/**
 * Phase 14 Test Suite 8: Search & SEO Health Center
 * Validates SEO audit findings, safe metadata updates, atomic search index rebuilds,
 * and sitemap generation triggers.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3021;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let serverProcess = null;

function assert(condition, message) {
    if (!condition) {
        console.error(`[FAIL] ${message}`);
        throw new Error(message);
    }
    console.log(`[PASS] ${message}`);
}

async function startServer() {
    return new Promise((resolve, reject) => {
        serverProcess = spawn('node', ['server/index.cjs'], {
            cwd: path.resolve(__dirname, '../../'),
            env: { ...process.env, PORT: String(PORT) }
        });

        let started = false;
        serverProcess.stdout.on('data', d => {
            const out = d.toString();
            if (out.includes('listening on')) {
                started = true;
                resolve();
            }
        });

        serverProcess.stderr.on('data', d => {
            const errStr = d.toString().trim();
            if (errStr && !errStr.includes('ExperimentalWarning')) {
                console.error('[SERVER_LOG]', errStr);
            }
        });

        serverProcess.on('error', reject);
        setTimeout(() => { if (!started) reject(new Error('Server startup timed out')); }, 10000);
    });
}

function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

async function loginAsOwner() {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'owner', password: 'changeme123' })
    });
    const cookie = res.headers.get('set-cookie');
    return cookie ? cookie.split(';')[0] : '';
}

async function run() {
    console.log('=== TEST PHASE 14: SEARCH & SEO HEALTH CENTER ===');
    await startServer();

    const game = await dbAsync.get("SELECT id, title, meta_title, meta_description FROM games LIMIT 1");
    const originalMetaTitle = game.meta_title;
    const originalMetaDesc = game.meta_description;

    try {
        const sessionCookie = await loginAsOwner();
        assert(sessionCookie.length > 0, 'Owner authenticated');

        // 1. Fetch SEO Audit
        const auditRes = await fetch(`${BASE_URL}/api/owner/seo/audit`, {
            headers: { Cookie: sessionCookie }
        });
        assert(auditRes.status === 200, 'GET /api/owner/seo/audit returns 200');
        const auditData = await auditRes.json();
        assert(auditData.status === 'HEALTHY' || auditData.status === 'NEEDS_ATTENTION', 'Valid SEO audit status');
        assert(Array.isArray(auditData.records), 'Records array provided');

        // 2. Safe Metadata Update
        const updateRes = await fetch(`${BASE_URL}/api/owner/seo/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({
                type: 'games',
                id: game.id,
                metaTitle: 'Preserved Retro Exhibit SEO Title',
                metaDescription: 'Comprehensive archival overview of video game history.'
            })
        });
        assert(updateRes.status === 200, 'POST /api/owner/seo/update returns 200');
        const updatedGame = await dbAsync.get('SELECT meta_title, meta_description FROM games WHERE id = ?', [game.id]);
        assert(updatedGame.meta_title === 'Preserved Retro Exhibit SEO Title', 'meta_title persisted');

        // 3. Trigger Search Rebuild Job
        const searchJobRes = await fetch(`${BASE_URL}/api/owner/search/rebuild`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(searchJobRes.status === 200, 'POST /api/owner/search/rebuild returns 200');
        const searchJob = await searchJobRes.json();
        assert(searchJob.job.job_type === 'SEARCH_REBUILD', 'SEARCH_REBUILD job enqueued');

        // 4. Trigger Sitemap Rebuild Job
        const sitemapJobRes = await fetch(`${BASE_URL}/api/owner/sitemap/rebuild`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(sitemapJobRes.status === 200, 'POST /api/owner/sitemap/rebuild returns 200');
        const sitemapJob = await sitemapJobRes.json();
        assert(sitemapJob.job.job_type === 'SITEMAP_REBUILD', 'SITEMAP_REBUILD job enqueued');

        // Allow background worker to complete
        await new Promise(r => setTimeout(r, 2000));

        // Verify search index file exists and is non-empty
        const searchPath = path.resolve(__dirname, '../../data/search-index.json');
        assert(fs.existsSync(searchPath), 'search-index.json exists after rebuild');
        const searchContent = JSON.parse(fs.readFileSync(searchPath, 'utf8'));
        assert(Array.isArray(searchContent) && searchContent.length >= 700, 'Search index contains >= 700 documents');

        console.log('>>> [PASS] SEARCH & SEO HEALTH AUDIT COMPLETED CLEANLY <<<\n');
    } finally {
        await dbAsync.run('UPDATE games SET meta_title = ?, meta_description = ? WHERE id = ?',
            [originalMetaTitle, originalMetaDesc, game.id]);
        stopServer();
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

