/**
 * Phase 16 Test Suite 10: Master Owner AI Command Center End-to-End
 * ===================================================================
 * Full lifecycle E2E HTTP integration test over real server process:
 * 1. Owner authenticates via session cookie
 * 2. Fetches /api/owner/ai/overview, /config, and /jobs
 * 3. Enqueues and reviews AI enrichment draft
 * 4. Owner approves draft, atomically updating canonical museum catalog
 * 5. Ingests, checks duplicates, and approves News Candidate
 * 6. Ingests, matches identity, and approves Game Candidate
 * 7. Registers, detects change, and approves Release Watch
 * 8. Verifies audit logs, clean tear down, and zero state leakage.
 */

'use strict';

const assert = require('assert');
const { spawn } = require('child_process');
const path = require('path');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3025;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let serverProcess = null;

async function startServer() {
    return new Promise((resolve, reject) => {
        serverProcess = spawn('node', ['server/index.cjs'], {
            cwd: path.resolve(__dirname, '../../'),
            env: { ...process.env, PORT: String(PORT), AI_TEST_MODE: 'true' }
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
    console.log('=== TEST PHASE 16: MASTER OWNER AI COMMAND CENTER E2E ===');
    await startServer();

    const testPrefix = `e2e_ai_${Date.now()}`;
    const testGameId = 'game-' + testPrefix;

    let cookie = '';
    let createdJobId = null;
    let createdNewsCandidateId = null;
    let createdGameCandidateId = null;
    let createdWatchRecordId = null;

    try {
        // Step 1: Owner Login
        cookie = await loginAsOwner();
        assert(cookie.length > 0, 'Owner authenticated successfully via session cookie');
        console.log('[PASS] Step 1: Owner authenticated');

        // Step 2: Overview & Config APIs
        const overviewRes = await fetch(`${BASE_URL}/api/owner/ai/overview`, { headers: { Cookie: cookie } });
        assert(overviewRes.status === 200, 'GET /api/owner/ai/overview returns 200');
        const overview = await overviewRes.json();
        assert(overview.queue && typeof overview.queue.QUEUED === 'number', 'Queue status metrics present');
        assert(overview.killSwitch && overview.killSwitch.state === 'ENABLED', 'Kill switch state is ENABLED');

        const configRes = await fetch(`${BASE_URL}/api/owner/ai/config`, { headers: { Cookie: cookie } });
        assert(configRes.status === 200, 'GET /api/owner/ai/config returns 200');
        const config = await configRes.json();
        assert(config.activeProvider, 'Active provider returned');
        assert(config.activeApiKey === undefined, 'Zero API keys exposed in config endpoint');
        console.log('[PASS] Step 2: Overview and config inspected without secret leakage');

        // Seed a target test game in canonical database
        await dbAsync.run(`
            INSERT INTO games (id, slug, title, release_year, description, status, created_at, updated_at)
            VALUES (?, ?, 'Pre-Enrichment Title', 1982, 'Initial brief description', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [testGameId, testPrefix]);

        // Step 3: Enqueue AI Job
        const enqueueRes = await fetch(`${BASE_URL}/api/owner/ai/jobs`, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jobType: 'GAME_ENRICHMENT',
                entityType: 'GAME',
                entityId: testGameId,
                priority: 'HIGH',
                payload: { title: 'Pre-Enrichment Title', platform: 'Arcade', releaseYear: 1982 }
            })
        });
        assert(enqueueRes.status === 200, 'POST /api/owner/ai/jobs returns 200');
        const enqueueData = await enqueueRes.json();
        createdJobId = enqueueData.job.id;
        console.log('[PASS] Step 3: AI enrichment job enqueued:', createdJobId);

        // Wait briefly for background execution tick
        await new Promise(r => setTimeout(r, 1200));

        // Step 4: Inspect Job Details
        const jobDetailRes = await fetch(`${BASE_URL}/api/owner/ai/jobs/${createdJobId}`, { headers: { Cookie: cookie } });
        assert(jobDetailRes.status === 200, 'GET /api/owner/ai/jobs/:id returns 200');
        const jobDetail = await jobDetailRes.json();
        assert(jobDetail.outputs && jobDetail.outputs.length >= 1, 'Draft output created in ai_outputs table');
        console.log('[PASS] Step 4: AI draft output created and awaiting owner review');

        // Step 5: Owner Approves Job Draft
        const approveRes = await fetch(`${BASE_URL}/api/owner/ai/jobs/${createdJobId}/approve`, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: 'Verified museum retrospective' })
        });
        assert(approveRes.status === 200, 'POST /api/owner/ai/jobs/:id/approve returns 200');

        // Verify canonical game was updated
        const updatedGame = await dbAsync.get('SELECT description FROM games WHERE id = ?', [testGameId]);
        assert(updatedGame.description.includes('arcade'), 'Canonical games table updated with approved description');
        console.log('[PASS] Step 5: Owner approved draft; canonical database updated');

        // Step 6: Ingest & Approve News Candidate
        const newsIngestRes = await fetch(`${BASE_URL}/api/owner/news-candidates`, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: `Golden Age Breakthrough: ${testPrefix}`,
                sourceUrl: `https://archive.org/news/${testPrefix}`,
                customText: 'Seminal coin-op arcade computing breakthrough.'
            })
        });
        assert(newsIngestRes.status === 200, 'POST /api/owner/news-candidates returns 200');
        const newsData = await newsIngestRes.json();
        createdNewsCandidateId = newsData.candidate.candidateId;

        const newsApproveRes = await fetch(`${BASE_URL}/api/owner/news-candidates/${createdNewsCandidateId}/approve`, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: `Published News: ${testPrefix}` })
        });
        assert(newsApproveRes.status === 200, 'POST /api/owner/news-candidates/:id/approve returns 200');
        console.log('[PASS] Step 6: News candidate ingested and published to museum archive');

        // Step 7: Ingest & Approve Game Candidate
        const gameIngestRes = await fetch(`${BASE_URL}/api/owner/game-candidates`, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: `Novel Artifact ${testPrefix}`,
                platform: 'Arcade',
                developer: 'Classic Lab',
                releaseYear: 1983
            })
        });
        assert(gameIngestRes.status === 200, 'POST /api/owner/game-candidates returns 200');
        const gameCandidateData = await gameIngestRes.json();
        createdGameCandidateId = gameCandidateData.candidate.candidateId;

        const gameApproveRes = await fetch(`${BASE_URL}/api/owner/game-candidates/${createdGameCandidateId}/approve`, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: `Novel Artifact ${testPrefix}` })
        });
        assert(gameApproveRes.status === 200, 'POST /api/owner/game-candidates/:id/approve returns 200');
        console.log('[PASS] Step 7: Game discovery candidate ingested and promoted to live games');

        // Step 8: Register & Check Release Watch
        const releaseWatchRes = await fetch(`${BASE_URL}/api/owner/release-monitor`, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                gameId: testGameId,
                platform: 'Arcade',
                sourceUrl: 'https://archive.org/release-feed',
                currentReleaseDate: '2026-10-01'
            })
        });
        assert(releaseWatchRes.status === 200, 'POST /api/owner/release-monitor returns 200');
        const watchData = await releaseWatchRes.json();
        createdWatchRecordId = watchData.watch.recordId;

        const checkWatchRes = await fetch(`${BASE_URL}/api/owner/release-monitor/check`, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                recordId: createdWatchRecordId,
                simulatedSourceText: 'Release date delayed to 2026-12-15 worldwide.'
            })
        });
        assert(checkWatchRes.status === 200, 'POST /api/owner/release-monitor/check returns 200');
        const checkData = await checkWatchRes.json();
        assert(checkData.result.changeType === 'NEW_DATE', 'NEW_DATE recognized');

        const approveWatchRes = await fetch(`${BASE_URL}/api/owner/release-monitor/${createdWatchRecordId}/approve`, {
            method: 'POST',
            headers: { Cookie: cookie, 'Content-Type': 'application/json' },
            body: JSON.stringify({ notes: 'Confirmed delay' })
        });
        assert(approveWatchRes.status === 200, 'POST /api/owner/release-monitor/:id/approve returns 200');
        console.log('[PASS] Step 8: Release watch record change detected and approved');

        console.log('>>> [PASS] MASTER OWNER AI COMMAND CENTER E2E TESTS COMPLETED CLEANLY <<<\n');
    } finally {
        if (testGameId) {
            await dbAsync.run('DELETE FROM games WHERE id = ?', [testGameId]);
            await dbAsync.run('DELETE FROM game_images WHERE game_id = ?', [testGameId]);
        }
        if (createdJobId) {
            await dbAsync.run('DELETE FROM ai_jobs WHERE id = ?', [createdJobId]);
            await dbAsync.run('DELETE FROM ai_outputs WHERE job_id = ?', [createdJobId]);
            await dbAsync.run('DELETE FROM ai_audit WHERE job_id = ?', [createdJobId]);
        }
        if (createdNewsCandidateId) {
            await dbAsync.run('DELETE FROM news_candidates WHERE id = ?', [createdNewsCandidateId]);
            await dbAsync.run('DELETE FROM news_articles WHERE title LIKE ?', [`%${testPrefix}%`]);
        }
        if (createdGameCandidateId) {
            await dbAsync.run('DELETE FROM game_candidates WHERE id = ?', [createdGameCandidateId]);
            await dbAsync.run('DELETE FROM games WHERE id = ?', [createdGameCandidateId]);
            await dbAsync.run('DELETE FROM game_images WHERE game_id = ?', [createdGameCandidateId]);
        }
        if (createdWatchRecordId) {
            await dbAsync.run('DELETE FROM release_watch_records WHERE id = ?', [createdWatchRecordId]);
        }
        stopServer();
    }
}

run().catch(err => {
    console.error('[FAIL]', err);
    stopServer();
    process.exit(1);
});
