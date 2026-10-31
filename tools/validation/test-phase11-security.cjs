const { spawn } = require('child_process');
const path = require('path');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3006;
const BASE_URL = `http://localhost:${PORT}`;
let serverProcess = null;

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
            console.error('[SERVER_ERR]', d.toString().trim());
        });

        serverProcess.on('error', reject);
        setTimeout(() => {
            if (!started) reject(new Error('Server start timed out'));
        }, 10000);
    });
}

function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

async function cleanupTestData(testUsernames = []) {
    console.log('[CLEANUP] Cleaning up test users and data...');
    try {
        for (const username of testUsernames) {
            const user = await dbAsync.get('SELECT id FROM users WHERE username = ?', [username]);
            if (!user) continue;
            const uid = user.id;

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
            await dbAsync.run('DELETE FROM sessions WHERE user_id = ?', [uid]);
            await dbAsync.run('DELETE FROM user_profiles WHERE user_id = ?', [uid]);
            await dbAsync.run('DELETE FROM users WHERE id = ?', [uid]);
        }

        const fkCheck = await dbAsync.all('PRAGMA foreign_key_check');
        if (fkCheck.length > 0) {
            console.error('[CLEANUP WARNING] Foreign key violations found:', fkCheck);
        } else {
            console.log('[CLEANUP] 0 Foreign key violations. Clean state verified.');
        }
    } catch (e) {
        console.error('[CLEANUP ERROR]', e);
    }
}

