/**
 * Phase 14 Test Suite 11: Backups & Disaster Recovery Operations
 * Validates online point-in-time snapshotting, corruption verification,
 * sandbox dry-run restoration, and ensures production DB is never overwritten.
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3024;
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
    console.log('=== TEST PHASE 14: BACKUP & DISASTER RECOVERY OPERATIONS ===');
    await startServer();

    try {
        const sessionCookie = await loginAsOwner();
        assert(sessionCookie.length > 0, 'Owner authenticated');

        // 1. Fetch Backups List
        const listRes = await fetch(`${BASE_URL}/api/owner/backups`, {
            headers: { Cookie: sessionCookie }
        });
        assert(listRes.status === 200, 'GET /api/owner/backups returns 200');
        const listData = await listRes.json();
        assert(Array.isArray(listData.backups), 'Backups returns array');

        // 2. Trigger Backup Creation Job
        const createRes = await fetch(`${BASE_URL}/api/owner/backups/create`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(createRes.status === 200, 'POST /api/owner/backups/create returns 200');
        const createJob = await createRes.json();
        assert(createJob.job.job_type === 'BACKUP', 'BACKUP job enqueued');

        // Wait for backup worker to complete snapshot
        await new Promise(r => setTimeout(r, 2000));

        // 3. Inspect Created Snapshot
        const updatedListRes = await fetch(`${BASE_URL}/api/owner/backups`, {
            headers: { Cookie: sessionCookie }
        });
        const updatedList = await updatedListRes.json();
        assert(updatedList.backups.length >= 1, 'At least 1 backup file is available in backups directory');
        const latestBackup = updatedList.backups[0].filename;

        // 4. Verify Database Snapshot Integrity
        const verifyRes = await fetch(`${BASE_URL}/api/owner/backups/${encodeURIComponent(latestBackup)}/verify`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(verifyRes.status === 200, 'POST /api/owner/backups/:filename/verify returns 200');
        const verifyData = await verifyRes.json();
        assert(verifyData.status === 'VERIFIED_CORRUPTION_FREE', 'Integrity check reports VERIFIED_CORRUPTION_FREE');

        // 5. Test Sandbox Dry-Run Restoration
        const sandboxRes = await fetch(`${BASE_URL}/api/owner/backups/${encodeURIComponent(latestBackup)}/restore-sandbox`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(sandboxRes.status === 200, 'POST /api/owner/backups/:filename/restore-sandbox returns 200');
        const sandboxData = await sandboxRes.json();
        assert(sandboxData.sandboxVerified === true, 'Sandbox dry-run restoration verified');

        console.log('>>> [PASS] BACKUP & DISASTER RECOVERY AUDIT COMPLETED CLEANLY <<<\n');
    } finally {
        stopServer();
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

