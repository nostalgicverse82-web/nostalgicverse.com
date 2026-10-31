/**
 * Phase 13 Load Test: Search Storm & Malformed Query Resilience
 * Stresses search API with 1,000 queries including normal terms, wildcard floods (%%%),
 * SQL injection probes, oversized strings (150+ chars), and empty inputs.
 */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const PORT = 3013;
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

function getHttp(urlPath) {
    return new Promise((resolve) => {
        const start = Date.now();
        const req = http.get({
            hostname: '127.0.0.1',
            port: PORT,
            path: urlPath,
            timeout: 5000
        }, (res) => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('end', () => {
                const duration = Date.now() - start;
                let parsed = null;
                try { parsed = JSON.parse(body); } catch (_) {}
                resolve({ status: res.statusCode, duration, body: parsed, rawBody: body });
            });
        });

        req.on('error', (err) => {
            resolve({ status: 0, error: err.message, duration: Date.now() - start });
        });
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
    console.log('  LOAD TEST: SEARCH STORM & QUERY DEFENSE (1,000 REQS)  ');
    console.log('========================================================\n');

    await startServer();

    try {
        const queries = [
            'mario', 'zelda', 'sonic', 'playstation', 'nintendo', 'final fantasy',
            '%%%%%%%%', '______', '%%%mario%%%',
            "' OR '1'='1", "'; DROP TABLE users; --",
            'A'.repeat(150), // Oversized query
            '   ', '', '!@#$%^&*()',
            '1985', '1998', 'rpg', 'adventure'
        ];

        const TOTAL_REQUESTS = 1000;
        const CONCURRENCY = 25;
        console.log(`Executing ${TOTAL_REQUESTS} search requests with concurrency = ${CONCURRENCY}...`);

        const latencies = [];
        const statusCounts = {};
        const startTime = Date.now();

        const queue = Array.from({ length: TOTAL_REQUESTS }, (_, i) => i);

        async function worker() {
            while (queue.length > 0) {
                const reqId = queue.shift();
                const q = queries[reqId % queries.length];
                const res = await getHttp(`/api/search?q=${encodeURIComponent(q)}`);
                latencies.push(res.duration);
                statusCounts[res.status] = (statusCounts[res.status] || 0) + 1;
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

        if (statusCounts[500] && statusCounts[500] > 0) {
            throw new Error(`FAIL: Search threw 500 errors on abusive queries: ${statusCounts[500]}`);
        }

        console.log('\n[PASS] Search storm & query defense verified.');
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

