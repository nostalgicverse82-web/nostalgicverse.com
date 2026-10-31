const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');
const { hashPassword, verifyPassword, createSession, destroySession, normalize } = require('../services/authService.cjs');
const { requireAuth } = require('../middleware/authMiddleware.cjs');

const router = express.Router();

router.post('/signup', async (req, res) => {
    const { email, username, displayName, password, confirmPassword } = req.body;
    
    if (!email || !username || !displayName || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (password !== confirmPassword) {
        return res.status(400).json({ error: 'Passwords do not match' });
    }
    
    const emailNorm = normalize(email);
    const usernameNorm = normalize(username);
    
    if (usernameNorm.includes('sufiyan') && usernameNorm.includes('memon')) {
        return res.status(400).json({ error: 'Username is reserved' });
    }
    
    try {
        const existingUser = await dbAsync.get('SELECT id FROM users WHERE email_normalized = ? OR username_normalized = ?', [emailNorm, usernameNorm]);
        if (existingUser) {
            return res.status(400).json({ error: 'Email or username already in use' });
        }
        
        const hash = await hashPassword(password);
        const userId = uuidv4();
        
        await dbAsync.run(`
            INSERT INTO users (id, email, email_normalized, username, username_normalized, display_name, password_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [userId, email, emailNorm, username, usernameNorm, displayName, hash]);
        
        const ip = req.ip || req.connection.remoteAddress;
        const ua = req.get('User-Agent') || 'unknown';
        const session = await createSession(userId, 30, ip, ua);
        res.cookie('session', session.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });
        
        res.json({ success: true, user: { id: userId, username, displayName, role: 'USER' } });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Username or email already in use' });
        }
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

router.post('/login', async (req, res) => {
    const username = req.body.username || req.body.identifier;
    const { password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
    }
    
    const usernameNorm = normalize(username);
    
    try {
        const user = await dbAsync.get('SELECT * FROM users WHERE username_normalized = ? OR email_normalized = ?', [usernameNorm, usernameNorm]);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        if (user.is_disabled) {
            return res.status(403).json({ error: 'Account disabled' });
        }
        
        const valid = await verifyPassword(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        const ip = req.ip || req.connection.remoteAddress;
        const ua = req.get('User-Agent') || 'unknown';
        const session = await createSession(user.id, 30, ip, ua);
        res.cookie('session', session.token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', maxAge: 30 * 24 * 60 * 60 * 1000 });
        
        // Update last login
        await dbAsync.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
        
        res.json({ 
            success: true, 
            user: { 
                id: user.id, 
                username: user.username, 
                displayName: user.display_name, 
                role: user.role, 
                forcePasswordChange: !!user.force_password_change,
                avatar_id: user.avatar_id
            } 
        });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

router.post('/logout', async (req, res) => {
    const token = req.cookies.session || req.headers['x-session-token'];
    if (token) {
        await destroySession(token);
    }
    res.clearCookie('session');
    res.json({ success: true });
});

router.get('/me', requireAuth, async (req, res) => {
    const user = await dbAsync.get('SELECT id, email, username, display_name, role, avatar_id, force_password_change FROM users WHERE id = ?', [req.user.id]);
    res.json({
        user: {
            id: user.id,
            email: user.email,
            username: user.username,
            display_name: user.display_name,
            role: user.role,
            avatar_id: user.avatar_id,
            force_password_change: !!user.force_password_change
        }
    });
});

router.post('/change-password', requireAuth, async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: 'New passwords do not match' });
    }
    
    try {
        const user = await dbAsync.get('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
        
        const valid = await verifyPassword(currentPassword, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Incorrect current password' });
        }
        
        const hash = await hashPassword(newPassword);
        
        await dbAsync.run('UPDATE users SET password_hash = ?, force_password_change = 0 WHERE id = ?', [hash, req.user.id]);
        
        // Revoke other sessions (except current)
        const currentToken = req.cookies.session || req.headers['x-session-token'];
        const { crypto } = require('crypto'); // not actually used here since we need the hashed token.
        // Easiest is to just revoke all sessions and force re-login, OR we can leave the current one untouched if we had the hashed token.
        // For security, just delete all sessions for this user.
        await dbAsync.run('DELETE FROM sessions WHERE user_id = ?', [req.user.id]);
        res.clearCookie('session');
        
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error', details: err.message });
    }
});

module.exports = router;
