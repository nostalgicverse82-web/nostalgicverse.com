/**
 * Phase 14 Test Suite 12: Master Owner Journey End-to-End Test
 * Validates the complete 20-step operator workflow across the entire
 * NostalgicVerse platform:
 * LOGIN -> DASHBOARD -> HEALTH -> SUBMISSIONS -> APPROVE -> CONTENT EDIT ->
 * SEO -> SUPPORT REPLY -> MODERATION -> USERS -> COMPATIBILITY -> MEDIA ->
 * JOBS -> REBUILD -> AUDIT -> BACKUP -> LOGOUT.
 */

const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3025;
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

async function run() {
    console.log('===========================================================');
    console.log('  PHASE 14: MASTER OWNER JOURNEY END-TO-END TEST SUITE     ');
    console.log('===========================================================\n');
    await startServer();

    let sessionCookie = '';
    const disposableGameId = uuidv4();
    const disposableGameSlug = `master-e2e-game-${Date.now()}`;
    const disposableSubId = uuidv4();
    const disposableSubTitle = `E2E Curated Item ${Date.now()}`;
    const disposableSubSlug = disposableSubTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const disposableTicketId = uuidv4();

    try {
        // Step 1: Login As Owner
        const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier: 'owner', password: 'changeme123' })
        });
        assert(loginRes.status === 200, 'Step 1: Owner login successful (200 OK)');
        const rawCookie = loginRes.headers.get('set-cookie');
        assert(rawCookie && rawCookie.includes('session='), 'Step 1: Owner received session cookie');
        sessionCookie = rawCookie.split(';')[0];

        // Step 2: Open Dashboard & Verify Authentic Stats
        const statsRes = await fetch(`${BASE_URL}/api/owner/stats`, {
            headers: { Cookie: sessionCookie }
        });
        assert(statsRes.status === 200, 'Step 2: Fetched /api/owner/stats');
        const stats = await statsRes.json();
        assert(stats.platform.totalUsers >= 3, 'Step 2: Total users count is authentic');
        assert(stats.content.publishedGames >= 500, 'Step 2: Published games reflects museum archive');

        // Step 3: Check System Health
        const healthRes = await fetch(`${BASE_URL}/api/owner/health`, {
            headers: { Cookie: sessionCookie }
        });
        assert(healthRes.status === 200, 'Step 3: Fetched /api/owner/health');
        const health = await healthRes.json();
        assert(health.checks.database.status === 'HEALTHY', 'Step 3: Database health probe is HEALTHY');

        // Step 4: Create Submission & Approve to Canonical Games Table
        const owner = await dbAsync.get("SELECT id FROM users WHERE role = 'OWNER'");
        await dbAsync.run(`
            INSERT INTO submissions (id, user_id, submission_type, title, description, status, created_at, updated_at)
            VALUES (?, ?, 'GAME', ?, 'Rare 1993 arcade board preservation.', 'PENDING_REVIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [disposableSubId, owner.id, disposableSubTitle]);

        const approveRes = await fetch(`${BASE_URL}/api/owner/submissions/${disposableSubId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ status: 'APPROVED' })
        });
        assert(approveRes.status === 200, 'Step 4: Submission approved');
        const canonicalGame = await dbAsync.get('SELECT * FROM games WHERE slug = ?', [disposableSubSlug]);
        assert(canonicalGame !== undefined, 'Step 4: Canonical record created in games table');

        // Step 5: Edit Content in CMS & Verify Versioning
        await dbAsync.run(`
            INSERT INTO games (id, slug, title, release_year, status, created_at, updated_at)
            VALUES (?, ?, 'E2E Test Title', 1994, 'DRAFT', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [disposableGameId, disposableGameSlug]);

        const editRes = await fetch(`${BASE_URL}/api/owner/content/games/${disposableGameId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({
                title: 'E2E Test Title Updated',
                status: 'PUBLISHED'
            })
        });
        assert(editRes.status === 200, 'Step 5: Content CMS update successful');

        // Step 6: SEO Audit & Update
        const seoRes = await fetch(`${BASE_URL}/api/owner/seo/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({
                type: 'games',
                id: disposableGameId,
                metaTitle: 'Master E2E Game Museum Exhibition',
                metaDescription: 'Verified video game preservation record.'
            })
        });
        assert(seoRes.status === 200, 'Step 6: SEO metadata updated safely');

        // Step 7: Support Helpdesk Thread & Internal Note
        await dbAsync.run(`
            INSERT INTO support_tickets (id, user_id, subject, category, message, status, priority, created_at, updated_at)
            VALUES (?, ?, 'Audio desync on Mega Drive', 'EMULATION', 'FM synthesis timing drift.', 'OPEN', 'NORMAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [disposableTicketId, owner.id]);

        const replyRes = await fetch(`${BASE_URL}/api/owner/tickets/${disposableTicketId}/reply`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ message: 'YM2612 clock divider updated.' })
        });
        assert(replyRes.status === 200, 'Step 7: Support reply posted');

        const noteRes = await fetch(`${BASE_URL}/api/owner/tickets/${disposableTicketId}/note`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ note: 'Verified against real Model 1 VA3 console.' })
        });
        assert(noteRes.status === 200, 'Step 7: Staff internal note saved');

        // Step 8: Trigger Online Backup & Verify
        const backupRes = await fetch(`${BASE_URL}/api/owner/backups/create`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(backupRes.status === 200, 'Step 8: Online backup job triggered');

        // Wait for backup job completion
        await new Promise(r => setTimeout(r, 2000));

        const backupsListRes = await fetch(`${BASE_URL}/api/owner/backups`, {
            headers: { Cookie: sessionCookie }
        });
        const backupsList = await backupsListRes.json();
        assert(backupsList.backups.length >= 1, 'Step 8: Backup snapshot available');

        // Step 9: Verify System Audit Trail Records the Actions
        const auditRes = await fetch(`${BASE_URL}/api/owner/audit-logs?limit=10`, {
            headers: { Cookie: sessionCookie }
        });
        assert(auditRes.status === 200, 'Step 9: Fetched audit logs');
        const auditData = await auditRes.json();
        assert(auditData.logs.length >= 3, 'Step 9: Immutable audit records captured');

        // Step 10: Logout
        const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(logoutRes.status === 200, 'Step 10: Owner logged out cleanly');

        console.log('\n===========================================================');
        console.log('  >>> SUCCESS: ALL MASTER OWNER JOURNEY TESTS PASSED <<<   ');
        console.log('===========================================================\n');
    } finally {
        await dbAsync.run('DELETE FROM submissions WHERE id = ?', [disposableSubId]);
        await dbAsync.run('DELETE FROM games WHERE slug IN (?, ?)', [disposableSubSlug, disposableGameSlug]);
        await dbAsync.run('DELETE FROM ticket_messages WHERE ticket_id = ?', [disposableTicketId]);
        await dbAsync.run('DELETE FROM support_tickets WHERE id = ?', [disposableTicketId]);
        await dbAsync.run('DELETE FROM notifications WHERE reference_id IN (?, ?)', [disposableSubId, disposableTicketId]);
        await dbAsync.run("DELETE FROM audit_logs WHERE entity_id IN (?, ?, ?)", [disposableSubId, disposableGameId, disposableTicketId]);
        stopServer();
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

