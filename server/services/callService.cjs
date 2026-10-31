/**
 * NostalgicVerse — Call Service
 * =============================
 * Server-authoritative call state machine for 1-to-1 voice and video calls.
 * 
 * State Machine:
 *   REQUESTED -> RINGING -> ACCEPTED -> NEGOTIATING -> CONNECTING -> CONNECTED -> ENDED
 *   REQUESTED -> DECLINED | CANCELLED | EXPIRED | BLOCKED
 *   RINGING -> DECLINED | CANCELLED | EXPIRED | MISSED
 *   ACCEPTED -> NEGOTIATING | FAILED | CANCELLED
 *   NEGOTIATING -> CONNECTING | FAILED | CANCELLED
 *   CONNECTING -> CONNECTED | FAILED | CANCELLED
 *   CONNECTED -> ENDED
 */

'use strict';

const { dbAsync } = require('../db/connection.cjs');
const { v4: uuidv4 } = require('uuid');

// Valid state transitions
const VALID_TRANSITIONS = {
    REQUESTED: ['RINGING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'BLOCKED'],
    RINGING: ['ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED', 'MISSED'],
    ACCEPTED: ['NEGOTIATING', 'FAILED', 'CANCELLED'],
    NEGOTIATING: ['CONNECTING', 'FAILED', 'CANCELLED'],
    CONNECTING: ['CONNECTED', 'FAILED', 'CANCELLED'],
    CONNECTED: ['ENDED']
};

// Terminal states — no further transitions allowed
const TERMINAL_STATES = new Set(['ENDED', 'DECLINED', 'CANCELLED', 'MISSED', 'BUSY', 'EXPIRED', 'FAILED', 'BLOCKED']);

// Active states — call is in progress
const ACTIVE_STATES = new Set(['REQUESTED', 'RINGING', 'ACCEPTED', 'NEGOTIATING', 'CONNECTING', 'CONNECTED']);

// Call request expiration timeout (30 seconds)
const CALL_REQUEST_TIMEOUT_MS = 30000;

// Ringing timeout (45 seconds)
const RINGING_TIMEOUT_MS = 45000;

/**
 * Create a new call request
 */
async function requestCall({ callerId, recipientId, conversationId, callType, callerTabId }) {
    // Validate call type
    if (!['VOICE', 'VIDEO'].includes(callType)) {
        return { success: false, error: 'Invalid call type. Must be VOICE or VIDEO.' };
    }

    // Check if calling is enabled
    const callingEnabled = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'calling_enabled'");
    if (callingEnabled && callingEnabled.value !== 'true') {
        return { success: false, error: 'Calling is currently disabled.' };
    }

    // Prevent self-calling
    if (callerId === recipientId) {
        return { success: false, error: 'Cannot call yourself.' };
    }

    // Check conversation exists and both users are members
    const conversation = await dbAsync.get(
        'SELECT id, type FROM conversations WHERE id = ?',
        [conversationId]
    );
    if (!conversation) {
        return { success: false, error: 'Conversation not found.' };
    }
    if (conversation.type !== 'DIRECT') {
        return { success: false, error: 'Calls are only supported in direct conversations.' };
    }

    // Verify both are members
    const callerMember = await dbAsync.get(
        'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
        [conversationId, callerId]
    );
    const recipientMember = await dbAsync.get(
        'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
        [conversationId, recipientId]
    );
    if (!callerMember || !recipientMember) {
        return { success: false, error: 'Both users must be members of this conversation.' };
    }

    // Check blocks (bidirectional)
    const block = await dbAsync.get(
        'SELECT 1 FROM user_blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)',
        [callerId, recipientId, recipientId, callerId]
    );
    if (block) {
        return { success: false, error: 'Cannot call this user.' };
    }

    // Check if caller already has an active call
    const callerActiveCall = await dbAsync.get(
        `SELECT id FROM call_sessions 
         WHERE (caller_id = ? OR recipient_id = ?) 
         AND status IN ('REQUESTED', 'RINGING', 'ACCEPTED', 'NEGOTIATING', 'CONNECTING', 'CONNECTED')`,
        [callerId, callerId]
    );
    if (callerActiveCall) {
        return { success: false, error: 'You already have an active call.' };
    }

    // Check if recipient already has an active call
    const recipientActiveCall = await dbAsync.get(
        `SELECT id FROM call_sessions 
         WHERE (caller_id = ? OR recipient_id = ?) 
         AND status IN ('REQUESTED', 'RINGING', 'ACCEPTED', 'NEGOTIATING', 'CONNECTING', 'CONNECTED')`,
        [recipientId, recipientId]
    );
    if (recipientActiveCall) {
        return { success: false, error: 'User is busy.', code: 'BUSY' };
    }

    // Check friendship requirement if enabled
    const requireFriendship = await dbAsync.get("SELECT value FROM site_settings WHERE key = 'calling_require_friendship'");
    if (requireFriendship && requireFriendship.value === 'true') {
        const friendship = await dbAsync.get(
            'SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?',
            [callerId, recipientId]
        );
        if (!friendship) {
            return { success: false, error: 'You must be friends to call this user.' };
        }
    }

    // Create call session
    const callId = uuidv4();
    await dbAsync.run(
        `INSERT INTO call_sessions (id, conversation_id, caller_id, recipient_id, call_type, status, caller_tab_id, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'REQUESTED', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [callId, conversationId, callerId, recipientId, callType, callerTabId || null]
    );

    // Log event
    await logCallEvent(callId, 'REQUESTED', callerId, { callType, conversationId });

    // Insert a system message into the conversation
    const msgId = uuidv4();
    const callLabel = callType === 'VIDEO' ? 'Video Call' : 'Voice Call';
    await dbAsync.run(
        `INSERT INTO messages (id, conversation_id, sender_id, body, message_type, created_at)
         VALUES (?, ?, ?, ?, 'CALL_REQUEST', CURRENT_TIMESTAMP)`,
        [msgId, conversationId, callerId, JSON.stringify({ callId, callType, label: `${callLabel} requested` })]
    );
    await dbAsync.run('UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [conversationId]);

    // Get caller info for the notification
    const caller = await dbAsync.get('SELECT id, username, display_name, avatar_id FROM users WHERE id = ?', [callerId]);

    return {
        success: true,
        call: {
            id: callId,
            conversationId,
            callerId,
            recipientId,
            callType,
            status: 'REQUESTED',
            createdAt: new Date().toISOString()
        },
        messageId: msgId,
        caller: {
            id: caller.id,
            username: caller.username,
            displayName: caller.display_name,
            avatarId: caller.avatar_id
        }
    };
}

/**
 * Accept an incoming call
 */
async function acceptCall({ callId, userId, recipientTabId }) {
    const call = await dbAsync.get('SELECT * FROM call_sessions WHERE id = ?', [callId]);
    if (!call) {
        return { success: false, error: 'Call not found.' };
    }

    // Only the recipient can accept
    if (call.recipient_id !== userId) {
        return { success: false, error: 'Only the recipient can accept this call.' };
    }

    // Can only accept from REQUESTED or RINGING
    if (!['REQUESTED', 'RINGING'].includes(call.status)) {
        return { success: false, error: `Cannot accept call in ${call.status} state.` };
    }

    await dbAsync.run(
        `UPDATE call_sessions SET status = 'ACCEPTED', recipient_tab_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [recipientTabId || null, callId]
    );

    await logCallEvent(callId, 'ACCEPTED', userId, null);

    return {
        success: true,
        call: { ...call, status: 'ACCEPTED', recipient_tab_id: recipientTabId }
    };
}

/**
 * Decline an incoming call
 */
async function declineCall({ callId, userId }) {
    const call = await dbAsync.get('SELECT * FROM call_sessions WHERE id = ?', [callId]);
    if (!call) {
        return { success: false, error: 'Call not found.' };
    }

    // Only the recipient can decline
    if (call.recipient_id !== userId) {
        return { success: false, error: 'Only the recipient can decline this call.' };
    }

    if (TERMINAL_STATES.has(call.status)) {
        return { success: false, error: 'Call already ended.' };
    }

    await dbAsync.run(
        `UPDATE call_sessions SET status = 'DECLINED', ended_at = CURRENT_TIMESTAMP, end_reason = 'declined', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [callId]
    );

    await logCallEvent(callId, 'DECLINED', userId, null);
    await updateCallMessage(call.conversation_id, call.id, 'Call declined');

    return { success: true, call: { ...call, status: 'DECLINED' } };
}

/**
 * Cancel an outgoing call
 */
async function cancelCall({ callId, userId }) {
    const call = await dbAsync.get('SELECT * FROM call_sessions WHERE id = ?', [callId]);
    if (!call) {
        return { success: false, error: 'Call not found.' };
    }

    if (call.caller_id !== userId && call.recipient_id !== userId) {
        return { success: false, error: 'Not authorized to cancel this call.' };
    }

    if (TERMINAL_STATES.has(call.status)) {
        return { success: false, error: 'Call already ended.' };
    }

    await dbAsync.run(
        `UPDATE call_sessions SET status = 'CANCELLED', ended_at = CURRENT_TIMESTAMP, end_reason = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [callId]
    );

    await logCallEvent(callId, 'CANCELLED', userId, null);
    await updateCallMessage(call.conversation_id, call.id, 'Call cancelled');

    return { success: true, call: { ...call, status: 'CANCELLED' } };
}

/**
 * Transition to NEGOTIATING
 */
async function setNegotiating({ callId, userId }) {
    return await transitionState(callId, userId, 'NEGOTIATING');
}

/**
 * Transition to CONNECTING
 */
async function setConnecting({ callId, userId }) {
    return await transitionState(callId, userId, 'CONNECTING');
}

/**
 * Mark call as CONNECTED
 */
async function setConnected({ callId, userId }) {
    const call = await dbAsync.get('SELECT * FROM call_sessions WHERE id = ?', [callId]);
    if (!call) return { success: false, error: 'Call not found.' };

    if (call.caller_id !== userId && call.recipient_id !== userId) {
        return { success: false, error: 'Not authorized.' };
    }

    if (!['NEGOTIATING', 'CONNECTING', 'ACCEPTED'].includes(call.status)) {
        if (call.status === 'CONNECTED') return { success: true, call };
        return { success: false, error: `Cannot connect from ${call.status} state.` };
    }

    await dbAsync.run(
        `UPDATE call_sessions SET status = 'CONNECTED', started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [callId]
    );

    await logCallEvent(callId, 'CONNECTED', userId, null);
    await updateCallMessage(call.conversation_id, call.id, `${call.call_type === 'VIDEO' ? 'Video' : 'Voice'} call in progress...`);

    return { success: true, call: { ...call, status: 'CONNECTED' } };
}

/**
 * End an active call
 */
async function endCall({ callId, userId, reason }) {
    const call = await dbAsync.get('SELECT * FROM call_sessions WHERE id = ?', [callId]);
    if (!call) return { success: false, error: 'Call not found.' };

    if (call.caller_id !== userId && call.recipient_id !== userId) {
        return { success: false, error: 'Not authorized.' };
    }

    if (TERMINAL_STATES.has(call.status)) {
        return { success: true, call };
    }

    const endReason = reason || 'completed';
    let durationSeconds = 0;
    if (call.started_at) {
        durationSeconds = Math.max(0, Math.floor((Date.now() - new Date(call.started_at + 'Z').getTime()) / 1000));
    }

    const finalStatus = call.status === 'CONNECTED' ? 'ENDED' : 'CANCELLED';

    await dbAsync.run(
        `UPDATE call_sessions SET status = ?, ended_at = CURRENT_TIMESTAMP, end_reason = ?, duration_seconds = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [finalStatus, endReason, durationSeconds, callId]
    );

    await logCallEvent(callId, finalStatus, userId, { reason: endReason, durationSeconds });

    let durationStr = '';
    if (durationSeconds > 0) {
        const mins = Math.floor(durationSeconds / 60);
        const secs = durationSeconds % 60;
        durationStr = mins > 0 ? ` (${mins}m ${secs}s)` : ` (${secs}s)`;
    }
    const callLabel = call.call_type === 'VIDEO' ? 'Video call' : 'Voice call';
    await updateCallMessage(call.conversation_id, call.id, `${callLabel} ended${durationStr}`);

    return { success: true, call: { ...call, status: finalStatus, duration_seconds: durationSeconds } };
}

/**
 * Mark call as failed
 */
async function failCall({ callId, userId, reason }) {
    const call = await dbAsync.get('SELECT * FROM call_sessions WHERE id = ?', [callId]);
    if (!call) return { success: false, error: 'Call not found.' };

    if (TERMINAL_STATES.has(call.status)) {
        return { success: true, call };
    }

    await dbAsync.run(
        `UPDATE call_sessions SET status = 'FAILED', ended_at = CURRENT_TIMESTAMP, end_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [reason || 'failed', callId]
    );

    await logCallEvent(callId, 'FAILED', userId, { reason });
    await updateCallMessage(call.conversation_id, call.id, 'Call failed');

    return { success: true, call: { ...call, status: 'FAILED' } };
}

/**
 * Expire stale call requests
 */
async function expireStaleRequests() {
    const staleRequested = await dbAsync.all(
        `SELECT id, conversation_id FROM call_sessions WHERE status = 'REQUESTED' AND created_at < datetime('now', '-30 seconds')`
    );
    for (const call of staleRequested) {
        await dbAsync.run(
            `UPDATE call_sessions SET status = 'EXPIRED', ended_at = CURRENT_TIMESTAMP, end_reason = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'REQUESTED'`,
            [call.id]
        );
        await logCallEvent(call.id, 'EXPIRED', null, { phase: 'REQUESTED' });
        await updateCallMessage(call.conversation_id, call.id, 'Call expired (no answer)');
    }

    const staleRinging = await dbAsync.all(
        `SELECT id, conversation_id FROM call_sessions WHERE status = 'RINGING' AND updated_at < datetime('now', '-45 seconds')`
    );
    for (const call of staleRinging) {
        await dbAsync.run(
            `UPDATE call_sessions SET status = 'MISSED', ended_at = CURRENT_TIMESTAMP, end_reason = 'missed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'RINGING'`,
            [call.id]
        );
        await logCallEvent(call.id, 'MISSED', null, { phase: 'RINGING' });
        await updateCallMessage(call.conversation_id, call.id, 'Missed call');
    }

    return { expiredRequested: staleRequested.length, missedRinging: staleRinging.length };
}

