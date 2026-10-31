/**
 * Phase 14 Test Suite 3: Content CMS, Versioning & Optimistic Locking
 * Validates content creation, retrieval, updates, optimistic concurrency conflict,
 * automatic snapshotting into content_versions, restoration, and content health check.
 */

const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3016;
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
    console.log('=== TEST PHASE 14: CONTENT CMS & VERSIONING ===');
    await startServer();

    let testGameId = null;
    const testSlug = `disposable-test-game-${Date.now()}`;

    try {
        const sessionCookie = await loginAsOwner();
        assert(sessionCookie.length > 0, 'Owner authenticated');

        // 1. Create Disposable Game
        const createRes = await fetch(`${BASE_URL}/api/owner/content/games`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({
                title: 'Disposable Test Game',
                slug: testSlug,
                release_year: 1995,
                developer: 'Test Devs',
                publisher: 'Test Pubs',
                description: 'Initial description of test game.',
                status: 'DRAFT'
            })
        });
        assert(createRes.status === 200, 'POST /api/owner/content/games returns 200');
        const createData = await createRes.json();
        testGameId = createData.id;
        assert(testGameId && testGameId.length > 0, 'Returned valid game ID');

        // Verify version 1 created
        const versionsRes1 = await fetch(`${BASE_URL}/api/owner/content/games/${testGameId}/versions`, {
            headers: { Cookie: sessionCookie }
        });
        const versions1 = await versionsRes1.json();
        assert(versions1.versions.length >= 1, 'Initial snapshot recorded in content_versions');
        const initialVersionId = versions1.versions[0].id;

        // 2. Fetch Created Game
        const getRes = await fetch(`${BASE_URL}/api/owner/content/games/${testGameId}`, {
            headers: { Cookie: sessionCookie }
        });
        assert(getRes.status === 200, 'GET /api/owner/content/games/:id returns 200');
        const getData = await getRes.json();
        assert(getData.item.title === 'Disposable Test Game', 'Correct game title fetched');
        const currentUpdatedAt = getData.item.updated_at;

        // 3. Update Game
        const updateRes = await fetch(`${BASE_URL}/api/owner/content/games/${testGameId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({
                title: 'Disposable Test Game Updated',
                description: 'Updated description for versioning test.'
            })
        });
        assert(updateRes.status === 200, 'PUT /api/owner/content/games/:id returns 200');

        // Verify version 2 recorded
        const versionsRes2 = await fetch(`${BASE_URL}/api/owner/content/games/${testGameId}/versions`, {
            headers: { Cookie: sessionCookie }
        });
        const versions2 = await versionsRes2.json();
        assert(versions2.versions.length >= 2, 'Second snapshot recorded in content_versions');

        // 4. Test Optimistic Concurrency Conflict
        const staleRes = await fetch(`${BASE_URL}/api/owner/content/games/${testGameId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({
                title: 'Conflicting Concurrent Edit',
                expected_updated_at: '2020-01-01T00:00:00.000Z' // Stale timestamp
            })
        });
        assert(staleRes.status === 409, 'Stale concurrent update rejected with 409 Conflict');

        // 5. Test Version Restoration
        const restoreRes = await fetch(`${BASE_URL}/api/owner/content/games/${testGameId}/restore-version`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ versionId: initialVersionId })
        });
        assert(restoreRes.status === 200, 'POST /api/owner/content/:type/:id/restore-version returns 200');
        const restoredGame = await dbAsync.get('SELECT title FROM games WHERE id = ?', [testGameId]);
        assert(restoredGame.title === 'Disposable Test Game', 'Game title restored to initial state');

        // 6. Test Content Health
        const healthRes = await fetch(`${BASE_URL}/api/owner/content-health`, {
            headers: { Cookie: sessionCookie }
        });
        assert(healthRes.status === 200, 'GET /api/owner/content-health returns 200');
        const healthData = await healthRes.json();
        assert(Array.isArray(healthData.issues), 'Content health returns issues array');

        console.log('>>> [PASS] CONTENT CMS & VERSIONING AUDIT COMPLETED CLEANLY <<<\n');
    } finally {
        if (testGameId) {
            await dbAsync.run('DELETE FROM games WHERE id = ?', [testGameId]);
            await dbAsync.run("DELETE FROM content_versions WHERE entity_id = ?", [testGameId]);
            await dbAsync.run("DELETE FROM audit_logs WHERE entity_id = ?", [testGameId]);
        }
        stopServer();
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

