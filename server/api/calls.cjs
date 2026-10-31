/**
 * NostalgicVerse — Calls API Router
 * =================================
 * Express endpoints for WebRTC 1-to-1 Voice and Video Calling.
 * Handles lifecycle: request, accept, decline, cancel, connect, end, active check, and ICE config.
 */

'use strict';

const express = require('express');
const { requireAuth } = require('../middleware/authMiddleware.cjs');
const { callRequestLimiter } = require('../middleware/rateLimitMiddleware.cjs');
const callService = require('../services/callService.cjs');
const { broadcastToUser, broadcastToConversation } = require('../realtime/websocket.cjs');
const { dbAsync } = require('../db/index.cjs');

const router = express.Router();

router.use(requireAuth);

/**
 * GET /api/calls/config/ice
 * Returns authoritative ICE server configuration (STUN/TURN)
 */
router.get('/config/ice', (req, res) => {
    const iceServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ];

    if (process.env.TURN_SERVER_URL) {
        iceServers.push({
            urls: process.env.TURN_SERVER_URL,
            username: process.env.TURN_USERNAME || '',
            credential: process.env.TURN_CREDENTIAL || ''
        });
    }

    res.json({ success: true, iceServers });
});

/**
 * GET /api/calls/active
 * Returns current active call for the authenticated user, if any
 */
