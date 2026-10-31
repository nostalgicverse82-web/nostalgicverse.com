const express = require('express');
const { dbAsync } = require('../db/index.cjs');
const { requireAuth } = require('../middleware/authMiddleware.cjs');
const { v4: uuidv4 } = require('uuid');
const { broadcastToUser } = require('../realtime/websocket.cjs');

const router = express.Router();

// Helper to determine friend status between current user and target user
async function getFriendStatus(currentUserId, targetUserId) {
    if (!currentUserId) return 'NONE';
    if (currentUserId === targetUserId) return 'SELF';

    // 1. Check blocks (check both user_blocks and blocks tables)
    const block = await dbAsync.get(`
        SELECT 1 FROM user_blocks 
        WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
    `, [currentUserId, targetUserId, targetUserId, currentUserId]);
    if (block) return 'BLOCKED';

    // 2. Check friendship
    const friend = await dbAsync.get(`
        SELECT 1 FROM friends 
        WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `, [currentUserId, targetUserId, targetUserId, currentUserId]);
    if (friend) return 'FRIENDS';

    // 3. Check pending request
    const request = await dbAsync.get(`
        SELECT sender_id, receiver_id FROM friend_requests 
        WHERE status = 'PENDING' AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
    `, [currentUserId, targetUserId, targetUserId, currentUserId]);
    if (request) {
        if (request.sender_id === currentUserId) return 'REQUEST_SENT';
        return 'REQUEST_RECEIVED';
    }

    return 'NONE';
}

