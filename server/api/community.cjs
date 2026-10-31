const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');
const { requireAuth } = require('../middleware/authMiddleware.cjs');
const { broadcastToOwner } = require('../realtime/websocket.cjs');

const router = express.Router();

// Helper to normalize content types
function normalizeType(type) {
    if (!type) return '';
    const clean = type.toLowerCase().trim();
    // Normalize plurals or singulars to consistent UPPERCASE
    if (clean.startsWith('game')) return 'GAME';
    if (clean.startsWith('console')) return 'CONSOLE';
    if (clean.startsWith('stori') || clean.startsWith('story')) return 'STORY';
    if (clean.startsWith('guide')) return 'GUIDE';
    if (clean.startsWith('new') || clean.startsWith('article')) return 'NEWS';
    if (clean.startsWith('timeline')) return 'TIMELINE';
    if (clean.startsWith('genre')) return 'GENRE';
    if (clean.startsWith('release')) return 'RELEASE';
    if (clean.startsWith('idea')) return 'IDEA';
    return clean.toUpperCase();
}

// ==========================================
// 1. REACTIONS (LIKE / DISLIKE)
// ==========================================

// Get reaction counts & user reaction for target
router.get('/reactions/:type/:id', async (req, res) => {
    try {
        const targetType = normalizeType(req.params.type);
        const targetId = req.params.id;

        const rows = await dbAsync.all(`
            SELECT reaction_type, COUNT(*) as count 
            FROM reactions 
            WHERE target_type = ? AND target_id = ? 
            GROUP BY reaction_type
        `, [targetType, targetId]);

        let likes = 0;
        let dislikes = 0;
        for (const row of rows) {
            if (row.reaction_type === 'LIKE') likes = row.count;
            else if (row.reaction_type === 'DISLIKE') dislikes = row.count;
        }

        let userReaction = null;
        if (req.user) {
            const ur = await dbAsync.get(
                `SELECT reaction_type FROM reactions WHERE target_type = ? AND target_id = ? AND user_id = ?`,
                [targetType, targetId, req.user.id]
            );
            if (ur) userReaction = ur.reaction_type;
        }

        res.json({
            target_type: targetType,
            target_id: targetId,
            counts: {
                likes,
                dislikes,
                total: likes + dislikes
            },
            userReaction
        });
    } catch (err) {
        console.error('[COMMUNITY_API] get reactions error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Toggle or set reaction (LIKE, DISLIKE, or null to remove)
router.post('/reactions', requireAuth, async (req, res) => {
    try {
        const targetType = normalizeType(req.body.target_type);
        const targetId = req.body.target_id;
        const requestedReaction = req.body.reaction_type ? req.body.reaction_type.toUpperCase() : null;

        if (!targetType || !targetId) {
            return res.status(400).json({ error: 'target_type and target_id required' });
        }

        let finalReaction = null;

        await dbAsync.transaction(async () => {
            // Check current reaction
            const current = await dbAsync.get(
                `SELECT id, reaction_type FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ?`,
                [req.user.id, targetType, targetId]
            );

            if (current) {
                if (current.reaction_type === requestedReaction || !requestedReaction) {
                    // Toggling off or removing
                    await dbAsync.run(`DELETE FROM reactions WHERE id = ?`, [current.id]);
                    finalReaction = null;
                } else {
                    // Changing reaction
                    await dbAsync.run(`UPDATE reactions SET reaction_type = ?, created_at = CURRENT_TIMESTAMP WHERE id = ?`, [requestedReaction, current.id]);
                    finalReaction = requestedReaction;
                }
            } else if (requestedReaction && (requestedReaction === 'LIKE' || requestedReaction === 'DISLIKE')) {
                // New reaction
                await dbAsync.run(`
                    INSERT INTO reactions (id, user_id, target_type, target_id, reaction_type, created_at)
                    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                `, [uuidv4(), req.user.id, targetType, targetId, requestedReaction]);
                finalReaction = requestedReaction;
            }
        });

        // Fetch authoritative updated counts
        const rows = await dbAsync.all(`
            SELECT reaction_type, COUNT(*) as count 
            FROM reactions 
            WHERE target_type = ? AND target_id = ? 
            GROUP BY reaction_type
        `, [targetType, targetId]);

        let likes = 0;
        let dislikes = 0;
        for (const row of rows) {
            if (row.reaction_type === 'LIKE') likes = row.count;
            else if (row.reaction_type === 'DISLIKE') dislikes = row.count;
        }

        res.json({
            success: true,
            userReaction: finalReaction,
            counts: {
                likes,
                dislikes,
                total: likes + dislikes
            }
        });
    } catch (err) {
        console.error('[COMMUNITY_API] post reaction error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 2. COMMENTS & THREADS
// ==========================================

// Get comments for a target
router.get('/comments/:type/:id', async (req, res) => {
    try {
        const targetType = normalizeType(req.params.type);
        const targetId = req.params.id;
        const currentUserId = req.user ? req.user.id : null;

        const comments = await dbAsync.all(`
            SELECT c.id, c.user_id, c.target_type, c.target_id, c.parent_id, 
                   c.body, c.status, c.created_at, c.updated_at, c.deleted_at,
                   u.username, u.display_name, u.avatar_id
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.target_type = ? AND c.target_id = ? AND (c.status = 'PUBLISHED' OR c.deleted_at IS NOT NULL)
            ORDER BY c.created_at ASC
        `, [targetType, targetId]);

        // Format comments, identifying user's own comments and replacing deleted comment bodies
        const formatted = comments.map(c => {
            const isDeleted = !!c.deleted_at || c.status === 'DELETED';
            return {
                id: c.id,
                parentId: c.parent_id,
                body: isDeleted ? '[Comment deleted by author]' : c.body,
                isDeleted,
                createdAt: c.created_at,
                updatedAt: c.updated_at,
                isOwn: currentUserId === c.user_id,
                author: isDeleted ? { username: '[deleted]', displayName: '[deleted]', avatarId: null } : {
                    id: c.user_id,
                    username: c.username,
                    displayName: c.display_name || c.username,
                    avatarId: c.avatar_id
                }
            };
        });

        res.json({ comments: formatted, total: formatted.filter(x => !x.isDeleted).length });
    } catch (err) {
        console.error('[COMMUNITY_API] get comments error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Post a comment (or reply)
router.post('/comments', requireAuth, async (req, res) => {
    try {
        const targetType = normalizeType(req.body.target_type);
        const targetId = req.body.target_id;
        const body = (req.body.body || '').trim();
        const parentId = req.body.parent_id || null;

        if (!targetType || !targetId || !body) {
            return res.status(400).json({ error: 'target_type, target_id, and body required' });
        }
        if (body.length > 3000) {
            return res.status(400).json({ error: 'Comment exceeds max length (3000 chars)' });
        }

        // Verify parent comment exists if replying
        if (parentId) {
            const parent = await dbAsync.get('SELECT id FROM comments WHERE id = ?', [parentId]);
            if (!parent) return res.status(404).json({ error: 'Parent comment not found' });
        }

        const id = uuidv4();
        await dbAsync.run(`
            INSERT INTO comments (id, user_id, target_type, target_id, parent_id, body, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [id, req.user.id, targetType, targetId, parentId, body]);

        const fullComment = await dbAsync.get(`
            SELECT c.id, c.user_id, c.target_type, c.target_id, c.parent_id, c.body, c.created_at,
                   u.username, u.display_name, u.avatar_id
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `, [id]);

        res.json({
            success: true,
            comment: {
                id: fullComment.id,
                parentId: fullComment.parent_id,
                body: fullComment.body,
                createdAt: fullComment.created_at,
                isOwn: true,
                author: {
                    id: req.user.id,
                    username: req.user.username,
                    displayName: req.user.displayName,
                    avatarId: req.user.avatar_id
                }
            }
        });
    } catch (err) {
        console.error('[COMMUNITY_API] post comment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Edit own comment
router.patch('/comments/:id', requireAuth, async (req, res) => {
    try {
        const commentId = req.params.id;
        const newBody = (req.body.body || '').trim();
        if (!newBody) return res.status(400).json({ error: 'Comment body required' });

        const comment = await dbAsync.get('SELECT * FROM comments WHERE id = ?', [commentId]);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        if (comment.user_id !== req.user.id && req.user.role !== 'OWNER') {
            return res.status(403).json({ error: 'Unauthorized to edit this comment' });
        }
        if (comment.deleted_at) {
            return res.status(400).json({ error: 'Cannot edit deleted comment' });
        }

        await dbAsync.run(
            `UPDATE comments SET body = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [newBody, commentId]
        );

        res.json({ success: true, body: newBody });
    } catch (err) {
        console.error('[COMMUNITY_API] edit comment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Soft-delete own comment
router.delete('/comments/:id', requireAuth, async (req, res) => {
    try {
        const commentId = req.params.id;
        const comment = await dbAsync.get('SELECT * FROM comments WHERE id = ?', [commentId]);
        if (!comment) return res.status(404).json({ error: 'Comment not found' });
        if (comment.user_id !== req.user.id && req.user.role !== 'OWNER') {
            return res.status(403).json({ error: 'Unauthorized to delete this comment' });
        }

        // Soft delete so replies remain threaded
        await dbAsync.run(
            `UPDATE comments SET deleted_at = CURRENT_TIMESTAMP, status = 'DELETED', body = '[deleted]' WHERE id = ?`,
            [commentId]
        );

        res.json({ success: true });
    } catch (err) {
        console.error('[COMMUNITY_API] delete comment error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 3. REVIEWS & RATINGS (GAMES / CONSOLES)
// ==========================================

// Get reviews and average rating
router.get('/reviews/:type/:id', async (req, res) => {
    try {
        const targetType = normalizeType(req.params.type);
        const targetId = req.params.id;
        const currentUserId = req.user ? req.user.id : null;

        const reviews = await dbAsync.all(`
            SELECT r.id, r.user_id, r.target_type, r.target_id, r.rating, 
                   r.title, r.body, r.pros, r.cons, r.is_spoiler, r.status, r.created_at, r.updated_at,
                   u.username, u.display_name, u.avatar_id
            FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.target_type = ? AND r.target_id = ? AND r.status = 'PUBLISHED'
            ORDER BY r.created_at DESC
        `, [targetType, targetId]);

        // Calculate aggregate rating
        let average = 0;
        if (reviews.length > 0) {
            const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
            average = Math.round((sum / reviews.length) * 10) / 10;
        }

        const formatted = reviews.map(r => ({
            id: r.id,
            rating: r.rating,
            title: r.title,
            body: r.body,
            pros: r.pros,
            cons: r.cons,
            isSpoiler: !!r.is_spoiler,
            createdAt: r.created_at,
            isOwn: currentUserId === r.user_id,
            author: {
                id: r.user_id,
                username: r.username,
                displayName: r.display_name || r.username,
                avatarId: r.avatar_id
            }
        }));

        res.json({
            reviews: formatted,
            stats: {
                count: reviews.length,
                averageRating: average
            }
        });
    } catch (err) {
        console.error('[COMMUNITY_API] get reviews error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Create or update review (One per user/content)
router.post('/reviews', requireAuth, async (req, res) => {
    try {
        const targetType = normalizeType(req.body.target_type);
        const targetId = req.body.target_id;
        const rating = parseInt(req.body.rating, 10);
        const title = (req.body.title || '').trim();
        const body = (req.body.body || '').trim();
        const pros = (req.body.pros || '').trim();
        const cons = (req.body.cons || '').trim();
        const isSpoiler = req.body.is_spoiler ? 1 : 0;

        if (!targetType || !targetId || isNaN(rating) || !body) {
            return res.status(400).json({ error: 'target_type, target_id, rating (1-10), and body required' });
        }
        if (rating < 1 || rating > 10) {
            return res.status(400).json({ error: 'Rating must be an integer between 1 and 10' });
        }

        const existing = await dbAsync.get(
            `SELECT id FROM reviews WHERE user_id = ? AND target_type = ? AND target_id = ?`,
            [req.user.id, targetType, targetId]
        );

        if (existing) {
            await dbAsync.run(`
                UPDATE reviews 
                SET rating = ?, title = ?, body = ?, pros = ?, cons = ?, is_spoiler = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [rating, title, body, pros, cons, isSpoiler, existing.id]);
            return res.json({ success: true, id: existing.id, updated: true });
        }

        const id = uuidv4();
        await dbAsync.run(`
            INSERT INTO reviews (id, user_id, target_type, target_id, rating, title, body, pros, cons, is_spoiler, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [id, req.user.id, targetType, targetId, rating, title, body, pros, cons, isSpoiler]);

        res.json({ success: true, id });
    } catch (err) {
        console.error('[COMMUNITY_API] post review error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Delete own review
router.delete('/reviews/:id', requireAuth, async (req, res) => {
    try {
        const reviewId = req.params.id;
        const review = await dbAsync.get('SELECT * FROM reviews WHERE id = ?', [reviewId]);
        if (!review) return res.status(404).json({ error: 'Review not found' });
        if (review.user_id !== req.user.id && req.user.role !== 'OWNER') {
            return res.status(403).json({ error: 'Unauthorized to delete this review' });
        }

        await dbAsync.run('DELETE FROM reviews WHERE id = ?', [reviewId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 4. SAVES / BOOKMARKS (STORIES / GUIDES / NEWS / IDEAS)
// ==========================================

// Check if content is saved
router.get('/saves/:type/:id', requireAuth, async (req, res) => {
    try {
        const targetType = normalizeType(req.params.type);
        const targetId = req.params.id;

        const saved = await dbAsync.get(
            `SELECT 1 FROM saves WHERE user_id = ? AND target_type = ? AND target_id = ?`,
            [req.user.id, targetType, targetId]
        );

        res.json({ isSaved: !!saved });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Toggle save
router.post('/saves', requireAuth, async (req, res) => {
    try {
        const targetType = normalizeType(req.body.target_type);
        const targetId = req.body.target_id;

        if (!targetType || !targetId) {
            return res.status(400).json({ error: 'target_type and target_id required' });
        }

        const existing = await dbAsync.get(
            `SELECT id FROM saves WHERE user_id = ? AND target_type = ? AND target_id = ?`,
            [req.user.id, targetType, targetId]
        );

        let isSaved = false;
        if (existing) {
            await dbAsync.run(`DELETE FROM saves WHERE id = ?`, [existing.id]);
            isSaved = false;
        } else {
            await dbAsync.run(`
                INSERT INTO saves (id, user_id, target_type, target_id, created_at)
                VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `, [uuidv4(), req.user.id, targetType, targetId]);
            isSaved = true;
        }

        res.json({ success: true, isSaved });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 5. REPORTS & MODERATION
// ==========================================

// Submit a report
router.post('/reports', requireAuth, async (req, res) => {
    try {
        const targetType = (req.body.target_type || '').toUpperCase();
        const targetId = req.body.target_id;
        const reason = (req.body.reason || '').trim();

        if (!targetType || !targetId || !reason) {
            return res.status(400).json({ error: 'target_type, target_id, and reason required' });
        }

        const id = uuidv4();
        await dbAsync.run(`
            INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, 'OPEN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [id, req.user.id, targetType, targetId, reason]);

        broadcastToOwner({
            type: 'report.created',
            reportId: id,
            targetType,
            targetId
        });

        res.json({ success: true, id });
    } catch (err) {
        console.error('[COMMUNITY_API] post report error:', err);
        res.status(500).json({ error: err.message });
    }
});

// Owner Moderation
router.post('/comments/:id/moderate', requireAuth, async (req, res) => {
    if (req.user.role !== 'OWNER') return res.status(403).json({ error: 'Forbidden' });
    const { action } = req.body; // 'hide', 'restore', 'delete'
    try {
        if (action === 'hide') {
            await dbAsync.run(`UPDATE comments SET status = 'HIDDEN' WHERE id = ?`, [req.params.id]);
        } else if (action === 'restore') {
            await dbAsync.run(`UPDATE comments SET status = 'PUBLISHED', deleted_at = NULL WHERE id = ?`, [req.params.id]);
        } else if (action === 'delete') {
            await dbAsync.run(`DELETE FROM comments WHERE id = ?`, [req.params.id]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