router.get('/active', async (req, res) => {
    try {
        const call = await callService.getActiveCallForUser(req.user.id);
        res.json({ success: true, call: call || null });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/calls/request
 * Caller creates an explicit call request. Media does NOT start automatically.
 */
router.post('/request', callRequestLimiter, async (req, res) => {
    const { conversationId, recipientId, callType, tabId } = req.body;

    if (!conversationId || !recipientId || !callType) {
        return res.status(400).json({ error: 'Missing required parameters: conversationId, recipientId, callType.' });
    }

    try {
        const result = await callService.requestCall({
            callerId: req.user.id,
            recipientId,
            conversationId,
            callType,
            callerTabId: tabId
        });

        if (!result.success) {
            const status = result.code === 'BUSY' ? 486 : 400;
            return res.status(status).json({ error: result.error, code: result.code });
        }

        // Notify recipient of incoming call via WebSocket
        broadcastToUser(recipientId, {
            type: 'call.incoming',
            legacyType: 'CALL_INCOMING',
            call: result.call,
            caller: result.caller
        });

        // Notify conversation subscribers of new call request message
        broadcastToConversation(conversationId, {
            type: 'call.requested',
            legacyType: 'CALL_REQUESTED',
            call: result.call,
            messageId: result.messageId
        });

        res.json({ success: true, call: result.call, caller: result.caller });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/calls/:id/accept
 * Recipient explicitly accepts the call request.
 */
router.post('/:id/accept', async (req, res) => {
    const { tabId } = req.body;
    try {
        const result = await callService.acceptCall({
            callId: req.params.id,
            userId: req.user.id,
            recipientTabId: tabId
        });

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        const call = result.call;

        // Signal caller that call was accepted
        broadcastToUser(call.caller_id, {
            type: 'call.accepted',
            legacyType: 'CALL_ACCEPTED',
            callId: call.id,
            recipientTabId: tabId
        });

        // Sync other tabs of the recipient to dismiss incoming call modal
        broadcastToUser(call.recipient_id, {
            type: 'call.accepted_sync',
            callId: call.id,
            recipientTabId: tabId
        });

        // Update conversation room state
        broadcastToConversation(call.conversation_id, {
            type: 'call.status_change',
            callId: call.id,
            status: 'ACCEPTED'
        });

        res.json({ success: true, call });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/calls/:id/decline
 * Recipient explicitly declines the call.
 */
router.post('/:id/decline', async (req, res) => {
    try {
        const result = await callService.declineCall({
            callId: req.params.id,
            userId: req.user.id
        });

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        const call = result.call;

        // Notify caller that call was declined
        broadcastToUser(call.caller_id, {
            type: 'call.declined',
            legacyType: 'CALL_DECLINED',
            callId: call.id
        });

        // Sync recipient's other tabs
        broadcastToUser(call.recipient_id, {
            type: 'call.declined_sync',
            callId: call.id
        });

        broadcastToConversation(call.conversation_id, {
            type: 'call.status_change',
            callId: call.id,
            status: 'DECLINED'
        });

        res.json({ success: true, call });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/calls/:id/cancel
 * Caller cancels call before it is answered.
 */
router.post('/:id/cancel', async (req, res) => {
    try {
        const result = await callService.cancelCall({
            callId: req.params.id,
            userId: req.user.id
        });

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        const call = result.call;
        const targetUserId = req.user.id === call.caller_id ? call.recipient_id : call.caller_id;

        broadcastToUser(targetUserId, {
            type: 'call.cancelled',
            legacyType: 'CALL_CANCELLED',
            callId: call.id
        });

        broadcastToConversation(call.conversation_id, {
            type: 'call.status_change',
            callId: call.id,
            status: 'CANCELLED'
        });

        res.json({ success: true, call });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/calls/:id/connected
 * WebRTC media stream is established.
 */
router.post('/:id/connected', async (req, res) => {
    try {
        const result = await callService.setConnected({
            callId: req.params.id,
            userId: req.user.id
        });

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        const call = result.call;
        const targetUserId = req.user.id === call.caller_id ? call.recipient_id : call.caller_id;

        broadcastToUser(targetUserId, {
            type: 'call.connected',
            legacyType: 'CALL_CONNECTED',
            callId: call.id
        });

        broadcastToConversation(call.conversation_id, {
            type: 'call.status_change',
            callId: call.id,
            status: 'CONNECTED'
        });

        res.json({ success: true, call });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/calls/:id/end
 * Hang up active call.
 */
router.post('/:id/end', async (req, res) => {
    const { reason } = req.body;
    try {
        const result = await callService.endCall({
            callId: req.params.id,
            userId: req.user.id,
            reason
        });

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        const call = result.call;
        const targetUserId = req.user.id === call.caller_id ? call.recipient_id : call.caller_id;

        const endPayload = {
            type: 'call.ended',
            legacyType: 'CALL_ENDED',
            callId: call.id,
            reason: reason || 'completed',
            duration: call.duration_seconds || 0
        };

        broadcastToUser(call.caller_id, endPayload);
        broadcastToUser(call.recipient_id, endPayload);

        broadcastToConversation(call.conversation_id, {
            type: 'call.status_change',
            callId: call.id,
            status: call.status,
            duration: call.duration_seconds || 0
        });

        res.json({ success: true, call });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * POST /api/calls/:id/fail
 * Record call failure (e.g. media permission denied after acceptance)
 */
router.post('/:id/fail', async (req, res) => {
    const { reason } = req.body;
    try {
        const result = await callService.failCall({
            callId: req.params.id,
            userId: req.user.id,
            reason: reason || 'media_permission_failed'
        });

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        const call = result.call;
        const failPayload = {
            type: 'call.failed',
            legacyType: 'CALL_FAILED',
            callId: call.id,
            reason: reason || 'media_permission_failed',
            actorId: req.user.id
        };

        broadcastToUser(call.caller_id, failPayload);
        broadcastToUser(call.recipient_id, failPayload);

        broadcastToConversation(call.conversation_id, {
            type: 'call.status_change',
            callId: call.id,
            status: 'FAILED',
            reason: reason || 'media_permission_failed'
        });

        res.json({ success: true, call });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/calls/conversations/:conversationId
 * Returns call history for a specific conversation
 */
router.get('/conversations/:conversationId', async (req, res) => {
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = parseInt(req.query.offset, 10) || 0;

    try {
        const member = await dbAsync.get(
            'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
            [req.params.conversationId, req.user.id]
        );
        if (!member) {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        const history = await callService.getCallHistory(req.params.conversationId, limit, offset);
        res.json({ success: true, calls: history });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/calls/:id
 * Retrieve specific call record
 */
router.get('/:id', async (req, res) => {
    try {
        const call = await callService.getCall(req.params.id);
        if (!call) {
            return res.status(404).json({ error: 'Call not found.' });
        }

        if (call.caller_id !== req.user.id && call.recipient_id !== req.user.id && req.user.role !== 'OWNER') {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        res.json({ success: true, call });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
