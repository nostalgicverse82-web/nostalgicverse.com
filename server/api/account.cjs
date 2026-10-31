const express = require('express');
const { dbAsync } = require('../db/index.cjs');
const { requireAuth } = require('../middleware/authMiddleware.cjs');
const fs = require('fs');
const path = require('path');

const router = express.Router();

let avatarRegistry = [];
try {
    const registryPath = path.resolve(__dirname, '../../data/profile-icons.json');
    if (fs.existsSync(registryPath)) {
        avatarRegistry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    }
} catch (e) {
    console.error('Failed to load avatar registry:', e.message);
}

// Get the central avatar registry
router.get('/avatars', (req, res) => {
    res.json(avatarRegistry);
});

// Update Profile
router.patch('/profile', requireAuth, async (req, res) => {
    const { display_name, avatar_id, bio } = req.body;
    
    try {
        let updates = [];
        let params = [];
        
        if (display_name !== undefined) {
            const trimmedName = String(display_name).trim();
            if (trimmedName.length > 50) {
                return res.status(400).json({ error: 'Display name cannot exceed 50 characters' });
            }
            updates.push('display_name = ?');
            params.push(trimmedName);
        }
        
        if (avatar_id !== undefined) {
            // Validate against registry
            const validAvatar = avatarRegistry.find(a => a.id === avatar_id);
            if (!validAvatar) {
                return res.status(400).json({ error: 'Invalid avatar ID' });
            }
            updates.push('avatar_id = ?');
            params.push(avatar_id);
        }

        if (bio !== undefined) {
            const trimmedBio = String(bio).trim();
            if (trimmedBio.length > 500) {
                return res.status(400).json({ error: 'Bio cannot exceed 500 characters' });
            }
            updates.push('bio = ?');
            params.push(trimmedBio);
        }
        
        if (updates.length > 0) {
            params.push(req.user.id);
            await dbAsync.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

            // Sync with user_profiles table
            const updatedUser = await dbAsync.get('SELECT display_name, avatar_id, bio FROM users WHERE id = ?', [req.user.id]);
            await dbAsync.run(`
                INSERT INTO user_profiles (user_id, display_name, avatar, bio)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    display_name = excluded.display_name,
                    avatar = excluded.avatar,
                    bio = excluded.bio
            `, [req.user.id, updatedUser.display_name || req.user.username, updatedUser.avatar_id, updatedUser.bio || '']);
        }
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// User Account Summary & Calculated Metrics
router.get('/summary', requireAuth, async (req, res) => {
    try {
        const user = await dbAsync.get('SELECT id, username, display_name, email, avatar_id, bio, role, created_at FROM users WHERE id = ?', [req.user.id]);
        if (!user) return res.status(404).json({ error: 'User not found' });

        const friendsCount = (await dbAsync.get('SELECT COUNT(*) as c FROM friends WHERE user_id = ?', [user.id])).c;
        const favoritesCount = (await dbAsync.get('SELECT COUNT(*) as c FROM favorites WHERE user_id = ?', [user.id])).c;
        const collectionsCount = (await dbAsync.get('SELECT COUNT(*) as c FROM collections WHERE user_id = ?', [user.id])).c;
        const submissionsCount = (await dbAsync.get('SELECT COUNT(*) as c FROM submissions WHERE user_id = ?', [user.id])).c;
        const openTicketsCount = (await dbAsync.get("SELECT COUNT(*) as c FROM support_tickets WHERE user_id = ? AND status != 'CLOSED'", [user.id])).c;
        const reviewsCount = (await dbAsync.get("SELECT COUNT(*) as c FROM reviews WHERE user_id = ? AND status = 'PUBLISHED'", [user.id])).c;
        const commentsCount = (await dbAsync.get("SELECT COUNT(*) as c FROM comments WHERE user_id = ? AND deleted_at IS NULL", [user.id])).c;

        const notif = await dbAsync.get('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0', [user.id]);
        const reqs = await dbAsync.get('SELECT COUNT(*) as c FROM friend_requests WHERE receiver_id = ? AND status = ?', [user.id, 'PENDING']);
        const msgs = await dbAsync.get(`
            SELECT COUNT(DISTINCT m.conversation_id) as c 
            FROM messages m
            JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
            WHERE cm.user_id = ? AND m.sender_id != ? AND (cm.last_read_at IS NULL OR m.created_at > cm.last_read_at)
        `, [user.id, user.id]);

        res.json({
            user: {
                id: user.id,
                username: user.username,
                displayName: user.display_name || user.username,
                email: user.email,
                avatarId: user.avatar_id,
                bio: user.bio || '',
                role: user.role,
                createdAt: user.created_at
            },
            metrics: {
                friendsCount,
                favoritesCount,
                collectionsCount,
                submissionsCount,
                openTicketsCount,
                reviewsCount,
                commentsCount,
                unreadNotifications: notif.c,
                pendingFriendRequests: reqs.c,
                unreadMessages: msgs.c
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

// Fetch a specific user's public profile
router.get('/profile/:username', async (req, res) => {
    const { username } = req.params;
    const usernameNorm = username.toLowerCase().trim();
    
    try {
        const user = await dbAsync.get('SELECT id, username, display_name, avatar_id, bio, created_at FROM users WHERE username_normalized = ?', [usernameNorm]);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({
            id: user.id,
            username: user.username,
            display_name: user.display_name,
            avatar_id: user.avatar_id,
            bio: user.bio || '',
            joined_at: user.created_at
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
