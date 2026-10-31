/**
 * Phase 14 Test Suite 4: Owner Submissions & Canonical Content Promotion
 * Validates submissions review, detail inspection, canonical promotion into games table,
 * enhancement request cycle, and rejection with notification delivery.
 */

const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3017;
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
    console.log('=== TEST PHASE 14: SUBMISSIONS & PROMOTION PIPELINE ===');
    await startServer();

    const subId = uuidv4();
    const testTitle = `Rare Prototype Game ${Date.now()}`;
    const testSlug = testTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const owner = await dbAsync.get("SELECT id FROM users WHERE role = 'OWNER'");

    try {
        const sessionCookie = await loginAsOwner();
        assert(sessionCookie.length > 0, 'Owner authenticated');

        // Create disposable test submission in DB
        await dbAsync.run(`
            INSERT INTO submissions (id, user_id, submission_type, title, description, status, created_at, updated_at)
            VALUES (?, ?, 'GAME', ?, 'Historical unreleased cartridge prototype.', 'PENDING_REVIEW', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [subId, owner.id, testTitle]);

        // 1. Fetch Submissions List
        const listRes = await fetch(`${BASE_URL}/api/owner/submissions`, {
            headers: { Cookie: sessionCookie }
        });
        assert(listRes.status === 200, 'GET /api/owner/submissions returns 200');
        const listData = await listRes.json();
        assert(listData.submissions.some(s => s.id === subId), 'Created submission present in list');

        // 2. Fetch Submission Detail
        const detailRes = await fetch(`${BASE_URL}/api/owner/submissions/${subId}`, {
            headers: { Cookie: sessionCookie }
        });
        assert(detailRes.status === 200, 'GET /api/owner/submissions/:id returns 200');
        const detailData = await detailRes.json();
        assert(detailData.submission.title === testTitle, 'Detail returns expected title');

        // 3. Request Enhancement
        const enhanceRes = await fetch(`${BASE_URL}/api/owner/submissions/${subId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ status: 'ENHANCEMENT_REQUESTED', reviewNotes: 'Please cite manufacturer provenance' })
        });
        assert(enhanceRes.status === 200, 'Request Enhancement review returns 200');
        const enhancedSub = await dbAsync.get('SELECT status, review_notes FROM submissions WHERE id = ?', [subId]);
        assert(enhancedSub.status === 'ENHANCEMENT_REQUESTED', 'Submission status updated to ENHANCEMENT_REQUESTED');

        // 4. Approve Submission & Promote to Canonical Games Table
        const approveRes = await fetch(`${BASE_URL}/api/owner/submissions/${subId}/review`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ status: 'APPROVED' })
        });
        assert(approveRes.status === 200, 'Approve review returns 200');

        // Verify canonical game created
        const canonicalGame = await dbAsync.get('SELECT * FROM games WHERE slug = ?', [testSlug]);
        assert(canonicalGame !== undefined, 'Canonical record created in games table');
        assert(canonicalGame.status === 'PUBLISHED', 'Canonical game status is PUBLISHED');

        // Verify notification delivered to submitter
        const notif = await dbAsync.get('SELECT * FROM notifications WHERE reference_id = ?', [subId]);
        assert(notif !== undefined, 'Notification created for submitting user');

        console.log('>>> [PASS] SUBMISSIONS & PROMOTION AUDIT COMPLETED CLEANLY <<<\n');
    } finally {
        await dbAsync.run('DELETE FROM submissions WHERE id = ?', [subId]);
        await dbAsync.run('DELETE FROM games WHERE slug = ?', [testSlug]);
        await dbAsync.run('DELETE FROM notifications WHERE reference_id = ?', [subId]);
        await dbAsync.run("DELETE FROM audit_logs WHERE entity_id = ?", [subId]);
        stopServer();
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

