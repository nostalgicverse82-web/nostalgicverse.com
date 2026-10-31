const express = require('express');
const { dbAsync } = require('../db/index.cjs');
const { requireAuth } = require('../middleware/authMiddleware.cjs');
const { v4: uuidv4 } = require('uuid');
const { broadcastToOwner, broadcastToUser } = require('../realtime/websocket.cjs');

const router = express.Router();

// Get user's tickets
router.get('/tickets', requireAuth, async (req, res) => {
    try {
        const tickets = await dbAsync.all(`
            SELECT id, subject, category, status, priority, created_at, updated_at
            FROM support_tickets
            WHERE user_id = ?
            ORDER BY updated_at DESC
        `, [req.user.id]);
        res.json({ tickets });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new ticket
router.post('/tickets', requireAuth, async (req, res) => {
    try {
        const { subject, category, message, relatedContentType, relatedContentId } = req.body;
        if (!subject || !category || !message) return res.status(400).json({ error: 'Missing required fields' });

        const ticketId = uuidv4();
        await dbAsync.run('BEGIN TRANSACTION');

        await dbAsync.run(`
            INSERT INTO support_tickets (id, user_id, subject, category, message, related_content_type, related_content_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [ticketId, req.user.id, subject, category, message, relatedContentType || null, relatedContentId || null]);

        // Add first message
        const msgId = uuidv4();
        await dbAsync.run(`
            INSERT INTO ticket_messages (id, ticket_id, sender_user_id, message)
            VALUES (?, ?, ?, ?)
        `, [msgId, ticketId, req.user.id, message]);

        await dbAsync.run('COMMIT');

        // Notify owner
        broadcastToOwner({
            type: 'NOTIFICATION',
            notification: {
                type: 'NEW_SUPPORT_TICKET',
                message: `New support ticket: ${subject}`,
                reference_id: ticketId,
                created_at: new Date().toISOString()
            }
        });

        res.json({ success: true, ticket_id: ticketId });
    } catch (err) {
        await dbAsync.run('ROLLBACK').catch(()=>{});
        res.status(500).json({ error: err.message });
    }
});

// Get ticket details and messages
router.get('/tickets/:id', requireAuth, async (req, res) => {
    try {
        const ticket = await dbAsync.get(`
            SELECT * FROM support_tickets WHERE id = ?
        `, [req.params.id]);

        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

        if (req.user.role !== 'OWNER' && ticket.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        const condition = req.user.role === 'OWNER' ? '1=1' : 'is_internal_note = 0';
        
        const messages = await dbAsync.all(`
            SELECT m.*, u.username, u.display_name, u.avatar_id, u.role
            FROM ticket_messages m
            LEFT JOIN users u ON m.sender_user_id = u.id
            WHERE m.ticket_id = ? AND ${condition}
            ORDER BY m.created_at ASC
        `, [req.params.id]);

        res.json({ ticket, messages });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Reply to ticket
router.post('/tickets/:id/reply', requireAuth, async (req, res) => {
    try {
        const { message, isInternalNote } = req.body;
        const ticketId = req.params.id;
        if (!message) return res.status(400).json({ error: 'Message required' });

        const ticket = await dbAsync.get('SELECT user_id, status FROM support_tickets WHERE id = ?', [ticketId]);
        if (!ticket) return res.status(404).json({ error: 'Not found' });

        if (req.user.role !== 'OWNER' && ticket.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        if (req.user.role !== 'OWNER' && isInternalNote) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        await dbAsync.run('BEGIN TRANSACTION');

        const msgId = uuidv4();
        await dbAsync.run(`
            INSERT INTO ticket_messages (id, ticket_id, sender_user_id, message, is_internal_note)
            VALUES (?, ?, ?, ?, ?)
        `, [msgId, ticketId, req.user.id, message, isInternalNote ? 1 : 0]);

        // Update ticket status
        let newStatus = ticket.status;
        if (req.user.role === 'OWNER' && !isInternalNote) {
            newStatus = 'WAITING_FOR_USER';
        } else if (req.user.role !== 'OWNER') {
            newStatus = 'OPEN'; // Re-open if user replies
        }

        await dbAsync.run(`UPDATE support_tickets SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, ticketId]);

        // Notifications
        if (!isInternalNote) {
            if (req.user.role === 'OWNER' && ticket.user_id) {
                const notifId = uuidv4();
                await dbAsync.run(`
                    INSERT INTO notifications (id, user_id, type, reference_id, message)
                    VALUES (?, ?, 'SUPPORT_REPLY', ?, ?)
                `, [notifId, ticket.user_id, ticketId, `Owner replied to your ticket`]);
                
                broadcastToUser(ticket.user_id, {
                    type: 'NOTIFICATION',
                    notification: { id: notifId, type: 'SUPPORT_REPLY', message: 'Owner replied to your ticket', reference_id: ticketId, created_at: new Date().toISOString() }
                });
            } else if (req.user.role !== 'OWNER') {
                broadcastToOwner({
                    type: 'NOTIFICATION',
                    notification: { type: 'SUPPORT_REPLY', message: `User replied to ticket ${ticketId}`, reference_id: ticketId, created_at: new Date().toISOString() }
                });
            }
        }

        await dbAsync.run('COMMIT');
        res.json({ success: true });
    } catch (err) {
        await dbAsync.run('ROLLBACK').catch(()=>{});
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

