const crypto = require('crypto');
const util = require('util');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');

const pbkdf2 = util.promisify(crypto.pbkdf2);
const randomBytes = util.promisify(crypto.randomBytes);

const ITERATIONS = 100000;
const KEYLEN = 64;
const DIGEST = 'sha512';
const SALT_SIZE = 16;

function normalize(str) {
    if (!str) return '';
    return str.trim().toLowerCase();
}

async function hashPassword(password) {
    const salt = (await randomBytes(SALT_SIZE)).toString('hex');
    const derivedKey = await pbkdf2(password, salt, ITERATIONS, KEYLEN, DIGEST);
    return `${salt}:${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, hash) {
    if (!hash || !hash.includes(':')) return false;
    const [salt, key] = hash.split(':');
    const derivedKey = await pbkdf2(password, salt, ITERATIONS, KEYLEN, DIGEST);
    return key === derivedKey.toString('hex');
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
}

async function createSession(userId, durationDays = 30, ipAddress = null, userAgent = null) {
    const token = uuidv4();
    const sessionId = uuidv4();
    const tokenHash = hashToken(token);
    
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);
    
    await dbAsync.run(
        'INSERT INTO sessions (id, user_id, session_token_hash, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
        [sessionId, userId, tokenHash, ipAddress, userAgent, expiresAt.toISOString()]
    );
    
    // Also update last_login_at
    await dbAsync.run('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [userId]);
    
    return { token, expiresAt };
}

async function getSessionUser(token) {
    if (!token) return null;
    const tokenHash = hashToken(token);
    
    const session = await dbAsync.get(`
        SELECT u.id, u.email, u.username, u.role, u.is_disabled, s.expires_at, s.id as session_id
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token_hash = ? AND s.revoked_at IS NULL
    `, [tokenHash]);
    
    if (!session) return null;
    
    if (new Date(session.expires_at) < new Date()) {
        await destroySession(token);
        return null;
    }
    
    if (session.is_disabled) {
        return null;
    }
    
    // Update last seen
    await dbAsync.run('UPDATE sessions SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?', [session.session_id]);
    
    return session;
}

async function destroySession(token) {
    const tokenHash = hashToken(token);
    await dbAsync.run('UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE session_token_hash = ?', [tokenHash]);
}

async function createOwnerUser(username, password) {
    const existing = await dbAsync.get("SELECT id FROM users WHERE role = 'OWNER'");
    if (existing) return existing;
    
    const hash = await hashPassword(password);
    const userId = uuidv4();
    const usernameNorm = normalize(username);
    const emailNorm = normalize('owner@nostalgicverse.local');
    
    await dbAsync.run(`
        INSERT INTO users (id, email, email_normalized, username, username_normalized, password_hash, role, force_password_change)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [userId, 'owner@nostalgicverse.local', emailNorm, username, usernameNorm, hash, 'OWNER', 1]);
    
    await dbAsync.run(`
        INSERT INTO user_profiles (user_id, display_name)
        VALUES (?, ?)
    `, [userId, 'Museum Owner']);
    
    return { id: userId };
}

module.exports = {
    normalize,
    hashPassword,
    verifyPassword,
    createSession,
    getSessionUser,
    destroySession,
    createOwnerUser
};

