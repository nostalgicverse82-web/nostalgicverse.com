const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');
const { requireAuth } = require('../middleware/authMiddleware.cjs');
const { broadcastMessage, broadcastToUser } = require('../realtime/websocket.cjs');

const router = express.Router();

// Helper to check membership
async function isMember(conversationId, userId) {
    const row = await dbAsync.get(
        'SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?',
        [conversationId, userId]
    );
    return !!row;
}

// 1. Get list of conversations for current user
router.get('/conversations', requireAuth, async (req, res) => {
    try {
        const rows = await dbAsync.all(`
            SELECT c.id, c.type, c.updated_at,
                   u.id as other_user_id, u.username as other_username, 
                   u.display_name as other_display_name, u.avatar_id as other_avatar_id,
                   cm.last_read_at,
                   (SELECT body FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                   (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
                   (SELECT COUNT(*) FROM messages 
                    WHERE conversation_id = c.id 
                      AND sender_id != ? 
                      AND (cm.last_read_at IS NULL OR created_at > cm.last_read_at)) as unread_count
            FROM conversations c
            JOIN conversation_members cm ON c.id = cm.conversation_id AND cm.user_id = ?
            JOIN conversation_members other_cm ON c.id = other_cm.conversation_id AND other_cm.user_id != cm.user_id
            JOIN users u ON other_cm.user_id = u.id
            ORDER BY c.updated_at DESC
        `, [req.user.id, req.user.id]);
        
        res.json({ conversations: rows });
    } catch (err) {
        console.error('[CHAT_API] conversations error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. Create or find canonical direct conversation (idempotent)
router.post('/conversations', requireAuth, async (req, res) => {
    const target_id = req.body.target_id || req.body.targetUserId;
    const target_username = req.body.target_username || req.body.targetUsername;
    if (!target_username && !target_id) {
        return res.status(400).json({ error: 'target_username or target_id required' });
    }
    
    try {
        let targetUser;
        if (target_id) {
            targetUser = await dbAsync.get('SELECT id, username FROM users WHERE id = ?', [target_id]);
        } else {
            const targetNorm = target_username.toLowerCase().trim();
            targetUser = await dbAsync.get('SELECT id, username FROM users WHERE username_normalized = ?', [targetNorm]);
        }
        
        if (!targetUser) return res.status(404).json({ error: 'User not found' });
        if (targetUser.id === req.user.id) return res.status(400).json({ error: 'Cannot chat with yourself' });
        
        // Check blocks
        const blocked = await dbAsync.get(`
            SELECT 1 FROM user_blocks 
            WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
        `, [req.user.id, targetUser.id, targetUser.id, req.user.id]);
        if (blocked) return res.status(403).json({ error: 'Cannot message this user' });

        // Check if direct conversation already exists between these 2 users
        const existing = await dbAsync.get(`
            SELECT c.id FROM conversations c
            JOIN conversation_members cm1 ON c.id = cm1.conversation_id AND cm1.user_id = ?
            JOIN conversation_members cm2 ON c.id = cm2.conversation_id AND cm2.user_id = ?
            WHERE c.type = 'DIRECT'
            LIMIT 1
        `, [req.user.id, targetUser.id]);
        
        if (existing) {
            return res.json({ success: true, conversation_id: existing.id });
        }
        
        // Create new direct conversation inside a serialized transaction
        const convId = uuidv4();
        await dbAsync.transaction(async () => {
            await dbAsync.run(
                `INSERT INTO conversations (id, type, created_by, created_at, updated_at) VALUES (?, 'DIRECT', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                [convId, req.user.id]
            );
            await dbAsync.run(
                `INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
                [convId, req.user.id]
            );
            await dbAsync.run(
                `INSERT INTO conversation_members (conversation_id, user_id, joined_at) VALUES (?, ?, CURRENT_TIMESTAMP)`,
                [convId, targetUser.id]
            );
        });
        
        res.json({ success: true, conversation_id: convId });
    } catch (err) {
        console.error('[CHAT_API] create conversation error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Get messages for a conversation (paginated, chronological order)
router.get('/conversations/:id/messages', requireAuth, async (req, res) => {
    const convId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);
    const offset = parseInt(req.query.offset, 10) || 0;
    const beforeId = req.query.before;
    
    try {
        if (!(await isMember(convId, req.user.id))) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        
        let query = `
            SELECT m.id, m.conversation_id, m.sender_id, m.body, m.message_type, 
                   m.client_message_id, m.created_at, m.edited_at, m.deleted_at,
                   u.username as sender_username, u.display_name as sender_display_name, u.avatar_id as sender_avatar_id
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ?
        `;
        const params = [convId];

        if (beforeId) {
            query += ` AND m.created_at < (SELECT created_at FROM messages WHERE id = ?) `;
            params.push(beforeId);
        }

        query += ` ORDER BY m.created_at DESC, m.id DESC LIMIT ? OFFSET ? `;
        params.push(limit, offset);

        const messages = await dbAsync.all(query, params);
        
        // Update last_read_at if fetching latest messages (not paginating backwards)
        if (!beforeId) {
            await dbAsync.run(
                `UPDATE conversation_members SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?`,
                [convId, req.user.id]
            );
        }
        
        // Return in ascending chronological order for display
        res.json({ messages: messages.reverse() });
    } catch (err) {
        console.error('[CHAT_API] get messages error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Send a message with strict idempotency (client_message_id)
router.post('/conversations/:id/messages', requireAuth, async (req, res) => {
    const convId = req.params.id;
    const { body, client_message_id } = req.body;
    
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
        return res.status(400).json({ error: 'Message body required' });
    }
    if (body.length > 2000) {
        return res.status(400).json({ error: 'Message exceeds maximum length (2000 characters)' });
    }
    
    try {
        if (!(await isMember(convId, req.user.id))) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Idempotency check: if client_message_id is provided, check if it was already inserted
        if (client_message_id) {
            const existing = await dbAsync.get(`
                SELECT m.id, m.conversation_id, m.sender_id, m.body, m.message_type, 
                       m.client_message_id, m.created_at,
                       u.username as sender_username, u.display_name as sender_display_name, u.avatar_id as sender_avatar_id
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.conversation_id = ? AND m.client_message_id = ?
            `, [convId, client_message_id]);
            
            if (existing) {
                // Return the existing canonical message without re-inserting
                return res.json({ success: true, message: existing, duplicate_suppressed: true });
            }
        }
        
        const msgId = uuidv4();
        const trimmedBody = body.trim();
        
        await dbAsync.run('BEGIN TRANSACTION');
        
        await dbAsync.run(`
            INSERT INTO messages (id, conversation_id, sender_id, body, client_message_id, created_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [msgId, convId, req.user.id, trimmedBody, client_message_id || null]);
        
        await dbAsync.run(
            `UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [convId]
        );
        
        // Also update sender's last_read_at so sender's own message is marked read
        await dbAsync.run(
            `UPDATE conversation_members SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?`,
            [convId, req.user.id]
        );
        
        await dbAsync.run('COMMIT');
        
        const fullMsg = await dbAsync.get(`
            SELECT m.id, m.conversation_id, m.sender_id, m.body, m.message_type, 
                   m.client_message_id, m.created_at,
                   u.username as sender_username, u.display_name as sender_display_name, u.avatar_id as sender_avatar_id
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.id = ?
        `, [msgId]);
        
        // Broadcast via websocket to subscribers of this conversation
        if (typeof broadcastMessage === 'function') {
            broadcastMessage(convId, fullMsg);
        }
        
        // Notify other member(s) who might not be inside the conversation currently
        const otherMembers = await dbAsync.all(
            `SELECT user_id FROM conversation_members WHERE conversation_id = ? AND user_id != ?`,
            [convId, req.user.id]
        );
        for (const member of otherMembers) {
            broadcastToUser(member.user_id, {
                type: 'notification.created',
                legacyType: 'NEW_MESSAGE_NOTIFICATION',
                conversation_id: convId,
                sender: {
                    id: req.user.id,
                    username: req.user.username,
                    displayName: req.user.displayName,
                    avatar_id: req.user.avatar_id
                },
                preview: trimmedBody.substring(0, 100)
            });
        }
        
        res.json({ success: true, message: fullMsg });
    } catch (err) {
        await dbAsync.run('ROLLBACK').catch(() => {});
        console.error('[CHAT_API] send message error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Mark conversation as read
router.post('/conversations/:id/read', requireAuth, async (req, res) => {
    const convId = req.params.id;
    try {
        if (!(await isMember(convId, req.user.id))) {
            return res.status(403).json({ error: 'Not authorized' });
        }
        await dbAsync.run(
            `UPDATE conversation_members SET last_read_at = CURRENT_TIMESTAMP WHERE conversation_id = ? AND user_id = ?`,
            [convId, req.user.id]
        );
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
