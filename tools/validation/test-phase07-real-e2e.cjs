// Native fetch is available
const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3002; // use a dedicated port to avoid conflicts
const BASE_URL = `http://localhost:${PORT}`;

// We will use native fetch since Node 25 has it.
const myFetch = typeof fetch === 'function' ? fetch : globalThis.fetch;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let serverProcess;

function startServer() {
    return new Promise((resolve, reject) => {
        console.log('[E2E] Starting server...');
        const testDbPath = path.resolve(__dirname, '../../data/nostalgicverse_test.sqlite');
        process.env.DB_PATH = testDbPath;
        
        // Migrate test db first
        require('child_process').execSync(`node server/db/migrate.cjs`, { env: { ...process.env, DB_PATH: testDbPath }, cwd: path.resolve(__dirname, '../../') });
        
        serverProcess = spawn('node', ['server/index.cjs'], {
            env: { ...process.env, PORT: PORT, DB_PATH: testDbPath },
            cwd: path.resolve(__dirname, '../../')
        });

        serverProcess.stdout.on('data', (data) => {
            const out = data.toString();
            // console.log('[SERVER_OUT]', out.trim());
            if (out.includes(`listening on http://`)) {
                resolve();
            }
        });

        serverProcess.stderr.on('data', (data) => {
            console.error('[SERVER_ERR]', data.toString().trim());
        });

        serverProcess.on('error', (err) => {
            console.error('[E2E] Failed to start server', err);
            reject(err);
        });
    });
}

function stopServer() {
    console.log('[E2E] Stopping server...');
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

async function apiRequest(path, method, body, cookie) {
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (cookie) headers['Cookie'] = cookie;

    const res = await myFetch(BASE_URL + path, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });

    const setCookie = res.headers.get('set-cookie');
    let resCookie = cookie;
    if (setCookie) {
        const match = setCookie.match(/session=([^;]+)/);
        if (match) resCookie = `session=${match[1]}`;
    }
    if (path.includes('/login')) console.log('[E2E] Login Set-Cookie:', setCookie, 'Parsed:', resCookie);

    let data = null;
    let text = null;
    try {
        text = await res.text();
        data = JSON.parse(text);
    } catch(e) {
        if (res.status >= 400) console.error('[API Error]', res.status, text);
    }

    return { status: res.status, data, cookie: resCookie };
}

async function connectWebSocket(cookie, name) {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:${PORT}`, {
            headers: { Cookie: cookie }
        });
        
        ws.on('open', () => {
            console.log(`[E2E] WS ${name} opened`);
            resolve(ws);
        });
        ws.on('error', reject);
    });
}

function waitForWSEvent(ws, eventType, timeoutMs = 5000) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Timeout waiting for WS event: ${eventType}`)), timeoutMs);
        
        const listener = (rawData) => {
            try {
                const dataStr = rawData.toString();
                const data = JSON.parse(dataStr);
                if (data.type === eventType) {
                    clearTimeout(timeout);
                    ws.removeListener('message', listener);
                    resolve(data);
                }
            } catch (e) { console.error('WS Parse error', e); }
        };
        ws.on('message', listener);
    });
}

