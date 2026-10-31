/**
 * NostalgicVerse — Release Intelligence Engine (Phase 15)
 * 
 * Manages:
 * - Game release records (physical, digital, remasters, regional ports)
 * - Factual release statuses (ANNOUNCED, COMING_SOON, TBA, DELAYED, RELEASED, CANCELLED)
 * - Date precision handling (EXACT, MONTH_YEAR, YEAR, TBA)
 * - Release change history and curatorial audit logs
 * - Game relationship validation
 */

const { dbAsync } = require('../db/index.cjs');
const { v4: uuidv4 } = require('uuid');

const VALID_RELEASE_STATUSES = ['ANNOUNCED', 'COMING_SOON', 'TBA', 'DELAYED', 'RELEASED', 'CANCELLED'];
const VALID_PRECISIONS = ['EXACT', 'MONTH_YEAR', 'YEAR', 'TBA'];

/**
 * Validate release record data
 */
function validateRelease(data) {
    const errors = [];

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 2) {
        errors.push('Title must be at least 2 characters long');
    }

    if (data.status && !VALID_RELEASE_STATUSES.includes(data.status)) {
        errors.push(`Invalid release status. Allowed: ${VALID_RELEASE_STATUSES.join(', ')}`);
    }

    if (data.date_precision && !VALID_PRECISIONS.includes(data.date_precision)) {
        errors.push(`Invalid date precision. Allowed: ${VALID_PRECISIONS.join(', ')}`);
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Create a new release entry
 */
async function createRelease(data, userId = null) {
    const validation = validateRelease(data);
    if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
    }

    const id = data.id || `rel-${uuidv4().slice(0, 8)}`;
    const status = data.status || 'ANNOUNCED';
    const precision = data.date_precision || 'EXACT';

    // Verify game exists if game_id provided
    if (data.game_id) {
        const game = await dbAsync.get('SELECT id FROM games WHERE id = ?', [data.game_id]);
        if (!game) {
            throw new Error(`Referenced game ID "${data.game_id}" does not exist in canonical database`);
        }
    }

    const history = JSON.stringify([{
        action: 'CREATED',
        userId,
        timestamp: new Date().toISOString(),
        status,
        release_date: data.release_date || null,
        precision
    }]);

    await dbAsync.run(`
        INSERT INTO releases (
            id, title, game_id, announcement_date, release_date, region, platform,
            edition, status, date_precision, source, notes, change_history,
            created_by, last_verified_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
        id,
        data.title.trim(),
        data.game_id || null,
        data.announcement_date || null,
        data.release_date || null,
        data.region || 'GLOBAL',
        data.platform || null,
        data.edition || 'Standard',
        status,
        precision,
        data.source || null,
        data.notes || null,
        history,
        userId
    ]);

    return await getReleaseById(id);
}

/**
 * Update an existing release record with change history auditing
 */
async function updateRelease(id, updates, userId = null) {
    const existing = await getReleaseById(id);
    if (!existing) {
        throw new Error(`Release record with ID "${id}" not found`);
    }

    const validation = validateRelease({ ...existing, ...updates });
    if (!validation.valid) {
        throw new Error(validation.errors.join('; '));
    }

    // Append to change history
    let history = [];
    if (Array.isArray(existing.change_history)) {
        history = [...existing.change_history];
    } else if (typeof existing.change_history === 'string') {
        try { history = JSON.parse(existing.change_history); } catch (e) {}
    }

    const changedFields = {};
    for (const key of Object.keys(updates)) {
        if (existing[key] !== updates[key]) {
            changedFields[key] = { old: existing[key], new: updates[key] };
        }
    }

    history.push({
        action: 'UPDATED',
        userId,
        timestamp: new Date().toISOString(),
        changes: changedFields
    });

    await dbAsync.run(`
        UPDATE releases SET
            title = COALESCE(?, title),
            game_id = COALESCE(?, game_id),
            announcement_date = COALESCE(?, announcement_date),
            release_date = COALESCE(?, release_date),
            region = COALESCE(?, region),
            platform = COALESCE(?, platform),
            edition = COALESCE(?, edition),
            status = COALESCE(?, status),
            date_precision = COALESCE(?, date_precision),
            source = COALESCE(?, source),
            notes = COALESCE(?, notes),
            change_history = ?,
            updated_by = ?,
            last_verified_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [
        updates.title || null,
        updates.game_id || null,
        updates.announcement_date || null,
        updates.release_date || null,
        updates.region || null,
        updates.platform || null,
        updates.edition || null,
        updates.status || null,
        updates.date_precision || null,
        updates.source || null,
        updates.notes || null,
        JSON.stringify(history),
        userId,
        id
    ]);

    return await getReleaseById(id);
}

async function getReleaseById(id) {
    const row = await dbAsync.get('SELECT * FROM releases WHERE id = ?', [id]);
    return formatRelease(row);
}

async function getReleasesByGameId(gameId) {
    const rows = await dbAsync.all('SELECT * FROM releases WHERE game_id = ? ORDER BY release_date ASC', [gameId]);
    return rows.map(formatRelease);
}

function formatRelease(row) {
    if (!row) return null;
    let changeHistory = [];
    try { changeHistory = JSON.parse(row.change_history || '[]'); } catch (e) {}
    return {
        ...row,
        change_history: changeHistory
    };
}

module.exports = {
    VALID_RELEASE_STATUSES,
    VALID_PRECISIONS,
    validateRelease,
    createRelease,
    updateRelease,
    getReleaseById,
    getReleasesByGameId
};
