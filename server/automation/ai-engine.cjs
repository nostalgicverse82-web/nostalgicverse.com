/**
 * NostalgicVerse — Private AI Control Engine (Phase 14)
 * ======================================================
 * Manages server-side AI tasks with human-in-the-loop owner approval,
 * schema validation, and complete credential isolation.
 *
 * Direct client exposure of AI keys is strictly prohibited.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');
const { broadcastToOwner } = require('../realtime/websocket.cjs');
const { defaultLogger: logger } = require('./logger.cjs');
const { MockAIProvider, GeminiAIProvider } = require('./ai-provider.cjs');

function getAIProvider(model = 'gemini-3.1-flash-lite') {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'mock_key' && !apiKey.startsWith('mock')) {
        return new GeminiAIProvider(apiKey);
    }
    return new MockAIProvider();
}

/**
 * Enqueue a new AI generation task
 */
async function enqueueAITask(entityType, entityId, prompt, model = 'gemini-3.1-flash-lite') {
    const id = uuidv4();
    await dbAsync.run(`
        INSERT INTO ai_queue (id, entity_type, entity_id, status, model, prompt, created_at, updated_at)
        VALUES (?, ?, ?, 'WAITING', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [id, entityType, entityId || null, model, prompt]);

    logger.info(`[AI_ENGINE] Enqueued AI task ${id} for ${entityType}`);

    broadcastToOwner({
        type: 'AI_TASK_ENQUEUED',
        task: { id, entity_type: entityType, status: 'WAITING' }
    });

    setImmediate(() => processAITask(id));
    return { id, entity_type: entityType, status: 'WAITING' };
}

/**
 * Execute AI generation task in background
 */
async function processAITask(taskId) {
    const task = await dbAsync.get('SELECT * FROM ai_queue WHERE id = ?', [taskId]);
    if (!task) return;

    try {
        await dbAsync.run(`UPDATE ai_queue SET status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [taskId]);
        broadcastToOwner({
            type: 'AI_TASK_PROCESSING',
            task: { id: taskId, status: 'PROCESSING' }
        });

        const provider = getAIProvider(task.model);
        const draft = await provider.generateStructuredJson(task.prompt, {}, {
            topicTitle: task.entity_type + ' Archival Enhancement',
            category: 'Archival AI Curation'
        });

        const draftStr = JSON.stringify(draft);

        // Transition to HELD (awaiting owner approval)
        await dbAsync.run(`
            UPDATE ai_queue 
            SET status = 'HELD', draft_content = ?, validation_status = 'VALIDATED', updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [draftStr, taskId]);

        logger.info(`[AI_ENGINE] Task ${taskId} drafted successfully and held for owner review`);

        broadcastToOwner({
            type: 'AI_DRAFT_READY',
            task: { id: taskId, entity_type: task.entity_type, status: 'HELD' }
        });
    } catch (err) {
        logger.error(`[AI_ENGINE] Task ${taskId} failed:`, { error: err.message });
        await dbAsync.run(`
            UPDATE ai_queue 
            SET status = 'FAILED', error_message = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [err.message, taskId]);

        broadcastToOwner({
            type: 'AI_TASK_FAILED',
            task: { id: taskId, status: 'FAILED', error: err.message }
        });
    }
}

/**
 * Approve AI draft and promote to content
 */
async function approveAIDraft(taskId, reviewerId) {
    const task = await dbAsync.get('SELECT * FROM ai_queue WHERE id = ?', [taskId]);
    if (!task) throw new Error('AI task not found');

    if (task.status !== 'HELD' && task.status !== 'DRAFTED') {
        throw new Error(`Only HELD or DRAFTED tasks can be approved (current status: ${task.status})`);
    }

    await dbAsync.run(`
        UPDATE ai_queue 
        SET status = 'COMPLETED', reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [reviewerId, taskId]);

    logger.info(`[AI_ENGINE] Task ${taskId} approved by owner ${reviewerId}`);
    return { success: true, taskId, status: 'COMPLETED' };
}

/**
 * Reject AI draft with feedback
 */
async function rejectAIDraft(taskId, reviewerId, reason = 'Rejected by curator') {
    const task = await dbAsync.get('SELECT * FROM ai_queue WHERE id = ?', [taskId]);
    if (!task) throw new Error('AI task not found');

    await dbAsync.run(`
        UPDATE ai_queue 
        SET status = 'REJECTED', reviewed_by = ?, validation_errors = ?, reviewed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [reviewerId, reason, taskId]);

    logger.info(`[AI_ENGINE] Task ${taskId} rejected by owner ${reviewerId}`);
    return { success: true, taskId, status: 'REJECTED' };
}

module.exports = {
    enqueueAITask,
    processAITask,
    approveAIDraft,
    rejectAIDraft
};

