const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/index.cjs');

async function runTests() {
    console.log('--- Phase 05 Chat DB Test ---');
    
    // Simulate user A and B
    const userA = uuidv4();
    const userB = uuidv4();
    
    await dbAsync.run(`INSERT INTO users (id, username, username_normalized, email, email_normalized, password_hash) 
        VALUES (?, 'UserA', 'usera', 'a@a.com', 'a@a.com', 'hash')`, [userA]);
    await dbAsync.run(`INSERT INTO users (id, username, username_normalized, email, email_normalized, password_hash) 
        VALUES (?, 'UserB', 'userb', 'b@b.com', 'b@b.com', 'hash')`, [userB]);
        
    const convId = uuidv4();
    await dbAsync.run(`INSERT INTO conversations (id, type) VALUES (?, 'DIRECT')`, [convId]);
    await dbAsync.run(`INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)`, [convId, userA]);
    await dbAsync.run(`INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?)`, [convId, userB]);
    
    // Send 10 messages
    for (let i = 0; i < 10; i++) {
        await dbAsync.run(`INSERT INTO messages (id, conversation_id, sender_id, body) VALUES (?, ?, ?, ?)`, 
            [uuidv4(), convId, userA, 'Msg ' + i]);
    }
    
    const count = await dbAsync.get(`SELECT COUNT(*) as c FROM messages WHERE conversation_id = ?`, [convId]);
    if (count.c !== 10) {
        console.error('Failed to persist messages');
        process.exit(1);
    }
    
    // Cleanup
    await dbAsync.run(`DELETE FROM conversations WHERE id = ?`, [convId]);
    await dbAsync.run(`DELETE FROM users WHERE id = ? OR id = ?`, [userA, userB]);
    
    console.log('Chat DB persistence PASSED.');
    process.exit(0);
}

runTests().catch(e => { console.error(e); process.exit(1); });

