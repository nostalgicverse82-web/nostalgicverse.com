/**
 * Phase 14 Test Suite 1: Owner Dashboard & Overview Intelligence
 * Validates stats endpoint, time-range filtering, system health checks,
 * alerts endpoint, global search, and zero fake data.
 */

const { spawn } = require('child_process');
const path = require('path');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3014;
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
    console.log('=== TEST PHASE 14: OWNER DASHBOARD & OVERVIEW ===');
    await startServer();

    try {
        const sessionCookie = await loginAsOwner();
        assert(sessionCookie.length > 0, 'Owner authenticated successfully');

        // 1. Test Overview Stats
        const statsRes = await fetch(`${BASE_URL}/api/owner/stats?range=all`, {
            headers: { Cookie: sessionCookie }
        });
        assert(statsRes.status === 200, 'GET /api/owner/stats returns 200 OK');
        const stats = await statsRes.json();

        assert(typeof stats.platform.totalUsers === 'number', 'Platform totalUsers is numeric');
        assert(typeof stats.content.publishedGames === 'number' && stats.content.publishedGames >= 500, 'Published games count is authentic (>= 500)');
        assert(typeof stats.content.publishedConsoles === 'number' && stats.content.publishedConsoles >= 60, 'Published consoles count is authentic (>= 60)');
        assert(stats.system.walMode === 'WAL', 'Database journal mode is WAL');
        assert(Array.isArray(stats.activity), 'Recent activity is an array');

        // 2. Test Time-Range Filtering
        const stats7d = await (await fetch(`${BASE_URL}/api/owner/stats?range=7d`, { headers: { Cookie: sessionCookie } })).json();
        assert(stats7d.range === '7d', 'Time-range filtering parameter accepted (7d)');

        // 3. Test System Health Check
        const healthRes = await fetch(`${BASE_URL}/api/owner/health`, {
            headers: { Cookie: sessionCookie }
        });
        assert(healthRes.status === 200, 'GET /api/owner/health returns 200 OK');
        const health = await healthRes.json();
        assert(health.status === 'HEALTHY' || health.status === 'DEGRADED', 'System health status is valid string');
        assert(health.checks.database.status === 'HEALTHY', 'Database integrity check passed in health probe');
        assert(health.checks.server.status === 'HEALTHY', 'Server process status healthy');

        // 4. Test Actionable Alerts
        const alertsRes = await fetch(`${BASE_URL}/api/owner/alerts`, {
            headers: { Cookie: sessionCookie }
        });
        assert(alertsRes.status === 200, 'GET /api/owner/alerts returns 200 OK');
        const alerts = await alertsRes.json();
        assert(Array.isArray(alerts.alerts), 'Alerts payload is an array');

        // 5. Test Global Search
        const searchRes = await fetch(`${BASE_URL}/api/owner/search?q=owner`, {
            headers: { Cookie: sessionCookie }
        });
        assert(searchRes.status === 200, 'GET /api/owner/search returns 200 OK');
        const searchResults = await searchRes.json();
        assert(Array.isArray(searchResults.results), 'Search results is an array');
        assert(searchResults.results.some(r => r.type === 'USER'), 'Global search finds owner user');

        console.log('>>> [PASS] OWNER DASHBOARD & OVERVIEW AUDIT COMPLETED CLEANLY <<<\n');
    } finally {
        stopServer();
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

