/**
 * NostalgicVerse — Enterprise AI Job Queue & Pipeline Service (Phase 16)
 * =======================================================================
 * Manages the full lifecycle state machine:
 * QUEUED -> PROCESSING -> VALIDATING -> AWAITING_OWNER -> COMPLETED / FAILED / HELD / CANCELLED
 *
 * Implements priority scheduling, idempotency, per-entity concurrency locks,
 * cost accounting, budget threshold enforcement, kill switch safety, and restart recovery.
 */

'use strict';

const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');
const { broadcastToOwner } = require('../realtime/websocket.cjs');
const { defaultLogger: logger } = require('../automation/logger.cjs');
const { createAIProvider } = require('../ai/provider.cjs');

// Priority ranking
const PRIORITY_SCORES = {
    CRITICAL: 1,
    HIGH: 2,
    NORMAL: 3,
    LOW: 4
};

// Concurrency locks per entity: Set of "entity_type:entity_id"
const activeEntityLocks = new Set();
let isProcessingQueue = false;

// Automation Kill Switch state: 'ENABLED', 'DISABLED', 'DEGRADED'
let killSwitchState = process.env.AI_AUTOMATION_ENABLED === 'false' ? 'DISABLED' : 'ENABLED';
let killSwitchReason = 'Normal operation';

function getKillSwitchStatus() {
    return {
        state: killSwitchState,
        reason: killSwitchReason,
        dailyBudgetUSD: parseFloat(process.env.AI_DAILY_BUDGET_USD || '5.00')
    };
}

async function resolveUserId(identifier) {
    if (!identifier) return null;
    try {
        const user = await dbAsync.get('SELECT id FROM users WHERE id = ? OR username = ?', [identifier, identifier]);
        return user ? user.id : null;
    } catch (_) {
        return null;
    }
}

async function setKillSwitchStatus(newState, reason = '', actorId = null) {
    if (!['ENABLED', 'DISABLED', 'DEGRADED'].includes(newState)) {
        throw new Error(`Invalid kill switch state: "${newState}". Must be ENABLED, DISABLED, or DEGRADED.`);
    }
    killSwitchState = newState;
    killSwitchReason = reason || `Manually set to ${newState}`;

    const resolvedActor = await resolveUserId(actorId);

    await dbAsync.run(`
        INSERT INTO ai_audit (id, actor_id, action, details, created_at)
        VALUES (?, ?, 'KILL_SWITCH', ?, CURRENT_TIMESTAMP)
    `, [uuidv4(), resolvedActor, JSON.stringify({ state: newState, reason: killSwitchReason })]);

    logger.warn(`[AI_KILL_SWITCH] Automation state updated to ${newState}. Reason: ${killSwitchReason}`);

    broadcastToOwner({
        type: 'AI_KILL_SWITCH_UPDATED',
        status: getKillSwitchStatus()
    });

    return getKillSwitchStatus();
}

/**
 * Checks if current daily AI expenditure has exceeded configured threshold
 */
async function checkDailyBudgetExceeded() {
    const budgetLimit = parseFloat(process.env.AI_DAILY_BUDGET_USD || '5.00');
    try {
        const row = await dbAsync.get(`
            SELECT COALESCE(SUM(cost_estimate), 0.0) as dailyCost 
            FROM ai_usage 
            WHERE created_at >= date('now', 'start of day')
        `);
        const spent = row ? parseFloat(row.dailyCost) : 0;
        return spent >= budgetLimit;
    } catch (_) {
        return false;
    }
}

/**
 * Enqueue an AI Job with priority and idempotency
 */