/**
 * Get active call for a user
 */
async function getActiveCallForUser(userId) {
    return await dbAsync.get(
        `SELECT cs.*, 
                cu.username as caller_username, cu.display_name as caller_display_name, cu.avatar_id as caller_avatar_id,
                ru.username as recipient_username, ru.display_name as recipient_display_name, ru.avatar_id as recipient_avatar_id
         FROM call_sessions cs
         JOIN users cu ON cs.caller_id = cu.id
         JOIN users ru ON cs.recipient_id = ru.id
         WHERE (cs.caller_id = ? OR cs.recipient_id = ?)
         AND cs.status IN ('REQUESTED', 'RINGING', 'ACCEPTED', 'NEGOTIATING', 'CONNECTING', 'CONNECTED')
         ORDER BY cs.created_at DESC LIMIT 1`,
        [userId, userId]
    );
}

/**
 * Get call history for a conversation
 */
async function getCallHistory(conversationId, limit = 20, offset = 0) {
    return await dbAsync.all(
        `SELECT cs.*,
                cu.username as caller_username, cu.display_name as caller_display_name, cu.avatar_id as caller_avatar_id,
                ru.username as recipient_username, ru.display_name as recipient_display_name, ru.avatar_id as recipient_avatar_id
         FROM call_sessions cs
         JOIN users cu ON cs.caller_id = cu.id
         JOIN users ru ON cs.recipient_id = ru.id
         WHERE cs.conversation_id = ?
         ORDER BY cs.created_at DESC
         LIMIT ? OFFSET ?`,
        [conversationId, limit, offset]
    );
}