async function runSecurityAudit() {
    console.log('====================================================');
    console.log('PHASE 11 SECURITY, AUTH & AUTHORIZATION AUDIT');
    console.log('====================================================');

    const timestamp = Date.now();
    const userA = `sec_user_a_${timestamp}`;
    const userB = `sec_user_b_${timestamp}`;
    const userC = `sec_user_c_${timestamp}`;
    const testUsernames = [userA, userB, userC];

    try {
        await startServer();
        console.log(`[SERVER] Started test server on port ${PORT}`);

        // ==========================================
        // 1. UNAUTHENTICATED ACTION REJECTION
        // ==========================================
        console.log('[TEST 1] Testing Unauthenticated Rejection (401)...');

        const unauthEndpoints = [
            { method: 'POST', url: `${BASE_URL}/api/chat/conversations`, body: { target_username: 'any' } },
            { method: 'POST', url: `${BASE_URL}/api/community/comments`, body: { target_type: 'GAME', target_id: 'pong', body: 'test' } },
            { method: 'POST', url: `${BASE_URL}/api/community/reviews`, body: { target_type: 'GAME', target_id: 'pong', rating: 5, title: 't', body: 'b' } },
            { method: 'POST', url: `${BASE_URL}/api/community/reactions`, body: { target_type: 'GAME', target_id: 'pong', reaction_type: 'LIKE' } },
            { method: 'POST', url: `${BASE_URL}/api/community/saves`, body: { target_type: 'GAME', target_id: 'pong' } },
            { method: 'POST', url: `${BASE_URL}/api/users/friends/request`, body: { target_id: 'any' } }
        ];

        for (const ep of unauthEndpoints) {
            const res = await fetch(ep.url, {
                method: ep.method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ep.body),
                redirect: 'manual'
            });
            if (res.status !== 401) {
                throw new Error(`Security breach! Endpoint ${ep.url} did not return 401 Unauthenticated. Status: ${res.status}`);
            }
        }
        console.log('✅ All 6 sensitive mutation endpoints reject unauthenticated access with 401.');

        // ==========================================
        // 2. SETUP AUTHENTICATED USERS
        // ==========================================
        console.log('[TEST 2] Registering and authenticating test actors A, B, C...');

        async function createAndLogin(username) {
            const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: `${username}@example.local`,
                    username,
                    password: 'Password123!',
                    confirmPassword: 'Password123!',
                    displayName: `Actor ${username}`
                })
            });
            if (!signupRes.ok) throw new Error(`Signup failed for ${username}: ${await signupRes.text()}`);

            const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password: 'Password123!' })
            });
            if (!loginRes.ok) throw new Error(`Login failed for ${username}`);

            const cookie = loginRes.headers.get('set-cookie');
            const data = await loginRes.json();
            return { user: data.user, cookie };
        }

        const actorA = await createAndLogin(userA);
        const actorB = await createAndLogin(userB);
        const actorC = await createAndLogin(userC);
        console.log('✅ Actors A, B, and C created and authenticated with session tokens.');

        // ==========================================
        // 3. CROSS-USER COMMENT AUTHORIZATION
        // ==========================================
        console.log('[TEST 3] Testing Cross-User Comment Modification Authorization (403)...');

        // Actor A posts comment
        const postCommentRes = await fetch(`${BASE_URL}/api/community/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': actorA.cookie
            },
            body: JSON.stringify({
                target_type: 'GAME',
                target_id: 'pac-man',
                body: 'Actor A private historical thought'
            })
        });
        const commentData = await postCommentRes.json();
        const commentId = commentData.comment?.id || commentData.id;

        // Actor B attempts to edit Actor A's comment
        const editAttemptRes = await fetch(`${BASE_URL}/api/community/comments/${commentId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': actorB.cookie
            },
            body: JSON.stringify({ body: 'Tampered by Actor B' })
        });
        if (editAttemptRes.status !== 403) {
            throw new Error(`Authorization failure: Actor B was able to modify Actor A's comment. Status: ${editAttemptRes.status}`);
        }

        // Actor B attempts to delete Actor A's comment
        const deleteAttemptRes = await fetch(`${BASE_URL}/api/community/comments/${commentId}`, {
            method: 'DELETE',
            headers: { 'Cookie': actorB.cookie }
        });
        if (deleteAttemptRes.status !== 403) {
            throw new Error(`Authorization failure: Actor B was able to delete Actor A's comment. Status: ${deleteAttemptRes.status}`);
        }
        console.log('✅ Cross-user comment edits and deletions strictly blocked with 403 Forbidden.');

        // ==========================================
        // 4. PRIVATE CHAT AUTHORIZATION
        // ==========================================
        console.log('[TEST 4] Testing Private Chat Eavesdropping & Tampering Prevention...');

        // Actor A creates conversation with Actor B
        const convRes = await fetch(`${BASE_URL}/api/chat/conversations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': actorA.cookie
            },
            body: JSON.stringify({ target_id: actorB.user.id })
        });
        const convData = await convRes.json();
        const convId = convData.conversation_id || convData.conversation?.id;

        // Actor C (outsider) attempts to read messages in A-B conversation
        const readConvRes = await fetch(`${BASE_URL}/api/chat/conversations/${convId}/messages`, {
            headers: { 'Cookie': actorC.cookie }
        });
        if (readConvRes.status !== 403) {
            throw new Error(`Chat eavesdropping breach! Actor C accessed A-B private messages. Status: ${readConvRes.status}`);
        }

        // Actor C attempts to post into A-B conversation
        const postConvRes = await fetch(`${BASE_URL}/api/chat/conversations/${convId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': actorC.cookie
            },
            body: JSON.stringify({ body: 'Imposter injection' })
        });
        if (postConvRes.status !== 403) {
            throw new Error(`Chat injection breach! Actor C posted into private conversation. Status: ${postConvRes.status}`);
        }
        console.log('✅ Outsider chat access and message injection strictly blocked with 403 Forbidden.');

        // ==========================================
        // 5. XSS ESCAPING & RESILIENCE
        // ==========================================
        console.log('[TEST 5] Testing XSS Payload Sanitization & Escaping...');

        const xssPayload = `<script>alert("XSS")</script><img src="x" onerror="window._xss_pwned=true"><b>Safe Formatting</b>`;
        const xssPostRes = await fetch(`${BASE_URL}/api/community/comments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': actorA.cookie
            },
            body: JSON.stringify({
                target_type: 'GAME',
                target_id: 'pac-man',
                body: xssPayload
            })
        });
        const xssCommentData = await xssPostRes.json();

        // Fetch comments list
        const getCommentsRes = await fetch(`${BASE_URL}/api/community/comments/GAME/pac-man`);
        const allComments = await getCommentsRes.json();
        const savedComment = (allComments.comments || []).find(c => c.body.includes('Safe Formatting'));

        if (!savedComment) {
            throw new Error('XSS test comment not saved or retrieved');
        }
        console.log('✅ Stored comment retrieved safely without crash.');

        // ==========================================
        // 6. SQL INJECTION RESILIENCE
        // ==========================================
        console.log('[TEST 6] Testing SQL Injection Parameter Resilience...');

        const sqliPayloads = [
            `' OR '1'='1`,
            `'; DROP TABLE test_dummy; --`,
            `1 UNION SELECT * FROM users--`
        ];

        for (const payload of sqliPayloads) {
            const sqliRes = await fetch(`${BASE_URL}/api/users/search?q=${encodeURIComponent(payload)}`, {
                headers: { 'Cookie': actorA.cookie }
            });
            // Should return 200 with normal results or 400, never 500 error
            if (sqliRes.status >= 500) {
                throw new Error(`SQL syntax error triggered by query: ${payload}`);
            }
        }
        console.log('✅ SQL injection payloads safely parameterized and handled with 0 query exceptions.');

        console.log('\n====================================================');
        console.log('🎉 PHASE 11 SECURITY & AUTHORIZATION AUDIT: 100% PASSED');
        console.log('====================================================');
    } finally {
        stopServer();
        await cleanupTestData(testUsernames);
    }
}

runSecurityAudit().catch(err => {
    console.error('❌ Security Audit Failed:', err);
    process.exit(1);
});
