/**
 * Phase 16 Test Suite 08: AI Cost Control, Token Accounting & Budget Caps
 * =======================================================================
 * Validates token usage tracking, estimated cost recording in ai_usage,
 * and automated job holding when daily budget caps are exceeded.
 */

'use strict';

const assert = require('assert');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/connection.cjs');
const { enqueueAIJob } = require('../../server/services/aiJobQueueService.cjs');

async function run() {
    console.log('=== TEST PHASE 16: AI COST CONTROL & BUDGET CAP ENFORCEMENT ===');

    const testId = 'cost-test-' + Date.now();
    let usageId = null;
    let heldJobId = null;
    let budgetInflationId = null;
    let criticalJobId = null;

    try {
        await dbAsync.run("DELETE FROM ai_usage WHERE job_id = 'job-inflation'");

        // 1. Record AI Usage Entry
        usageId = uuidv4();
        await dbAsync.run(`
            INSERT INTO ai_usage (id, job_id, provider, model, operation, input_tokens_est, output_tokens_est, cost_estimate, duration_ms, success, created_at)
            VALUES (?, 'job-mock', 'mock', 'mock-engine', 'GAME_ENRICHMENT', 450, 220, 0.00010, 180, 1, CURRENT_TIMESTAMP)
        `, [usageId]);

        const record = await dbAsync.get('SELECT * FROM ai_usage WHERE id = ?', [usageId]);
        assert(record !== null, 'Usage record persisted');
        assert(record.input_tokens_est === 450, 'Input tokens recorded');
        assert(record.output_tokens_est === 220, 'Output tokens recorded');
        assert(record.cost_estimate > 0, 'Cost estimate calculated');
        console.log('[PASS] AI token and cost metrics recorded accurately in ai_usage');

        // 2. Budget Threshold Enforcement: Simulate Budget Exhaustion
        budgetInflationId = uuidv4();
        await dbAsync.run(`
            INSERT INTO ai_usage (id, job_id, provider, model, operation, input_tokens_est, output_tokens_est, cost_estimate, duration_ms, success, created_at)
            VALUES (?, 'job-inflation', 'mock', 'mock-engine', 'BULK_BATCH', 100000, 50000, 10.50, 1200, 1, CURRENT_TIMESTAMP)
        `, [budgetInflationId]);

        // Enqueue non-critical job while over-budget
        const heldJob = await enqueueAIJob({
            jobType: 'SEO_GENERATION',
            entityType: 'GAME',
            entityId: testId,
            priority: 'NORMAL',
            payload: { title: 'Over-Budget Candidate' }
        });

        heldJobId = heldJob.id;
        assert(heldJob.status === 'HELD', 'Non-critical job queued with status HELD when budget is exceeded');
        console.log('[PASS] Budget cap enforced: non-critical jobs automatically transition to HELD');

        // Enqueue CRITICAL job to verify critical bypass
        const criticalJob = await enqueueAIJob({
            jobType: 'SECURITY_ALERT',
            entityType: 'SYSTEM',
            entityId: testId,
            priority: 'CRITICAL',
            payload: { title: 'Urgent System Alert' }
        });
        criticalJobId = criticalJob.id;

        assert(criticalJob.status === 'QUEUED', 'CRITICAL priority jobs bypass daily budget limits');
        console.log('[PASS] CRITICAL priority jobs permitted during budget freeze');

        // Wait briefly for critical job to complete drafting so foreign keys aren't severed
        await new Promise(r => setTimeout(r, 100));

        console.log('>>> [PASS] ALL AI COST CONTROL & BUDGET TESTS PASSED <<<\n');
    } finally {
        if (usageId) await dbAsync.run('DELETE FROM ai_usage WHERE id = ?', [usageId]);
        if (budgetInflationId) await dbAsync.run('DELETE FROM ai_usage WHERE id = ?', [budgetInflationId]);
        await dbAsync.run("DELETE FROM ai_usage WHERE job_id = 'job-inflation'");
        if (heldJobId) await dbAsync.run('DELETE FROM ai_jobs WHERE id = ?', [heldJobId]);
        if (criticalJobId) {
            await dbAsync.run('DELETE FROM ai_outputs WHERE job_id = ?', [criticalJobId]);
            await dbAsync.run('DELETE FROM ai_audit WHERE job_id = ?', [criticalJobId]);
            await dbAsync.run('DELETE FROM ai_usage WHERE job_id = ?', [criticalJobId]);
            await dbAsync.run('DELETE FROM ai_jobs WHERE id = ?', [criticalJobId]);
        }
    }
}

run().catch(err => {
    console.error('[FAIL]', err);
    process.exit(1);
});
