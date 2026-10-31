const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');

dotenv.config();

const { dbAsync } = require('./db/index.cjs');
const { runMigrations } = require('./db/migrate.cjs');
const { createOwnerUser } = require('./services/authService.cjs');
const { setupWebSockets } = require('./realtime/websocket.cjs');
const { authMiddleware } = require('./middleware/authMiddleware.cjs');

const { v4: uuidv4 } = require('uuid');
const { securityHeadersMiddleware } = require('./middleware/securityHeadersMiddleware.cjs');
const { 
    authLoginLimiter, 
    authSignupLimiter, 
    searchLimiter, 
    communityWriteLimiter, 
    chatMessageLimiter 
} = require('./middleware/rateLimitMiddleware.cjs');

const authApi = require('./api/auth.cjs');
const accountApi = require('./api/account.cjs');
const ownerApi = require('./api/owner.cjs');
const cmsApi = require('./api/cms.cjs');
const socialApi = require('./api/social.cjs');
const chatApi = require('./api/chat.cjs');
const emulatorsApi = require('./api/emulators.cjs');
const supportApi = require('./api/support.cjs');
const submissionsApi = require('./api/submissions.cjs');
const callsApi = require('./api/calls.cjs');
const { expireStaleRequests } = require('./services/callService.cjs');

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '127.0.0.1';
const ROOT = path.join(__dirname, '..');

// Setup WS
setupWebSockets(server);

// Request ID & Correlation Logging Middleware
app.use((req, res, next) => {
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-Id', req.id);
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        if (req.path.startsWith('/api/') || duration > 500) {
            const status = res.statusCode;
            const logLine = `[REQ] ${req.id} ${req.method} ${req.originalUrl} ${status} ${duration}ms`;
            if (status >= 500) console.error(logLine);
            else if (status >= 400) console.warn(logLine);
            else if (process.env.NODE_ENV !== 'test') console.log(logLine);
        }
    });
    next();
});

// Security Headers & Cache-Control
app.use(securityHeadersMiddleware);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(authMiddleware);

