const { dbAsync } = require('../server/db/index.cjs');
const fs = require('fs');
const path = require('path');

async function run() {
    const counts = {};
    const tables = ['users', 'sessions', 'friend_requests', 'friendships', 'conversations', 'conversation_members', 'messages', 'notifications', 'support_tickets', 'ticket_messages', 'submissions', 'comments', 'reviews', 'reactions', 'favorites', 'collections', 'reports', 'audit_logs', 'games', 'consoles', 'ideas', 'compatibility_records'];
    
    for (const table of tables) {
        try {
            const res = await dbAsync.get('SELECT COUNT(*) as c FROM ' + table);
            counts[table] = res.c;
        } catch(e) {
            counts[table] = 'TABLE NOT FOUND';
        }
    }
    
    const ownerCount = await dbAsync.get("SELECT COUNT(*) as c FROM users WHERE role = 'OWNER'");
    counts['owner_users'] = ownerCount.c;
    
    const normalCount = await dbAsync.get("SELECT COUNT(*) as c FROM users WHERE role != 'OWNER'");
    counts['normal_users'] = normalCount.c;

    let md = '# Phase 10 Before Cleanup\n\n';
    for (const table in counts) {
        md += '- ' + table + ': ' + counts[table] + '\n';
    }
    
    fs.writeFileSync(path.join(__dirname, '../docs/PHASE-10-BEFORE-CLEANUP.md'), md);
    console.log('Done');
    process.exit(0);
}
run();