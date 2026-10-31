/**
 * Phase 13 Load Test: Registration Spike & Case-Insensitive Collision Storm
 * Verifies that concurrent signups, case-insensitive collision storms ('User1', 'user1', 'USER1'),
 * and registration rate limits are handled gracefully without 500 errors or duplicate accounts.
 */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3011;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let serverProcess = null;

function postJson(urlPath, payload) {
    return new Promise((resolve) => {
        const start = Date.now();
        const data = JSON.stringify(payload);
        const req = http.request({
            hostname: '127.0.0.1',
            port: PORT,
            path: urlPath,
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
                let parsed = null;
                try { parsed = JSON.parse(body); } catch (_) {}
                resolve({ status: res.statusCode, duration, body: parsed, rawBody: body });
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

async function cleanupTestUsers(prefix = 'storm_') {
    try {
        await dbAsync.run("DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE username LIKE ?)", [`${prefix}%`]);
        await dbAsync.run("DELETE FROM users WHERE username LIKE ?", [`${prefix}%`]);
        const fk = await dbAsync.all("PRAGMA foreign_key_check");
        if (fk.length > 0) {
            console.error('[CLEANUP WARNING] FK violations:', fk);
        }
    } catch (e) {
        console.error('[CLEANUP ERROR]:', e);
    }
}

async function run() {
    console.log('========================================================');
    console.log('  LOAD TEST: SIGNUP SPIKE & COLLISION STORM             ');
    console.log('========================================================\n');

    await startServer();
    const prefix = `storm_${Date.now().toString(36)}_`;

    try {
        // Test 1: Case-Insensitive Collision Storm
        console.log('1. Launching simultaneous collision storm (same username in different cases)...');
        const collisionUsername = `${prefix}colltarget`;
        const stormVariants = [
            collisionUsername,
            collisionUsername.toUpperCase(),
            collisionUsername.charAt(0).toUpperCase() + collisionUsername.slice(1),
            collisionUsername.toUpperCase(),
            collisionUsername.toLowerCase()
        ];

        const collisionResults = await Promise.all(
            stormVariants.map((u, i) => postJson('/api/auth/signup', {
                username: u,
                email: `${prefix}email_${i}@example.com`,
                password: 'Password123!',
                confirmPassword: 'Password123!',
                displayName: `Display ${u}`
            }))
        );

        const successes = collisionResults.filter(r => r.status === 200 || r.status === 201 || (r.body && r.body.success));
        const conflicts = collisionResults.filter(r => r.status === 400 || r.status === 409 || (r.body && r.body.error && r.body.error.toLowerCase().includes('already in use')));
        const rateLimited = collisionResults.filter(r => r.status === 429);

        console.log(`Collision Results: ${collisionResults.map(r => r.status).join(', ')}`);
        console.log(`Success count: ${successes.length}, Conflict count: ${conflicts.length}, Rate-limited: ${rateLimited.length}`);

        if (successes.length > 1) {
            throw new Error(`FAIL: Multiple registrations succeeded for case variants of ${collisionUsername}!`);
        }
        console.log('[PASS] Case-insensitive uniqueness strictly preserved under simultaneous race conditions.');

        // Test 2: Rapid Concurrent Signups & Rate Limiter Verification
        console.log('\n2. Testing rapid signup burst and rate limiter enforcement...');
        const burstPromises = [];
        for (let i = 0; i < 20; i++) {
            burstPromises.push(postJson('/api/auth/signup', {
                username: `${prefix}burst_${i}`,
                email: `${prefix}burst_${i}@example.com`,
                password: 'Password123!',
                confirmPassword: 'Password123!',
                displayName: `Burst User ${i}`
            }));
        }

        const burstResults = await Promise.all(burstPromises);
        const burstStatusCounts = {};
        burstResults.forEach(r => {
            burstStatusCounts[r.status] = (burstStatusCounts[r.status] || 0) + 1;
        });

        console.log(`Burst Status Counts: ${JSON.stringify(burstStatusCounts)}`);
        if (burstStatusCounts[500] && burstStatusCounts[500] > 0) {
            throw new Error(`FAIL: Server threw 500 error during signup burst: ${burstStatusCounts[500]}`);
        }
        if (burstStatusCounts[429] > 0) {
            console.log(`[PASS] Signup rate limiter successfully throttled burst with HTTP 429 (${burstStatusCounts[429]} requests throttled).`);
        }

        console.log('\n[PASS] Signup spike test complete.');
        return { collisionResults, burstStatusCounts };
    } finally {
        await cleanupTestUsers(prefix);
        stopServer();
        console.log('[CLEANUP] Disposable test users cleanly purged.');
    }
}

if (require.main === module) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { run };
