const { dbAsync } = require('../../server/db/connection.cjs');

async function purge() {
    const testUsers = await dbAsync.all(
        "SELECT id, username FROM users WHERE username LIKE 'test_%' OR username LIKE 'sec_%' OR username LIKE 'e2e_%'"
    );
    console.log(`Found ${testUsers.length} test users to purge.`);

    for (const u of testUsers) {
        const uid = u.id;
        await dbAsync.run('DELETE FROM messages WHERE sender_id = ?', [uid]);
        const convs = await dbAsync.all('SELECT conversation_id FROM conversation_members WHERE user_id = ?', [uid]);
        for (const c of convs) {
            await dbAsync.run('DELETE FROM messages WHERE conversation_id = ?', [c.conversation_id]);
            await dbAsync.run('DELETE FROM conversation_members WHERE conversation_id = ?', [c.conversation_id]);
            await dbAsync.run('DELETE FROM conversations WHERE id = ?', [c.conversation_id]);
        }
        await dbAsync.run('DELETE FROM friend_requests WHERE sender_id = ? OR receiver_id = ?', [uid, uid]);
        await dbAsync.run('DELETE FROM friends WHERE user_id = ? OR friend_id = ?', [uid, uid]);
        await dbAsync.run('DELETE FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?', [uid, uid]).catch(() => {});
        await dbAsync.run('DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?', [uid, uid]).catch(() => {});
        await dbAsync.run('DELETE FROM notifications WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM comments WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM reviews WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM reactions WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM saves WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM favorites WHERE user_id = ?', [uid]);
        const userColls = await dbAsync.all('SELECT id FROM collections WHERE user_id = ?', [uid]);
        for (const uc of userColls) {
            await dbAsync.run('DELETE FROM collection_items WHERE collection_id = ?', [uc.id]);
        }
        await dbAsync.run('DELETE FROM collections WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM ticket_messages WHERE sender_user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM support_tickets WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM submissions WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM audit_logs WHERE actor_id = ?', [uid]);
        await dbAsync.run('DELETE FROM sessions WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM user_profiles WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM users WHERE id = ?', [uid]);
        console.log(`Purged ${u.username}`);
    }

    const remaining = await dbAsync.all('SELECT id, username, email, role FROM users');
    console.log('Purge complete. Remaining users in authoritative DB:');
    console.table(remaining);

    const fk = await dbAsync.all('PRAGMA foreign_key_check');
    console.log('Foreign key check violations:', fk.length);
    if (fk.length > 0) {
        console.error(fk);
        process.exit(1);
    }
}

purge().catch(err => {
    console.error(err);
    process.exit(1);
});

