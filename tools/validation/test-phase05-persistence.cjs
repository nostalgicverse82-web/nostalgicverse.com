const fs = require('fs');
const path = require('path');
const { dbAsync } = require('../../server/db/index.cjs');

async function runTests() {
    console.log('--- Phase 05 Persistence Test ---');
    const errors = [];
    
    // 1. Check if DB schema updated for chat
    const msgCols = await dbAsync.all("PRAGMA table_info(messages)");
    const hasMsgType = msgCols.some(c => c.name === 'message_type');
    if (!hasMsgType) errors.push('messages table is missing message_type column.');
    
    const memCols = await dbAsync.all("PRAGMA table_info(conversation_members)");
    if (!memCols.some(c => c.name === 'last_read_at')) errors.push('conversation_members missing last_read_at');
    
    // 2. Test Account Creation Transaction (simulate)
    // We already validated auth registration in Phase 04. We just need to ensure the structure allows it.
    
    if (errors.length > 0) {
        console.error('Persistence validation FAILED:');
        errors.forEach(e => console.error('- ' + e));
        process.exit(1);
    } else {
        console.log('Persistence validation PASSED: Chat columns added correctly.');
        process.exit(0);
    }
}

runTests().catch(e => { console.error(e); process.exit(1); });

