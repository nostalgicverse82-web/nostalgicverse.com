/**
 * NostalgicVerse — Release Monitoring & Change Detection Engine (Phase 16)
 * =========================================================================
 * Pipeline:
 * WATCH RECORD -> FETCH SOURCES -> DETECT CHANGE -> EXTRACT -> COMPARE -> OWNER REVIEW -> UPDATE -> NOTIFY
 *
 * Tracks official announcement sources, detects release date modifications,
 * delays, and cancellations, ensuring zero unauthorized automatic mutations.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');
const { safeFetchSource, normalizeUrl } = require('./sourceFetchService.cjs');
const { enqueueAIJob } = require('./aiJobQueueService.cjs');
const { defaultLogger: logger } = require('../automation/logger.cjs');

/**
 * Register a game for release monitoring
 */
async function registerReleaseWatch({
    gameId,
    platform = 'PC',
    region = 'Worldwide',
    sourceUrl,
    currentReleaseDate = '2026-12-31'
}) {
    const recordId = uuidv4();
    const normUrl = normalizeUrl(sourceUrl);

    await dbAsync.run(`
        INSERT INTO release_watch_records (
            id, entity_type, entity_id, platform, region, source_url, 
            current_release_date, detected_release_date, change_type, status, last_checked_at, created_at, updated_at
        ) VALUES (?, 'GAME', ?, ?, ?, ?, ?, ?, 'NONE', 'WATCHING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [recordId, gameId, platform, region, normUrl, currentReleaseDate, currentReleaseDate]);

    logger.info(`[RELEASE_MONITOR] Registered release watch ${recordId} for game ${gameId}`);
    return { recordId, gameId, platform, status: 'WATCHING' };
}

/**
 * Check monitored release sources for updates
 */
async function checkReleaseWatchRecord(recordId, simulatedSourceText = null) {
    const record = await dbAsync.get('SELECT * FROM release_watch_records WHERE id = ?', [recordId]);
    if (!record) throw new Error('Release watch record not found');

    let textContent = simulatedSourceText;
    if (!textContent && (record.source_url.startsWith('http://') || record.source_url.startsWith('https://'))) {
        try {
            const fetched = await safeFetchSource(record.source_url);
            textContent = fetched.extractedText;
        } catch (err) {
            logger.warn(`[RELEASE_MONITOR] Failed to fetch source for watch ${recordId}: ${err.message}`);
        }
    }

    if (!textContent) {
        textContent = `Current release target: ${record.current_release_date}`;
    }

    // Date regex scanner: YYYY-MM-DD or Month YYYY
    const datePattern = /\b(20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01]))\b/;
    const match = textContent.match(datePattern);
    const detectedDate = match ? match[1] : record.current_release_date;

    let changeType = 'NONE';
    let status = 'WATCHING';

    if (detectedDate !== record.current_release_date) {
        changeType = 'NEW_DATE';
        status = 'AWAITING_REVIEW';
    } else if (textContent.toLowerCase().includes('delayed') || textContent.toLowerCase().includes('postponed')) {
        changeType = 'DELAY';
        status = 'AWAITING_REVIEW';
    } else if (textContent.toLowerCase().includes('cancelled') || textContent.toLowerCase().includes('canceled')) {
        changeType = 'CANCELLED';
        status = 'AWAITING_REVIEW';
    }

    // Update watch record
    await dbAsync.run(`
        UPDATE release_watch_records 
        SET detected_release_date = ?, change_type = ?, status = ?, last_checked_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
    `, [detectedDate, changeType, status, recordId]);

    // If change detected, enqueue AI analysis for curator notes
    let aiJobId = null;
    if (changeType !== 'NONE') {
        const job = await enqueueAIJob({
            jobType: 'RELEASE_ANALYSIS',
            entityType: 'RELEASE',
            entityId: record.entity_id,
            priority: 'HIGH',
            payload: {
                currentReleaseDate: record.current_release_date,
                detectedDate,
                changeType,
                detectedText: textContent.slice(0, 500)
            },
            idempotencyKey: `release:${recordId}:${detectedDate}`
        });
        aiJobId = job.id;
    }

    logger.info(`[RELEASE_MONITOR] Checked watch ${recordId}. Change: ${changeType}, Status: ${status}`);

    return {
        recordId,
        changeType,
        currentReleaseDate: record.current_release_date,
        detectedReleaseDate: detectedDate,
        status,
        aiJobId
    };
}

/**
 * Owner approves release change and updates canonical database
 */
async function approveReleaseChange(recordId, reviewerId, notes = '') {
    const record = await dbAsync.get('SELECT * FROM release_watch_records WHERE id = ?', [recordId]);
    if (!record) throw new Error('Release watch record not found');

    const newDate = record.detected_release_date;

    await dbAsync.transaction(async (tx) => {
        // Update releases table if record exists
        await tx.run(`
            UPDATE releases 
            SET release_date = ?, last_verified_at = CURRENT_TIMESTAMP 
            WHERE game_id = ? AND platform = ?
        `, [newDate, record.entity_id, record.platform]);

        // Update watch record to APPROVED and reflect new current date
        await tx.run(`
            UPDATE release_watch_records 
            SET current_release_date = ?, status = 'APPROVED', last_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [newDate, recordId]);

        // Create notification for game followers
        const users = await tx.all(`
            SELECT user_id FROM favorites 
            WHERE entity_type = 'GAME' AND entity_id = ?
        `, [record.entity_id]);

        for (const u of users) {
            await tx.run(`
                INSERT INTO notifications (id, user_id, type, reference_id, message, is_read, created_at)
                VALUES (?, ?, 'RELEASE_UPDATE', ?, ?, 0, CURRENT_TIMESTAMP)
            `, [uuidv4(), u.user_id, record.entity_id, `Release Date Update: Verified update: Release date is now ${newDate}.`]);
        }
    });

    logger.info(`[RELEASE_MONITOR] Approved release change for watch ${recordId} to ${newDate}`);
    return { success: true, recordId, updatedDate: newDate, status: 'APPROVED' };
}

module.exports = {
    registerReleaseWatch,
    checkReleaseWatchRecord,
    approveReleaseChange
};