async function enqueueAIJob({
    jobType,
    entityType = null,
    entityId = null,
    priority = 'NORMAL',
    payload = {},
    createdBy = 'owner',
    idempotencyKey = null,
    promptVersion = 'v1'
}) {
    if (killSwitchState === 'DISABLED') {
        throw new Error('AI Automation is currently DISABLED via kill switch.');
    }

    const id = uuidv4();
    const finalPriority = PRIORITY_SCORES[priority] ? priority : 'NORMAL';

    // 1. Idempotency Check
    const key = idempotencyKey || (entityType && entityId ? `${jobType}:${entityType}:${entityId}:${promptVersion}` : null);
    if (key) {
        const existing = await dbAsync.get(`
            SELECT * FROM ai_jobs 
            WHERE idempotency_key = ? AND status IN ('QUEUED', 'PROCESSING', 'AWAITING_OWNER')
        `, [key]);
        if (existing) {
            logger.info(`[AI_QUEUE] Duplicate job avoided via idempotency key: ${key}`);
            return existing;
        }
    }

    // 2. Budget Check
    const budgetExceeded = await checkDailyBudgetExceeded();
    const initialStatus = budgetExceeded && finalPriority !== 'CRITICAL' ? 'HELD' : 'QUEUED';

    const providerName = (process.env.AI_PROVIDER || 'mock').toLowerCase();
    const modelName = process.env.AI_MODEL || 'mock-engine';

    const promptText = payload.prompt || payload.query || (typeof payload === 'string' ? payload : null);
    await dbAsync.run(`
        INSERT INTO ai_jobs (
            id, job_type, entity_type, entity_id, status, priority, 
            idempotency_key, provider, model, prompt_version, prompt, payload, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
        id, jobType, entityType, entityId, initialStatus, finalPriority,
        key, providerName, modelName, promptVersion, promptText, JSON.stringify(payload), createdBy
    ]);

    const resolvedActor = await resolveUserId(createdBy);

    await dbAsync.run(`
        INSERT INTO ai_audit (id, actor_id, action, entity_type, entity_id, job_id, details, created_at)
        VALUES (?, ?, 'ENQUEUE', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [uuidv4(), resolvedActor, entityType, entityId, id, JSON.stringify({ priority: finalPriority, status: initialStatus })]);

    broadcastToOwner({
        type: 'AI_JOB_ENQUEUED',
        job: { id, job_type: jobType, entity_type: entityType, entity_id: entityId, status: initialStatus, priority: finalPriority }
    });

    if (initialStatus === 'QUEUED') {
        setImmediate(processNextAIJob);
    }

    return { id, job_type: jobType, status: initialStatus, priority: finalPriority };
}

/**
 * Core Job Execution Worker
 */
async function processNextAIJob() {
    if (isProcessingQueue) return;
    if (killSwitchState === 'DISABLED') return;

    isProcessingQueue = true;

    try {
        // Query next eligible job ordered by priority (CRITICAL -> HIGH -> NORMAL -> LOW) and created_at
        const candidates = await dbAsync.all(`
            SELECT * FROM ai_jobs 
            WHERE status = 'QUEUED' 
            ORDER BY 
                CASE priority 
                    WHEN 'CRITICAL' THEN 1 
                    WHEN 'HIGH' THEN 2 
                    WHEN 'NORMAL' THEN 3 
                    ELSE 4 
                END ASC, 
                created_at ASC 
            LIMIT 5
        `);

        if (!candidates || candidates.length === 0) {
            isProcessingQueue = false;
            return;
        }

        for (const job of candidates) {
            const lockKey = job.entity_type && job.entity_id ? `${job.entity_type}:${job.entity_id}` : null;
            if (lockKey && activeEntityLocks.has(lockKey)) {
                // Skip while entity lock is active
                continue;
            }

            if (lockKey) activeEntityLocks.add(lockKey);

            await dbAsync.run(`
                UPDATE ai_jobs 
                SET status = 'PROCESSING', started_at = CURRENT_TIMESTAMP, attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [job.id]);

            broadcastToOwner({
                type: 'AI_JOB_PROCESSING',
                job: { id: job.id, job_type: job.job_type, status: 'PROCESSING' }
            });

            // Execute job
            (async () => {
                const startTime = Date.now();
                let parsedPayload = {};
                try {
                    parsedPayload = job.payload ? JSON.parse(job.payload) : {};
                } catch (_) {}

                try {
                    const provider = createAIProvider({
                        provider: job.provider,
                        model: job.model
                    });

                    let draftResult = null;

                    // Execute domain task
                    if (job.job_type === 'NEWS_SYNTHESIS') {
                        const { topic = 'Milestone In Gaming History', sourceText = '' } = parsedPayload;
                        draftResult = await provider.summarize(sourceText || topic, { maxWords: 150 });
                    } else if (job.job_type === 'GAME_ENRICHMENT') {
                        const { title = 'Classic Specimen', platform = 'Arcade', sourceUrl = '' } = parsedPayload;
                        draftResult = await provider.generateStructured(
                            `Generate museum catalog metadata for game: ${title} (${platform}). Include description, historicalContext, tags, and seo fields.`,
                            { description: 'string', historicalContext: 'string', tags: ['string'], seo: {} },
                            { title, sourceUrl }
                        );
                    } else if (job.job_type === 'SEO_GENERATION') {
                        const { title = 'Museum Specimen', context = '' } = parsedPayload;
                        draftResult = await provider.generateStructured(
                            `Draft metaTitle and metaDescription for: ${title}.\nContext: ${context}`,
                            { metaTitle: 'string', metaDescription: 'string' },
                            { title }
                        );
                    } else if (job.job_type === 'RELEASE_ANALYSIS') {
                        const { currentReleaseDate = '', detectedText = '' } = parsedPayload;
                        draftResult = await provider.extract(
                            detectedText,
                            { detectedDate: 'string', changeType: 'NEW_DATE | DELAY | CANCELLED | NONE', notes: 'string' }
                        );
                    } else {
                        draftResult = await provider.generateStructured(
                            `Synthesize verified content for ${job.job_type}`,
                            {},
                            parsedPayload
                        );
                    }

                    const duration = Date.now() - startTime;
                    const draftStr = JSON.stringify(draftResult);
                    const outputHash = crypto.createHash('sha256').update(draftStr).digest('hex');

                    // Estimate tokens & cost
                    const inTokens = provider.estimateTokens(job.payload || '');
                    const outTokens = provider.estimateTokens(draftStr);
                    // Approximate $0.00015 per 1K tokens for lightweight models
                    const costEst = ((inTokens + outTokens) / 1000) * 0.00015;

                    await dbAsync.run(`
                        INSERT INTO ai_usage (id, job_id, provider, model, operation, input_tokens_est, output_tokens_est, cost_estimate, duration_ms, success, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
                    `, [uuidv4(), job.id, job.provider, job.model, job.job_type, inTokens, outTokens, costEst, duration]);

                    // Store Draft Output in ai_outputs (Awaiting Owner Review)
                    const outputId = uuidv4();
                    await dbAsync.run(`
                        INSERT INTO ai_outputs (id, job_id, entity_type, entity_id, model, provider, prompt_version, draft_content, output_hash, status, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'AWAITING_OWNER', CURRENT_TIMESTAMP)
                    `, [
                        outputId, job.id, job.entity_type || 'GENERAL', job.entity_id || null,
                        job.model, job.provider, job.prompt_version || 'v1', draftStr, outputHash
                    ]);

                    // Transition Job to AWAITING_OWNER
                    await dbAsync.run(`
                        UPDATE ai_jobs 
                        SET status = 'AWAITING_OWNER', result = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                        WHERE id = ?
                    `, [draftStr, job.id]);

                    logger.info(`[AI_QUEUE] Job ${job.id} (${job.job_type}) completed drafting. Awaiting owner review.`);

                    broadcastToOwner({
                        type: 'AI_JOB_AWAITING_OWNER',
                        job: { id: job.id, output_id: outputId, job_type: job.job_type, status: 'AWAITING_OWNER', duration_ms: duration }
                    });
                } catch (err) {
                    const duration = Date.now() - startTime;
                    logger.error(`[AI_QUEUE] Job ${job.id} execution failed:`, { error: err.message });

                    await dbAsync.run(`
                        INSERT INTO ai_usage (id, job_id, provider, model, operation, duration_ms, success, error_code, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, 0, ?, CURRENT_TIMESTAMP)
                    `, [uuidv4(), job.id, job.provider, job.model, job.job_type, duration, err.message.slice(0, 100)]);

                    // Retry Evaluation: Only retry transient network/5xx errors
                    const isTransient = err.message.includes('timeout') || err.message.includes('fetch') || err.message.includes('503') || err.message.includes('429');
                    const nextAttempt = job.attempts + 1;

                    if (isTransient && nextAttempt <= job.max_attempts) {
                        await dbAsync.run(`
                            UPDATE ai_jobs 
                            SET status = 'RETRYING', error = ?, updated_at = CURRENT_TIMESTAMP 
                            WHERE id = ?
                        `, [err.message, job.id]);
                        logger.info(`[AI_QUEUE] Job ${job.id} scheduled for retry (attempt ${nextAttempt}/${job.max_attempts})`);
                        // Exponential backoff
                        setTimeout(async () => {
                            await dbAsync.run(`UPDATE ai_jobs SET status = 'QUEUED' WHERE id = ?`, [job.id]);
                            setImmediate(processNextAIJob);
                        }, Math.min(nextAttempt * 1500, 10000));
                    } else {
                        await dbAsync.run(`
                            UPDATE ai_jobs 
                            SET status = 'FAILED', error = ?, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
                            WHERE id = ?
                        `, [err.message, job.id]);

                        broadcastToOwner({
                            type: 'AI_JOB_FAILED',
                            job: { id: job.id, job_type: job.job_type, status: 'FAILED', error: err.message }
                        });
                    }
                } finally {
                    if (lockKey) activeEntityLocks.delete(lockKey);
                    isProcessingQueue = false;
                    setImmediate(processNextAIJob);
                }
            })();

            break;
        }
    } catch (e) {
        logger.error('[AI_QUEUE] Worker loop error:', { error: e.message });
        isProcessingQueue = false;
    }
}

/**
 * Approve AI Draft and atomically apply to canonical catalog
 */
async function approveAIDraft(outputId, reviewerId, reviewNotes = '') {
    const output = await dbAsync.get('SELECT * FROM ai_outputs WHERE id = ?', [outputId]);
    if (!output) throw new Error('AI output record not found');
    if (output.status !== 'AWAITING_OWNER') {
        throw new Error(`Only AWAITING_OWNER drafts may be approved (current status: ${output.status})`);
    }

    const draft = JSON.parse(output.draft_content);
    const resolvedReviewer = await resolveUserId(reviewerId);

    // Apply mutation based on entity type inside transaction
    await dbAsync.transaction(async (tx) => {
        if (output.entity_type === 'GAME' && output.entity_id) {
            if (draft.description) {
                await tx.run('UPDATE games SET description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [draft.description, output.entity_id]);
            }
            if (draft.seo) {
                await tx.run('UPDATE games SET meta_title = ?, meta_description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
                    draft.seo.metaTitle || null,
                    draft.seo.metaDescription || null,
                    output.entity_id
                ]);
            }
        }

        // Mark output as APPROVED
        await tx.run(`
            UPDATE ai_outputs 
            SET status = 'APPROVED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ? 
            WHERE id = ?
        `, [resolvedReviewer, reviewNotes, outputId]);

        // Complete the associated job
        if (output.job_id) {
            await tx.run(`
                UPDATE ai_jobs 
                SET status = 'COMPLETED', updated_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [output.job_id]);
        }

        // Record audit
        await tx.run(`
            INSERT INTO ai_audit (id, actor_id, action, entity_type, entity_id, job_id, details, created_at)
            VALUES (?, ?, 'APPROVE', ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [uuidv4(), resolvedReviewer, output.entity_type, output.entity_id, output.job_id, JSON.stringify({ outputId, notes: reviewNotes })]);
    });

    broadcastToOwner({
        type: 'AI_DRAFT_APPROVED',
        outputId,
        entity_type: output.entity_type,
        entity_id: output.entity_id
    });

    return { success: true, outputId, status: 'APPROVED' };
}

/**
 * Reject AI Draft
 */
async function rejectAIDraft(outputId, reviewerId, reason = 'Rejected by curator') {
    const output = await dbAsync.get('SELECT * FROM ai_outputs WHERE id = ?', [outputId]);
    if (!output) throw new Error('AI output record not found');

    const resolvedReviewer = await resolveUserId(reviewerId);

    await dbAsync.run(`
        UPDATE ai_outputs 
        SET status = 'REJECTED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, review_notes = ? 
        WHERE id = ?
    `, [resolvedReviewer, reason, outputId]);

    if (output.job_id) {
        await dbAsync.run(`UPDATE ai_jobs SET status = 'HELD', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [output.job_id]);
    }

    await dbAsync.run(`
        INSERT INTO ai_audit (id, actor_id, action, entity_type, entity_id, job_id, details, created_at)
        VALUES (?, ?, 'REJECT', ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [uuidv4(), resolvedReviewer, output.entity_type, output.entity_id, output.job_id, JSON.stringify({ reason })]);

    broadcastToOwner({
        type: 'AI_DRAFT_REJECTED',
        outputId,
        reason
    });

    return { success: true, outputId, status: 'REJECTED' };
}

/**
 * Retry an AI job
 */
async function retryAIJob(jobId) {
    const job = await dbAsync.get('SELECT * FROM ai_jobs WHERE id = ?', [jobId]);
    if (!job) throw new Error('AI job not found');

    await dbAsync.run(`
        UPDATE ai_jobs 
        SET status = 'QUEUED', error = NULL, attempts = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [jobId]);

    setImmediate(processNextAIJob);
    return { success: true, id: jobId, status: 'QUEUED' };
}

/**
 * Cancel a queued AI job
 */
async function cancelAIJob(jobId) {
    const job = await dbAsync.get('SELECT * FROM ai_jobs WHERE id = ?', [jobId]);
    if (!job) throw new Error('AI job not found');

    await dbAsync.run(`
        UPDATE ai_jobs 
        SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [jobId]);

    return { success: true, id: jobId, status: 'CANCELLED' };
}

/**
 * Recover stale processing jobs on server startup
 */
async function recoverStaleAIJobs() {
    try {
        const result = await dbAsync.run(`
            UPDATE ai_jobs 
            SET status = 'FAILED', error = 'Process restart interrupted active AI job', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
            WHERE status = 'PROCESSING'
        `);
        if (result && result.changes > 0) {
            logger.warn(`[AI_QUEUE] Recovered ${result.changes} stale PROCESSING jobs on server startup.`);
        }
    } catch (e) {
        logger.error('[AI_QUEUE] Stale recovery check error:', { error: e.message });
    }
}

// Auto recover on module load
recoverStaleAIJobs();

module.exports = {
    enqueueAIJob,
    processNextAIJob,
    approveAIDraft,
    rejectAIDraft,
    retryAIJob,
    cancelAIJob,
    recoverStaleAIJobs,
    getKillSwitchStatus,
    setKillSwitchStatus
};