// Maintenance Mode Middleware
app.use(async (req, res, next) => {
    try {
        if (
            req.path.startsWith('/owner') ||
            req.path.startsWith('/api/owner') ||
            req.path.startsWith('/api/auth') ||
            req.path === '/api/health' ||
            req.path === '/api/ready' ||
            req.path.startsWith('/assets/') ||
            req.path === '/favicon.ico' ||
            (req.user && req.user.role === 'OWNER')
        ) {
            return next();
        }

        const setting = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'maintenance_mode'");
        if (setting && (setting.value === 'true' || setting.value === '1')) {
            const reasonRow = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'maintenance_reason'");
            const reason = reasonRow ? reasonRow.value : 'NostalgicVerse is currently undergoing scheduled archival maintenance.';
            if (req.path.startsWith('/api/')) {
                return res.status(503).json({ error: reason, maintenance: true });
            }
            return res.status(503).send(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8"><title>Maintenance — NostalgicVerse</title>
                    <meta name="robots" content="noindex, nofollow">
                    <style>
                        body { background: #08080C; color: #F4F4F7; font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
                        .card { max-width: 500px; padding: 40px; background: #111118; border: 1px solid #1E1E2C; border-radius: 8px; }
                        h1 { color: #FFB300; font-size: 1.5rem; margin-bottom: 12px; }
                        p { color: #A7A7B5; line-height: 1.6; }
                    </style>
                </head>
                <body>
                    <div class="card">
                        <h1>Archival Maintenance</h1>
                        <p>${reason}</p>
                    </div>
                </body>
                </html>
            `);
        }
        next();
    } catch (e) {
        next();
    }
});

// Initialize Database Migrations & Owner Account
async function initDatabaseAndOwner() {
    try {
        await runMigrations();
    } catch (mErr) {
        console.error('Migration initialization error:', mErr);
    }
    const ownerUser = process.env.OWNER_USERNAME || 'owner';
    const ownerPass = process.env.OWNER_INITIAL_PASSWORD || 'changeme123';
    try {
        await createOwnerUser(ownerUser, ownerPass);
        console.log('Owner account initialized.');
    } catch (err) {
        console.error('Error initializing owner:', err);
    }
}
initDatabaseAndOwner();

// Rate Limiters mounted on sensitive endpoints
app.use('/api/auth/login', authLoginLimiter);
app.use('/api/auth/signup', authSignupLimiter);
app.use('/api/search', searchLimiter);
app.use('/api/community/comments', communityWriteLimiter);
app.use('/api/community/reviews', communityWriteLimiter);
app.use('/api/community/reactions', communityWriteLimiter);
app.use('/api/chat/conversations/:id/messages', chatMessageLimiter);

// API Routes
app.use('/api/auth', authApi);
app.use('/api/account', accountApi);
app.use('/api/owner', ownerApi);
app.use('/api/cms', cmsApi);
app.use('/api/users', socialApi);
app.use('/api/friends', (req, res, next) => {
    req.url = '/friends' + req.url;
    socialApi(req, res, next);
});
app.use('/api/chat', chatApi);
app.use('/api/conversations', (req, res, next) => {
    req.url = '/conversations' + req.url;
    chatApi(req, res, next);
});
app.use('/api/emulators', emulatorsApi);
app.use('/api/submissions', submissionsApi);
app.use('/api/support', supportApi);
app.use('/api/calls', callsApi);
app.use('/api/community', require('./api/community.cjs'));

// Periodic expiration of stale call requests (every 10 seconds)
setInterval(() => {
    expireStaleRequests().catch(err => {
        if (process.env.NODE_ENV !== 'test') console.warn('[CallService] Expiration error:', err.message);
    });
}, 10000).unref();

app.use('/api/content', require('./api/content.cjs'));
app.use('/api/search', require('./api/search.cjs'));
app.use('/api/discovery', require('./api/discovery.cjs'));
app.use('/api/analytics', require('./api/analytics.cjs'));
app.use('/api/business', require('./api/monetization.cjs'));
app.use('/api/monetization', require('./api/monetization.cjs'));

app.get('/api/health', async (req, res) => {
    try {
        const gamesCount = (await dbAsync.get('SELECT COUNT(*) as c FROM games')).c;
        const consolesCount = (await dbAsync.get('SELECT COUNT(*) as c FROM consoles')).c;
        const newsCount = (await dbAsync.get('SELECT COUNT(*) as c FROM news_articles')).c;
        res.json({
            status: 'healthy',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            counts: {
                games: gamesCount,
                consoles: consolesCount,
                news: newsCount
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message, requestId: req.id || null });
    }
});

// Readiness check: verifies database query execution, journal mode, and storage availability
app.get('/api/ready', async (req, res) => {
    try {
        await dbAsync.get('SELECT 1');
        const journal = await dbAsync.get('PRAGMA journal_mode');
        res.json({
            status: 'ready',
            checks: {
                database: 'ok',
                journalMode: journal ? journal.journal_mode.toUpperCase() : 'unknown',
                uptime: process.uptime()
            }
        });
    } catch (err) {
        res.status(503).json({
            status: 'not_ready',
            error: 'Database unavailable or locked',
            requestId: req.id || null
        });
    }
});

// Internal test mocks
app.post('/api/internal/generate-news', async (req, res) => {
    if (req.headers['x-internal-secret'] !== process.env.INTERNAL_API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const id = 'mock-' + Date.now();
    await dbAsync.run(`
        INSERT INTO news_articles (id, title, status) VALUES (?, ?, ?)
    `, [id, req.body?.topic || 'Test', 'held_for_review']);
    res.json({ article: { id, status: 'held_for_review' } });
});

app.post('/api/internal/approve-news', async (req, res) => {
    if (req.headers['x-internal-secret'] !== process.env.INTERNAL_API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    await dbAsync.run(`UPDATE news_articles SET status = 'PUBLISHED' WHERE id = ?`, [req.body.id]);
    res.json({ success: true, article: { id: req.body.id, status: 'published', approvedBy: req.body.reviewer } });
});

app.get('/api/news', async (req, res) => {
    try {
        const articles = await dbAsync.all("SELECT * FROM news_articles WHERE status = 'PUBLISHED' OR status = 'published' ORDER BY created_at DESC");
        res.json({ articles: articles || [] });
    } catch (e) {
        res.status(500).json({ error: 'Failed to fetch news' });
    }
});

app.post('/api/internal/audit-images', async (req, res) => {
    if (req.headers['x-internal-secret'] !== process.env.INTERNAL_API_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const limit = req.body.limit || 3;
    res.json({ audited: limit, healthPercentage: 100 });
});

// Root method validation (405 for non-GET/HEAD methods)
app.all('/', (req, res, next) => {
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
        res.setHeader('Allow', 'GET, HEAD');
        return res.status(405).send('Method Not Allowed');
    }
    next();
});

// Preserved Legacy Redirects & Asset Aliases
app.get(['/stories', '/stories/'], (req, res) => res.redirect(302, '/blog/'));
app.get(['/legal', '/legal/'], (req, res) => res.redirect(302, '/legal/privacy.html'));
app.get('/assets/images/branding/logo.svg', (req, res) => res.sendFile(path.join(ROOT, 'assets/images/branding/logo/logo.svg')));
app.get('/assets/images/branding/logo.png', (req, res) => res.sendFile(path.join(ROOT, 'assets/images/branding/logo/logo.png')));

// Fallback for static files
app.use(express.static(ROOT, {
    extensions: ['html']
}));

// SPA fallback for specific new routes if needed
app.get('/login', (req, res) => res.sendFile(path.join(ROOT, 'login/index.html')));
app.get('/signup', (req, res) => res.sendFile(path.join(ROOT, 'signup/index.html')));
app.use('/owner', (req, res) => res.sendFile(path.join(ROOT, 'owner/index.html')));

// Map /u/:username to the static shell created in /u/index.html
app.get('/u/:username', (req, res) => res.sendFile(path.join(ROOT, 'u/index.html')));

app.use((req, res) => {
    res.status(404).sendFile(path.join(ROOT, '404.html'));
});

// Centralized error handling: sanitized JSON without leaking stack traces to clients
app.use((err, req, res, next) => {
    const status = (err.status && typeof err.status === 'number') ? err.status : 500;
    if (status >= 500) {
        console.error(`[UNHANDLED_ERROR] ${req.id || 'no-id'}`, err);
    }
    res.status(status).json({
        error: status === 400 ? 'Bad request or malformed payload' : 'Internal server error',
        requestId: req.id || null
    });
});

let isShuttingDown = false;
function setupGracefulShutdown() {
    const shutdown = async (signal) => {
        if (isShuttingDown) return;
        isShuttingDown = true;
        console.log(`[SHUTDOWN] Received ${signal}, closing gracefully...`);
        server.close(async () => {
            console.log('[SHUTDOWN] HTTP server closed.');
            try {
                await dbAsync.close();
                console.log('[SHUTDOWN] SQLite connection closed.');
            } catch (e) {}
            process.exit(0);
        });
        setTimeout(() => {
            console.error('[SHUTDOWN] Force exiting after timeout');
            process.exit(1);
        }, 5000).unref();
    };

    if (process.env.NODE_ENV !== 'test') {
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        process.on('SIGINT', () => shutdown('SIGINT'));
    }
}
setupGracefulShutdown();

function startServer(port = PORT, host = HOST) {
    return new Promise((resolve, reject) => {
        server.listen(port, host, () => {
            console.log(`NostalgicVerse Server (Express) listening on http://${host}:${port}`);
            resolve(server);
        });
        server.on('error', reject);
    });
}

function stopServer() {
    return new Promise((resolve) => {
        server.close(() => resolve());
    });
}

if (require.main === module) {
    startServer().catch(err => {
        console.error('Fatal server startup error', err);
        process.exit(1);
    });
}

module.exports = {
    app,
    server,
    startServer,
    stopServer
};
