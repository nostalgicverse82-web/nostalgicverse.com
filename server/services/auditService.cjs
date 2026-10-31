/**
 * NostalgicVerse — Canonical Immutable Audit Logging Service
 * ============================================================
 * Records security, moderation, AI execution, publishing, backup,
 * and configuration events with immutable timestamps and actor attribution.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');

/**
 * Record an immutable audit log entry
 */
async function createAuditLog(actorId, action, entityType = null, entityId = null, result = 'SUCCESS', metadata = null) {
    try {
        const id = uuidv4();
        let metaObj = {};
        if (typeof metadata === 'object' && metadata !== null) {
            metaObj = { ...metadata };
        } else if (metadata) {
            metaObj = { note: String(metadata) };
        }

        const metaStr = Object.keys(metaObj).length > 0 ? JSON.stringify(metaObj) : null;

        await dbAsync.run(`
            INSERT INTO audit_logs (id, actor_id, action, entity_type, entity_id, result, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [id, actorId || 'system', action, entityType, entityId ? String(entityId) : null, result, metaStr]);

        return { id, action, entityType, entityId, result };
    } catch (err) {
        console.error('[AUDIT_LOG_ERROR]', err.message);
        return null;
    }
}

/**
 * Retrieve audit logs with filtering and pagination
 */
async function getAuditLogs({ limit = 50, offset = 0, action, entityType, actorId } = {}) {
    const conditions = [];
    const params = [];

    if (action) {
        conditions.push('action = ?');
        params.push(action);
    }
    if (entityType) {
        conditions.push('entity_type = ?');
        params.push(entityType);
    }
    if (actorId) {
        conditions.push('actor_id = ?');
        params.push(actorId);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRow = await dbAsync.get(`SELECT COUNT(*) as c FROM audit_logs ${whereClause}`, params);

    const logs = await dbAsync.all(`
        SELECT a.*, u.username as actor_username, u.display_name as actor_display_name
        FROM audit_logs a
        LEFT JOIN users u ON a.actor_id = u.id
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT ? OFFSET ?
    `, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

    return {
        logs,
        total: countRow ? countRow.c : 0,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
    };
}

module.exports = {
    createAuditLog,
    getAuditLogs
};
