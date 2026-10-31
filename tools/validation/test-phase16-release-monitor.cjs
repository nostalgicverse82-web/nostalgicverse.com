/**
 * Phase 16 Test Suite 06: Release Monitoring & Follower Notification
 * ===================================================================
 * Validates watch registration, automated date/delay change detection,
 * AI release analysis queueing, owner approval, and user notifications.
 */

'use strict';

const assert = require('assert');
const { dbAsync } = require('../../server/db/connection.cjs');
const {
    registerReleaseWatch,
    checkReleaseWatchRecord,
    approveReleaseChange
} = require('../../server/services/releaseMonitorService.cjs');

async function run() {
    console.log('=== TEST PHASE 16: RELEASE MONITORING & CHANGE DETECTION ===');

    const testGameId = 'game-test-release-' + Date.now();
    const ownerUser = await dbAsync.get('SELECT id FROM users WHERE username = "owner"');
    const followerUserId = ownerUser ? ownerUser.id : '168807b4-4c17-46ab-aa2c-2c911040fa24';
    let recordId = null;

    try {
        // Setup mock game and follower
        await dbAsync.run(`
            INSERT INTO games (id, slug, title, release_year, status, created_at, updated_at)
            VALUES (?, ?, 'Upcoming Remaster', 2026, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [testGameId, 'upcoming-remaster-' + Date.now()]);

        await dbAsync.run(`
            INSERT INTO favorites (user_id, entity_type, entity_id, created_at)
            VALUES (?, 'GAME', ?, CURRENT_TIMESTAMP)
        `, [followerUserId, testGameId]);

        // 1. Register Release Watch Record
        const watchRes = await registerReleaseWatch({
            gameId: testGameId,
            platform: 'PC',
            region: 'Worldwide',
            sourceUrl: 'https://official-dev.example.com/press',
            currentReleaseDate: '2026-10-01'
        });

        recordId = watchRes.recordId;
        assert(watchRes.status === 'WATCHING', 'Watch registered with WATCHING status');
        console.log('[PASS] Registered release watch record:', recordId);

        // 2. Check Watch Record with Unchanged Source Text
        const checkUnchanged = await checkReleaseWatchRecord(recordId, 'Official target release remains 2026-10-01.');
        assert(checkUnchanged.changeType === 'NONE', 'No change detected when date matches');
        assert(checkUnchanged.status === 'WATCHING', 'Status remains WATCHING');
        console.log('[PASS] Stable release date confirmed without false alerts');

        // 3. Check Watch Record with Changed Date (2026-11-15)
        const checkChanged = await checkReleaseWatchRecord(recordId, 'Official announcement: remastered edition now releasing 2026-11-15 worldwide.');
        assert(checkChanged.changeType === 'NEW_DATE', 'NEW_DATE change type detected');
        assert(checkChanged.detectedReleaseDate === '2026-11-15', 'New date 2026-11-15 extracted');
        assert(checkChanged.status === 'AWAITING_REVIEW', 'Status shifted to AWAITING_REVIEW');
        assert(checkChanged.aiJobId !== null, 'RELEASE_ANALYSIS AI job enqueued');
        console.log('[PASS] Release change detected and flagged for owner review with AI analysis job');

        // 4. Owner Review & Approval
        const approval = await approveReleaseChange(recordId, 'owner', 'Confirmed by press release');
        assert(approval.success === true, 'Owner approval succeeded');
        assert(approval.updatedDate === '2026-11-15', 'Updated date set in record');

        // Verify notification was sent to follower
        const notification = await dbAsync.get('SELECT * FROM notifications WHERE user_id = ? AND type = "RELEASE_UPDATE"', [followerUserId]);
        assert(notification && notification.message.includes('2026-11-15'), 'Follower received in-app notification with new verified date');
        console.log('[PASS] In-app release update notification delivered to game followers');

        console.log('>>> [PASS] ALL RELEASE MONITORING TESTS PASSED <<<\n');
    } finally {
        if (recordId) {
            await dbAsync.run('DELETE FROM release_watch_records WHERE id = ?', [recordId]);
        }
        await dbAsync.run('DELETE FROM games WHERE id = ?', [testGameId]);
        await dbAsync.run('DELETE FROM favorites WHERE entity_id = ?', [testGameId]);
        await dbAsync.run('DELETE FROM notifications WHERE user_id = ?', [followerUserId]);
        await dbAsync.run('DELETE FROM ai_jobs WHERE entity_id = ?', [testGameId]);
    }
}

run().catch(err => {
    console.error('[FAIL]', err);
    process.exit(1);
});