/**
 * Get a specific call by ID
 */
async function getCall(callId) {
    return await dbAsync.get(
        `SELECT cs.*,
                cu.username as caller_username, cu.display_name as caller_display_name, cu.avatar_id as caller_avatar_id,
                ru.username as recipient_username, ru.display_name as recipient_display_name, ru.avatar_id as recipient_avatar_id
         FROM call_sessions cs
         JOIN users cu ON cs.caller_id = cu.id
         JOIN users ru ON cs.recipient_id = ru.id
         WHERE cs.id = ?`,
        [callId]
    );
}

// ========== Internal Helpers ==========

async function transitionState(callId, userId, newStatus) {
    const call = await dbAsync.get('SELECT * FROM call_sessions WHERE id = ?', [callId]);
    if (!call) return { success: false, error: 'Call not found.' };

    if (call.caller_id !== userId && call.recipient_id !== userId) {
        return { success: false, error: 'Not authorized.' };
    }

    const allowed = VALID_TRANSITIONS[call.status];
    if (!allowed || !allowed.includes(newStatus)) {
        if (call.status === newStatus) return { success: true, call };
        return { success: false, error: `Invalid transition from ${call.status} to ${newStatus}.` };
    }

    await dbAsync.run(
        'UPDATE call_sessions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [newStatus, callId]
    );

    await logCallEvent(callId, newStatus, userId, null);
    return { success: true, call: { ...call, status: newStatus } };
}

async function logCallEvent(callId, eventType, actorId, payload) {
    const eventId = uuidv4();
    await dbAsync.run(
        'INSERT INTO call_events (id, call_id, event_type, actor_id, payload, created_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
        [eventId, callId, eventType, actorId, payload ? JSON.stringify(payload) : null]
    );
}

async function updateCallMessage(conversationId, callId, label) {
    try {
        await dbAsync.run(
            `UPDATE messages SET body = ? WHERE conversation_id = ? AND message_type = 'CALL_REQUEST' AND body LIKE ?`,
            [JSON.stringify({ callId, label }), conversationId, `%"callId":"${callId}"%`]
        );
    } catch (err) {
        console.warn('[CallService] Failed to update call message:', err.message);
    }
}

module.exports = {
    requestCall,
    acceptCall,
    declineCall,
    cancelCall,
    setNegotiating,
    setConnecting,
    setConnected,
    endCall,
    failCall,
    expireStaleRequests,
    getActiveCallForUser,
    getCallHistory,
    getCall,
    ACTIVE_STATES,
    TERMINAL_STATES,
    CALL_REQUEST_TIMEOUT_MS,
    RINGING_TIMEOUT_MS
};
