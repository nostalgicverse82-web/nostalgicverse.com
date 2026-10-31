/**
 * Phase 13 Load Test: Mixed Realistic Traffic Distribution
 * Simulates a realistic traffic ratio: 90% public reads, 8% writes (reactions/comments),
 * 2% session verification, measuring composite latency and system resilience.
 */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { dbAsync } = require('../../server/db/connection.cjs');
const { createSession, destroySession } = require('../../server/services/authService.cjs');

const PORT = 3015;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let serverProcess = null;

function calculatePercentiles(latencies) {
    if (latencies.length === 0) return { p50: 0, p90: 0, p95: 0, p99: 0, min: 0, max: 0, avg: 0 };
    latencies.sort((a, b) => a - b);
    const p = (pct) => latencies[Math.min(Math.floor(latencies.length * pct), latencies.length - 1)];
    const sum = latencies.reduce((a, b) => a + b, 0);
    return {
        min: latencies[0],
        max: latencies[latencies.length - 1],
        avg: Math.round(sum / latencies.length),
        p50: p(0.50),
        p90: p(0.90),
        p95: p(0.95),
        p99: p(0.99)
    };
}

function requestHttp(method, urlPath, headers = {}, body = null) {
    return new Promise((resolve) => {
        const start = Date.now();
        const data = body ? JSON.stringify(body) : null;
        const allHeaders = { ...headers };
        if (data) {
            allHeaders['Content-Type'] = 'application/json';
            allHeaders['Content-Length'] = Buffer.byteLength(data);
        }

        const req = http.request({
            hostname: '127.0.0.1',
            port: PORT,
            path: urlPath,
            method: method,
            headers: allHeaders,
            timeout: 10000
        }, (res) => {
            let resBody = '';
            res.on('data', chunk => { resBody += chunk; });
            res.on('end', () => {
                resolve({ status: res.statusCode, duration: Date.now() - start, body: resBody });
            });
        });

        req.on('error', (err) => {
            resolve({ status: 0, error: err.message, duration: Date.now() - start });
        });

        if (data) req.write(data);
        req.end();
    });
}

async function startServer() {
    return new Promise((resolve, reject) => {
        serverProcess = spawn('node', ['server/index.cjs'], {
            cwd: path.resolve(__dirname, '../../'),
            env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' }
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
            console.error('[SERVER STDERR]', d.toString());
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

async function run() {
    console.log('========================================================');
    console.log('  LOAD TEST: MIXED REALISTIC TRAFFIC (500 REQS)         ');
    console.log('  Ratio: 90% Read, 8% Community Write, 2% Auth Check    ');
    console.log('========================================================\n');

    await startServer();

    let session = null;
    const testPrefix = `mixed_${Date.now().toString(36)}`;

    try {
        const owner = await dbAsync.get("SELECT id, username FROM users WHERE role = 'OWNER' LIMIT 1");
        if (!owner) throw new Error('Owner account missing');

        session = await createSession(owner.id, 1, '127.0.0.1', 'MixedLoadTester');
        const authCookie = `session=${session.token}`;

        const TOTAL_REQUESTS = 500;
        const CONCURRENCY = 20;

        const readLatencies = [];
        const writeLatencies = [];
        const authLatencies = [];
        const statusCounts = {};

        const readRoutes = ['/', '/games/', '/api/search?q=pac-man', '/api/health', '/consoles/'];

        const queue = Array.from({ length: TOTAL_REQUESTS }, (_, i) => i);
        const startTime = Date.now();

        async function worker() {
            while (queue.length > 0) {
                const reqId = queue.shift();
                const roll = reqId % 100;

                let res;
                if (roll < 90) {
                    // 90% Read
                    const route = readRoutes[reqId % readRoutes.length];
                    res = await requestHttp('GET', route);
                    readLatencies.push(res.duration);
                } else if (roll < 98) {
                    // 8% Write (Reaction)
                    res = await requestHttp('POST', '/api/community/reactions', { 
                        Cookie: authCookie,
                        'X-Forwarded-For': `10.1.0.${(reqId % 10) + 1}`
                    }, {
                        target_type: 'GAME',
                        target_id: 'pac-man',
                        reaction_type: reqId % 2 === 0 ? 'LIKE' : null
                    });
                    writeLatencies.push(res.duration);
                } else {
                    // 2% Auth check
                    res = await requestHttp('GET', '/api/auth/me', { Cookie: authCookie });
                    authLatencies.push(res.duration);
                }

                if (res.status === 500) {
                    console.error('[500 ERROR]', reqId, 'Route was:', (roll < 90 ? readRoutes[reqId % readRoutes.length] : (roll < 98 ? '/api/community/reactions' : '/api/auth/me')), 'Body:', res.body);
                }

                statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
            }
        }

        const workers = Array.from({ length: CONCURRENCY }, () => worker());
        await Promise.all(workers);

        const totalDuration = Date.now() - startTime;
        const rps = Math.round((TOTAL_REQUESTS / (totalDuration / 1000)));

        console.log('\n--- RESULTS ---');
        console.log(`Total Requests:    ${TOTAL_REQUESTS}`);
        console.log(`Duration:          ${totalDuration}ms`);
        console.log(`Throughput:        ${rps} req/sec`);
        console.log(`Status Codes:      ${JSON.stringify(statusCounts)}`);

        const readStats = calculatePercentiles(readLatencies);
        const writeStats = calculatePercentiles(writeLatencies);
        const authStats = calculatePercentiles(authLatencies);

        console.log('\nRead Latencies (90% traffic):');
        console.log(`  p50: ${readStats.p50}ms, p95: ${readStats.p95}ms, p99: ${readStats.p99}ms, avg: ${readStats.avg}ms`);

        console.log('Write Latencies (8% traffic):');
        console.log(`  p50: ${writeStats.p50}ms, p95: ${writeStats.p95}ms, p99: ${writeStats.p99}ms, avg: ${writeStats.avg}ms`);

        console.log('Auth Latencies (2% traffic):');
        console.log(`  p50: ${authStats.p50}ms, p95: ${authStats.p95}ms, p99: ${authStats.p99}ms, avg: ${authStats.avg}ms`);

        if (statusCounts[500] && statusCounts[500] > 0) {
            throw new Error(`FAIL: 500 errors detected in mixed traffic: ${statusCounts[500]}`);
        }

        console.log('\n[PASS] Mixed realistic traffic test complete.');
        return { totalRequests: TOTAL_REQUESTS, rps, readStats, writeStats, authStats, statusCounts };
    } finally {
        if (session) {
            await destroySession(session.token);
        }
        stopServer();
    }
}

if (require.main === module) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { run };
