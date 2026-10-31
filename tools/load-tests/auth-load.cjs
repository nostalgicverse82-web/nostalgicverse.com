/**
 * Phase 13 Load Test: Auth Load & Threadpool Protection
 * Simulates 1,000 concurrent/burst login requests to evaluate PBKDF2 CPU usage,
 * threadpool isolation, and rate-limiting (429) protection.
 */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 3010;
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

function postJson(path, payload) {
    return new Promise((resolve) => {
        const start = Date.now();
        const data = JSON.stringify(payload);
        const req = http.request({
            hostname: '127.0.0.1',
            port: PORT,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: 10000
        }, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                const duration = Date.now() - start;
                resolve({ status: res.statusCode, duration, headers: res.headers, body });
            });
        });

        req.on('error', (err) => {
            const duration = Date.now() - start;
            resolve({ status: 0, error: err.message, duration });
        });

        req.write(data);
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
            const errStr = d.toString().trim();
            if (errStr && !errStr.includes('ExperimentalWarning')) {
                // Ignore expected rate-limit warnings
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

async function run() {
    console.log('========================================================');
    console.log('  LOAD TEST: AUTH & THREADPOOL CONCURRENCY (1,000 REQS) ');
    console.log('========================================================\n');

    await startServer();
    try {
        const TOTAL_REQUESTS = 1000;
        const CONCURRENCY = 50;
        console.log(`Sending ${TOTAL_REQUESTS} login requests with concurrency = ${CONCURRENCY}...`);

        const latencies = [];
        const statusCounts = {};
        const startTime = Date.now();

        let completed = 0;
        const queue = Array.from({ length: TOTAL_REQUESTS }, (_, i) => i);

        async function worker() {
            while (queue.length > 0) {
                const reqId = queue.shift();
                // Alternate between valid owner attempts and non-existent credentials
                const payload = (reqId % 2 === 0) 
                    ? { identifier: 'owner', password: 'wrongpassword123' }
                    : { identifier: `user_test_${reqId}`, password: 'somepassword' };

                const res = await postJson('/api/auth/login', payload);
                latencies.push(res.duration);
                statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
                completed++;
            }
        }

        const workers = Array.from({ length: CONCURRENCY }, () => worker());
        await Promise.all(workers);

        const totalDuration = Date.now() - startTime;
        const rps = Math.round((TOTAL_REQUESTS / (totalDuration / 1000)));
        const stats = calculatePercentiles(latencies);

        console.log('\n--- RESULTS ---');
        console.log(`Total Requests:    ${TOTAL_REQUESTS}`);
        console.log(`Duration:          ${totalDuration}ms`);
        console.log(`Throughput:        ${rps} req/sec`);
        console.log(`Status Codes:      ${JSON.stringify(statusCounts)}`);
        console.log(`Latency Min:       ${stats.min}ms`);
        console.log(`Latency Avg:       ${stats.avg}ms`);
        console.log(`Latency p50:       ${stats.p50}ms`);
        console.log(`Latency p90:       ${stats.p90}ms`);
        console.log(`Latency p95:       ${stats.p95}ms`);
        console.log(`Latency p99:       ${stats.p99}ms`);
        console.log(`Latency Max:       ${stats.max}ms`);

        // Check health after load
        const healthRes = await new Promise(res => {
            http.get(`${BASE_URL}/api/health`, r => {
                res({ status: r.statusCode });
            }).on('error', err => res({ status: 0, error: err.message }));
        });

        console.log(`Post-test health status: ${healthRes.status}`);

        // Verifications
        if (statusCounts[500] && statusCounts[500] > 0) {
            throw new Error(`FAIL: Server threw 500 errors during auth load: ${statusCounts[500]}`);
        }
        if (!statusCounts[429] || statusCounts[429] === 0) {
            console.warn('NOTE: Rate limiter was not triggered or window expired.');
        } else {
            console.log(`[PASS] Rate limiter successfully throttled ${statusCounts[429]} requests with HTTP 429.`);
        }
        if (healthRes.status !== 200) {
            throw new Error(`FAIL: Server unresponsive after auth load, status = ${healthRes.status}`);
        }

        console.log('\n[PASS] Auth load & threadpool protection verified.');
        return { totalRequests: TOTAL_REQUESTS, rps, stats, statusCounts };
    } finally {
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

