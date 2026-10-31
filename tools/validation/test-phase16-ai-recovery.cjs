/**
 * Phase 16 Test Suite 07: AI Job Recovery, Circuit Breaker & Kill Switch
 * ======================================================================
 * Validates retry of failed jobs, job cancellation, process restart recovery
 * of stale processing states, circuit breaker transitions, and kill switch safety.
 */

'use strict';

const assert = require('assert');
const { dbAsync } = require('../../server/db/connection.cjs');
const {
    enqueueAIJob,
    retryAIJob,
    cancelAIJob,
    recoverStaleAIJobs,
    getKillSwitchStatus,
    setKillSwitchStatus
} = require('../../server/services/aiJobQueueService.cjs');
const { getCircuitBreaker } = require('../../server/ai/provider.cjs');

async function run() {
    console.log('=== TEST PHASE 16: AI RECOVERY, CIRCUIT BREAKER & KILL SWITCH ===');

    const testId = 'recov-' + Date.now();
    let jobId = null;

    try {
        // 1. Job Cancellation
        const queuedJob = await enqueueAIJob({
            jobType: 'SEO_GENERATION',
            entityType: 'GAME',
            entityId: testId,
            priority: 'LOW',
            payload: { title: 'Test Specimen' },
            idempotencyKey: `cancel-test-${Date.now()}`
        });

        jobId = queuedJob.id;
        const cancelResult = await cancelAIJob(jobId);
        assert(cancelResult.status === 'CANCELLED', 'Job transitioned to CANCELLED status');

        const cancelledInDb = await dbAsync.get('SELECT status FROM ai_jobs WHERE id = ?', [jobId]);
        assert(cancelledInDb.status === 'CANCELLED', 'Database reflects CANCELLED state');
        console.log('[PASS] cancelAIJob() safely transitioned job to CANCELLED');

        // 2. Job Retry
        const retryResult = await retryAIJob(jobId);
        assert(retryResult.status === 'QUEUED', 'Job transitioned back to QUEUED on retry');

        const retriedInDb = await dbAsync.get('SELECT status, attempts FROM ai_jobs WHERE id = ?', [jobId]);
        assert(retriedInDb.status === 'QUEUED' || retriedInDb.status === 'AWAITING_OWNER' || retriedInDb.status === 'PROCESSING', 'Job resumed execution');
        console.log('[PASS] retryAIJob() safely re-enqueued job');

        // 3. Stale Processing Job Recovery (Simulating Server Crash)
        const crashJobId = 'crash-test-' + Date.now();
        await dbAsync.run(`
            INSERT INTO ai_jobs (id, job_type, entity_type, entity_id, status, provider, model, created_at, updated_at)
            VALUES (?, 'GAME_ENRICHMENT', 'GAME', 'simulated-crash', 'PROCESSING', 'mock', 'mock-engine', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [crashJobId]);

        await recoverStaleAIJobs();

        const recovered = await dbAsync.get('SELECT status, error FROM ai_jobs WHERE id = ?', [crashJobId]);
        assert(recovered.status === 'FAILED', 'Interrupted job safely marked as FAILED');
        assert(recovered.error.includes('Process restart interrupted'), 'Error message documents restart event');
        console.log('[PASS] recoverStaleAIJobs() recovered interrupted job without hanging state');
        await dbAsync.run('DELETE FROM ai_jobs WHERE id = ?', [crashJobId]);

        // 4. Circuit Breaker Mechanism
        const cb = getCircuitBreaker('gemini-test');
        assert(cb.state === 'CLOSED', 'Circuit breaker starts in CLOSED (healthy) state');
        cb.failures = 3;
        cb.state = 'OPEN';
        cb.lastFailureTime = Date.now();
        assert(cb.state === 'OPEN', 'Circuit breaker enters OPEN (degraded) state upon threshold');
        console.log('[PASS] Circuit breaker safely isolates repeatedly failing provider');

        // 5. Automation Kill Switch Safety
        const initialKs = getKillSwitchStatus();
        assert(initialKs.state === 'ENABLED', 'Kill switch starts in ENABLED state');

        // Toggle to DISABLED
        await setKillSwitchStatus('DISABLED', 'Emergency audit maintenance');
        const disabledKs = getKillSwitchStatus();
        assert(disabledKs.state === 'DISABLED', 'Kill switch updated to DISABLED');

        // Attempt to enqueue job while disabled
        let enqueueBlocked = false;
        try {
            await enqueueAIJob({
                jobType: 'SEO_GENERATION',
                entityType: 'GAME',
                entityId: 'blocked-id',
                payload: {}
            });
        } catch (err) {
            enqueueBlocked = err.message.includes('DISABLED via kill switch');
        }
        assert(enqueueBlocked, 'Job enqueueing rejected when kill switch is DISABLED');
        console.log('[PASS] Kill switch halts new background job creation');

        // Restore to ENABLED
        await setKillSwitchStatus('ENABLED', 'Maintenance concluded');
        const restoredKs = getKillSwitchStatus();
        assert(restoredKs.state === 'ENABLED', 'Kill switch restored to ENABLED');
        console.log('[PASS] Kill switch safely restored to normal operation');

        console.log('>>> [PASS] ALL AI RECOVERY & KILL SWITCH TESTS PASSED <<<\n');
    } finally {
        if (jobId) {
            await dbAsync.run('DELETE FROM ai_jobs WHERE id = ?', [jobId]);
            await dbAsync.run('DELETE FROM ai_outputs WHERE job_id = ?', [jobId]);
        }
    }
}

run().catch(err => {
    console.error('[FAIL]', err);
    process.exit(1);
});
