const express = require('express');
const { dbAsync } = require('../db/index.cjs');
const { requireAuth } = require('../middleware/authMiddleware.cjs');
const { v4: uuidv4 } = require('uuid');
const { broadcastToOwner } = require('../realtime/websocket.cjs');

const router = express.Router();

// Get user's submissions
router.get('/', requireAuth, async (req, res) => {
    try {
        const submissions = await dbAsync.all(`
            SELECT id, submission_type, title, status, created_at, updated_at
            FROM submissions
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [req.user.id]);
        res.json({ submissions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Create new submission
router.post('/', requireAuth, async (req, res) => {
    try {
        const { type, title, description } = req.body;
        if (!type || !title) return res.status(400).json({ error: 'Missing type or title' });

        const subId = uuidv4();
        
        await dbAsync.run(`
            INSERT INTO submissions (id, user_id, submission_type, title, description, status)
            VALUES (?, ?, ?, ?, ?, 'PENDING_REVIEW')
        `, [subId, req.user.id, type, title, description || null]);

        // Notify owner
        broadcastToOwner({
            type: 'NOTIFICATION',
            notification: {
                type: 'NEW_SUBMISSION',
                message: `New ${type} submission: ${title}`,
                reference_id: subId,
                created_at: new Date().toISOString()
            }
        });

        res.json({ success: true, id: subId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get a single submission
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const sub = await dbAsync.get(`
            SELECT * FROM submissions WHERE id = ?
        `, [req.params.id]);

        if (!sub) return res.status(404).json({ error: 'Not found' });
        if (req.user.role !== 'OWNER' && sub.user_id !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        res.json({ submission: sub });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get all published ideas (Public API endpoint for /ideas/ page)
router.get('/public/ideas', async (req, res) => {
    try {
        const ideas = await dbAsync.all(`
            SELECT s.id, s.title, s.description, s.created_at, u.username, u.display_name, u.avatar_id
            FROM submissions s
            JOIN users u ON s.user_id = u.id
            WHERE s.submission_type = 'Idea' AND s.status = 'APPROVED'
            ORDER BY s.created_at DESC
        `);
        res.json({ ideas });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Update a submission (e.g. after ENHANCEMENT_REQUESTED)
router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { title, description } = req.body;
        const subId = req.params.id;
        
        const sub = await dbAsync.get('SELECT * FROM submissions WHERE id = ? AND user_id = ?', [subId, req.user.id]);
        if (!sub) return res.status(404).json({ error: 'Not found or unauthorized' });
        
        await dbAsync.run(`
            UPDATE submissions 
            SET title = COALESCE(?, title), description = COALESCE(?, description), status = 'PENDING_REVIEW', updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [title, description, subId]);
        
        // Notify owner
        broadcastToOwner({
            type: 'NOTIFICATION',
            notification: { id: uuidv4(), type: 'SUBMISSION_UPDATED', message: `Submission updated: ${title || sub.title}`, created_at: new Date().toISOString() }
        });
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

