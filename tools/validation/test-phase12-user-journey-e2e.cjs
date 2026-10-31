/**
 * Phase 12 E2E Test Suite 1: Full Real User Journey & Surface Integration
 * Tests registration, account summary metrics calculation, bio/profile edit,
 * friend request from discovery/profile, inline notification accept,
 * realtime unread count updates, and database consistency.
 */
const { spawn } = require('child_process');
const path = require('path');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3004;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let serverProcess = null;

function assert(condition, message) {
    if (!condition) {
        console.error(`[FAIL] ${message}`);
        throw new Error(message);
    }
    console.log(`[PASS] ${message}`);
}

async function startServer() {
    return new Promise((resolve, reject) => {
        serverProcess = spawn('node', ['server/index.cjs'], {
            cwd: path.resolve(__dirname, '../../'),
            env: { ...process.env, PORT: String(PORT) }
        });

        let started = false;
        serverProcess.stdout.on('data', d => {
            const out = d.toString();
            if (out.includes('listening on')) {
                started = true;
                resolve();
            }
        });

        serverProcess.stderr.on('data', d => {
            const errStr = d.toString().trim();
            if (errStr && !errStr.includes('ExperimentalWarning')) {
                console.error('[SERVER_LOG]', errStr);
            }
        });

        serverProcess.on('error', reject);
        setTimeout(() => {
            if (!started) reject(new Error('Server startup timed out'));
        }, 10000);
    });
}

function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

async function cleanupTestData(usernames = ['e2e_p12_alice', 'e2e_p12_bob']) {
    for (const u of usernames) {
        const row = await dbAsync.get('SELECT id FROM users WHERE username = ?', [u]);
        if (!row) continue;
        const uid = row.id;

        await dbAsync.run('DELETE FROM messages WHERE sender_id = ?', [uid]);
        const convs = await dbAsync.all('SELECT conversation_id FROM conversation_members WHERE user_id = ?', [uid]);
        for (const c of convs) {
            await dbAsync.run('DELETE FROM messages WHERE conversation_id = ?', [c.conversation_id]);
            await dbAsync.run('DELETE FROM conversation_members WHERE conversation_id = ?', [c.conversation_id]);
            await dbAsync.run('DELETE FROM conversations WHERE id = ?', [c.conversation_id]);
        }
        await dbAsync.run('DELETE FROM friend_requests WHERE sender_id = ? OR receiver_id = ?', [uid, uid]);
        await dbAsync.run('DELETE FROM friends WHERE user_id = ? OR friend_id = ?', [uid, uid]);
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
    }
}

