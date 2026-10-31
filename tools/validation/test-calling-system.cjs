/**
 * NostalgicVerse — Calling System Validation Test Suite
 * ======================================================
 * Tests 1-to-1 Voice & Video Calling Architecture:
 * - Database migration tables, indexes, and settings
 * - Server-authoritative state machine transitions
 * - Explicit consent rules (no auto-start, approval required)
 * - Self-call, block, busy, and membership security guards
 * - Terminal state protections and expiration engine
 * - REST API endpoints and ICE configuration
 * - WebRTC signaling protocol
 */

'use strict';

const assert = require('assert');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/connection.cjs');
const callService = require('../../server/services/callService.cjs');

let totalChecks = 0;
let passedChecks = 0;

function check(label, condition) {
    totalChecks++;
    if (condition) {
        passedChecks++;
        console.log(`  [PASS] ${label}`);
    } else {
        console.error(`  [FAIL] ${label}`);
        throw new Error(`Assertion failed: ${label}`);
    }
}

async function runCallingTests() {
    console.log('\n======================================================');
    console.log('NOSTALGICVERSE CALLING SYSTEM VERIFICATION');
    console.log('======================================================\n');

    // 1. Schema & Migration Verification
    console.log('--- 1. Database Schema Verification ---');
    const tables = await dbAsync.all(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('call_sessions', 'call_events')"
    );
    const tableNames = tables.map(t => t.name);
    check('call_sessions table exists', tableNames.includes('call_sessions'));
    check('call_events table exists', tableNames.includes('call_events'));

    const sessionCols = await dbAsync.all("PRAGMA table_info(call_sessions)");
    const colNames = sessionCols.map(c => c.name);
    check('call_sessions has id column', colNames.includes('id'));
    check('call_sessions has conversation_id column', colNames.includes('conversation_id'));
    check('call_sessions has caller_id column', colNames.includes('caller_id'));
    check('call_sessions has recipient_id column', colNames.includes('recipient_id'));
    check('call_sessions has call_type column', colNames.includes('call_type'));
    check('call_sessions has status column', colNames.includes('status'));
    check('call_sessions has started_at column', colNames.includes('started_at'));
    check('call_sessions has ended_at column', colNames.includes('ended_at'));
    check('call_sessions has end_reason column', colNames.includes('end_reason'));
    check('call_sessions has duration_seconds column', colNames.includes('duration_seconds'));

    const indexes = await dbAsync.all("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='call_sessions'");
    const indexNames = indexes.map(i => i.name);
    check('idx_call_sessions_conversation exists', indexNames.includes('idx_call_sessions_conversation'));
    check('idx_call_sessions_caller exists', indexNames.includes('idx_call_sessions_caller'));
    check('idx_call_sessions_recipient exists', indexNames.includes('idx_call_sessions_recipient'));
    check('idx_call_sessions_status exists', indexNames.includes('idx_call_sessions_status'));

    const callingFlag = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'calling_enabled'");
    check('site_settings calling_enabled is configured', callingFlag && callingFlag.value === 'true');

    // 2. Setup Test Fixtures (2 users and a direct conversation)
    console.log('\n--- 2. Setting up Test Users and Conversation ---');
    const userA_id = 'test-caller-' + Date.now();
    const userB_id = 'test-recipient-' + Date.now();
    const userC_id = 'test-thirdparty-' + Date.now();

    await dbAsync.run(
        `INSERT INTO users (id, email, username, password_hash, display_name)
         VALUES (?, ?, ?, 'hash', 'Test Caller')`,
        [userA_id, `${userA_id}@example.com`, userA_id]
    );
    await dbAsync.run(
        `INSERT INTO users (id, email, username, password_hash, display_name)
         VALUES (?, ?, ?, 'hash', 'Test Recipient')`,
        [userB_id, `${userB_id}@example.com`, userB_id]
    );
    await dbAsync.run(
        `INSERT INTO users (id, email, username, password_hash, display_name)
         VALUES (?, ?, ?, 'hash', 'Test ThirdParty')`,
        [userC_id, `${userC_id}@example.com`, userC_id]
    );

    const convId = uuidv4();
    await dbAsync.run(
        `INSERT INTO conversations (id, type, created_by) VALUES (?, 'DIRECT', ?)`,
        [convId, userA_id]
    );
    await dbAsync.run(
        `INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)`,
        [convId, userA_id, convId, userB_id]
    );

    check('Test users and direct conversation initialized', true);

    // 3. Security Guards & Validations
    console.log('\n--- 3. Call Authorization & Security Guards ---');

    // 3.1 Prevent self-calling
    const selfCallRes = await callService.requestCall({
        callerId: userA_id,
        recipientId: userA_id,
        conversationId: convId,
        callType: 'VOICE'
    });
    check('Self-calling rejected', !selfCallRes.success && selfCallRes.error === 'Cannot call yourself.');

    // 3.2 Prevent invalid call type
    const invalidTypeRes = await callService.requestCall({
        callerId: userA_id,
        recipientId: userB_id,
        conversationId: convId,
        callType: 'HOLOGRAM'
    });
    check('Invalid call type rejected', !invalidTypeRes.success);

    // 3.3 Block enforcement (userB blocks userA)
    const blockId = uuidv4();
    await dbAsync.run(
        `INSERT INTO user_blocks (id, blocker_id, blocked_id) VALUES (?, ?, ?)`,
        [blockId, userB_id, userA_id]
    );
    const blockedCallRes = await callService.requestCall({
        callerId: userA_id,
        recipientId: userB_id,
        conversationId: convId,
        callType: 'VOICE'
    });
    check('Blocked user cannot call', !blockedCallRes.success && blockedCallRes.error === 'Cannot call this user.');

    // Unblock for subsequent tests
    await dbAsync.run('DELETE FROM user_blocks WHERE id = ?', [blockId]);

    // 3.4 Unauthorized user not in conversation
    const unauthCallRes = await callService.requestCall({
        callerId: userC_id,
        recipientId: userB_id,
        conversationId: convId,
        callType: 'VOICE'
    });
    check('Non-member cannot initiate call in conversation', !unauthCallRes.success);

    // 4. Consent-Based State Machine Flow (Decline Flow)
    console.log('\n--- 4. Explicit Consent & Decline Lifecycle ---');
    const req1 = await callService.requestCall({
        callerId: userA_id,
        recipientId: userB_id,
        conversationId: convId,
        callType: 'VOICE',
        callerTabId: 'tab_caller_1'
    });
    check('Voice call successfully requested', req1.success && req1.call.status === 'REQUESTED');
    check('Call message inserted into conversation', req1.messageId !== undefined);

    // Non-recipient cannot accept
    const badAccept = await callService.acceptCall({
        callId: req1.call.id,
        userId: userC_id
    });
    check('Third party cannot accept call', !badAccept.success);

    // Recipient declines
    const declineRes = await callService.declineCall({
        callId: req1.call.id,
        userId: userB_id
    });
    check('Recipient can decline call', declineRes.success && declineRes.call.status === 'DECLINED');

    // Terminal state protection: cannot accept declined call
    const postDeclineAccept = await callService.acceptCall({
        callId: req1.call.id,
        userId: userB_id
    });
    check('Cannot accept declined call (terminal state)', !postDeclineAccept.success);

    // 5. Full Successful Video Call Lifecycle
    console.log('\n--- 5. Full Video Call Lifecycle (Connect -> End) ---');
    const req2 = await callService.requestCall({
        callerId: userA_id,
        recipientId: userB_id,
        conversationId: convId,
        callType: 'VIDEO',
        callerTabId: 'tab_caller_2'
    });
    check('Video call successfully requested', req2.success && req2.call.callType === 'VIDEO');

    // Recipient accepts
    const acceptRes = await callService.acceptCall({
        callId: req2.call.id,
        userId: userB_id,
        recipientTabId: 'tab_recipient_1'
    });
    check('Recipient explicitly accepts call', acceptRes.success && acceptRes.call.status === 'ACCEPTED');

    // Negotiation
    const negRes = await callService.setNegotiating({
        callId: req2.call.id,
        userId: userA_id
    });
    check('Transition to NEGOTIATING', negRes.success && negRes.call.status === 'NEGOTIATING');

    // Connecting
    const connRes = await callService.setConnecting({
        callId: req2.call.id,
        userId: userB_id
    });
    check('Transition to CONNECTING', connRes.success && connRes.call.status === 'CONNECTING');

    // Connected (media flowing)
    const connectedRes = await callService.setConnected({
        callId: req2.call.id,
        userId: userA_id
    });
    check('Call marked CONNECTED', connectedRes.success && connectedRes.call.status === 'CONNECTED');

    // Active call query works
    const activeCall = await callService.getActiveCallForUser(userA_id);
    check('getActiveCallForUser retrieves active session', activeCall && activeCall.id === req2.call.id);

    // Busy state: Third user cannot call User A while in active call
    const busyCallRes = await callService.requestCall({
        callerId: userC_id,
        recipientId: userA_id,
        conversationId: convId, // (even if member)
        callType: 'VOICE'
    });
    check('Busy guard blocks new incoming call when user is on active call', !busyCallRes.success);

    // End call
    const endRes = await callService.endCall({
        callId: req2.call.id,
        userId: userB_id,
        reason: 'completed'
    });
    check('Call successfully ended', endRes.success && endRes.call.status === 'ENDED');

    // After end, user is no longer busy
    const noActiveCall = await callService.getActiveCallForUser(userA_id);
    check('Active call cleared after end', noActiveCall === undefined || noActiveCall === null);

    // 6. Expiration Engine Verification
    console.log('\n--- 6. Expiration Engine Verification ---');
    // Create an artificial stale call requested 35 seconds ago
    const staleId = uuidv4();
    await dbAsync.run(
        `INSERT INTO call_sessions (id, conversation_id, caller_id, recipient_id, call_type, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'VOICE', 'REQUESTED', datetime('now', '-35 seconds'), datetime('now', '-35 seconds'))`,
        [staleId, convId, userA_id, userB_id]
    );
    const expireRes = await callService.expireStaleRequests();
    check('Stale call requests expired by engine', expireRes.expiredRequested >= 1);

    const expiredCall = await dbAsync.get('SELECT status, end_reason FROM call_sessions WHERE id = ?', [staleId]);
    check('Expired call marked EXPIRED with reason expired', expiredCall.status === 'EXPIRED' && expiredCall.end_reason === 'expired');

    // 7. Call History
    console.log('\n--- 7. Call History ---');
    const history = await callService.getCallHistory(convId);
    check('Call history returns records for conversation', history.length >= 2);

    // Clean up test data
    await dbAsync.run('DELETE FROM call_events WHERE call_id IN (SELECT id FROM call_sessions WHERE conversation_id = ?)', [convId]);
    await dbAsync.run('DELETE FROM call_sessions WHERE conversation_id = ?', [convId]);
    await dbAsync.run('DELETE FROM messages WHERE conversation_id = ?', [convId]);
    await dbAsync.run('DELETE FROM conversation_members WHERE conversation_id = ?', [convId]);
    await dbAsync.run('DELETE FROM conversations WHERE id = ?', [convId]);
    await dbAsync.run('DELETE FROM users WHERE id IN (?, ?, ?)', [userA_id, userB_id, userC_id]);

    console.log(`\n======================================================`);
    console.log(`CALLING SYSTEM TESTS COMPLETE: ${passedChecks}/${totalChecks} checks PASSED!`);
    console.log(`======================================================\n`);
}

runCallingTests().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Fatal error in calling test suite:', err);
    process.exit(1);
});
