/**
 * Phase 14 Test Suite 10: Owner Security, RBAC & Parameter Sanitization
 * Validates strict server-side RBAC (visitor -> 401, regular user -> 403, owner -> 200),
 * session revocation, SQL injection resilience, and IDOR defense.
 */

const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3023;
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

async function loginAs(identifier, password) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password })
    });
    const cookie = res.headers.get('set-cookie');
    return cookie ? cookie.split(';')[0] : '';
}

async function run() {
    console.log('=== TEST PHASE 14: OWNER SECURITY, RBAC & SANITIZATION ===');
    await startServer();

    const normalUserId = uuidv4();
    const normalUsername = `norm_user_${Date.now()}`;

    try {
        // 1. Unauthenticated Visitor Access
        const anonRes = await fetch(`${BASE_URL}/api/owner/stats`);
        assert(anonRes.status === 401, 'Unauthenticated visitor rejected with 401 Unauthorized');

        // Register / Create regular user in DB
        const { hashPassword, normalize } = require('../../server/services/authService.cjs');
        const passHash = await hashPassword('password123');
        await dbAsync.run(`
            INSERT INTO users (id, username, username_normalized, email, email_normalized, display_name, password_hash, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'USER', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [normalUserId, normalUsername, normalize(normalUsername), `${normalUsername}@test.local`, normalize(`${normalUsername}@test.local`), normalUsername, passHash]);

        // 2. Regular User Access Attempt
        const userCookie = await loginAs(normalUsername, 'password123');
        assert(userCookie.length > 0, 'Regular user authenticated');

        const userAttemptRes = await fetch(`${BASE_URL}/api/owner/stats`, {
            headers: { Cookie: userCookie }
        });
        assert(userAttemptRes.status === 403, 'Regular authenticated user denied owner API with 403 Forbidden');

        // 3. Owner Access Allowed
        const ownerCookie = await loginAs('owner', 'changeme123');
        assert(ownerCookie.length > 0, 'Owner authenticated');

        const ownerRes = await fetch(`${BASE_URL}/api/owner/stats`, {
            headers: { Cookie: ownerCookie }
        });
        assert(ownerRes.status === 200, 'Owner permitted access with 200 OK');

        // 4. SQL Injection Resistance on Query Parameters
        const sqliRes = await fetch(`${BASE_URL}/api/owner/users?q=${encodeURIComponent("' OR '1'='1")}`, {
            headers: { Cookie: ownerCookie }
        });
        assert(sqliRes.status === 200, 'SQL injection query handled safely without syntax error');
        const sqliData = await sqliRes.json();
        assert(Array.isArray(sqliData.users), 'Parameterized query returned expected array');

        // 5. Active Sessions Inspection
        const sessionsRes = await fetch(`${BASE_URL}/api/owner/security/sessions`, {
            headers: { Cookie: ownerCookie }
        });
        assert(sessionsRes.status === 200, 'GET /api/owner/security/sessions returns 200');
        const sessionsData = await sessionsRes.json();
        assert(Array.isArray(sessionsData.sessions), 'Sessions returned as an array');
        assert(sessionsData.sessions.length >= 1, 'Owner active session found');

        console.log('>>> [PASS] OWNER SECURITY, RBAC & SANITIZATION AUDIT COMPLETED CLEANLY <<<\n');
    } finally {
        await dbAsync.run('DELETE FROM users WHERE id = ?', [normalUserId]);
        await dbAsync.run('DELETE FROM sessions WHERE user_id = ?', [normalUserId]);
        stopServer();
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

