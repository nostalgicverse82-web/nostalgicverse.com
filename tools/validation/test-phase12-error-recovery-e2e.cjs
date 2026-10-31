/**
 * Phase 12 E2E Test Suite 4: Error Handling & Recovery E2E
 * Tests HTTP 401 unauthenticated access, 403 forbidden access,
 * 400 bad requests, 404 not found, input boundary validation,
 * and database consistency.
 */
const { spawn } = require('child_process');
const path = require('path');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3007;
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
        setTimeout(() => {
            if (!started) reject(new Error('Server startup timed out'));
        }, 10000);
    });
}

function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

async function cleanupTestData(usernames = ['e2e_p12_err_user']) {
    for (const u of usernames) {
        const row = await dbAsync.get('SELECT id FROM users WHERE username = ?', [u]);
        if (!row) continue;
        const uid = row.id;

        await dbAsync.run('DELETE FROM reviews WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM comments WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM sessions WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM user_profiles WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM users WHERE id = ?', [uid]);
    }
}

async function run() {
    console.log('=== PHASE 12: ERROR HANDLING & RECOVERY E2E TEST ===');
    await startServer();
    console.log('[SERVER] Running on', BASE_URL);

    const TEST_USER = { username: 'e2e_p12_err_user', email: 'err_user@test.local', password: 'Password123!', confirmPassword: 'Password123!', displayName: 'Error Tester' };

    try {
        await cleanupTestData([TEST_USER.username]);

        // 1. Unauthenticated 401s on protected endpoints
        const resAccount = await fetch(`${BASE_URL}/api/account/summary`);
        assert(resAccount.status === 401, 'Unauthenticated /api/account/summary returns 401');

        const resFriends = await fetch(`${BASE_URL}/api/users/friends/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: 'some-id' })
        });
        assert(resFriends.status === 401, 'Unauthenticated /api/users/friends/request returns 401');

        const resComment = await fetch(`${BASE_URL}/api/community/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target_type: 'GAME', target_id: 'any', body: 'hello' })
        });
        assert(resComment.status === 401, 'Unauthenticated /api/community/comments returns 401');

        // 2. Forbidden 403 on owner endpoints for normal authenticated user
        const regRes = await fetch(`${BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(TEST_USER)
        });
        assert(regRes.ok, 'Test user registered');
        const userCookie = regRes.headers.get('set-cookie');

        const resOwnerStats = await fetch(`${BASE_URL}/api/owner/stats`, {
            headers: { 'Cookie': userCookie }
        });
        assert(resOwnerStats.status === 403, 'Normal user accessing /api/owner/stats returns 403 Forbidden');

        // 3. 400 Bad Requests: Validation failures
        // Signup with mismatched passwords
        const badSignup = await fetch(`${BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: 'bad_user',
                email: 'bad@test.local',
                displayName: 'Bad',
                password: 'Password123!',
                confirmPassword: 'MismatchPassword!'
            })
        });
        assert(badSignup.status === 400, 'Signup with password mismatch returns 400');

        // Review with invalid rating (> 10)
        const badReview = await fetch(`${BASE_URL}/api/community/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': userCookie },
            body: JSON.stringify({
                target_type: 'GAME',
                target_id: 'any',
                rating: 15,
                body: 'Out of range rating'
            })
        });
        assert(badReview.status === 400, 'Review with rating > 10 returns 400');

        // Empty comment
        const badComment = await fetch(`${BASE_URL}/api/community/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': userCookie },
            body: JSON.stringify({
                target_type: 'GAME',
                target_id: 'any',
                body: '   '
            })
        });
        assert(badComment.status === 400, 'Empty comment body returns 400');

        // 4. 404 Not Found Handling
        const missingProfile = await fetch(`${BASE_URL}/api/users/profile/non_existent_archivist_9999`);
        assert(missingProfile.status === 404, 'Non-existent profile returns 404');

        const missingGame = await fetch(`${BASE_URL}/api/content/games/non-existent-game-slug-9999`);
        assert(missingGame.status === 404, 'Non-existent game content item returns 404');

        console.log('[SUCCESS] All Error Handling & Recovery assertions passed cleanly!');
    } finally {
        await cleanupTestData([TEST_USER.username]);
        stopServer();

        const fkCheck = await dbAsync.all('PRAGMA foreign_key_check');
        assert(fkCheck.length === 0, `Database has 0 foreign key violations after test (found ${fkCheck.length})`);
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

