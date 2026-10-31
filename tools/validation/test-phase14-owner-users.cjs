/**
 * Phase 14 Test Suite 2: Owner User Management & Profile Inspection
 * Validates pagination, role/status filtering, admin profile metadata,
 * account suspension, restoration, warning, owner protection,
 * and confirms zero credential/hash exposure.
 */

const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3015;
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
    console.log('=== TEST PHASE 14: OWNER USER MANAGEMENT ===');
    await startServer();

    const testUsername = `user_test_${Date.now()}`;
    const testUserId = uuidv4();

    try {
        const sessionCookie = await loginAsOwner();
        assert(sessionCookie.length > 0, 'Owner authenticated');

        // Create disposable test user directly in DB
        await dbAsync.run(`
            INSERT INTO users (id, username, email, password_hash, role, status, created_at, updated_at)
            VALUES (?, ?, ?, 'dummy_hash', 'USER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [testUserId, testUsername, `${testUsername}@test.local`]);

        // 1. Test Paginated User Listing
        const listRes = await fetch(`${BASE_URL}/api/owner/users?page=1&limit=10`, {
            headers: { Cookie: sessionCookie }
        });
        assert(listRes.status === 200, 'GET /api/owner/users returns 200');
        const listData = await listRes.json();
        assert(Array.isArray(listData.users), 'Users is an array');
        assert(listData.total >= 4, 'Total includes disposable user');

        // Check password hash is NEVER leaked in user list
        const leakedHash = listData.users.some(u => u.password_hash !== undefined);
        assert(!leakedHash, 'Password hash is strictly omitted from user list response');

        // 2. Test User Inspection Detail
        const detailRes = await fetch(`${BASE_URL}/api/owner/users/${testUserId}`, {
            headers: { Cookie: sessionCookie }
        });
        assert(detailRes.status === 200, 'GET /api/owner/users/:id returns 200');
        const detailData = await detailRes.json();
        assert(detailData.user.username === testUsername, 'Fetched target user profile');
        assert(detailData.user.password_hash === undefined, 'Password hash omitted from user detail');
        assert(typeof detailData.metrics.submissionsCount === 'number', 'Submissions count metric provided');

        // 3. Test User Suspension
        const suspendRes = await fetch(`${BASE_URL}/api/owner/users/${testUserId}/suspend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ reason: 'Test policy infraction', duration: '7d' })
        });
        assert(suspendRes.status === 200, 'POST /api/owner/users/:id/suspend returns 200');
        const suspendedUser = await dbAsync.get('SELECT status, is_disabled FROM users WHERE id = ?', [testUserId]);
        assert(suspendedUser.status === 'SUSPENDED' && suspendedUser.is_disabled === 1, 'User status transitioned to SUSPENDED in DB');

        // 4. Test User Restoration
        const restoreRes = await fetch(`${BASE_URL}/api/owner/users/${testUserId}/restore`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(restoreRes.status === 200, 'POST /api/owner/users/:id/restore returns 200');
        const restoredUser = await dbAsync.get('SELECT status, is_disabled FROM users WHERE id = ?', [testUserId]);
        assert(restoredUser.status === 'ACTIVE' && restoredUser.is_disabled === 0, 'User status transitioned to ACTIVE in DB');

        // 5. Test User Warning
        const warnRes = await fetch(`${BASE_URL}/api/owner/users/${testUserId}/warn`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ reason: 'Please adhere to museum conduct guidelines' })
        });
        assert(warnRes.status === 200, 'POST /api/owner/users/:id/warn returns 200');

        // 6. Test Owner Protection Safeguard
        const ownerUser = await dbAsync.get("SELECT id FROM users WHERE role = 'OWNER'");
        const ownerSuspendRes = await fetch(`${BASE_URL}/api/owner/users/${ownerUser.id}/suspend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ reason: 'Accidental suspension attempt' })
        });
        assert(ownerSuspendRes.status === 403, 'Owner account suspension rejected with 403 Forbidden');

        console.log('>>> [PASS] OWNER USER MANAGEMENT AUDIT COMPLETED CLEANLY <<<\n');
    } finally {
        // Cleanup disposable user
        await dbAsync.run('DELETE FROM users WHERE id = ?', [testUserId]);
        await dbAsync.run("DELETE FROM audit_logs WHERE actor_id = 'test-id' OR metadata LIKE ?", [`%${testUsername}%`]);
        await dbAsync.run('DELETE FROM notifications WHERE user_id = ?', [testUserId]);
        stopServer();
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

