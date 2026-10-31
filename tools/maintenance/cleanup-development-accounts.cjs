require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { dbAsync } = require('../../server/db/index.cjs');

async function runCleanup() {
    if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force-production')) {
        console.error('REFUSED: Running in production requires --force-production flag.');
        process.exit(1);
    }
    
    if (!process.argv.includes('--confirm-cleanup')) {
        console.error('REFUSED: You must provide --confirm-cleanup to run this destructive script.');
        process.exit(1);
    }

    const ownerUsername = (process.env.OWNER_USERNAME || 'owner').toLowerCase();
    
    const owner = await dbAsync.get(
        "SELECT id, username FROM users WHERE role = 'OWNER' AND username_normalized = ?", 
        [ownerUsername]
    );

    if (!owner) {
        console.error("FATAL: Could not identify exactly one valid OWNER account matching configured OWNER_USERNAME.");
        process.exit(1);
    }

    // Backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dbPath = process.env.DATABASE_URL || path.resolve(__dirname, '../../data/nostalgicverse.db');
    const backupPath = path.resolve(__dirname, '../../backups/phase10-before-account-cleanup-' + timestamp + '.sqlite');
    
    if (!fs.existsSync(path.dirname(backupPath))) {
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
    }
    fs.copyFileSync(dbPath, backupPath);
    console.log('Created backup at', backupPath);

    const countsBefore = await getCounts();
    console.log('Before cleanup:', countsBefore.users, 'users');

    await dbAsync.run('PRAGMA foreign_keys = ON');

    await dbAsync.run('BEGIN TRANSACTION');
    try {
        await dbAsync.run("DELETE FROM submissions WHERE user_id != ?", [owner.id]);
        await dbAsync.run("DELETE FROM support_tickets WHERE user_id != ? AND user_id IS NOT NULL", [owner.id]);
        await dbAsync.run("DELETE FROM sessions WHERE user_id != ?", [owner.id]);
        await dbAsync.run("DELETE FROM reports WHERE reporter_id != ?", [owner.id]);
        await dbAsync.run("DELETE FROM user_blocks WHERE blocker_id != ?", [owner.id]);
        await dbAsync.run("DELETE FROM friends WHERE user_id != ? OR friend_id != ?", [owner.id, owner.id]);
        await dbAsync.run("DELETE FROM friend_requests WHERE sender_id != ? OR receiver_id != ?", [owner.id, owner.id]);
        await dbAsync.run("DELETE FROM notifications WHERE user_id != ?", [owner.id]);
        
        // Let cascade handle messages, conversation_members, etc.
        const userDeleteRes = await dbAsync.run("DELETE FROM users WHERE id != ?", [owner.id]);
        console.log('Deleted ' + userDeleteRes.changes + ' non-owner user accounts.');

        // Clean orphaned/invalid conversations
        await dbAsync.run("DELETE FROM conversations WHERE id NOT IN (SELECT conversation_id FROM conversation_members)");
        await dbAsync.run("DELETE FROM conversations WHERE type = 'DIRECT' AND id IN (SELECT conversation_id FROM conversation_members GROUP BY conversation_id HAVING COUNT(user_id) < 2)");

        await dbAsync.run('COMMIT');
        console.log('Transaction committed successfully.');
    } catch (e) {
        await dbAsync.run('ROLLBACK');
        console.error('Cleanup failed, rolled back.', e);
        process.exit(1);
    }
    
    const countsAfter = await getCounts();
    console.log('After cleanup:', countsAfter.users, 'users');
    
    process.exit(0);
}

async function getCounts() {
    const res = await dbAsync.get('SELECT COUNT(*) as c FROM users');
    return { users: res.c };
}

runCleanup();