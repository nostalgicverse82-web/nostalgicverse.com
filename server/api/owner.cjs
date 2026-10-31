/**
 * NostalgicVerse — Enterprise Owner Command Center API (Phase 14)
 * =================================================================
 * Centralized, audited, and strictly authorized API supporting all 31
 * platform subsystems: Dashboard, Users, Profiles, Submissions, Ideas,
 * Games, Consoles, Stories, Guides, News, Timeline, Genres, Releases,
 * Compatibility, Media, SEO, Search, Comments, Reviews, Reports,
 * Moderation, Support, Analytics, Jobs, AI, Backups, Security, Business,
 * Ads, Settings, and Audit Trail.
 *
 * Direct arbitrary shell commands are strictly prohibited.
 */

'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { dbAsync } = require('../db/index.cjs');
const { requireAuth, requireOwner } = require('../middleware/authMiddleware.cjs');
const { broadcastToUser, broadcastToOwner, getOnlineUserCount } = require('../realtime/websocket.cjs');
const { enqueueJob, retryJob, cancelJob } = require('../automation/job-engine.cjs');
const { enqueueAITask, approveAIDraft, rejectAIDraft } = require('../automation/ai-engine.cjs');
const { hashPassword, verifyPassword } = require('../services/authService.cjs');
const mediaService = require('../services/mediaService.cjs');
const contentHealthService = require('../services/contentHealthService.cjs');
const newsService = require('../services/newsService.cjs');
const releaseService = require('../services/releaseService.cjs');
const relationshipService = require('../services/relationshipService.cjs');
const aiJobQueueService = require('../services/aiJobQueueService.cjs');
const sourceFetchService = require('../services/sourceFetchService.cjs');
const newsIntelligenceService = require('../services/newsIntelligenceService.cjs');
const gameDiscoveryService = require('../services/gameDiscoveryService.cjs');
const releaseMonitorService = require('../services/releaseMonitorService.cjs');
const { searchService } = require('../services/searchService.cjs');
const analyticsService = require('../services/analyticsService.cjs');
const seoService = require('../services/seoService.cjs');
const sitemapService = require('../services/sitemapService.cjs');
const aiKeyVault = require('../services/aiKeyVaultService.cjs');
const providerRegistry = require('../ai/providerRegistry.cjs');
const modelRegistry = require('../ai/modelRegistry.cjs');
const projectAgent = require('../services/projectAgentService.cjs');
const auditService = require('../services/auditService.cjs');

const router = express.Router();
router.use(requireAuth);
router.use(requireOwner);

const ROOT = path.resolve(__dirname, '../..');
const BACKUPS_DIR = path.join(ROOT, 'data/backups');

// Protected canonical assets that can never be modified or deleted via media workflows
const PROTECTED_ASSET_PREFIXES = [
    '/assets/images/profile-icons/',
    '/assets/images/consoles/',
    '/assets/images/support/qr-support'
];

function isProtectedAsset(assetPath) {
    if (!assetPath) return false;
    const normalized = assetPath.replace(/\\/g, '/');
    return PROTECTED_ASSET_PREFIXES.some(prefix => normalized.includes(prefix));
}

// Immutable Audit Logging Utility (Delegates to canonical auditService)
async function createAuditLog(actorId, action, entityType, entityId, result = 'SUCCESS', metadata = null) {
    return await auditService.createAuditLog(actorId, action, entityType, entityId, result, metadata);
}

// ======================================================================
// 1. OVERVIEW & STATS (Grouped metrics + time range + health + alerts)
// ======================================================================

router.get('/stats', async (req, res) => {
    try {
        const range = req.query.range || 'all'; // today, 7d, 30d, 90d, all
        let dateClause = '';
        if (range === 'today') dateClause = "AND created_at >= date('now', 'start of day')";
        else if (range === '7d') dateClause = "AND created_at >= date('now', '-7 days')";
        else if (range === '30d') dateClause = "AND created_at >= date('now', '-30 days')";
        else if (range === '90d') dateClause = "AND created_at >= date('now', '-90 days')";

        // Platform Cluster
        const totalUsers = (await dbAsync.get('SELECT COUNT(*) as c FROM users')).c;
        const onlineUsers = getOnlineUserCount ? getOnlineUserCount() : 1;
        const pendingSubmissions = (await dbAsync.get("SELECT COUNT(*) as c FROM submissions WHERE status = 'PENDING_REVIEW'")).c;
        const openTickets = (await dbAsync.get("SELECT COUNT(*) as c FROM support_tickets WHERE status = 'OPEN'")).c;

        // Content Cluster
        const publishedGames = (await dbAsync.get("SELECT COUNT(*) as c FROM games WHERE status = 'PUBLISHED'")).c;
        const publishedConsoles = (await dbAsync.get("SELECT COUNT(*) as c FROM consoles WHERE status = 'PUBLISHED'")).c;
        const publishedStories = (await dbAsync.get("SELECT COUNT(*) as c FROM stories")).c;
        const publishedGuides = (await dbAsync.get("SELECT COUNT(*) as c FROM guides")).c;
        const publishedNews = (await dbAsync.get("SELECT COUNT(*) as c FROM news_articles WHERE status = 'PUBLISHED'")).c;
        const totalReleases = (await dbAsync.get("SELECT COUNT(*) as c FROM releases")).c;
        const totalCompatibility = (await dbAsync.get("SELECT COUNT(*) as c FROM compatibility_records")).c;

        // Community Cluster
        const totalComments = (await dbAsync.get("SELECT COUNT(*) as c FROM comments WHERE deleted_at IS NULL")).c;
        const totalReviews = (await dbAsync.get("SELECT COUNT(*) as c FROM reviews WHERE status = 'PUBLISHED'")).c;
        const pendingReports = (await dbAsync.get("SELECT COUNT(*) as c FROM reports WHERE status = 'PENDING'")).c;
        const totalFriendships = (await dbAsync.get("SELECT COUNT(*) as c FROM friends")).c;

        // Queue Cluster
        const pendingJobs = (await dbAsync.get("SELECT COUNT(*) as c FROM jobs WHERE status IN ('QUEUED', 'RUNNING')")).c;
        const pendingAI = (await dbAsync.get("SELECT COUNT(*) as c FROM ai_queue WHERE status IN ('WAITING', 'PROCESSING', 'HELD')")).c;

        // System Cluster
        const dbPath = path.resolve(__dirname, '../../data/nostalgicverse.db');
        let databaseSize = '0 MB';
        if (fs.existsSync(dbPath)) {
            databaseSize = (fs.statSync(dbPath).size / (1024 * 1024)).toFixed(2) + ' MB';
        }
        const journalRow = await dbAsync.get("PRAGMA journal_mode");
        const walMode = journalRow ? journalRow.journal_mode.toUpperCase() : 'UNKNOWN';

        let searchIndexCount = 0;
        const searchPath = path.resolve(__dirname, '../../data/search-index.json');
        if (fs.existsSync(searchPath)) {
            try {
                const sData = JSON.parse(fs.readFileSync(searchPath, 'utf8'));
                searchIndexCount = Array.isArray(sData) ? sData.length : 0;
            } catch (e) {}
        }
        const mediaCount = (await dbAsync.get("SELECT COUNT(*) as c FROM game_images")).c;

        // Recent Real Activity
        const recentSub = await dbAsync.all("SELECT 'New submission: ' || title as event, created_at, 'SUBMISSION' as type FROM submissions ORDER BY created_at DESC LIMIT 5");
        const recentUser = await dbAsync.all("SELECT 'New registration: @' || username as event, created_at, 'USER' as type FROM users WHERE role != 'OWNER' ORDER BY created_at DESC LIMIT 5");
        const recentAudit = await dbAsync.all("SELECT action || ' on ' || entity_type as event, created_at, 'AUDIT' as type FROM audit_logs ORDER BY created_at DESC LIMIT 5");
        const recentActivity = [...recentSub, ...recentUser, ...recentAudit];
        recentActivity.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        res.json({
            range,
            platform: {
                totalUsers,
                onlineUsers,
                pendingSubmissions,
                openTickets
            },
            content: {
                publishedGames,
                publishedConsoles,
                publishedStories,
                publishedGuides,
                publishedNews,
                totalReleases,
                totalCompatibility
            },
            community: {
                totalComments,
                totalReviews,
                pendingReports,
                totalFriendships
            },
            queue: {
                pendingSubmissions,
                openTickets,
                pendingReports,
                pendingJobs,
                pendingAI
            },
            system: {
                databaseSize,
                walMode,
                realtimeStatus: 'Online (Connected)',
                searchIndexCount,
                mediaCount
            },
            activity: recentActivity.slice(0, 10)
        });
    } catch (err) {
        console.error('[OWNER_STATS_ERR]', err);
        res.status(500).json({ error: err.message });
    }
});

// System Health Probe
router.get('/health', async (req, res) => {
    try {
        const startDb = Date.now();
        await dbAsync.get('SELECT 1');
        const dbLatency = Date.now() - startDb;

        const integrity = await dbAsync.get('PRAGMA integrity_check');
        const journal = await dbAsync.get('PRAGMA journal_mode');
        const onlineCount = getOnlineUserCount ? getOnlineUserCount() : 1;

        const searchPath = path.resolve(__dirname, '../../data/search-index.json');
        let searchHealthy = fs.existsSync(searchPath);

        const queuedJobs = (await dbAsync.get("SELECT COUNT(*) as c FROM jobs WHERE status = 'QUEUED'")).c;
        const failedJobs = (await dbAsync.get("SELECT COUNT(*) as c FROM jobs WHERE status = 'FAILED'")).c;

        res.json({
            status: integrity?.integrity_check === 'ok' ? 'HEALTHY' : 'DEGRADED',
            checks: {
                server: { status: 'HEALTHY', uptime: process.uptime(), memory: process.memoryUsage().rss },
                database: { status: integrity?.integrity_check === 'ok' ? 'HEALTHY' : 'DEGRADED', latencyMs: dbLatency, journalMode: journal?.journal_mode?.toUpperCase() },
                realtime: { status: 'HEALTHY', onlineUsers: onlineCount },
                search: { status: searchHealthy ? 'HEALTHY' : 'DEGRADED' },
                jobs: { status: failedJobs > 0 ? 'DEGRADED' : 'HEALTHY', queued: queuedJobs, failed: failedJobs }
            }
        });
    } catch (err) {
        res.status(500).json({ status: 'FAILED', error: err.message });
    }
});

