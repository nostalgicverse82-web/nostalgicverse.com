const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const { getSessionUser } = require('../services/authService.cjs');
const cookie = require('cookie');
const { dbAsync } = require('../db/index.cjs');

const clients = new Map(); // ws -> { userId, isOwner, subscriptions }

function setupWebSockets(server) {
    const wss = new WebSocketServer({ 
        server,
        maxPayload: 65536 // 64KB maximum incoming payload to prevent memory exhaustion
    });

    wss.on('connection', async (ws, req) => {
        let userId = null;
        let isOwner = false;
        
        try {
            const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
            const token = cookies.session;
            if (token) {
                const user = await getSessionUser(token);
                if (user) {
                    userId = user.id;
                    isOwner = user.role === 'OWNER';
                }
            }
        } catch (err) {
            console.error('[WS] Auth parse error:', err);
        }

        const clientData = {
            userId,
            isOwner,
            subscriptions: new Set() // Conversation IDs or content targets subscribed to
        };
        clients.set(ws, clientData);
        
        ws.isAlive = true;
        ws.on('pong', () => { ws.isAlive = true; });

        ws.on('message', async (message) => {
            try {
                // Safeguard against oversized string messages
                if (typeof message === 'string' && message.length > 65536) {
                    console.warn('[WS] Payload exceeds 64KB limit from user:', userId);
                    return;
                }
                const data = JSON.parse(message);
                
                // Only authenticated users can interact with rooms
                if (!userId) return;

                if (data.type === 'JOIN_CONVERSATION') {
                    // Check authorization before allowing subscription
                    const row = await dbAsync.get(
                        'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
                        [data.conversationId, userId]
                    );
                    if (row) {
                        clientData.subscriptions.add(data.conversationId);
                    }
                } else if (data.type === 'LEAVE_CONVERSATION') {
                    clientData.subscriptions.delete(data.conversationId);
                } else if (data.type === 'TYPING' || data.type === 'typing.started') {
                    if (clientData.subscriptions.has(data.conversationId)) {
                        broadcastToConversation(data.conversationId, {
                            type: 'typing.started',
                            legacyType: 'TYPING',
                            conversationId: data.conversationId,
                            userId: userId
                        }, ws); // exclude sender
                    }
                } else if (data.type === 'CALL_OFFER' || data.type === 'call.offer') {
                    // WebRTC Offer from caller to recipient
                    const call = await dbAsync.get('SELECT * FROM call_sessions WHERE id = ?', [data.callId]);
                    if (call && (call.status === 'ACCEPTED' || call.status === 'NEGOTIATING')) {
                        if (call.caller_id === userId || call.recipient_id === userId) {
                            const targetUserId = userId === call.caller_id ? call.recipient_id : call.caller_id;
                            await dbAsync.run("UPDATE call_sessions SET status = 'NEGOTIATING', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [data.callId]);
                            broadcastToUser(targetUserId, {
                                type: 'call.offer',
                                legacyType: 'CALL_OFFER',
                                callId: data.callId,
                                sdp: data.sdp,
                                senderId: userId
                            });
                        }
                    }
                } else if (data.type === 'CALL_ANSWER' || data.type === 'call.answer') {
                    // WebRTC Answer from recipient to caller
                    const call = await dbAsync.get('SELECT * FROM call_sessions WHERE id = ?', [data.callId]);
                    if (call && (call.status === 'NEGOTIATING' || call.status === 'ACCEPTED')) {
                        if (call.recipient_id === userId || call.caller_id === userId) {
                            const targetUserId = userId === call.caller_id ? call.recipient_id : call.caller_id;
                            await dbAsync.run("UPDATE call_sessions SET status = 'CONNECTING', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [data.callId]);
                            broadcastToUser(targetUserId, {
                                type: 'call.answer',
                                legacyType: 'CALL_ANSWER',
                                callId: data.callId,
                                sdp: data.sdp,
                                senderId: userId
                            });
                        }
                    }
                } else if (data.type === 'CALL_ICE_CANDIDATE' || data.type === 'call.ice') {
                    // WebRTC ICE Candidate relay
                    const call = await dbAsync.get('SELECT * FROM call_sessions WHERE id = ?', [data.callId]);
                    if (call && ['ACCEPTED', 'NEGOTIATING', 'CONNECTING', 'CONNECTED'].includes(call.status)) {
                        if (call.caller_id === userId || call.recipient_id === userId) {
                            const targetUserId = userId === call.caller_id ? call.recipient_id : call.caller_id;
                            broadcastToUser(targetUserId, {
                                type: 'call.ice',
                                legacyType: 'CALL_ICE_CANDIDATE',
                                callId: data.callId,
                                candidate: data.candidate,
                                senderId: userId
                            });
                        }
                    }
                } else if (data.type === 'CALL_MEDIA_STATE' || data.type === 'call.media_state') {
                    // Relay mute/camera states
                    const call = await dbAsync.get('SELECT * FROM call_sessions WHERE id = ?', [data.callId]);
                    if (call && ['ACCEPTED', 'NEGOTIATING', 'CONNECTING', 'CONNECTED'].includes(call.status)) {
                        if (call.caller_id === userId || call.recipient_id === userId) {
                            const targetUserId = userId === call.caller_id ? call.recipient_id : call.caller_id;
                            broadcastToUser(targetUserId, {
                                type: 'call.media_state',
                                legacyType: 'CALL_MEDIA_STATE',
                                callId: data.callId,
                                audioEnabled: data.audioEnabled !== false,
                                videoEnabled: data.videoEnabled !== false,
                                senderId: userId
                            });
                        }
                    }
                }
            } catch (err) {
                console.error('[WS] Message Handler Error:', err);
            }
        });

        ws.on('close', () => {
            clients.delete(ws);
        });

        ws.on('error', (err) => {
            console.error('[WS] Socket error:', err.message);
            clients.delete(ws);
            try { ws.terminate(); } catch (_) {}
        });
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();
            ws.isAlive = false;
            try {
                ws.ping();
            } catch (err) {
                ws.terminate();
            }
        });
    }, 30000);

    wss.on('close', () => {
        clearInterval(interval);
    });
    
    return wss;
}