async function run() {
    console.log('=== PHASE 12: USER JOURNEY & SURFACE INTEGRATION E2E TEST ===');
    await startServer();
    console.log('[SERVER] Running on', BASE_URL);

    const ALICE = { username: 'e2e_p12_alice', email: 'alice@test.local', password: 'Password123!', confirmPassword: 'Password123!', displayName: 'Alice Archivist' };
    const BOB = { username: 'e2e_p12_bob', email: 'bob@test.local', password: 'Password123!', confirmPassword: 'Password123!', displayName: 'Bob Cartridge' };

    try {
        await cleanupTestData([ALICE.username, BOB.username]);

        // 1. Register User A
        let regA = await fetch(`${BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ALICE)
        });
        assert(regA.ok, 'Alice registered successfully');
        const cookieA = regA.headers.get('set-cookie');
        assert(!!cookieA, 'Alice received session cookie');

        // 2. Register User B
        let regB = await fetch(`${BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(BOB)
        });
        assert(regB.ok, 'Bob registered successfully');
        const cookieB = regB.headers.get('set-cookie');
        assert(!!cookieB, 'Bob received session cookie');

        // 3. User A: Check initial account summary metrics
        let sumA = await fetch(`${BASE_URL}/api/account/summary`, {
            headers: { 'Cookie': cookieA }
        });
        assert(sumA.ok, 'Alice accessed /api/account/summary');
        let sumAData = await sumA.json();
        assert(sumAData.metrics.friendsCount === 0, 'Alice has 0 friends initially');
        assert(sumAData.metrics.favoritesCount === 0, 'Alice has 0 favorites initially');
        assert(sumAData.metrics.collectionsCount === 0, 'Alice has 0 collections initially');
        assert(sumAData.metrics.unreadMessages === 0, 'Alice has 0 unread messages initially');

        // 4. User A: Update profile (Bio & Display Name)
        const updateProf = await fetch(`${BASE_URL}/api/account/profile`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
            body: JSON.stringify({
                display_name: 'Alice Curates',
                bio: 'Preserving arcade history from 1980 to 1999.'
            })
        });
        assert(updateProf.ok, 'Alice updated profile bio and display name');

        // Verify summary reflects new bio
        sumA = await fetch(`${BASE_URL}/api/account/summary`, { headers: { 'Cookie': cookieA } });
        sumAData = await sumA.json();
        assert(sumAData.user.displayName === 'Alice Curates', 'Summary reflects updated display name');
        assert(sumAData.user.bio === 'Preserving arcade history from 1980 to 1999.', 'Summary reflects updated bio');

        // 5. User A visits Bob's public profile
        const profB = await fetch(`${BASE_URL}/api/users/profile/${BOB.username}`, {
            headers: { 'Cookie': cookieA }
        });
        assert(profB.ok, "Alice fetched Bob's public profile");
        const profBData = await profB.json();
        assert(profBData.friendStatus === 'NONE', "Bob's friend status is NONE for Alice");
        const bobUserId = profBData.user.id;

        // 6. User A sends Friend Request to Bob
        const sendReq = await fetch(`${BASE_URL}/api/users/friends/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
            body: JSON.stringify({ recipient_id: bobUserId })
        });
        assert(sendReq.ok, 'Alice sent friend request to Bob');

        // 7. User B checks header unread counts
        const bCounts = await fetch(`${BASE_URL}/api/users/counts`, { headers: { 'Cookie': cookieB } });
        assert(bCounts.ok, 'Bob fetched /api/users/counts');
        const bCountsData = await bCounts.json();
        assert(bCountsData.friendRequests === 1, 'Bob has exactly 1 pending friend request');

        // 8. User B inspects notifications & accepts friend request inline
        const bNotifs = await fetch(`${BASE_URL}/api/users/notifications`, { headers: { 'Cookie': cookieB } });
        assert(bNotifs.ok, 'Bob fetched notifications');
        const bNotifsData = await bNotifs.json();
        const fReqNotif = bNotifsData.notifications.find(n => n.type === 'FRIEND_REQUEST');
        assert(!!fReqNotif, 'Friend request notification present for Bob');
        assert(!!fReqNotif.reference_id, 'Notification contains reference_id to request');

        const acceptReq = await fetch(`${BASE_URL}/api/users/friends/request/${fReqNotif.reference_id}/accept`, {
            method: 'POST',
            headers: { 'Cookie': cookieB }
        });
        assert(acceptReq.ok, 'Bob accepted friend request inline');

        // Mark notification read
        await fetch(`${BASE_URL}/api/users/notifications/mark-read`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookieB },
            body: JSON.stringify({ ids: [fReqNotif.id] })
        });

        // 9. Verify friendship established in database & metrics
        const bSummaryAfter = await fetch(`${BASE_URL}/api/account/summary`, { headers: { 'Cookie': cookieB } });
        const bSumData = await bSummaryAfter.json();
        assert(bSumData.metrics.friendsCount === 1, 'Bob now has 1 friend in account metrics');

        const aSummaryAfter = await fetch(`${BASE_URL}/api/account/summary`, { headers: { 'Cookie': cookieA } });
        const aSumData = await aSummaryAfter.json();
        assert(aSumData.metrics.friendsCount === 1, 'Alice now has 1 friend in account metrics');

        // 10. Realtime Chat: Alice sends Bob a canonical direct message
        const convRes = await fetch(`${BASE_URL}/api/chat/conversations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
            body: JSON.stringify({ targetUserId: bobUserId })
        });
        assert(convRes.ok, 'Direct conversation established');
        const convData = await convRes.json();
        const convId = convData.conversation_id || (convData.conversation && convData.conversation.id);
        assert(!!convId, 'Obtained conversation ID');

        const msgSend = await fetch(`${BASE_URL}/api/chat/conversations/${convId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
            body: JSON.stringify({
                client_message_id: 'client-msg-p12-001',
                body: 'Hello Bob! The Phase 12 surface integration is working.'
            })
        });
        assert(msgSend.ok, 'Alice sent direct chat message');
        const msgData = await msgSend.json();
        assert(msgData.message.client_message_id === 'client-msg-p12-001', 'Canonical message echoes client_message_id');

        // 11. Bob verifies unread message count
        const bCountsMsg = await fetch(`${BASE_URL}/api/users/counts`, { headers: { 'Cookie': cookieB } });
        const bMsgCountsData = await bCountsMsg.json();
        assert(bMsgCountsData.messages === 1, 'Bob has exactly 1 unread message count in header stats');

        // 12. Alice creates a curated collection
        const colRes = await fetch(`${BASE_URL}/api/users/collections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookieA },
            body: JSON.stringify({
                name: 'Golden Era Arcade Classics',
                description: 'The finest coin-op arcade cabinets from 1980 to 1985.',
                isPublic: true
            })
        });
        assert(colRes.ok, 'Alice created public collection');

        // Verify Alice's public profile reflects collection
        const alicePublic = await fetch(`${BASE_URL}/api/users/profile/${ALICE.username}`);
        assert(alicePublic.ok, 'Alice public profile fetched without auth');
        const alicePubData = await alicePublic.json();
        assert(alicePubData.user.collections.length === 1, 'Alice public profile lists 1 public collection');
        assert(alicePubData.user.collections[0].name === 'Golden Era Arcade Classics', 'Public collection name matches');

        console.log('[SUCCESS] All Phase 12 User Journey assertions passed cleanly!');
    } finally {
        await cleanupTestData([ALICE.username, BOB.username]);
        stopServer();

        const fkCheck = await dbAsync.all('PRAGMA foreign_key_check');
        assert(fkCheck.length === 0, `Database has 0 foreign key violations after test (found ${fkCheck.length})`);
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});