// Actionable Alert Center
router.get('/alerts', async (req, res) => {
    try {
        const alerts = [];

        // Check pending reports
        const openReports = (await dbAsync.get("SELECT COUNT(*) as c FROM reports WHERE status = 'PENDING'")).c;
        if (openReports > 0) {
            alerts.push({ id: 'alert-reports', severity: 'WARNING', title: `${openReports} Pending Community Report(s)`, message: 'Unresolved community reports requiring moderator inspection.', link: '/owner/reports' });
        }

        // Check failed jobs
        const failedJobs = (await dbAsync.get("SELECT COUNT(*) as c FROM jobs WHERE status = 'FAILED'")).c;
        if (failedJobs > 0) {
            alerts.push({ id: 'alert-jobs', severity: 'CRITICAL', title: `${failedJobs} Background Job(s) Failed`, message: 'One or more allowlisted jobs encountered execution errors.', link: '/owner/jobs' });
        }

        // Check unverified media
        const unverifiedMedia = (await dbAsync.get("SELECT COUNT(*) as c FROM game_images WHERE verification_status != 'VERIFIED' OR verification_status IS NULL")).c;
        if (unverifiedMedia > 50) {
            alerts.push({ id: 'alert-media', severity: 'INFO', title: `${unverifiedMedia} Unverified Game Images`, message: 'Media assets require automated verification or manual curation.', link: '/owner/media' });
        }

        // Check open tickets
        const openTickets = (await dbAsync.get("SELECT COUNT(*) as c FROM support_tickets WHERE status = 'OPEN'")).c;
        if (openTickets > 0) {
            alerts.push({ id: 'alert-support', severity: 'INFO', title: `${openTickets} Open Support Ticket(s)`, message: 'Visitor requests waiting in the helpdesk inbox.', link: '/owner/support' });
        }

        res.json({ alerts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Notification Center (Section 28)
router.get('/notifications', async (req, res) => {
    try {
        const filter = (req.query.status || 'all').toLowerCase();
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 20;
        const offset = (page - 1) * limit;

        const conditions = ['(user_id = ? OR user_id IS NULL)'];
        const params = [req.user.id];

        if (filter === 'unread') {
            conditions.push('is_read = 0 AND is_archived = 0');
        } else if (filter === 'read') {
            conditions.push('is_read = 1 AND is_archived = 0');
        } else if (filter === 'archived') {
            conditions.push('is_archived = 1');
        } else {
            // 'all' excludes archived unless requested
            conditions.push('is_archived = 0');
        }

        const whereClause = 'WHERE ' + conditions.join(' AND ');
        const countRow = await dbAsync.get(`SELECT COUNT(*) as c FROM notifications ${whereClause}`, params);
        const unreadRow = await dbAsync.get('SELECT COUNT(*) as c FROM notifications WHERE (user_id = ? OR user_id IS NULL) AND is_read = 0 AND is_archived = 0', [req.user.id]);
        
        const notifications = await dbAsync.all(`
            SELECT * FROM notifications 
            ${whereClause} 
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        res.json({
            notifications,
            total: countRow ? countRow.c : 0,
            unreadCount: unreadRow ? unreadRow.c : 0,
            page,
            limit
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/notifications/:id/read', async (req, res) => {
    try {
        await dbAsync.run('UPDATE notifications SET is_read = 1 WHERE id = ?', [req.params.id]);
        res.json({ success: true, id: req.params.id, is_read: 1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/notifications/:id/archive', async (req, res) => {
    try {
        await dbAsync.run('UPDATE notifications SET is_archived = 1 WHERE id = ?', [req.params.id]);
        res.json({ success: true, id: req.params.id, is_archived: 1 });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/notifications/mark-all-read', async (req, res) => {
    try {
        await dbAsync.run('UPDATE notifications SET is_read = 1 WHERE user_id = ? OR user_id IS NULL', [req.user.id]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/notifications', async (req, res) => {
    try {
        const { type = 'SYSTEM_ALERT', message, referenceId = null, severity = 'INFO' } = req.body;
        if (!message) return res.status(400).json({ error: 'Message is required' });

        const id = uuidv4();
        await dbAsync.run(`
            INSERT INTO notifications (id, user_id, type, reference_id, message, is_read, is_archived, severity, created_at)
            VALUES (?, ?, ?, ?, ?, 0, 0, ?, CURRENT_TIMESTAMP)
        `, [id, req.user.id, type, referenceId, message, severity]);

        res.json({ success: true, notification: { id, type, message, severity } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Global Owner Search (Section 30 - Grouped by Category)
router.get('/search', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (!q) return res.json({ results: [], grouped: { games: [], consoles: [], articles: [], users: [], tickets: [], media: [], jobs: [] } });

        const wildcard = `%${q}%`;
        const [users, games, consoles, stories, guides, news, tickets, media, aiJobs, bgJobs] = await Promise.all([
            dbAsync.all('SELECT id, username, display_name, email, role, status FROM users WHERE username LIKE ? OR display_name LIKE ? OR email LIKE ? LIMIT 6', [wildcard, wildcard, wildcard]),
            dbAsync.all('SELECT id, title, slug, platforms, genre, status FROM games WHERE title LIKE ? OR slug LIKE ? LIMIT 6', [wildcard, wildcard]),
            dbAsync.all('SELECT id, name as title, slug, generation, status FROM consoles WHERE name LIKE ? OR slug LIKE ? LIMIT 6', [wildcard, wildcard]),
            dbAsync.all('SELECT id, title, slug, excerpt as category FROM stories WHERE title LIKE ? OR slug LIKE ? LIMIT 4', [wildcard, wildcard]),
            dbAsync.all('SELECT id, title, slug, excerpt as category FROM guides WHERE title LIKE ? OR slug LIKE ? LIMIT 4', [wildcard, wildcard]),
            dbAsync.all('SELECT id, title, slug FROM news_articles WHERE title LIKE ? OR slug LIKE ? LIMIT 4', [wildcard, wildcard]),
            dbAsync.all('SELECT id, subject as title, status, priority FROM support_tickets WHERE subject LIKE ? LIMIT 6', [wildcard]),
            dbAsync.all('SELECT id, game_id, image_type, image_url as file_path FROM game_images WHERE game_id LIKE ? OR image_url LIKE ? LIMIT 6', [wildcard, wildcard]),
            dbAsync.all('SELECT id, job_type, prompt, status FROM ai_jobs WHERE prompt LIKE ? OR job_type LIKE ? LIMIT 4', [wildcard, wildcard]),
            dbAsync.all('SELECT id, job_type, status FROM jobs WHERE job_type LIKE ? LIMIT 4', [wildcard])
        ]);

        const articles = [
            ...stories.map(s => ({ ...s, subtype: 'Story' })),
            ...guides.map(g => ({ ...g, subtype: 'Guide' })),
            ...news.map(n => ({ ...n, subtype: 'News' }))
        ];

        const jobs = [
            ...aiJobs.map(j => ({ id: j.id, title: `AI: ${j.job_type}`, status: j.status, subtitle: (j.prompt || '').slice(0, 40) })),
            ...bgJobs.map(j => ({ id: j.id, title: `Job: ${j.job_type}`, status: j.status, subtitle: j.job_type }))
        ];

        const grouped = {
            games: games.map(g => ({ type: 'GAME', id: g.id, title: g.title, slug: g.slug, subtitle: `${g.genre || 'Game'} • ${g.status}` })),
            consoles: consoles.map(c => ({ type: 'CONSOLE', id: c.id, title: c.title, slug: c.slug, subtitle: `Console • Gen ${c.generation || 'N/A'}` })),
            articles: articles.map(a => ({ type: 'ARTICLE', id: a.id, title: a.title, slug: a.slug, subtitle: a.subtype })),
            users: users.map(u => ({ type: 'USER', id: u.id, title: `@${u.username} (${u.display_name})`, subtitle: `${u.role} • ${u.status || 'ACTIVE'}` })),
            tickets: tickets.map(t => ({ type: 'TICKET', id: t.id, title: t.title, subtitle: `${t.status} • ${t.priority}` })),
            media: media.map(m => ({ type: 'MEDIA', id: m.id, title: m.game_id, subtitle: m.image_type || 'image' })),
            jobs
        };

        const results = [
            ...grouped.games,
            ...grouped.consoles,
            ...grouped.articles,
            ...grouped.users,
            ...grouped.tickets,
            ...grouped.media,
            ...grouped.jobs
        ];

        res.json({ grouped, results });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Dedicated Analytics Aggregation
router.get('/analytics', async (req, res) => {
    try {
        const range = req.query.range || '30d';
        const totalUsers = (await dbAsync.get('SELECT COUNT(*) as c FROM users')).c;
        const activeUsers = (await dbAsync.get("SELECT COUNT(*) as c FROM users WHERE status = 'ACTIVE' OR status IS NULL")).c;
        const suspendedUsers = (await dbAsync.get("SELECT COUNT(*) as c FROM users WHERE status = 'SUSPENDED'")).c;

        const totalGames = (await dbAsync.get('SELECT COUNT(*) as c FROM games')).c;
        const totalConsoles = (await dbAsync.get('SELECT COUNT(*) as c FROM consoles')).c;
        const totalStories = (await dbAsync.get('SELECT COUNT(*) as c FROM stories')).c;
        const totalGuides = (await dbAsync.get('SELECT COUNT(*) as c FROM guides')).c;

        const totalComments = (await dbAsync.get('SELECT COUNT(*) as c FROM comments')).c;
        const totalReviews = (await dbAsync.get('SELECT COUNT(*) as c FROM reviews')).c;
        const totalFavorites = (await dbAsync.get('SELECT COUNT(*) as c FROM favorites')).c;

        // Daily user registrations (actual data from users table)
        const registrations = await dbAsync.all(`
            SELECT date(created_at) as day, COUNT(*) as count 
            FROM users 
            GROUP BY date(created_at) 
            ORDER BY day DESC 
            LIMIT 30
        `);

        res.json({
            users: { total: totalUsers, active: activeUsers, suspended: suspendedUsers, registrations },
            content: { games: totalGames, consoles: totalConsoles, stories: totalStories, guides: totalGuides },
            engagement: { comments: totalComments, reviews: totalReviews, favorites: totalFavorites }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phase 17: Platform Overview Analytics
router.get('/analytics/overview', async (req, res) => {
    try {
        const range = (req.query.range || '30d').toLowerCase();
        const data = await analyticsService.getOverviewAnalytics(range);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phase 17: Search Analytics
router.get('/analytics/search', async (req, res) => {
    try {
        const range = (req.query.range || '30d').toLowerCase();
        const data = await analyticsService.getSearchAnalytics(range);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phase 17: Discovery Analytics
router.get('/analytics/discovery', async (req, res) => {
    try {
        const range = (req.query.range || '30d').toLowerCase();
        const data = await analyticsService.getDiscoveryAnalytics(range);
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Analytics Export (Section 9 - CSV and JSON formats across 24h, 7d, 30d, 90d, all)
router.get('/analytics/export', async (req, res) => {
    try {
        const range = (req.query.range || '30d').toLowerCase();
        const format = (req.query.format || 'json').toLowerCase();

        let days = 30;
        if (range === '24h' || range === 'today') days = 1;
        else if (range === '7d') days = 7;
        else if (range === '30d') days = 30;
        else if (range === '90d') days = 90;
        else if (range === 'all') days = 3650;

        const dateFilter = `created_at >= datetime('now', '-' || ${days} || ' days')`;

        // Gather real instrumentation metrics
        const [
            totalUsers,
            periodUsers,
            totalGames,
            totalConsoles,
            totalStories,
            pageViews,
            uniqueVisitors,
            totalSearches,
            aiCompletedJobs,
            aiFailedJobs,
            openTickets,
            totalComments,
            totalReviews
        ] = await Promise.all([
            dbAsync.get('SELECT COUNT(*) as c FROM users').then(r => r?.c || 0),
            dbAsync.get(`SELECT COUNT(*) as c FROM users WHERE ${dateFilter}`).then(r => r?.c || 0),
            dbAsync.get('SELECT COUNT(*) as c FROM games WHERE status="PUBLISHED"').then(r => r?.c || 0),
            dbAsync.get('SELECT COUNT(*) as c FROM consoles WHERE status="PUBLISHED"').then(r => r?.c || 0),
            dbAsync.get('SELECT COUNT(*) as c FROM stories').then(r => r?.c || 0),
            dbAsync.get(`SELECT COUNT(*) as c FROM analytics_events WHERE ${dateFilter}`).then(r => r?.c || 0),
            dbAsync.get(`SELECT COUNT(DISTINCT session_id) as c FROM analytics_events WHERE ${dateFilter} AND session_id IS NOT NULL`).then(r => r?.c || 0),
            dbAsync.get(`SELECT COUNT(*) as c FROM analytics_events WHERE event_name='search' AND ${dateFilter}`).then(r => r?.c || 0),
            dbAsync.get(`SELECT COUNT(*) as c FROM ai_jobs WHERE status='COMPLETED' AND ${dateFilter}`).then(r => r?.c || 0),
            dbAsync.get(`SELECT COUNT(*) as c FROM ai_jobs WHERE status='FAILED' AND ${dateFilter}`).then(r => r?.c || 0),
            dbAsync.get('SELECT COUNT(*) as c FROM support_tickets WHERE status="OPEN"').then(r => r?.c || 0),
            dbAsync.get(`SELECT COUNT(*) as c FROM comments WHERE deleted_at IS NULL AND ${dateFilter}`).then(r => r?.c || 0),
            dbAsync.get(`SELECT COUNT(*) as c FROM reviews WHERE status="PUBLISHED" AND ${dateFilter}`).then(r => r?.c || 0)
        ]);

        const metrics = [
            { category: 'Platform', metric: 'Total Registered Users', value: totalUsers },
            { category: 'Platform', metric: `New Users (${range})`, value: periodUsers },
            { category: 'Content', metric: 'Published Games Catalogue', value: totalGames },
            { category: 'Content', metric: 'Hardware Consoles', value: totalConsoles },
            { category: 'Content', metric: 'Historical Stories', value: totalStories },
            { category: 'Traffic', metric: `Total Page Views (${range})`, value: pageViews },
            { category: 'Traffic', metric: `Unique Visitors (${range})`, value: uniqueVisitors },
            { category: 'Search', metric: `Total Searches Executed (${range})`, value: totalSearches },
            { category: 'AI Automation', metric: `Completed AI Jobs (${range})`, value: aiCompletedJobs },
            { category: 'AI Automation', metric: `Failed AI Jobs (${range})`, value: aiFailedJobs },
            { category: 'Support', metric: 'Currently Open Tickets', value: openTickets },
            { category: 'Community', metric: `Comments Posted (${range})`, value: totalComments },
            { category: 'Community', metric: `Reviews Submitted (${range})`, value: totalReviews }
        ];

        if (format === 'csv') {
            const csvRows = [
                'Category,Metric,Value,Period,ExportedAt'
            ];
            const now = new Date().toISOString();
            for (const m of metrics) {
                csvRows.push(`"${m.category}","${m.metric}",${m.value},"${range}","${now}"`);
            }
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="nostalgicverse-analytics-${range}.csv"`);
            return res.send(csvRows.join('\r\n'));
        }

        res.setHeader('Content-Disposition', `attachment; filename="nostalgicverse-analytics-${range}.json"`);
        res.json({
            range,
            exportedAt: new Date().toISOString(),
            metrics,
            summary: {
                pageViews,
                uniqueVisitors,
                newUsers: periodUsers,
                totalGames,
                totalConsoles,
                aiCompletedJobs,
                aiFailedJobs
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phase 17: Search Index Health Audit
router.get('/search/health', async (req, res) => {
    try {
        const health = await searchService.validateIndex();
        res.json(health);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phase 17: Trigger Full Search Index Rebuild
router.post('/search/rebuild', async (req, res) => {
    try {
        const job = await enqueueJob('SEARCH_REBUILD', {}, req.user.username);
        await createAuditLog(req.user.id, 'TRIGGER_SEARCH_REBUILD', 'job', job.id, 'SUCCESS');
        res.json({ success: true, job });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phase 17: SEO Health Overview (Latest Audit)
router.get('/seo/health', async (req, res) => {
    try {
        const latest = await dbAsync.get(`
            SELECT * FROM seo_health_audits 
            ORDER BY started_at DESC 
            LIMIT 1
        `);
        if (!latest) {
            return res.json({ status: 'NO_AUDITS_YET', pagesAudited: 0, issuesFound: 0, details: null });
        }
        res.json({
            ...latest,
            details: latest.details_json ? JSON.parse(latest.details_json) : null
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phase 17: Trigger Automated SEO Health Audit
router.post('/seo/audit', async (req, res) => {
    try {
        const result = await seoService.runSeoHealthAudit();
        res.json({ success: true, audit: result, ...result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phase 17: Trigger Sitemap Rebuild
router.post('/sitemap/rebuild', async (req, res) => {
    try {
        const job = await enqueueJob('SITEMAP_REBUILD', {}, req.user.username);
        await createAuditLog(req.user.id, 'TRIGGER_SITEMAP_REBUILD', 'job', job.id, 'SUCCESS');
        res.json({ success: true, job });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 2. USER MANAGEMENT & PROFILES (Search, Filter, Suspend, Restore, Warn)
// ======================================================================

router.get('/users', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        const role = (req.query.role || '').trim();
        const status = (req.query.status || '').trim();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const offset = (page - 1) * limit;

        const conditions = [];
        const params = [];

        if (q) {
            conditions.push('(username LIKE ? OR display_name LIKE ? OR email LIKE ?)');
            const wildcard = `%${q}%`;
            params.push(wildcard, wildcard, wildcard);
        }
        if (role) {
            conditions.push('role = ?');
            params.push(role);
        }
        if (status) {
            conditions.push('status = ?');
            params.push(status);
        }

        const whereSql = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const countRow = await dbAsync.get(`SELECT COUNT(*) as total FROM users ${whereSql}`, params);
        const total = countRow ? countRow.total : 0;

        const users = await dbAsync.all(`
            SELECT id, username, display_name, email, role, avatar_id, bio, status, is_disabled, created_at, last_login_at
            FROM users
            ${whereSql}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        res.json({ users, total, page, limit });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/users/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await dbAsync.get(`
            SELECT id, username, display_name, email, role, avatar_id, bio, status, is_disabled, created_at, last_login_at
            FROM users WHERE id = ?
        `, [userId]);

        if (!user) return res.status(404).json({ error: 'User not found' });

        const submissionsCount = (await dbAsync.get('SELECT COUNT(*) as c FROM submissions WHERE user_id = ?', [userId])).c;
        const ticketsCount = (await dbAsync.get('SELECT COUNT(*) as c FROM support_tickets WHERE user_id = ?', [userId])).c;
        const reportsCount = (await dbAsync.get("SELECT COUNT(*) as c FROM reports WHERE target_type = 'USER' AND target_id = ?", [userId])).c;
        const commentsCount = (await dbAsync.get('SELECT COUNT(*) as c FROM comments WHERE user_id = ?', [userId])).c;
        const reviewsCount = (await dbAsync.get('SELECT COUNT(*) as c FROM reviews WHERE user_id = ?', [userId])).c;

        res.json({
            user,
            metrics: {
                submissionsCount,
                ticketsCount,
                reportsCount,
                commentsCount,
                reviewsCount
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/users/:id/suspend', async (req, res) => {
    try {
        const userId = req.params.id;
        const { reason, duration, internalNote } = req.body;

        const targetUser = await dbAsync.get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!targetUser) return res.status(404).json({ error: 'User not found' });
        if (targetUser.role === 'OWNER') return res.status(403).json({ error: 'Cannot suspend owner account' });

        await dbAsync.run(`
            UPDATE users 
            SET status = 'SUSPENDED', is_disabled = 1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [userId]);

        await createAuditLog(req.user.id, 'SUSPEND_USER', 'user', userId, 'SUCCESS', {
            username: targetUser.username,
            reason: reason || 'Violation of community terms',
            duration: duration || 'indefinite',
            internalNote
        });

        // Notify user if online
        broadcastToUser(userId, {
            type: 'ACCOUNT_SUSPENDED',
            message: 'Your account has been suspended by an administrator.'
        });

        res.json({ success: true, status: 'SUSPENDED' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/users/:id/restore', async (req, res) => {
    try {
        const userId = req.params.id;
        const targetUser = await dbAsync.get('SELECT * FROM users WHERE id = ?', [userId]);
        if (!targetUser) return res.status(404).json({ error: 'User not found' });

        await dbAsync.run(`
            UPDATE users 
            SET status = 'ACTIVE', is_disabled = 0, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [userId]);

        await createAuditLog(req.user.id, 'RESTORE_USER', 'user', userId, 'SUCCESS', {
            username: targetUser.username
        });

        res.json({ success: true, status: 'ACTIVE' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/users/:id/warn', async (req, res) => {
    try {
        const userId = req.params.id;
        const { reason } = req.body;
        if (!reason) return res.status(400).json({ error: 'Warning reason required' });

        const notifId = uuidv4();
        const msg = `Official Administrator Warning: ${reason}`;
        await dbAsync.run(`
            INSERT INTO notifications (id, user_id, type, message, created_at)
            VALUES (?, ?, 'SYSTEM_WARNING', ?, CURRENT_TIMESTAMP)
        `, [notifId, userId, msg]);

        broadcastToUser(userId, {
            type: 'NOTIFICATION',
            notification: { id: notifId, type: 'SYSTEM_WARNING', message: msg, created_at: new Date().toISOString() }
        });

        await createAuditLog(req.user.id, 'WARN_USER', 'user', userId, 'SUCCESS', { reason });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 3. SUBMISSIONS CENTER (Review, Approve, Enhancement, Reject)
// ======================================================================

router.get('/submissions', async (req, res) => {
    try {
        const status = (req.query.status || '').trim();
        const type = (req.query.type || '').trim();
        const conditions = [];
        const params = [];

        if (status) {
            conditions.push('s.status = ?');
            params.push(status);
        }
        if (type) {
            conditions.push('s.submission_type = ?');
            params.push(type);
        }

        const whereSql = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const submissions = await dbAsync.all(`
            SELECT s.*, u.username, u.display_name, u.avatar_id
            FROM submissions s
            JOIN users u ON s.user_id = u.id
            ${whereSql}
            ORDER BY s.created_at DESC
        `, params);

        res.json({ submissions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/submissions/:id', async (req, res) => {
    try {
        const sub = await dbAsync.get(`
            SELECT s.*, u.username, u.display_name, u.avatar_id
            FROM submissions s
            JOIN users u ON s.user_id = u.id
            WHERE s.id = ?
        `, [req.params.id]);

        if (!sub) return res.status(404).json({ error: 'Submission not found' });
        res.json({ submission: sub });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/submissions/:id/review', async (req, res) => {
    try {
        const { status, reviewNotes } = req.body;
        const subId = req.params.id;

        const sub = await dbAsync.get('SELECT * FROM submissions WHERE id = ?', [subId]);
        if (!sub) return res.status(404).json({ error: 'Submission not found' });

        await dbAsync.run('BEGIN TRANSACTION');

        await dbAsync.run(`
            UPDATE submissions 
            SET status = ?, review_notes = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [status, reviewNotes || null, req.user.id, subId]);

        // Push to canonical content if approved
        if (status === 'APPROVED') {
            const newId = uuidv4();
            const slug = sub.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

            if (sub.submission_type === 'GAME') {
                await dbAsync.run(`
                    INSERT INTO games (id, slug, title, description, status, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [newId, slug, sub.title, sub.description]);
            } else if (sub.submission_type === 'CONSOLE') {
                await dbAsync.run(`
                    INSERT INTO consoles (id, slug, name, description, status, created_at, updated_at) 
                    VALUES (?, ?, ?, ?, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                `, [newId, slug, sub.title, sub.description]);
            }
        }

        // Notify submitting user
        const notifId = uuidv4();
        let actionWord = status.toLowerCase().replace(/_/g, ' ');
        const msg = `Your submission "${sub.title}" was ${actionWord}.`;
        await dbAsync.run(`
            INSERT INTO notifications (id, user_id, type, reference_id, message, created_at)
            VALUES (?, ?, 'SUBMISSION_REVIEWED', ?, ?, CURRENT_TIMESTAMP)
        `, [notifId, sub.user_id, subId, msg]);

        broadcastToUser(sub.user_id, {
            type: 'NOTIFICATION',
            notification: { id: notifId, type: 'SUBMISSION_REVIEWED', message: msg, created_at: new Date().toISOString() }
        });

        await createAuditLog(req.user.id, `REVIEW_SUBMISSION_${status}`, 'submission', subId, 'SUCCESS', {
            title: sub.title,
            status,
            notes: reviewNotes || null
        });

        await dbAsync.run('COMMIT');
        res.json({ success: true, status });
    } catch (err) {
        await dbAsync.run('ROLLBACK').catch(() => {});
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 4. CONTENT CMS (Games, Consoles, Stories, Guides, News, Timeline, Genres)
// ======================================================================

const VALID_CONTENT_TYPES = [
    'games', 'consoles', 'stories', 'guides', 'news_articles', 
    'timeline_events', 'genres', 'releases', 'compatibility_records'
];

router.get('/content/:type', async (req, res) => {
    const { type } = req.params;
    if (!VALID_CONTENT_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid content type' });

    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        let items = [];
        let total = 0;

        const countRow = await dbAsync.get(`SELECT COUNT(*) as c FROM ${type}`);
        total = countRow ? countRow.c : 0;

        if (type === 'games') {
            items = await dbAsync.all(`SELECT id, title, slug, status, release_year, developer, publisher FROM games ORDER BY title ASC LIMIT ? OFFSET ?`, [limit, offset]);
        } else if (type === 'consoles') {
            items = await dbAsync.all(`SELECT id, name as title, slug, status, release_year, manufacturer FROM consoles ORDER BY name ASC LIMIT ? OFFSET ?`, [limit, offset]);
        } else if (type === 'timeline_events') {
            items = await dbAsync.all(`SELECT id, title, year, status FROM timeline_events ORDER BY year DESC LIMIT ? OFFSET ?`, [limit, offset]);
        } else if (type === 'genres') {
            items = await dbAsync.all(`SELECT id, name as title, slug, status FROM genres ORDER BY name ASC LIMIT ? OFFSET ?`, [limit, offset]);
        } else if (type === 'news_articles') {
            items = await dbAsync.all(`SELECT id, title, slug, status, factual_status, published_date FROM news_articles ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
        } else {
            items = await dbAsync.all(`SELECT id, title, status FROM ${type} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
        }

        res.json({ items, total, page, limit });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/content/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    if (!VALID_CONTENT_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid content type' });

    try {
        const item = await dbAsync.get(`SELECT * FROM ${type} WHERE id = ?`, [id]);
        if (!item) return res.status(404).json({ error: 'Content item not found' });
        res.json({ item });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/content/:type', async (req, res) => {
    const { type } = req.params;
    if (!VALID_CONTENT_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid content type' });

    const id = uuidv4();
    const data = { ...req.body, id };

    const keys = Object.keys(data);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => data[k]);

    try {
        await dbAsync.run(`INSERT INTO ${type} (${keys.join(', ')}) VALUES (${placeholders})`, values);

        // Snapshot initial version
        await dbAsync.run(`
            INSERT INTO content_versions (id, entity_type, entity_id, content, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [uuidv4(), type, id, JSON.stringify(data), req.user.id]);

        await createAuditLog(req.user.id, `CREATE_${type.toUpperCase()}`, type, id, 'SUCCESS', { title: data.title || data.name });
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.put('/content/:type/:id', async (req, res) => {
    const { type, id } = req.params;
    if (!VALID_CONTENT_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid content type' });

    const data = { ...req.body };
    delete data.id; // protect identity

    // Optimistic Concurrency Check: client can pass expected_updated_at
    if (data.expected_updated_at) {
        const current = await dbAsync.get(`SELECT updated_at FROM ${type} WHERE id = ?`, [id]);
        if (current && current.updated_at && current.updated_at !== data.expected_updated_at) {
            return res.status(409).json({ error: 'Conflict: Stale update detected. Content was modified by another operator.' });
        }
        delete data.expected_updated_at;
    }

    data.updated_at = new Date().toISOString();

    const keys = Object.keys(data);
    const assignments = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => data[k]);
    values.push(id);

    try {
        await dbAsync.run(`UPDATE ${type} SET ${assignments} WHERE id = ?`, values);

        // Snapshot revision into content_versions
        await dbAsync.run(`
            INSERT INTO content_versions (id, entity_type, entity_id, content, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [uuidv4(), type, id, JSON.stringify(data), req.user.id]);

        await createAuditLog(req.user.id, `UPDATE_${type.toUpperCase()}`, type, id, 'SUCCESS');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Version History & Restoration
router.get('/content/:type/:id/versions', async (req, res) => {
    const { type, id } = req.params;
    try {
        const versions = await dbAsync.all(`
            SELECT v.id, v.created_at, v.created_by, u.username as author_username
            FROM content_versions v
            LEFT JOIN users u ON v.created_by = u.id
            WHERE v.entity_type = ? AND v.entity_id = ?
            ORDER BY v.created_at DESC
        `, [type, id]);
        res.json({ versions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/content/:type/:id/restore-version', async (req, res) => {
    const { type, id } = req.params;
    const { versionId } = req.body;
    try {
        const versionRecord = await dbAsync.get('SELECT * FROM content_versions WHERE id = ? AND entity_id = ?', [versionId, id]);
        if (!versionRecord) return res.status(404).json({ error: 'Version not found' });

        const snapshotData = JSON.parse(versionRecord.content);
        delete snapshotData.id;
        snapshotData.updated_at = new Date().toISOString();

        const keys = Object.keys(snapshotData);
        const assignments = keys.map(k => `${k} = ?`).join(', ');
        const values = keys.map(k => snapshotData[k]);
        values.push(id);

        await dbAsync.run(`UPDATE ${type} SET ${assignments} WHERE id = ?`, values);

        // Snapshot new version marking restoration
        await dbAsync.run(`
            INSERT INTO content_versions (id, entity_type, entity_id, content, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [uuidv4(), type, id, JSON.stringify(snapshotData), req.user.id]);

        await createAuditLog(req.user.id, `RESTORE_VERSION_${type.toUpperCase()}`, type, id, 'SUCCESS', { restoredFrom: versionId });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Content Health Audit & Management
router.get('/content-health', async (req, res) => {
    try {
        const severity = (req.query.severity || '').trim().toUpperCase();
        const status = (req.query.status || 'OPEN').trim().toUpperCase();
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 50;
        const offset = (page - 1) * limit;

        const summary = await contentHealthService.getHealthSummary();

        let sql = 'SELECT * FROM content_health_issues WHERE 1=1';
        const params = [];

        if (status && status !== 'ALL') {
            sql += ' AND status = ?';
            params.push(status);
        }
        if (severity && severity !== 'ALL') {
            sql += ' AND severity = ?';
            params.push(severity);
        }

        const countRow = await dbAsync.get(sql.replace('SELECT *', 'SELECT COUNT(*) as c'), params);
        sql += ' ORDER BY CASE severity WHEN "CRITICAL" THEN 1 WHEN "WARNING" THEN 2 ELSE 3 END, created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const issues = await dbAsync.all(sql, params);

        res.json({
            summary,
            total: countRow ? countRow.c : 0,
            page,
            limit,
            issues
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/content-health/audit', async (req, res) => {
    try {
        const summary = await contentHealthService.runHealthAudit();
        res.json({ success: true, summary });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/content-health/ignore', async (req, res) => {
    try {
        const { issueId, reason } = req.body;
        if (!issueId || !reason) return res.status(400).json({ error: 'issueId and reason required' });

        const result = await contentHealthService.ignoreIssue(issueId, req.user.id, reason);
        await createAuditLog(req.user.id, 'IGNORE_HEALTH_ISSUE', 'content_health', issueId, 'SUCCESS', { reason });
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/content-health/recheck', async (req, res) => {
    try {
        const { entityType, entityId } = req.body;
        if (!entityType || !entityId) return res.status(400).json({ error: 'entityType and entityId required' });

        const result = await contentHealthService.recheckEntity(entityType, entityId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 5. RELEASES & COMPATIBILITY CMS
// ======================================================================

router.get('/compatibility', async (req, res) => {
    try {
        const system = (req.query.system || '').trim();
        const status = (req.query.status || '').trim();
        const conditions = [];
        const params = [];

        if (system) { conditions.push('c.system = ?'); params.push(system); }
        if (status) { conditions.push('c.status = ?'); params.push(status); }

        const whereSql = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const records = await dbAsync.all(`
            SELECT c.*, g.title as game_title, g.slug as game_slug
            FROM compatibility_records c
            JOIN games g ON c.game_id = g.id
            ${whereSql}
            ORDER BY g.title ASC
            LIMIT 100
        `, params);

        res.json({ records });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/compatibility', async (req, res) => {
    try {
        const { game_id, system, status, tested_version, notes } = req.body;
        if (!game_id || !system || !status) return res.status(400).json({ error: 'game_id, system, and status required' });

        const existing = await dbAsync.get('SELECT id FROM compatibility_records WHERE game_id = ? AND system = ?', [game_id, system]);
        if (existing) {
            await dbAsync.run(`
                UPDATE compatibility_records 
                SET status = ?, tested_version = ?, notes = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [status, tested_version || null, notes || null, req.user.id, existing.id]);
        } else {
            await dbAsync.run(`
                INSERT INTO compatibility_records (id, game_id, system, status, tested_version, notes, updated_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [uuidv4(), game_id, system, status, tested_version || null, notes || null, req.user.id]);
        }

        await createAuditLog(req.user.id, 'SET_COMPATIBILITY', 'compatibility', game_id, 'SUCCESS', { system, status });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/compatibility/bulk', async (req, res) => {
    try {
        const { items } = req.body; // array of { game_id, system, status }
        if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'items array required' });

        await dbAsync.run('BEGIN TRANSACTION');
        for (const item of items) {
            const existing = await dbAsync.get('SELECT id FROM compatibility_records WHERE game_id = ? AND system = ?', [item.game_id, item.system]);
            if (existing) {
                await dbAsync.run(`UPDATE compatibility_records SET status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                    [item.status, req.user.id, existing.id]);
            } else {
                await dbAsync.run(`INSERT INTO compatibility_records (id, game_id, system, status, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                    [uuidv4(), item.game_id, item.system, item.status, req.user.id]);
            }
        }
        await dbAsync.run('COMMIT');

        await createAuditLog(req.user.id, 'BULK_COMPATIBILITY_UPDATE', 'compatibility', 'bulk', 'SUCCESS', { count: items.length });
        res.json({ success: true, count: items.length });
    } catch (err) {
        await dbAsync.run('ROLLBACK').catch(() => {});
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 6. MEDIA MANAGER & ASSET SAFEGUARD
// ======================================================================

router.get('/media', async (req, res) => {
    try {
        const page = parseInt(req.query.page, 10) || 1;
        const limit = parseInt(req.query.limit, 10) || 25;
        const offset = (page - 1) * limit;
        const status = (req.query.status || '').trim().toUpperCase();
        const q = (req.query.q || '').trim();

        // Get aggregate counts
        const totalRow = await dbAsync.get('SELECT COUNT(*) as c FROM game_images');
        const localRow = await dbAsync.get("SELECT COUNT(*) as c FROM game_images WHERE verification_status = 'VERIFIED_LOCAL' OR image_type = 'local'");
        const remoteRow = await dbAsync.get("SELECT COUNT(*) as c FROM game_images WHERE verification_status = 'VERIFIED_REMOTE' OR (image_type = 'remote' AND verification_status = 'verified')");
        const fallbackRow = await dbAsync.get("SELECT COUNT(*) as c FROM game_images WHERE verification_status = 'FALLBACK' OR image_type = 'fallback'");
        const brokenRow = await dbAsync.get("SELECT COUNT(*) as c FROM game_images WHERE verification_status IN ('BROKEN', 'NOT_FOUND', 'FORBIDDEN', 'INVALID_MIME', 'TIMEOUT')");
        const unverifiedRow = await dbAsync.get("SELECT COUNT(*) as c FROM game_images WHERE verification_status = 'UNVERIFIED'");

        let sql = `
            SELECT i.*, g.title as game_title, g.slug as game_slug 
            FROM game_images i
            LEFT JOIN games g ON i.game_id = g.id
            WHERE 1=1
        `;
        const params = [];

        if (status && status !== 'ALL') {
            if (status === 'LOCAL') {
                sql += " AND (i.verification_status = 'VERIFIED_LOCAL' OR i.image_type = 'local')";
            } else if (status === 'REMOTE') {
                sql += " AND (i.verification_status = 'VERIFIED_REMOTE' OR i.image_type = 'remote')";
            } else if (status === 'FALLBACK') {
                sql += " AND (i.verification_status = 'FALLBACK' OR i.image_type = 'fallback')";
            } else if (status === 'BROKEN') {
                sql += " AND i.verification_status IN ('BROKEN', 'NOT_FOUND', 'FORBIDDEN', 'INVALID_MIME', 'TIMEOUT')";
            } else {
                sql += ' AND i.verification_status = ?';
                params.push(status);
            }
        }

        if (q) {
            sql += ' AND (g.title LIKE ? OR g.slug LIKE ? OR i.source_domain LIKE ?)';
            params.push(`%${q}%`, `%${q}%`, `%${q}%`);
        }

        const countQuery = sql.replace('SELECT i.*, g.title as game_title, g.slug as game_slug', 'SELECT COUNT(*) as c');
        const filteredCount = (await dbAsync.get(countQuery, params)).c;

        sql += ' ORDER BY g.release_year ASC, g.title ASC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const images = await dbAsync.all(sql, params);

        res.json({
            images,
            total: filteredCount,
            counts: {
                total: totalRow ? totalRow.c : 0,
                local: localRow ? localRow.c : 0,
                remote: remoteRow ? remoteRow.c : 0,
                fallback: fallbackRow ? fallbackRow.c : 0,
                broken: brokenRow ? brokenRow.c : 0,
                unverified: unverifiedRow ? unverifiedRow.c : 0
            },
            page,
            limit
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Trigger full catalogue media audit background job
router.post('/media/audit', async (req, res) => {
    try {
        const job = await enqueueJob('MEDIA_AUDIT', {}, req.user.id);
        res.json({ success: true, message: 'Full catalogue media audit enqueued', job });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Media Candidates Management
router.get('/media/candidates', async (req, res) => {
    try {
        const gameId = (req.query.game_id || '').trim();
        let sql = `
            SELECT mc.*, g.title as game_title, g.slug as game_slug
            FROM media_candidates mc
            JOIN games g ON mc.game_id = g.id
        `;
        const params = [];
        if (gameId) {
            sql += ' WHERE mc.game_id = ?';
            params.push(gameId);
        }
        sql += ' ORDER BY mc.created_at DESC LIMIT 50';

        const candidates = await dbAsync.all(sql, params);
        res.json({ candidates });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/media/candidates', async (req, res) => {
    try {
        const { game_id, image_url, source_url, attribution, license_status } = req.body;
        if (!game_id || !image_url) return res.status(400).json({ error: 'game_id and image_url required' });

        const safeCheck = mediaService.isSafeUrl(image_url);
        if (!safeCheck.safe) {
            return res.status(400).json({ error: `Image URL rejected: ${safeCheck.reason}` });
        }

        let domain = null;
        try { domain = new URL(image_url).hostname; } catch (e) {}

        const id = `cand-${uuidv4().slice(0, 8)}`;
        await dbAsync.run(`
            INSERT INTO media_candidates (id, game_id, image_url, source_url, source_domain, attribution, license_status, verification_status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'UNVERIFIED', CURRENT_TIMESTAMP)
        `, [id, game_id, image_url, source_url || null, domain, attribution || null, license_status || 'UNKNOWN']);

        res.json({ success: true, candidateId: id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Source domain health distribution
router.get('/sources/health', async (req, res) => {
    try {
        const domains = await dbAsync.all(`
            SELECT source_domain, COUNT(*) as total_records,
                   SUM(CASE WHEN verification_status = 'VERIFIED_REMOTE' OR verification_status = 'verified' THEN 1 ELSE 0 END) as verified_count,
                   SUM(CASE WHEN verification_status = 'BROKEN' THEN 1 ELSE 0 END) as broken_count,
                   SUM(CASE WHEN verification_status = 'NOT_FOUND' THEN 1 ELSE 0 END) as not_found_count,
                   SUM(CASE WHEN verification_status = 'FORBIDDEN' THEN 1 ELSE 0 END) as forbidden_count,
                   SUM(CASE WHEN verification_status = 'THROTTLED' THEN 1 ELSE 0 END) as throttled_count
            FROM game_images
            WHERE source_domain IS NOT NULL AND source_domain != ''
            GROUP BY source_domain
            ORDER BY total_records DESC
        `);

        res.json({ domains });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/media/replace', async (req, res) => {
    try {
        const { imageId, newUrl, sourceUrl, attribution } = req.body;
        if (!imageId || !newUrl) return res.status(400).json({ error: 'imageId and newUrl required' });

        const currentImage = await dbAsync.get('SELECT * FROM game_images WHERE id = ?', [imageId]);
        if (!currentImage) return res.status(404).json({ error: 'Image record not found' });

        // PROTECTED ASSETS ENFORCEMENT: prevent modifying profile-icons, console transparent PNGs, or creator QR
        if (isProtectedAsset(currentImage.image_url) || isProtectedAsset(newUrl)) {
            return res.status(403).json({ error: 'Operation rejected: Target asset is part of the protected museum core iconography and cannot be altered.' });
        }

        await dbAsync.run(`
            UPDATE game_images 
            SET image_url = ?, source_url = ?, verification_status = 'VERIFIED' 
            WHERE id = ?
        `, [newUrl, sourceUrl || null, imageId]);

        // Record provenance in media_metadata
        await dbAsync.run(`
            INSERT INTO media_metadata (id, content_id, content_type, type, storage_path, source_url, attribution, verification_status, created_at)
            VALUES (?, ?, 'game', 'exhibit_screenshot', ?, ?, ?, 'VERIFIED', CURRENT_TIMESTAMP)
        `, [uuidv4(), currentImage.game_id, newUrl, sourceUrl || null, attribution || null]);

        await createAuditLog(req.user.id, 'REPLACE_MEDIA', 'media', imageId, 'SUCCESS', { oldUrl: currentImage.image_url, newUrl });
        res.json({ success: true, newUrl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 7. SEO & SEARCH CENTER
// ======================================================================

router.get('/seo/audit', async (req, res) => {
    try {
        const missingGames = await dbAsync.all("SELECT id, title, slug, status FROM games WHERE meta_title IS NULL OR meta_description IS NULL LIMIT 50");
        const missingConsoles = await dbAsync.all("SELECT id, name as title, slug, status FROM consoles WHERE description IS NULL LIMIT 50");

        res.json({
            status: missingGames.length === 0 ? 'HEALTHY' : 'NEEDS_ATTENTION',
            missingCount: missingGames.length + missingConsoles.length,
            records: [
                ...missingGames.map(g => ({ type: 'GAME', id: g.id, title: g.title, slug: g.slug })),
                ...missingConsoles.map(c => ({ type: 'CONSOLE', id: c.id, title: c.title, slug: c.slug }))
            ]
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/seo/update', async (req, res) => {
    try {
        const { type, id, metaTitle, metaDescription } = req.body;
        if (!type || !id) return res.status(400).json({ error: 'type and id required' });

        if (type === 'games') {
            await dbAsync.run(`UPDATE games SET meta_title = ?, meta_description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [metaTitle || null, metaDescription || null, id]);
        }

        await createAuditLog(req.user.id, 'UPDATE_SEO', type, id, 'SUCCESS');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 8. AUTOMATION & BACKGROUND JOBS
// ======================================================================

router.get('/jobs', async (req, res) => {
    try {
        const status = (req.query.status || '').trim();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 25;
        const offset = (page - 1) * limit;

        const whereSql = status ? 'WHERE status = ?' : '';
        const params = status ? [status] : [];

        const countRow = await dbAsync.get(`SELECT COUNT(*) as c FROM jobs ${whereSql}`, params);
        const jobs = await dbAsync.all(`
            SELECT * FROM jobs 
            ${whereSql}
            ORDER BY created_at DESC 
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        res.json({ jobs, total: countRow ? countRow.c : 0, page, limit });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/jobs/enqueue', async (req, res) => {
    try {
        const { jobType, payload } = req.body;
        const job = await enqueueJob(jobType, payload || {}, req.user.username);
        await createAuditLog(req.user.id, 'ENQUEUE_JOB', 'job', job.id, 'SUCCESS', { jobType });
        res.json({ success: true, job });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/jobs/:id/retry', async (req, res) => {
    try {
        const result = await retryJob(req.params.id);
        await createAuditLog(req.user.id, 'RETRY_JOB', 'job', req.params.id, 'SUCCESS');
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/jobs/:id/cancel', async (req, res) => {
    try {
        const result = await cancelJob(req.params.id);
        await createAuditLog(req.user.id, 'CANCEL_JOB', 'job', req.params.id, 'SUCCESS');
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ======================================================================
// 9. SUPPORT HELPDESK & THREADED REPLIES
// ======================================================================

router.get('/tickets', async (req, res) => {
    try {
        const status = (req.query.status || '').trim();
        const priority = (req.query.priority || '').trim();
        const conditions = [];
        const params = [];

        if (status) { conditions.push('t.status = ?'); params.push(status); }
        if (priority) { conditions.push('t.priority = ?'); params.push(priority); }

        const whereSql = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const tickets = await dbAsync.all(`
            SELECT t.*, u.username, u.display_name, u.email
            FROM support_tickets t
            LEFT JOIN users u ON t.user_id = u.id
            ${whereSql}
            ORDER BY t.updated_at DESC
        `, params);

        res.json({ tickets });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/tickets/:id', async (req, res) => {
    try {
        const ticketId = req.params.id;
        const ticket = await dbAsync.get(`
            SELECT t.*, u.username, u.display_name, u.email
            FROM support_tickets t
            LEFT JOIN users u ON t.user_id = u.id
            WHERE t.id = ?
        `, [ticketId]);

        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const messages = await dbAsync.all(`
            SELECT m.*, u.username as sender_username, u.display_name as sender_name
            FROM ticket_messages m
            LEFT JOIN users u ON m.sender_user_id = u.id
            WHERE m.ticket_id = ?
            ORDER BY m.created_at ASC
        `, [ticketId]);

        res.json({ ticket, messages });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/tickets/:id/reply', async (req, res) => {
    try {
        const ticketId = req.params.id;
        const { message, status } = req.body;
        if (!message) return res.status(400).json({ error: 'Message content required' });

        const ticket = await dbAsync.get('SELECT * FROM support_tickets WHERE id = ?', [ticketId]);
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        const msgId = uuidv4();
        await dbAsync.run(`
            INSERT INTO ticket_messages (id, ticket_id, sender_user_id, message, is_internal_note, created_at)
            VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
        `, [msgId, ticketId, req.user.id, message]);

        const nextStatus = status || 'WAITING';
        await dbAsync.run(`UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [nextStatus, ticketId]);

        // Notify user if ticket has associated user
        if (ticket.user_id) {
            const notifId = uuidv4();
            const notifMsg = `New response on your support ticket "${ticket.subject}"`;
            await dbAsync.run(`
                INSERT INTO notifications (id, user_id, type, reference_id, message, created_at)
                VALUES (?, ?, 'TICKET_REPLIED', ?, ?, CURRENT_TIMESTAMP)
            `, [notifId, ticket.user_id, ticketId, notifMsg]);

            broadcastToUser(ticket.user_id, {
                type: 'NOTIFICATION',
                notification: { id: notifId, type: 'TICKET_REPLIED', message: notifMsg, created_at: new Date().toISOString() }
            });
        }

        await createAuditLog(req.user.id, 'REPLY_TICKET', 'support_ticket', ticketId, 'SUCCESS');
        res.json({ success: true, messageId: msgId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/tickets/:id/note', async (req, res) => {
    try {
        const ticketId = req.params.id;
        const { note } = req.body;
        if (!note) return res.status(400).json({ error: 'Internal note required' });

        const msgId = uuidv4();
        await dbAsync.run(`
            INSERT INTO ticket_messages (id, ticket_id, sender_user_id, message, is_internal_note, created_at)
            VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
        `, [msgId, ticketId, req.user.id, note]);

        await createAuditLog(req.user.id, 'ADD_INTERNAL_NOTE', 'support_ticket', ticketId, 'SUCCESS');
        res.json({ success: true, noteId: msgId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/tickets/:id', async (req, res) => {
    try {
        const ticketId = req.params.id;
        const { status, priority } = req.body;

        const updates = [];
        const params = [];
        if (status) { updates.push('status = ?'); params.push(status); }
        if (priority) { updates.push('priority = ?'); params.push(priority); }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(ticketId);

        await dbAsync.run(`UPDATE support_tickets SET ${updates.join(', ')} WHERE id = ?`, params);
        await createAuditLog(req.user.id, 'UPDATE_TICKET', 'support_ticket', ticketId, 'SUCCESS', { status, priority });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 10. MODERATION CENTER (Reports, Comments, Reviews)
// ======================================================================

router.get('/reports', async (req, res) => {
    try {
        const rows = await dbAsync.all(`
            SELECT r.*, u.username as reporter_username, u.display_name as reporter_name
            FROM reports r
            JOIN users u ON r.reporter_id = u.id
            ORDER BY r.created_at DESC
        `);
        res.json({ reports: rows });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/reports/:id/action', async (req, res) => {
    try {
        const { action, moderatorNotes } = req.body; // RESOLVE, DISMISS, HIDE_TARGET
        const report = await dbAsync.get('SELECT * FROM reports WHERE id = ?', [req.params.id]);
        if (!report) return res.status(404).json({ error: 'Report not found' });

        const status = action === 'DISMISS' ? 'DISMISSED' : 'RESOLVED';
        await dbAsync.run(`
            UPDATE reports 
            SET status = ?, moderator_notes = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [status, moderatorNotes || null, req.params.id]);

        if (action === 'HIDE_TARGET') {
            if (report.target_type === 'COMMENT') {
                await dbAsync.run(`UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [report.target_id]);
            } else if (report.target_type === 'REVIEW') {
                await dbAsync.run(`UPDATE reviews SET status = 'REJECTED' WHERE id = ?`, [report.target_id]);
            }
        }

        await createAuditLog(req.user.id, `REPORT_${action}`, 'report', req.params.id, 'SUCCESS', { targetType: report.target_type, targetId: report.target_id });
        res.json({ success: true, status });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/comments', async (req, res) => {
    try {
        const rows = await dbAsync.all(`
            SELECT c.*, u.username, u.display_name
            FROM comments c
            JOIN users u ON c.user_id = u.id
            ORDER BY c.created_at DESC LIMIT 100
        `);
        res.json({ comments: rows });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/comments/:id/delete', async (req, res) => {
    try {
        await dbAsync.run(`UPDATE comments SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.params.id]);
        await createAuditLog(req.user.id, 'DELETE_COMMENT', 'comment', req.params.id, 'SUCCESS');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/comments/:id/restore', async (req, res) => {
    try {
        await dbAsync.run(`UPDATE comments SET deleted_at = NULL WHERE id = ?`, [req.params.id]);
        await createAuditLog(req.user.id, 'RESTORE_COMMENT', 'comment', req.params.id, 'SUCCESS');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.get('/reviews', async (req, res) => {
    try {
        const rows = await dbAsync.all(`
            SELECT r.*, u.username, u.display_name
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.created_at DESC LIMIT 100
        `);
        res.json({ reviews: rows });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/reviews/:id/delete', async (req, res) => {
    try {
        await dbAsync.run(`UPDATE reviews SET status = 'REJECTED' WHERE id = ?`, [req.params.id]);
        await createAuditLog(req.user.id, 'DELETE_REVIEW', 'review', req.params.id, 'SUCCESS');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

router.post('/reviews/:id/restore', async (req, res) => {
    try {
        await dbAsync.run(`UPDATE reviews SET status = 'PUBLISHED' WHERE id = ?`, [req.params.id]);
        await createAuditLog(req.user.id, 'RESTORE_REVIEW', 'review', req.params.id, 'SUCCESS');
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// ======================================================================
// 11. PRIVATE AI CONTROL CENTER
// ======================================================================

// Legacy AI queue endpoints for backwards compatibility
router.get('/ai/queue', async (req, res) => {
    try {
        const tasks = await dbAsync.all('SELECT id, entity_type, entity_id, status, model, validation_status, created_at, updated_at FROM ai_queue ORDER BY created_at DESC LIMIT 50');
        res.json({ tasks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/ai/drafts/:id', async (req, res) => {
    try {
        const task = await dbAsync.get('SELECT * FROM ai_queue WHERE id = ?', [req.params.id]);
        if (!task) return res.status(404).json({ error: 'AI task not found' });
        res.json({ task });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/ai/generate', async (req, res) => {
    try {
        const { entityType, entityId, prompt, model } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt required' });
        const task = await enqueueAITask(entityType || 'STORY', entityId, prompt, model);
        await createAuditLog(req.user.id, 'TRIGGER_AI_GENERATION', 'ai_queue', task.id, 'SUCCESS');
        res.json({ success: true, task });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/ai/drafts/:id/approve', async (req, res) => {
    try {
        const result = await approveAIDraft(req.params.id, req.user.id);
        await createAuditLog(req.user.id, 'APPROVE_AI_DRAFT', 'ai_queue', req.params.id, 'SUCCESS');
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/ai/drafts/:id/reject', async (req, res) => {
    try {
        const result = await rejectAIDraft(req.params.id, req.user.id, req.body.reason);
        await createAuditLog(req.user.id, 'REJECT_AI_DRAFT', 'ai_queue', req.params.id, 'SUCCESS');
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Phase 16: Enterprise AI Control Center Endpoints
router.get('/ai/overview', async (req, res) => {
    try {
        const counts = await dbAsync.all(`
            SELECT status, COUNT(*) as c FROM ai_jobs GROUP BY status
        `);
        const statusMap = { QUEUED: 0, PROCESSING: 0, AWAITING_OWNER: 0, COMPLETED: 0, FAILED: 0, HELD: 0, RETRYING: 0 };
        for (const r of counts) {
            statusMap[r.status] = r.c;
        }

        const usageToday = await dbAsync.get(`
            SELECT 
                COALESCE(SUM(input_tokens_est + output_tokens_est), 0) as totalTokens,
                COALESCE(SUM(cost_estimate), 0.0) as totalCost,
                COUNT(*) as callCount
            FROM ai_usage 
            WHERE created_at >= date('now', 'start of day')
        `);

        const killSwitch = aiJobQueueService.getKillSwitchStatus();

        res.json({
            status: 'success',
            queue: statusMap,
            usageToday: {
                totalTokens: usageToday ? usageToday.totalTokens : 0,
                totalCostUSD: usageToday ? parseFloat(usageToday.totalCost.toFixed(4)) : 0,
                calls: usageToday ? usageToday.callCount : 0
            },
            killSwitch,
            providerHealth: 'HEALTHY'
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/ai/jobs', async (req, res) => {
    try {
        const { status, type, priority, limit = 50, offset = 0 } = req.query;
        let query = 'SELECT * FROM ai_jobs WHERE 1=1';
        let countQuery = 'SELECT COUNT(*) as c FROM ai_jobs WHERE 1=1';
        const params = [];

        if (status) {
            query += ' AND status = ?';
            countQuery += ' AND status = ?';
            params.push(status);
        }
        if (type) {
            query += ' AND job_type = ?';
            countQuery += ' AND job_type = ?';
            params.push(type);
        }
        if (priority) {
            query += ' AND priority = ?';
            countQuery += ' AND priority = ?';
            params.push(priority);
        }

        const countRow = await dbAsync.get(countQuery, params);

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        const listParams = [...params, parseInt(limit, 10), parseInt(offset, 10)];

        const jobs = await dbAsync.all(query, listParams);
        const enrichedJobs = jobs.map(j => {
            let durationSeconds = 0;
            if (j.started_at && j.completed_at) {
                durationSeconds = Math.max(0, Math.floor((new Date(j.completed_at).getTime() - new Date(j.started_at).getTime()) / 1000));
            } else if (j.started_at && (j.status === 'RUNNING' || j.status === 'PROCESSING')) {
                durationSeconds = Math.max(0, Math.floor((Date.now() - new Date(j.started_at).getTime()) / 1000));
            }
            return { ...j, durationSeconds };
        });

        res.json({ jobs: enrichedJobs, total: countRow ? countRow.c : 0, limit: parseInt(limit, 10), offset: parseInt(offset, 10) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/ai/jobs/:id', async (req, res) => {
    try {
        const job = await dbAsync.get('SELECT * FROM ai_jobs WHERE id = ?', [req.params.id]);
        if (!job) return res.status(404).json({ error: 'AI job not found' });

        const outputs = await dbAsync.all('SELECT * FROM ai_outputs WHERE job_id = ? ORDER BY created_at DESC', [job.id]);
        const audit = await dbAsync.all('SELECT * FROM ai_audit WHERE job_id = ? ORDER BY created_at DESC', [job.id]);

        res.json({ job, outputs, audit });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/ai/jobs', async (req, res) => {
    try {
        const { jobType, entityType, entityId, priority, payload, promptVersion } = req.body;
        if (!jobType) return res.status(400).json({ error: 'jobType is required' });

        const job = await aiJobQueueService.enqueueAIJob({
            jobType,
            entityType,
            entityId,
            priority,
            payload: payload || {},
            createdBy: req.user.id,
            promptVersion
        });

        await createAuditLog(req.user.id, 'ENQUEUE_AI_JOB', 'ai_jobs', job.id, 'SUCCESS');
        res.json({ success: true, job });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/ai/jobs/:id/retry', async (req, res) => {
    try {
        const result = await aiJobQueueService.retryAIJob(req.params.id);
        await createAuditLog(req.user.id, 'RETRY_AI_JOB', 'ai_jobs', req.params.id, 'SUCCESS');
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/ai/jobs/:id/cancel', async (req, res) => {
    try {
        const result = await aiJobQueueService.cancelAIJob(req.params.id);
        await createAuditLog(req.user.id, 'CANCEL_AI_JOB', 'ai_jobs', req.params.id, 'SUCCESS');
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/ai/jobs/:id/approve', async (req, res) => {
    try {
        const output = await dbAsync.get('SELECT id FROM ai_outputs WHERE job_id = ? AND status = "AWAITING_OWNER" LIMIT 1', [req.params.id]);
        if (!output) return res.status(404).json({ error: 'No draft output awaiting approval for this job' });

        const result = await aiJobQueueService.approveAIDraft(output.id, req.user.id, req.body.notes);
        await createAuditLog(req.user.id, 'APPROVE_AI_JOB_DRAFT', 'ai_jobs', req.params.id, 'SUCCESS');
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/ai/jobs/:id/reject', async (req, res) => {
    try {
        const output = await dbAsync.get('SELECT id FROM ai_outputs WHERE job_id = ? LIMIT 1', [req.params.id]);
        if (!output) return res.status(404).json({ error: 'No output found for this job' });

        const result = await aiJobQueueService.rejectAIDraft(output.id, req.user.id, req.body.reason);
        await createAuditLog(req.user.id, 'REJECT_AI_JOB_DRAFT', 'ai_jobs', req.params.id, 'SUCCESS');
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/ai/bulk', async (req, res) => {
    try {
        const { entityIds = [], entityType = 'GAME', jobType = 'GAME_ENRICHMENT', priority = 'LOW' } = req.body;
        if (!Array.isArray(entityIds) || entityIds.length === 0) {
            return res.status(400).json({ error: 'entityIds array required' });
        }

        const maxBulk = 500;
        const targetIds = entityIds.slice(0, maxBulk);
        const enqueuedJobs = [];

        for (const id of targetIds) {
            const job = await aiJobQueueService.enqueueAIJob({
                jobType,
                entityType,
                entityId: id,
                priority,
                payload: { id },
                createdBy: req.user.id
            });
            enqueuedJobs.push(job.id);
        }

        await createAuditLog(req.user.id, 'BULK_ENQUEUE_AI', 'ai_jobs', null, 'SUCCESS');

        res.json({
            success: true,
            enqueuedCount: enqueuedJobs.length,
            jobIds: enqueuedJobs,
            estimatedCostUSD: parseFloat((enqueuedJobs.length * 0.0003).toFixed(4))
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/ai/usage', async (req, res) => {
    try {
        const usage = await dbAsync.all(`
            SELECT provider, model, operation, COUNT(*) as calls,
                   SUM(input_tokens_est) as inputTokens,
                   SUM(output_tokens_est) as outputTokens,
                   SUM(cost_estimate) as costEst,
                   AVG(duration_ms) as avgLatencyMs
            FROM ai_usage
            GROUP BY provider, model, operation
        `);
        res.json({ usage });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/ai/config', (req, res) => {
    res.json({
        activeProvider: process.env.AI_PROVIDER || 'mock',
        activeModel: process.env.AI_MODEL || 'gemini-3.1-flash-lite',
        timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '15000', 10),
        maxRetries: parseInt(process.env.AI_MAX_RETRIES || '3', 10),
        testMode: process.env.AI_TEST_MODE === 'true',
        dailyBudgetUSD: parseFloat(process.env.AI_DAILY_BUDGET_USD || '5.00'),
        killSwitch: aiJobQueueService.getKillSwitchStatus()
    });
});

router.post('/ai/kill-switch', async (req, res) => {
    try {
        const { state, reason } = req.body;
        const result = await aiJobQueueService.setKillSwitchStatus(state, reason, req.user.id);
        await createAuditLog(req.user.id, 'TOGGLE_AI_KILL_SWITCH', 'system', null, 'SUCCESS');
        res.json({ success: true, status: result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ======================================================================
// 11B. PHASE 20: OWNER AI COMMAND CENTER & MULTI-PROVIDER KEY VAULT
// ======================================================================

// 1. Key Vault: Provider Summaries & Keys
router.get('/ai/vault/providers', async (req, res) => {
    try {
        const summaries = await aiKeyVault.getProviderSummaries();
        res.json({ success: true, providers: summaries });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/ai/vault/keys', async (req, res) => {
    try {
        const keys = await aiKeyVault.getSafeKeys(req.query.provider);
        res.json({ success: true, keys });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/ai/vault/keys', async (req, res) => {
    try {
        const { provider, label, apiKey, priority, customBaseUrl, modelsSupported } = req.body;
        const key = await aiKeyVault.addKey({ provider, label, apiKey, priority, customBaseUrl, modelsSupported });
        await createAuditLog(req.user.id, 'ADD_AI_KEY', 'ai_provider_keys', key.id, 'SUCCESS', { provider, label });
        res.json({ success: true, key });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.post('/ai/vault/keys/:id/toggle', async (req, res) => {
    try {
        const { isEnabled } = req.body;
        await aiKeyVault.toggleKey(req.params.id, isEnabled);
        await createAuditLog(req.user.id, 'TOGGLE_AI_KEY', 'ai_provider_keys', req.params.id, 'SUCCESS', { isEnabled });
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.post('/ai/vault/keys/:id/test', async (req, res) => {
    try {
        const result = await aiKeyVault.testKey(req.params.id);
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Test unsaved API key
router.post('/ai/vault/test-raw-key', async (req, res) => {
    try {
        const { provider, apiKey, model, customBaseUrl } = req.body;
        const result = await aiKeyVault.testRawKey({ provider, apiKey, model, customBaseUrl });
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Test provider connectivity (e.g. POST /api/owner/ai/providers/google/test)
router.post('/ai/providers/:provider/test', async (req, res) => {
    try {
        const { model } = req.body || {};
        const result = await aiKeyVault.testProviderConnection(req.params.provider, model);
        res.json(result);
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.delete('/ai/vault/keys/:id', async (req, res) => {
    try {
        await aiKeyVault.deleteKey(req.params.id);
        await createAuditLog(req.user.id, 'DELETE_AI_KEY', 'ai_provider_keys', req.params.id, 'SUCCESS');
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.post('/ai/vault/keys/:id/priority', async (req, res) => {
    try {
        const { priority } = req.body;
        await aiKeyVault.updateKeyPriority(req.params.id, priority);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// 2. Model Registry & Task Routing
router.get('/ai/models', async (req, res) => {
    try {
        const models = await providerRegistry.getModelRegistry();
        res.json({ success: true, models, defaultModel: modelRegistry.DEFAULT_MODEL_ID, aliases: providerRegistry.DEFAULT_ALIASES });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 3. Conversation Memory
router.get('/ai/conversations', async (req, res) => {
    try {
        const conversations = await dbAsync.all(`
            SELECT c.*, 
                   (SELECT COUNT(*) FROM ai_conversation_messages m WHERE m.conversation_id = c.id) as message_count,
                   (SELECT m.content FROM ai_conversation_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message
            FROM ai_conversations c
            WHERE c.is_archived = 0
            ORDER BY c.updated_at DESC
        `);
        res.json({ success: true, conversations });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/ai/conversations', async (req, res) => {
    try {
        const { title = 'New Engineering Session', provider = 'GOOGLE', model = 'gemini-3.1-flash-lite', mode = 'plan_approve' } = req.body;
        const id = uuidv4();
        await dbAsync.run(`
            INSERT INTO ai_conversations (id, title, provider, model, mode, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [id, title.trim(), provider.toUpperCase(), model, mode]);
        res.json({ success: true, conversation: { id, title: title.trim(), provider, model, mode } });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.get('/ai/conversations/:id', async (req, res) => {
    try {
        const conv = await dbAsync.get('SELECT * FROM ai_conversations WHERE id = ?', [req.params.id]);
        if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

        const messages = await dbAsync.all(`
            SELECT * FROM ai_conversation_messages 
            WHERE conversation_id = ? 
            ORDER BY created_at ASC
        `, [req.params.id]);

        res.json({
            success: true,
            conversation: conv,
            messages: messages.map(m => ({
                ...m,
                plan_json: m.plan_json ? JSON.parse(m.plan_json) : null,
                execution_json: m.execution_json ? JSON.parse(m.execution_json) : null
            }))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.put('/ai/conversations/:id', async (req, res) => {
    try {
        const { title, mode, provider, model, autonomousMode } = req.body;
        const updates = [];
        const params = [];
        if (title !== undefined) { updates.push('title = ?'); params.push(title.trim()); }
        if (mode !== undefined) { updates.push('mode = ?'); params.push(mode); }
        if (provider !== undefined) { updates.push('provider = ?'); params.push(provider.toUpperCase()); }
        if (model !== undefined) { updates.push('model = ?'); params.push(model); }
        if (autonomousMode !== undefined) { updates.push('autonomous_mode = ?'); params.push(autonomousMode ? 1 : 0); }
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(req.params.id);

        await dbAsync.run(`UPDATE ai_conversations SET ${updates.join(', ')} WHERE id = ?`, params);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

router.delete('/ai/conversations/:id', async (req, res) => {
    try {
        await dbAsync.run('UPDATE ai_conversations SET is_archived = 1 WHERE id = ?', [req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// 4. Autonomous Agent Chat Execution
router.post('/ai/chat', async (req, res) => {
    try {
        const { conversationId, prompt, mode, provider, model, attachments = [], thinkingLevel = null, autoFallback = false } = req.body;
        if (!prompt || !prompt.trim()) return res.status(400).json({ error: 'Prompt is required.' });

        // Resolve conversation
        let convId = conversationId;
        if (!convId) {
            convId = uuidv4();
            const title = prompt.trim().slice(0, 40) + '...';
            await dbAsync.run(`
                INSERT INTO ai_conversations (id, title, provider, model, mode, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            `, [convId, title, (provider || 'GOOGLE').toUpperCase(), model || 'gemini-3.1-flash-lite', mode || 'plan_approve']);
        }

        const conv = await dbAsync.get('SELECT * FROM ai_conversations WHERE id = ?', [convId]);
        const activeMode = mode || conv?.mode || 'plan_approve';
        const activeProvider = provider || conv?.provider || 'GOOGLE';
        const activeModel = model || conv?.model || 'gemini-3.1-flash-lite';

        // Save User Message
        const userMsgId = uuidv4();
        await dbAsync.run(`
            INSERT INTO ai_conversation_messages (id, conversation_id, role, content, created_at)
            VALUES (?, ?, 'user', ?, CURRENT_TIMESTAMP)
        `, [userMsgId, convId, prompt.trim()]);

        // Process through Project Agent
        const asstMsgId = uuidv4();
        const agentResult = await projectAgent.processAgentCommand({
            conversationId: convId,
            messageId: asstMsgId,
            prompt: prompt.trim(),
            mode: activeMode,
            provider: activeProvider,
            model: activeModel,
            actorId: req.user.id,
            attachments,
            thinkingLevel,
            autoFallback: !!autoFallback
        });

        // Enqueue Job for transparency in Jobs Center
        const jobId = uuidv4();
        const jobResultJson = JSON.stringify(agentResult.plan || agentResult.execution || { response: agentResult.response });
        const jobMetadataJson = JSON.stringify({
            tokensUsed: agentResult.tokensUsed || 0,
            costUSD: agentResult.costUSD || 0.0,
            fallback: agentResult.fallback || null,
            attachments: attachments || []
        });

        await dbAsync.run(`
            INSERT INTO ai_jobs (
                id, job_type, entity_type, status, priority, 
                provider, model, prompt, execution_mode, result, metadata,
                created_by, started_at, completed_at, created_at, updated_at
            ) VALUES (?, 'AGENT_COMMAND', 'WORKSPACE', ?, 'HIGH', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [
            jobId,
            agentResult.status || 'COMPLETED',
            agentResult.provider || activeProvider,
            agentResult.model || activeModel,
            prompt,
            activeMode,
            jobResultJson,
            jobMetadataJson,
            req.user.id
        ]);

        // Save Assistant Message
        const storedPlan = agentResult.plan 
            ? { ...agentResult.plan, fallback: agentResult.fallback || agentResult.plan.fallback || null }
            : (agentResult.fallback ? { fallback: agentResult.fallback } : null);
        const storedExec = agentResult.execution
            ? { ...agentResult.execution, fallback: agentResult.fallback || agentResult.execution.fallback || null }
            : null;

        await dbAsync.run(`
            INSERT INTO ai_conversation_messages (
                id, conversation_id, role, content, plan_json, execution_json, job_id, tokens_used, cost_estimate, created_at
            ) VALUES (?, ?, 'assistant', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            asstMsgId,
            convId,
            agentResult.response || agentResult.plan?.summary || 'Execution completed.',
            storedPlan ? JSON.stringify(storedPlan) : null,
            storedExec ? JSON.stringify(storedExec) : null,
            jobId,
            agentResult.tokensUsed || 0,
            agentResult.costUSD || 0.0
        ]);

        await dbAsync.run('UPDATE ai_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [convId]);

        // Audit Trail
        await createAuditLog(req.user.id, 'AI_AGENT_COMMAND', 'ai_conversations', convId, 'SUCCESS', {
            mode: activeMode,
            provider: activeProvider,
            model: activeModel,
            status: agentResult.status,
            fallback: agentResult.fallback
        });

        res.json({
            success: true,
            conversationId: convId,
            messageId: asstMsgId,
            result: agentResult,
            fallback: agentResult.fallback || null
        });
    } catch (e) {
        console.error('[AI_CHAT_ERROR]', e);
        res.status(500).json({ error: e.message });
    }
});

router.post('/ai/chat/approve', async (req, res) => {
    try {
        const { messageId, plan } = req.body;
        if (!messageId && !plan) return res.status(400).json({ error: 'messageId or plan required.' });

        let planToExecute = plan;
        let convId = null;

        if (messageId) {
            const msg = await dbAsync.get('SELECT * FROM ai_conversation_messages WHERE id = ?', [messageId]);
            if (!msg) return res.status(404).json({ error: 'Message not found.' });
            convId = msg.conversation_id;
            planToExecute = JSON.parse(msg.plan_json);
        }

        const executionResult = await projectAgent.executePlan({
            conversationId: convId,
            messageId,
            plan: planToExecute,
            actorId: req.user.id
        });

        if (messageId) {
            await dbAsync.run(`
                UPDATE ai_conversation_messages 
                SET execution_json = ?, content = ? 
                WHERE id = ?
            `, [JSON.stringify(executionResult.execution), planToExecute.summary + ' (Approved & Executed)', messageId]);
        }

        await createAuditLog(req.user.id, 'APPROVE_AI_PLAN', 'ai_snapshots', executionResult.snapshotId, 'SUCCESS');

        res.json({ success: true, result: executionResult });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/ai/chat/rollback', async (req, res) => {
    try {
        const { snapshotId } = req.body;
        let targetSnapshotId = snapshotId;

        if (!targetSnapshotId) {
            const latest = await dbAsync.get("SELECT id FROM ai_snapshots WHERE status = 'ACTIVE' ORDER BY created_at DESC LIMIT 1");
            if (!latest) return res.status(404).json({ error: 'No active snapshots available for rollback.' });
            targetSnapshotId = latest.id;
        }

        const rollbackResult = await projectAgent.rollbackSnapshot(targetSnapshotId);
        await createAuditLog(req.user.id, 'ROLLBACK_AI_SNAPSHOT', 'ai_snapshots', targetSnapshotId, 'SUCCESS');

        res.json(rollbackResult);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.get('/ai/snapshots', async (req, res) => {
    try {
        const snapshots = await dbAsync.all('SELECT * FROM ai_snapshots ORDER BY created_at DESC LIMIT 30');
        res.json({ success: true, snapshots: snapshots.map(s => ({ ...s, manifest: JSON.parse(s.manifest_json) })) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Phase 16: Source Intelligence Endpoints
router.get('/sources', async (req, res) => {
    try {
        const candidates = await dbAsync.all('SELECT * FROM source_candidates ORDER BY discovered_at DESC LIMIT 50');
        const checks = await dbAsync.all('SELECT * FROM source_checks ORDER BY checked_at DESC LIMIT 50');
        res.json({ candidates, checks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/sources/check', async (req, res) => {
    try {
        const { url: targetUrl } = req.body;
        if (!targetUrl) return res.status(400).json({ error: 'url is required' });

        const result = await sourceFetchService.safeFetchSource(targetUrl);
        await createAuditLog(req.user.id, 'CHECK_SOURCE_URL', 'source_snapshots', result.snapshotId, 'SUCCESS');
        res.json({ success: true, result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// Phase 16: News Intelligence Endpoints
router.get('/news-candidates', async (req, res) => {
    try {
        const candidates = await dbAsync.all('SELECT * FROM news_candidates ORDER BY created_at DESC LIMIT 50');
        const conflicts = await dbAsync.all('SELECT * FROM content_conflicts WHERE entity_type = "NEWS" ORDER BY created_at DESC LIMIT 50');
        res.json({ candidates, conflicts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/news-candidates', async (req, res) => {
    try {
        const { title, sourceUrl, customText, relatedGames, relatedConsoles, factualStatus, claims } = req.body;
        if (!title || !sourceUrl) return res.status(400).json({ error: 'title and sourceUrl are required' });

        const result = await newsIntelligenceService.ingestNewsCandidate({
            title, sourceUrl, customText, relatedGames, relatedConsoles, factualStatus, claims
        });
        await createAuditLog(req.user.id, 'INGEST_NEWS_CANDIDATE', 'news_candidates', result.candidateId, 'SUCCESS');
        res.json({ success: true, candidate: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/news-candidates/:id/approve', async (req, res) => {
    try {
        const result = await newsIntelligenceService.publishNewsCandidate(req.params.id, req.user.id, req.body);
        await createAuditLog(req.user.id, 'PUBLISH_NEWS_CANDIDATE', 'news_articles', result.articleId, 'SUCCESS');
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/news-candidates/:id/reject', async (req, res) => {
    try {
        await dbAsync.run('UPDATE news_candidates SET status = "REJECTED", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
        await createAuditLog(req.user.id, 'REJECT_NEWS_CANDIDATE', 'news_candidates', req.params.id, 'SUCCESS');
        res.json({ success: true, id: req.params.id, status: 'REJECTED' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phase 16: Game Discovery Endpoints
router.get('/game-candidates', async (req, res) => {
    try {
        const candidates = await dbAsync.all('SELECT * FROM game_candidates ORDER BY created_at DESC LIMIT 50');
        res.json({ candidates });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/game-candidates', async (req, res) => {
    try {
        const { title, platform, developer, publisher, releaseYear, genre, shortDescription, sourceUrl, imageCandidateUrl } = req.body;
        if (!title) return res.status(400).json({ error: 'title is required' });

        const result = await gameDiscoveryService.ingestGameCandidate({
            title, platform, developer, publisher, releaseYear, genre, shortDescription, sourceUrl, imageCandidateUrl
        });
        await createAuditLog(req.user.id, 'INGEST_GAME_CANDIDATE', 'game_candidates', result.candidateId, 'SUCCESS');
        res.json({ success: true, candidate: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/game-candidates/:id/approve', async (req, res) => {
    try {
        const result = await gameDiscoveryService.publishGameCandidate(req.params.id, req.user.id, req.body);
        await createAuditLog(req.user.id, 'PUBLISH_GAME_CANDIDATE', 'games', result.gameId, 'SUCCESS');
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/game-candidates/:id/reject', async (req, res) => {
    try {
        await dbAsync.run('UPDATE game_candidates SET status = "REJECTED", updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
        await createAuditLog(req.user.id, 'REJECT_GAME_CANDIDATE', 'game_candidates', req.params.id, 'SUCCESS');
        res.json({ success: true, id: req.params.id, status: 'REJECTED' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Phase 16: Release Monitoring Endpoints
router.get('/release-monitor', async (req, res) => {
    try {
        const records = await dbAsync.all('SELECT * FROM release_watch_records ORDER BY created_at DESC LIMIT 50');
        res.json({ records });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/release-monitor', async (req, res) => {
    try {
        const { gameId, platform, region, sourceUrl, currentReleaseDate } = req.body;
        if (!gameId || !sourceUrl) return res.status(400).json({ error: 'gameId and sourceUrl are required' });

        const result = await releaseMonitorService.registerReleaseWatch({
            gameId, platform, region, sourceUrl, currentReleaseDate
        });
        await createAuditLog(req.user.id, 'REGISTER_RELEASE_WATCH', 'release_watch_records', result.recordId, 'SUCCESS');
        res.json({ success: true, watch: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/release-monitor/check', async (req, res) => {
    try {
        const { recordId, simulatedSourceText } = req.body;
        if (!recordId) return res.status(400).json({ error: 'recordId is required' });

        const result = await releaseMonitorService.checkReleaseWatchRecord(recordId, simulatedSourceText);
        await createAuditLog(req.user.id, 'CHECK_RELEASE_WATCH', 'release_watch_records', recordId, 'SUCCESS');
        res.json({ success: true, result });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

router.post('/release-monitor/:id/approve', async (req, res) => {
    try {
        const result = await releaseMonitorService.approveReleaseChange(req.params.id, req.user.id, req.body.notes);
        await createAuditLog(req.user.id, 'APPROVE_RELEASE_CHANGE', 'release_watch_records', req.params.id, 'SUCCESS');
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ======================================================================
// 12. BACKUPS & DISASTER RECOVERY
// ======================================================================

router.get('/backups', async (req, res) => {
    try {
        if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.endsWith('.db'));
        const backups = files.map(file => {
            const filePath = path.join(BACKUPS_DIR, file);
            const stats = fs.statSync(filePath);
            return {
                filename: file,
                size: (stats.size / (1024 * 1024)).toFixed(2) + ' MB',
                sizeBytes: stats.size,
                created_at: stats.mtime.toISOString()
            };
        });
        backups.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        res.json({ backups });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/backups/create', async (req, res) => {
    try {
        const job = await enqueueJob('BACKUP', {}, req.user.username);
        await createAuditLog(req.user.id, 'TRIGGER_BACKUP', 'backup', job.id, 'SUCCESS');
        res.json({ success: true, job });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/backups/:filename/verify', async (req, res) => {
    try {
        const filename = path.basename(req.params.filename);
        const targetPath = path.join(BACKUPS_DIR, filename);
        if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'Backup file not found' });

        const dr = require(path.resolve(__dirname, '../../tools/maintenance/disaster-recovery.cjs'));
        await dr.verifyDatabaseFile(targetPath);
        res.json({ success: true, filename, status: 'VERIFIED_CORRUPTION_FREE' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/backups/:filename/restore-sandbox', async (req, res) => {
    try {
        const filename = path.basename(req.params.filename);
        const targetPath = path.join(BACKUPS_DIR, filename);
        if (!fs.existsSync(targetPath)) return res.status(404).json({ error: 'Backup file not found' });

        const dr = require(path.resolve(__dirname, '../../tools/maintenance/disaster-recovery.cjs'));
        const result = await dr.testRestore(targetPath);
        res.json({ success: true, filename, sandboxVerified: true, details: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 13. SECURITY CENTER & OWNER SESSIONS
// ======================================================================

router.get('/security/overview', async (req, res) => {
    try {
        const failedAudits = await dbAsync.all("SELECT * FROM audit_logs WHERE result = 'ERROR' ORDER BY created_at DESC LIMIT 10");
        const activeSessions = (await dbAsync.get('SELECT COUNT(*) as c FROM sessions WHERE revoked_at IS NULL')).c;

        res.json({
            failedAudits,
            activeSessionsCount: activeSessions,
            securityAlerts: failedAudits.length > 5 ? [{ severity: 'WARNING', message: 'Elevated rate of administrative error events detected.' }] : []
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/security/sessions', async (req, res) => {
    try {
        const sessions = await dbAsync.all(`
            SELECT id, ip_address, user_agent, created_at, last_seen_at
            FROM sessions
            WHERE user_id = ? AND revoked_at IS NULL
            ORDER BY last_seen_at DESC
        `, [req.user.id]);
        res.json({ sessions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/security/sessions/:id/revoke', async (req, res) => {
    try {
        await dbAsync.run(`UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
        await createAuditLog(req.user.id, 'REVOKE_SESSION', 'session', req.params.id, 'SUCCESS');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/security/sessions/revoke-others', async (req, res) => {
    try {
        const currentToken = req.cookies?.session;
        // Revoke all sessions for owner except current
        await dbAsync.run(`UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ?`, [req.user.id]);
        await createAuditLog(req.user.id, 'REVOKE_ALL_SESSIONS', 'session', req.user.id, 'SUCCESS');
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 14. BUSINESS, ADS & SPONSOR INQUIRIES
// ======================================================================

router.get('/business/inquiries', async (req, res) => {
    try {
        const inquiries = await dbAsync.all('SELECT * FROM sponsor_inquiries ORDER BY created_at DESC');
        res.json({ inquiries });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.patch('/business/inquiries/:id', async (req, res) => {
    try {
        const { status } = req.body;
        await dbAsync.run('UPDATE sponsor_inquiries SET status = ? WHERE id = ?', [status, req.params.id]);
        await createAuditLog(req.user.id, 'UPDATE_SPONSOR_INQUIRY', 'sponsor_inquiry', req.params.id, 'SUCCESS', { status });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/business/ad-slots', async (req, res) => {
    try {
        const slots = await dbAsync.all('SELECT * FROM ad_slots ORDER BY slot_name ASC');
        res.json({ slots });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/business/ad-slots', async (req, res) => {
    try {
        const { slot_name, provider, status, device_visibility } = req.body;
        const id = uuidv4();
        await dbAsync.run(`
            INSERT INTO ad_slots (id, slot_name, provider, status, device_visibility, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [id, slot_name, provider || 'manual', status || 'DISABLED', device_visibility || 'ALL']);

        await createAuditLog(req.user.id, 'CREATE_AD_SLOT', 'ad_slot', id, 'SUCCESS');
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 15. OWNER SETTINGS & MAINTENANCE MODE
// ======================================================================

router.get('/settings', async (req, res) => {
    try {
        const rows = await dbAsync.all('SELECT key, value FROM site_settings');
        const settings = {};
        rows.forEach(r => { settings[r.key] = r.value; });
        res.json({
            settings,
            ownerProfile: {
                username: req.user.username,
                displayName: req.user.display_name,
                email: req.user.email,
                role: req.user.role
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/settings/maintenance', async (req, res) => {
    try {
        const { enabled, reason, estimatedDuration } = req.body;
        const val = enabled ? 'true' : 'false';

        await dbAsync.run(`
            INSERT INTO site_settings (key, value, updated_at) VALUES ('maintenance_mode', ?, CURRENT_TIMESTAMP)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
        `, [val]);

        if (reason) {
            await dbAsync.run(`
                INSERT INTO site_settings (key, value, updated_at) VALUES ('maintenance_reason', ?, CURRENT_TIMESTAMP)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
            `, [reason]);
        }

        await createAuditLog(req.user.id, enabled ? 'ENABLE_MAINTENANCE' : 'DISABLE_MAINTENANCE', 'system', 'maintenance', 'SUCCESS', { reason, estimatedDuration });
        res.json({ success: true, maintenance_mode: enabled });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/settings/profile', async (req, res) => {
    try {
        const { displayName } = req.body;
        if (!displayName) return res.status(400).json({ error: 'Display name required' });

        // Update display name strictly preserving owner username, role, and ID
        await dbAsync.run('UPDATE users SET display_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [displayName, req.user.id]);
        await createAuditLog(req.user.id, 'UPDATE_OWNER_PROFILE', 'user', req.user.id, 'SUCCESS', { displayName });
        res.json({ success: true, displayName });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/settings/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
        if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });

        const user = await dbAsync.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        const isValid = await verifyPassword(currentPassword, user.password_hash);
        if (!isValid) return res.status(401).json({ error: 'Current password incorrect' });

        const newHash = await hashPassword(newPassword);
        await dbAsync.run('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [newHash, req.user.id]);

        await createAuditLog(req.user.id, 'CHANGE_OWNER_PASSWORD', 'user', req.user.id, 'SUCCESS');
        res.json({ success: true, message: 'Password updated successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 16. AUDIT TRAIL
// ======================================================================

router.get('/audit-logs', async (req, res) => {
    try {
        const action = (req.query.action || '').trim();
        const actor = (req.query.actor || '').trim();
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const offset = (page - 1) * limit;

        const conditions = [];
        const params = [];
        if (action) { conditions.push('a.action LIKE ?'); params.push(`%${action}%`); }
        if (actor) { conditions.push('u.username LIKE ?'); params.push(`%${actor}%`); }

        const whereSql = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

        const countRow = await dbAsync.get(`
            SELECT COUNT(*) as c 
            FROM audit_logs a
            LEFT JOIN users u ON a.actor_id = u.id
            ${whereSql}
        `, params);

        const logs = await dbAsync.all(`
            SELECT a.*, u.username as actor_username, u.display_name as actor_name
            FROM audit_logs a
            LEFT JOIN users u ON a.actor_id = u.id
            ${whereSql}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?
        `, [...params, limit, offset]);

        res.json({ logs, total: countRow ? countRow.c : 0, page, limit });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Backward compatibility generator runner
router.post('/generators/run', async (req, res) => {
    try {
        const job = await enqueueJob('PAGE_REBUILD', {}, req.user.username);
        await createAuditLog(req.user.id, 'RUN_GENERATORS', 'system', job.id, 'SUCCESS');
        res.json({ success: true, job });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