function safeSend(ws, payload) {
    if (ws.readyState === 1 /* OPEN */) {
        try {
            ws.send(payload, (err) => {
                if (err) {
                    console.warn('[WS] Send error on active client:', err.message);
                    clients.delete(ws);
                    try { ws.terminate(); } catch (_) {}
                }
            });
        } catch (e) {
            console.warn('[WS] Synchronous send exception:', e.message);
            clients.delete(ws);
        }
    }
}

function broadcastToConversation(conversationId, messageObj, excludeWs = null) {
    const payload = JSON.stringify({
        event_id: uuidv4(),
        timestamp: new Date().toISOString(),
        ...messageObj
    });
    clients.forEach((clientData, ws) => {
        if (ws !== excludeWs && clientData.subscriptions.has(conversationId)) {
            safeSend(ws, payload);
        }
    });
}

function broadcastMessage(conversationId, messageObj, excludeWs = null) {
    broadcastToConversation(conversationId, {
        type: 'message.created',
        legacyType: 'NEW_MESSAGE', // Backward compatibility for existing listeners
        conversationId,
        message: messageObj
    }, excludeWs);
}

function broadcastToUser(targetUserId, messageObj) {
    const payload = JSON.stringify({
        event_id: uuidv4(),
        timestamp: new Date().toISOString(),
        ...messageObj
    });
    clients.forEach((clientData, ws) => {
        if (clientData.userId === targetUserId) {
            safeSend(ws, payload);
        }
    });
}

function broadcastToOwner(messageObj) {
    const payload = JSON.stringify({
        event_id: uuidv4(),
        timestamp: new Date().toISOString(),
        ...messageObj
    });
    clients.forEach((clientData, ws) => {
        if (clientData.isOwner) {
            safeSend(ws, payload);
        }
    });
}

function getOnlineUserCount() {
    const userIds = new Set();
    clients.forEach((clientData, ws) => {
        if (ws.readyState === 1 && clientData.userId) {
            userIds.add(clientData.userId);
        }
    });
    return userIds.size;
}

module.exports = {
    setupWebSockets,
    broadcastToConversation,
    broadcastMessage,
    broadcastToUser,
    broadcastToOwner,
    broadcastToOwners: broadcastToOwner,
    getOnlineUserCount
};
