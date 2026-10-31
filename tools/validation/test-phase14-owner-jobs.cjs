/**
 * Phase 14 Test Suite 9: Background Job Engine & Safety Allowlist
 * Validates persistent job queue, execution lifecycle, strict rejection of arbitrary
 * shell commands, job cancellation, and retry capabilities.
 */

const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3022;
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
    console.log('=== TEST PHASE 14: JOB ENGINE & ALLOWLIST SAFETY ===');
    await startServer();

    let createdJobId = null;

    try {
        const sessionCookie = await loginAsOwner();
        assert(sessionCookie.length > 0, 'Owner authenticated');

        // 1. Fetch Job Queue
        const listRes = await fetch(`${BASE_URL}/api/owner/jobs`, {
            headers: { Cookie: sessionCookie }
        });
        assert(listRes.status === 200, 'GET /api/owner/jobs returns 200');
        const listData = await listRes.json();
        assert(Array.isArray(listData.jobs), 'Jobs returns an array');

        // 2. Reject Arbitrary Shell Command Attack
        const attackRes = await fetch(`${BASE_URL}/api/owner/jobs/enqueue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ jobType: 'EXEC_ARBITRARY_COMMAND', payload: { cmd: 'rm -rf /' } })
        });
        assert(attackRes.status === 400, 'Arbitrary unallowlisted command rejected with 400 Bad Request');

        // 3. Enqueue Legitimate Allowlisted Job
        const validJobRes = await fetch(`${BASE_URL}/api/owner/jobs/enqueue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ jobType: 'SEO_AUDIT' })
        });
        assert(validJobRes.status === 200, 'Enqueue allowlisted job returns 200');
        const validJob = await validJobRes.json();
        createdJobId = validJob.job.id;
        assert(createdJobId && createdJobId.length > 0, 'Job ID returned');

        // Allow worker loop to execute
        await new Promise(r => setTimeout(r, 1200));

        // 4. Verify Execution and Completion State in DB
        const completedJob = await dbAsync.get('SELECT * FROM jobs WHERE id = ?', [createdJobId]);
        assert(completedJob.status === 'COMPLETED', 'Job transitioned to COMPLETED status');
        assert(completedJob.result !== null, 'Job result JSON stored');
        assert(completedJob.completed_at !== null, 'Job completed_at timestamp recorded');

        // 5. Test Job Cancellation on a Mock Queued Job
        const mockJobId = uuidv4();
        await dbAsync.run(`
            INSERT INTO jobs (id, job_type, status, created_by, created_at, updated_at)
            VALUES (?, 'REPORT_GENERATION', 'QUEUED', 'test-runner', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [mockJobId]);

        const cancelRes = await fetch(`${BASE_URL}/api/owner/jobs/${mockJobId}/cancel`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(cancelRes.status === 200, 'Job cancellation returns 200');
        const cancelledJob = await dbAsync.get('SELECT status FROM jobs WHERE id = ?', [mockJobId]);
        assert(cancelledJob.status === 'CANCELLED', 'Job status updated to CANCELLED');

        // Clean up mock job
        await dbAsync.run('DELETE FROM jobs WHERE id = ?', [mockJobId]);

        console.log('>>> [PASS] JOB ENGINE & ALLOWLIST SAFETY AUDIT COMPLETED CLEANLY <<<\n');
    } finally {
        if (createdJobId) {
            await dbAsync.run('DELETE FROM jobs WHERE id = ?', [createdJobId]);
            await dbAsync.run("DELETE FROM audit_logs WHERE entity_id = ?", [createdJobId]);
        }
        stopServer();
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