// 1. Discover People (Automatic real user list with pagination and sorting)
router.get('/discover', async (req, res) => {
    try {
        const currentUserId = req.user ? req.user.id : null;
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);
        const offset = parseInt(req.query.offset, 10) || 0;
        const sort = req.query.sort || 'recent'; // 'recent', 'new', 'alpha'

        let orderBy = 'u.last_login_at DESC NULLS LAST, u.created_at DESC';
        if (sort === 'new') {
            orderBy = 'u.created_at DESC';
        } else if (sort === 'alpha') {
            orderBy = 'LOWER(u.username) ASC';
        }

        let whereClause = `WHERE u.status = 'ACTIVE'`;
        const params = [];

        // Exclude current user if logged in
        if (currentUserId) {
            whereClause += ` AND u.id != ?`;
            params.push(currentUserId);

            // Exclude blocked users
            whereClause += ` AND u.id NOT IN (
                SELECT blocked_id FROM user_blocks WHERE blocker_id = ?
                UNION
                SELECT blocker_id FROM user_blocks WHERE blocked_id = ?
            )`;
            params.push(currentUserId, currentUserId);
        }

        // Get total count
        const countSql = `SELECT COUNT(*) as total FROM users u ${whereClause}`;
        const total = (await dbAsync.get(countSql, params)).total;

        // Get paginated users
        const querySql = `
            SELECT u.id, u.username, u.display_name, u.avatar_id, u.created_at, u.last_login_at
            FROM users u
            ${whereClause}
            ORDER BY ${orderBy}
            LIMIT ? OFFSET ?
        `;
        params.push(limit, offset);
        const users = await dbAsync.all(querySql, params);

        // Enrich with relationship status
        const enrichedUsers = await Promise.all(users.map(async (u) => {
            const status = await getFriendStatus(currentUserId, u.id);
            // Calculate presence: active in last 5 minutes
            const isOnline = u.last_login_at && (Date.now() - new Date(u.last_login_at + 'Z').getTime() < 5 * 60 * 1000);
            return {
                id: u.id,
                username: u.username,
                displayName: u.display_name || u.username,
                avatarId: u.avatar_id,
                createdAt: u.created_at,
                isOnline: !!isOnline,
                friendStatus: status
            };
        }));

        res.json({
            users: enrichedUsers,
            total,
            limit,
            offset,
            hasMore: offset + users.length < total
        });
    } catch (err) {
        console.error('[SOCIAL_API] discover error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 2. User Search (Username or Display Name)
router.get('/search', async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        if (q.length < 2) return res.json({ users: [] });

        const searchStr = `%${q}%`;
        const currentUserId = req.user ? req.user.id : null;
        
        let sql = `
            SELECT id, username, display_name, avatar_id, created_at, last_login_at 
            FROM users 
            WHERE (username LIKE ? OR display_name LIKE ?) AND status = 'ACTIVE'
        `;
        const params = [searchStr, searchStr];

        if (currentUserId) {
            sql += ` AND id != ?`;
            params.push(currentUserId);
        }
        sql += ` LIMIT 20`;

        const users = await dbAsync.all(sql, params);

        const enrichedUsers = await Promise.all(users.map(async (u) => {
            const status = await getFriendStatus(currentUserId, u.id);
            const isOnline = u.last_login_at && (Date.now() - new Date(u.last_login_at + 'Z').getTime() < 5 * 60 * 1000);
            return {
                id: u.id,
                username: u.username,
                displayName: u.display_name || u.username,
                avatarId: u.avatar_id,
                createdAt: u.created_at,
                isOnline: !!isOnline,
                friendStatus: status
            };
        }));

        res.json({ users: enrichedUsers });
    } catch (err) {
        console.error('[SOCIAL_API] search error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 3. Public Profile by Username
router.get('/profile/:username', async (req, res) => {
    try {
        const username = req.params.username.toLowerCase().trim();
        const user = await dbAsync.get(`
            SELECT id, username, display_name, avatar_id, bio, created_at, last_login_at
            FROM users WHERE username_normalized = ?
        `, [username]);
        
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        const currentUserId = req.user ? req.user.id : null;
        const friendStatus = await getFriendStatus(currentUserId, user.id);

        // Fetch counts for public profile
        const friendsCount = (await dbAsync.get(
            'SELECT COUNT(*) as c FROM friends WHERE user_id = ?',
            [user.id]
        )).c;
        const favoritesCount = (await dbAsync.get(
            'SELECT COUNT(*) as c FROM favorites WHERE user_id = ?',
            [user.id]
        )).c;
        const commentsCount = (await dbAsync.get(
            `SELECT COUNT(*) as c FROM comments WHERE user_id = ? AND status = 'PUBLISHED' AND deleted_at IS NULL`,
            [user.id]
        )).c;
        const reviewsCount = (await dbAsync.get(
            `SELECT COUNT(*) as c FROM reviews WHERE user_id = ? AND status = 'PUBLISHED'`,
            [user.id]
        )).c;

        // Fetch public collections
        const publicCollections = await dbAsync.all(
            `SELECT id, name, description, created_at FROM collections WHERE user_id = ? AND is_public = 1 ORDER BY created_at DESC LIMIT 6`,
            [user.id]
        );

        // Fetch public contributions (recent reviews)
        const recentReviews = await dbAsync.all(
            `SELECT id, target_type, target_id, rating, title, body, created_at FROM reviews WHERE user_id = ? AND status = 'PUBLISHED' ORDER BY created_at DESC LIMIT 5`,
            [user.id]
        );

        res.json({
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name || user.username,
                avatarId: user.avatar_id,
                bio: user.bio || '',
                createdAt: user.created_at,
                stats: {
                    friends: friendsCount,
                    favorites: favoritesCount,
                    comments: commentsCount,
                    reviews: reviewsCount,
                    collections: publicCollections.length
                },
                collections: publicCollections,
                contributions: recentReviews
            },
            friendStatus
        });
    } catch (err) {
        console.error('[SOCIAL_API] profile error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 4. Friend Requests List (Incoming & Outgoing)
router.get('/friends/requests', requireAuth, async (req, res) => {
    try {
        const incoming = await dbAsync.all(`
            SELECT r.id as request_id, r.status, r.created_at,
                   u.id as user_id, u.username, u.display_name, u.avatar_id
            FROM friend_requests r
            JOIN users u ON r.sender_id = u.id
            WHERE r.receiver_id = ? AND r.status = 'PENDING'
            ORDER BY r.created_at DESC
        `, [req.user.id]);
        
        const outgoing = await dbAsync.all(`
            SELECT r.id as request_id, r.status, r.created_at,
                   u.id as user_id, u.username, u.display_name, u.avatar_id
            FROM friend_requests r
            JOIN users u ON r.receiver_id = u.id
            WHERE r.sender_id = ? AND r.status = 'PENDING'
            ORDER BY r.created_at DESC
        `, [req.user.id]);

        res.json({ incoming, outgoing });
    } catch (err) {
        console.error('[SOCIAL_API] friend requests error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 5. Send Friend Request (Idempotent)
router.post('/friends/request', requireAuth, async (req, res) => {
    try {
        const { target_username, recipient_id } = req.body;
        
        let target;
        if (recipient_id) {
            target = await dbAsync.get('SELECT id, username, display_name FROM users WHERE id = ?', [recipient_id]);
        } else if (target_username) {
            const norm = target_username.toLowerCase().trim();
            target = await dbAsync.get('SELECT id, username, display_name FROM users WHERE username_normalized = ?', [norm]);
        }
        
        if (!target) return res.status(404).json({ error: 'User not found' });
        if (target.id === req.user.id) return res.status(400).json({ error: 'Cannot send friend request to yourself' });

        // Check if blocked
        const blocked = await dbAsync.get(`
            SELECT 1 FROM user_blocks 
            WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)
        `, [req.user.id, target.id, target.id, req.user.id]);
        if (blocked) return res.status(403).json({ error: 'Action not allowed' });

        // Check if already friends
        const friend = await dbAsync.get(
            'SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?',
            [req.user.id, target.id]
        );
        if (friend) return res.status(400).json({ error: 'Already friends' });

        // Check existing request
        const existing = await dbAsync.get(`
            SELECT id, sender_id, receiver_id, status FROM friend_requests 
            WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        `, [req.user.id, target.id, target.id, req.user.id]);
        
        if (existing) {
            if (existing.status === 'PENDING') {
                if (existing.sender_id === req.user.id) {
                    return res.json({ success: true, message: 'Request already pending', request_id: existing.id });
                } else {
                    // Mutual request: automatically accept!
                    return res.redirect(307, `/api/users/friends/request/${existing.id}/accept`);
                }
            }
            // Delete declined/cancelled old request before re-creating
            await dbAsync.run('DELETE FROM friend_requests WHERE id = ?', [existing.id]);
        }

        const requestId = uuidv4();
        const notifId = uuidv4();

        await dbAsync.transaction(async () => {
            await dbAsync.run(`
                INSERT INTO friend_requests (id, sender_id, receiver_id, status, created_at)
                VALUES (?, ?, ?, 'PENDING', CURRENT_TIMESTAMP)
            `, [requestId, req.user.id, target.id]);

            await dbAsync.run(`
                INSERT INTO notifications (id, user_id, type, reference_id, message, created_at)
                VALUES (?, ?, 'FRIEND_REQUEST', ?, ?, CURRENT_TIMESTAMP)
            `, [notifId, target.id, requestId, `@${req.user.username} sent you a friend request.`]);
        });

        // Broadcast realtime notification to recipient
        broadcastToUser(target.id, {
            type: 'friend_request.created',
            legacyType: 'NOTIFICATION',
            request_id: requestId,
            sender: {
                id: req.user.id,
                username: req.user.username,
                displayName: req.user.displayName,
                avatarId: req.user.avatar_id
            },
            notification: {
                id: notifId,
                type: 'FRIEND_REQUEST',
                reference_id: requestId,
                message: `@${req.user.username} sent you a friend request.`,
                sender_username: req.user.username,
                sender_display_name: req.user.displayName,
                sender_avatar_id: req.user.avatar_id,
                is_read: 0,
                created_at: new Date().toISOString()
            }
        });

        res.json({ success: true, request_id: requestId });
    } catch (err) {
        await dbAsync.run('ROLLBACK').catch(() => {});
        console.error('[SOCIAL_API] send friend request error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 6. Direct Friend Request Acceptance (By Request ID)
router.post('/friends/request/:id/accept', requireAuth, async (req, res) => {
    try {
        const requestId = req.params.id;
        const request = await dbAsync.get('SELECT * FROM friend_requests WHERE id = ?', [requestId]);
        
        if (!request) return res.status(404).json({ error: 'Friend request not found' });
        if (request.receiver_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized to accept this request' });
        if (request.status === 'ACCEPTED') return res.json({ success: true, already_accepted: true });

        const notifId = uuidv4();
        await dbAsync.transaction(async () => {
            await dbAsync.run(`UPDATE friend_requests SET status = 'ACCEPTED' WHERE id = ?`, [requestId]);
            
            // Create bidirectional friendship records
            await dbAsync.run(`
                INSERT OR IGNORE INTO friends (user_id, friend_id, created_at)
                VALUES (?, ?, CURRENT_TIMESTAMP), (?, ?, CURRENT_TIMESTAMP)
            `, [request.sender_id, request.receiver_id, request.receiver_id, request.sender_id]);

            // Mark corresponding notification as read
            await dbAsync.run(`
                UPDATE notifications SET is_read = 1 
                WHERE user_id = ? AND reference_id = ?
            `, [req.user.id, requestId]);

            // Notification for the original sender
            await dbAsync.run(`
                INSERT INTO notifications (id, user_id, type, reference_id, message, created_at)
                VALUES (?, ?, 'FRIEND_ACCEPTED', ?, ?, CURRENT_TIMESTAMP)
            `, [notifId, request.sender_id, req.user.id, `@${req.user.username} accepted your friend request.`]);
        });

        // Broadcast realtime events to both parties
        broadcastToUser(request.sender_id, {
            type: 'friend_request.accepted',
            legacyType: 'FRIEND_REQUEST_ACCEPTED',
            friend: {
                id: req.user.id,
                username: req.user.username,
                displayName: req.user.displayName,
                avatarId: req.user.avatar_id
            },
            notification: {
                id: notifId,
                type: 'FRIEND_ACCEPTED',
                reference_id: req.user.id,
                message: `@${req.user.username} accepted your friend request.`,
                is_read: 0,
                created_at: new Date().toISOString()
            }
        });

        broadcastToUser(req.user.id, {
            type: 'friend_request.accepted',
            legacyType: 'FRIEND_REQUEST_ACCEPTED',
            friend_id: request.sender_id
        });

        res.json({ success: true, friend_id: request.sender_id });
    } catch (err) {
        console.error('[SOCIAL_API] accept request error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 7. Direct Friend Request Decline (By Request ID)
router.post('/friends/request/:id/decline', requireAuth, async (req, res) => {
    try {
        const requestId = req.params.id;
        const request = await dbAsync.get('SELECT * FROM friend_requests WHERE id = ?', [requestId]);
        
        if (!request) return res.status(404).json({ error: 'Friend request not found' });
        if (request.receiver_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized to decline this request' });

        await dbAsync.transaction(async () => {
            await dbAsync.run(`UPDATE friend_requests SET status = 'DECLINED' WHERE id = ?`, [requestId]);
            await dbAsync.run(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND reference_id = ?`, [req.user.id, requestId]);
        });

        broadcastToUser(request.sender_id, {
            type: 'friend_request.declined',
            legacyType: 'FRIEND_REQUEST_DECLINED',
            receiver_id: req.user.id
        });

        res.json({ success: true });
    } catch (err) {
        console.error('[SOCIAL_API] decline request error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 8. Cancel Outgoing Friend Request (By Request ID or Recipient ID)
router.post('/friends/request/:id/cancel', requireAuth, async (req, res) => {
    try {
        const requestId = req.params.id;
        const request = await dbAsync.get('SELECT * FROM friend_requests WHERE id = ?', [requestId]);
        
        if (!request) return res.status(404).json({ error: 'Friend request not found' });
        if (request.sender_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized to cancel this request' });

        await dbAsync.run('DELETE FROM friend_requests WHERE id = ?', [requestId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Backward compatibility for legacy respondRequest (POST /friends/request/:id with { action })
router.post('/friends/request/:id', requireAuth, async (req, res) => {
    const { action } = req.body;
    if (action === 'accept') {
        return res.redirect(307, `/api/users/friends/request/${req.params.id}/accept`);
    } else if (action === 'decline') {
        return res.redirect(307, `/api/users/friends/request/${req.params.id}/decline`);
    } else if (action === 'cancel') {
        return res.redirect(307, `/api/users/friends/request/${req.params.id}/cancel`);
    }
    res.status(400).json({ error: 'Invalid action' });
});

// 9. List Friends
router.get('/friends', requireAuth, async (req, res) => {
    try {
        const friends = await dbAsync.all(`
            SELECT u.id, u.username, u.display_name, u.avatar_id, u.last_login_at,
                   f.created_at as friends_since
            FROM friends f
            JOIN users u ON f.friend_id = u.id
            WHERE f.user_id = ?
            ORDER BY LOWER(u.username) ASC
        `, [req.user.id]);

        const enriched = friends.map(f => {
            const isOnline = f.last_login_at && (Date.now() - new Date(f.last_login_at + 'Z').getTime() < 5 * 60 * 1000);
            return {
                id: f.id,
                username: f.username,
                displayName: f.display_name || f.username,
                avatarId: f.avatar_id,
                friendsSince: f.friends_since,
                isOnline: !!isOnline
            };
        });

        res.json({ friends: enriched });
    } catch (err) {
        console.error('[SOCIAL_API] list friends error:', err);
        res.status(500).json({ error: err.message });
    }
});

// 10. Remove Friend
router.delete('/friends/:id', requireAuth, async (req, res) => {
    try {
        const friendId = req.params.id;
        await dbAsync.transaction(async () => {
            await dbAsync.run('DELETE FROM friends WHERE user_id = ? AND friend_id = ?', [req.user.id, friendId]);
            await dbAsync.run('DELETE FROM friends WHERE user_id = ? AND friend_id = ?', [friendId, req.user.id]);
            await dbAsync.run('DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)', 
                [req.user.id, friendId, friendId, req.user.id]);
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 11. Block & Unblock
router.post('/blocks', requireAuth, async (req, res) => {
    try {
        const { blocked_id } = req.body;
        if (!blocked_id) return res.status(400).json({ error: 'blocked_id required' });
        if (blocked_id === req.user.id) return res.status(400).json({ error: 'Cannot block yourself' });

        await dbAsync.transaction(async () => {
            await dbAsync.run('INSERT OR IGNORE INTO user_blocks (id, blocker_id, blocked_id) VALUES (?, ?, ?)', 
                [uuidv4(), req.user.id, blocked_id]);
            await dbAsync.run('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)', 
                [req.user.id, blocked_id]);
            
            // Remove friendship and pending requests
            await dbAsync.run('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', 
                [req.user.id, blocked_id, blocked_id, req.user.id]);
            await dbAsync.run('DELETE FROM friend_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)', 
                [req.user.id, blocked_id, blocked_id, req.user.id]);
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/blocks/:blockedId', requireAuth, async (req, res) => {
    try {
        const { blockedId } = req.params;
        await dbAsync.run('DELETE FROM user_blocks WHERE blocker_id = ? AND blocked_id = ?', [req.user.id, blockedId]);
        await dbAsync.run('DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [req.user.id, blockedId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.get('/blocks', requireAuth, async (req, res) => {
    try {
        const blockedUsers = await dbAsync.all(`
            SELECT u.id, u.username, u.display_name, u.avatar_id
            FROM user_blocks b
            JOIN users u ON b.blocked_id = u.id
            WHERE b.blocker_id = ?
            ORDER BY u.username ASC
        `, [req.user.id]);
        res.json({ blocked: blockedUsers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 12. Enriched Notifications with Sender Details and Action Context
router.get('/notifications', requireAuth, async (req, res) => {
    try {
        const notifications = await dbAsync.all(`
            SELECT n.id, n.user_id, n.type, n.reference_id, n.message, n.is_read, n.created_at,
                   u.username as actor_username, u.display_name as actor_display_name, u.avatar_id as actor_avatar_id
            FROM notifications n
            LEFT JOIN friend_requests fr ON n.type = 'FRIEND_REQUEST' AND n.reference_id = fr.id
            LEFT JOIN users u ON fr.sender_id = u.id
            WHERE n.user_id = ?
            ORDER BY n.created_at DESC
            LIMIT 50
        `, [req.user.id]);
        
        const unreadCount = notifications.filter(n => !n.is_read).length;
        res.json({ notifications, unreadCount });
    } catch (err) {
        console.error('[SOCIAL_API] notifications error:', err);
        res.status(500).json({ error: err.message });
    }
});

router.post('/notifications/mark-read', requireAuth, async (req, res) => {
    try {
        const { ids } = req.body;
        if (ids && Array.isArray(ids) && ids.length > 0) {
            const placeholders = ids.map(() => '?').join(',');
            await dbAsync.run(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND id IN (${placeholders})`, [req.user.id, ...ids]);
        } else {
            await dbAsync.run(`UPDATE notifications SET is_read = 1 WHERE user_id = ?`, [req.user.id]);
        }
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 13. Header Unread Counts
router.get('/counts', requireAuth, async (req, res) => {
    try {
        const notif = await dbAsync.get('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
        const reqs = await dbAsync.get('SELECT COUNT(*) as c FROM friend_requests WHERE receiver_id = ? AND status = ?', [req.user.id, 'PENDING']);
        const msgs = await dbAsync.get(`
            SELECT COUNT(DISTINCT m.conversation_id) as c 
            FROM messages m
            JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
            WHERE cm.user_id = ? AND m.sender_id != ? AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
        `, [req.user.id, req.user.id]);

        res.json({
            notifications: notif.c,
            friendRequests: reqs.c,
            messages: msgs.c
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 14. Favorites
router.get('/favorites', requireAuth, async (req, res) => {
    try {
        const favorites = await dbAsync.all(`
            SELECT entity_type, entity_id, 
                   entity_type as item_type, entity_id as item_id, created_at
            FROM favorites
            WHERE user_id = ?
            ORDER BY created_at DESC
        `, [req.user.id]);
        res.json({ favorites });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/favorites', requireAuth, async (req, res) => {
    const entityType = req.body.entity_type || req.body.itemType || req.body.type;
    const entityId = req.body.entity_id || req.body.itemId || req.body.id;
    if (!entityType || !entityId) {
        return res.status(400).json({ error: 'entity_type and entity_id required' });
    }
    try {
        await dbAsync.run(`
            INSERT OR IGNORE INTO favorites (user_id, entity_type, entity_id, created_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `, [req.user.id, entityType, entityId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete('/favorites/:type/:itemId', requireAuth, async (req, res) => {
    try {
        await dbAsync.run(`
            DELETE FROM favorites
            WHERE user_id = ? AND entity_type = ? AND entity_id = ?
        `, [req.user.id, req.params.type, req.params.itemId]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 15. Collections
router.get('/collections', requireAuth, async (req, res) => {
    try {
        const collections = await dbAsync.all(
            'SELECT * FROM collections WHERE user_id = ? ORDER BY created_at DESC',
            [req.user.id]
        );
        for (let c of collections) {
            c.items = await dbAsync.all(
                'SELECT * FROM collection_items WHERE collection_id = ? ORDER BY added_at DESC',
                [c.id]
            );
        }
        res.json({ collections });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/collections', requireAuth, async (req, res) => {
    try {
        const { name, description, isPublic } = req.body;
        if (!name) return res.status(400).json({ error: 'Name required' });
        const id = uuidv4();
        await dbAsync.run(`
            INSERT INTO collections (id, user_id, name, description, is_public, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [id, req.user.id, name, description || null, isPublic ? 1 : 0]);
        res.json({ success: true, id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