async function runE2E() {
    try {
        await startServer();
        await delay(1000); // give it a moment

        const userA = { username: `userA_${Date.now()}`, password: 'Password1!' };
        const userB = { username: `userB_${Date.now()}`, password: 'Password1!' };

        console.log('[E2E] Registering users...');
        const regA = await apiRequest('/api/auth/signup', 'POST', { username: userA.username, displayName: userA.username, email: `${userA.username}@example.com`, password: userA.password, confirmPassword: userA.password });
        if (regA.status !== 200) console.error('[E2E] Reg A:', regA.data);
        const regB = await apiRequest('/api/auth/signup', 'POST', { username: userB.username, displayName: userB.username, email: `${userB.username}@example.com`, password: userB.password, confirmPassword: userB.password });
        if (regB.status !== 200) console.error('[E2E] Reg B:', regB.data);

        const loginA = await apiRequest('/api/auth/login', 'POST', { username: userA.username, password: userA.password });
        const cookieA = loginA.cookie;
        if (!cookieA) throw new Error('User A login failed');

        const loginB = await apiRequest('/api/auth/login', 'POST', { username: userB.username, password: userB.password });
        const cookieB = loginB.cookie;
        if (!cookieB) throw new Error('User B login failed');

        console.log('[E2E] Connecting WebSockets...');
        const wsA = await connectWebSocket(cookieA, 'A');
        const wsB = await connectWebSocket(cookieB, 'B');
        
        await delay(500); // Give WS time to authenticate in background

        console.log('[E2E] Testing Friend Request (A -> B)...');
        
        const wsBNotifPromise = waitForWSEvent(wsB, 'NOTIFICATION');
        // A sends request to B
        const reqRes = await apiRequest('/api/users/friends/request', 'POST', { target_username: userB.username }, cookieA);
        if (reqRes.status !== 200) throw new Error(`Friend request failed: ${JSON.stringify(reqRes.data)}`);

        // B should receive NOTIFICATION via WS
        const notifB = await wsBNotifPromise;
        if (notifB.notification.type !== 'FRIEND_REQUEST') throw new Error('B did not receive correct WS friend request notification');
        console.log('[E2E] Realtime Friend Request passed.');

        // B accepts
        console.log('[E2E] B accepts friend request...');
        const bReqs = await apiRequest('/api/users/friends/requests', 'GET', null, cookieB);
        const pendingReqId = bReqs.data.incoming[0].id;
        
        const wsANotifPromise = waitForWSEvent(wsA, 'NOTIFICATION');
        await apiRequest(`/api/users/friends/request/${pendingReqId}`, 'POST', { action: 'accept' }, cookieB);

        // A should receive NOTIFICATION via WS
        const notifA = await wsANotifPromise;
        if (notifA.notification.type !== 'FRIEND_ACCEPTED') throw new Error('A did not receive WS accepted notification');
        console.log('[E2E] Realtime Friend Accept passed.');

        console.log('[E2E] Testing Chat Creation...');
        // A creates chat with B
        const chatRes = await apiRequest('/api/chat/conversations', 'POST', { target_username: userB.username }, cookieA);
        const convId = chatRes.data.conversation_id;
        
        // A and B join WS room
        wsA.send(JSON.stringify({ type: 'JOIN_CONVERSATION', conversationId: convId }));
        wsB.send(JSON.stringify({ type: 'JOIN_CONVERSATION', conversationId: convId }));
        await delay(500);

        console.log('[E2E] Testing Realtime Chat (A -> B)...');
        const msgEvtBPromise = waitForWSEvent(wsB, 'NEW_MESSAGE');
        await apiRequest(`/api/chat/conversations/${convId}/messages`, 'POST', { body: 'Hello from A' }, cookieA);

        const msgEvtB = await msgEvtBPromise;
        if (msgEvtB.message.body !== 'Hello from A') throw new Error('B did not receive the correct message');
        console.log('[E2E] B received realtime message.');

        console.log('[E2E] Testing Owner Submissions Flow...');
        const loginOwner = await apiRequest('/api/auth/login', 'POST', { username: 'owner', password: 'changeme123' });
        const cookieOwner = loginOwner.cookie;
        if (!cookieOwner) throw new Error('Owner login failed');

        // Normal user (User A) submits an idea
        const subRes = await apiRequest('/api/submissions', 'POST', { title: 'Test Idea', description: 'Testing', type: 'FEATURE_REQUEST' }, cookieA);
        if (subRes.status !== 200) throw new Error(`Submission failed: ${JSON.stringify(subRes.data)}`);
        const subId = subRes.data.id;

        // User A tries to approve their own idea -> Should fail
        const badApprove = await apiRequest(`/api/owner/submissions/${subId}/review`, 'POST', { status: 'APPROVED' }, cookieA);
        if (badApprove.status !== 403) throw new Error('User A was not blocked from owner API');

        const wsANotifPromise2 = waitForWSEvent(wsA, 'NOTIFICATION');
        // Owner approves
        const approve = await apiRequest(`/api/owner/submissions/${subId}/review`, 'POST', { status: 'APPROVED', reviewNotes: 'Looks good' }, cookieOwner);
        if (approve.status !== 200) throw new Error('Owner approve failed');

        // User A gets websocket notification of approval
        const notifSubA = await wsANotifPromise2;
        if (!notifSubA.notification.message.includes('APPROVED') && !notifSubA.notification.message.includes('approved')) {
             throw new Error('User A did not get correct submission notification');
        }
        console.log('[E2E] Owner Submissions Flow passed.');

        console.log('[E2E] Testing Server Restart Persistence...');
        stopServer();
        await delay(2000);
        await startServer();

        console.log('[E2E] Verifying Persistence post-restart...');
        const newLoginA = await apiRequest('/api/auth/login', 'POST', { username: userA.username, password: userA.password });
        const newCookieA = newLoginA.cookie;

        // Verify Friends
        const friendsA = await apiRequest('/api/users/friends', 'GET', null, newCookieA);
        if (friendsA.data.friends.length !== 1 || friendsA.data.friends[0].username !== userB.username) {
            console.error('Friends array:', friendsA.data);
            throw new Error('Friendship did not persist across restart');
        }

        // Verify Messages
        const msgsA = await apiRequest(`/api/chat/conversations/${convId}/messages`, 'GET', null, newCookieA);
        if (msgsA.data.messages.length === 0 || msgsA.data.messages[0].body !== 'Hello from A') {
            throw new Error('Chat message did not persist across restart');
        }

        console.log('[E2E] Server Restart Persistence passed.');

        console.log('--- PHASE 07 TESTS ---');
        
        // Ensure server is running for Phase 07 tests
        if (!serverProcess) await startServer();
        
        // 5. Test Submission & CMS Pipeline
        console.log('[E2E] Testing Submission -> Approval -> Generation Pipeline');
        const subRes7 = await apiRequest('/api/submissions', 'POST', { type: 'GAME', title: 'Test Game 7', description: 'Phase 7 game submission' }, cookieB);
        if (subRes7.status !== 200) throw new Error('Submission failed');
        
        // Fetch submissions as owner
        const ownerSubRes = await apiRequest('/api/owner/submissions', 'GET', null, cookieOwner);
        const targetSub = ownerSubRes.data.submissions.find(s => s.title === 'Test Game 7');
        if (!targetSub) throw new Error('Submission not found in owner queue');
        
        // Approve submission
        const approveRes = await apiRequest(`/api/owner/submissions/${targetSub.id}/review`, 'POST', { status: 'APPROVED', reviewNotes: 'Looks good' }, cookieOwner);
        if (approveRes.status !== 200) throw new Error('Approval failed');
        
        // Verify canonical game was created
        const gamesRes = await apiRequest('/api/cms/games', 'GET', null, cookieOwner);
        const publishedGame = gamesRes.data.items.find(g => g.title === 'Test Game 7');
        if (!publishedGame) throw new Error('Game was not published to canonical DB');
        
        // 6. Test Community Features (Comments & Reactions)
        console.log('[E2E] Testing Community Comments & Reactions');
        const commentRes = await apiRequest('/api/community/comments', 'POST', { target_type: 'GAME', target_id: publishedGame.id, body: 'First comment!' }, cookieA);
        if (commentRes.status !== 200) throw new Error('Comment failed');
        
        const reactionRes = await apiRequest('/api/community/reactions', 'POST', { target_type: 'GAME', target_id: publishedGame.id, reaction_type: 'LIKE' }, cookieB);
        if (reactionRes.status !== 200) throw new Error('Reaction failed');
        
        const fetchComments = await apiRequest(`/api/community/comments/GAME/${publishedGame.id}`, 'GET', null);
        if (fetchComments.data.comments.length === 0 || fetchComments.data.comments[0].body !== 'First comment!') throw new Error('Comment retrieval failed');
        
        console.log('✅ Phase 07 E2E verified.');

        console.log('\n=============================================');
        stopServer();
        process.exit(0);

    } catch (err) {
        console.error('\n❌ E2E Failed:', err);
        stopServer();
        process.exit(1);
    }
}

runE2E();
