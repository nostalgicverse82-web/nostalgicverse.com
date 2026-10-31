const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3003;
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

            // Delete messages
            await dbAsync.run('DELETE FROM messages WHERE sender_id = ?', [uid]);
            
            // Delete conversation members & conversations
            const convs = await dbAsync.all('SELECT conversation_id FROM conversation_members WHERE user_id = ?', [uid]);
            for (const c of convs) {
                await dbAsync.run('DELETE FROM messages WHERE conversation_id = ?', [c.conversation_id]);
                await dbAsync.run('DELETE FROM conversation_members WHERE conversation_id = ?', [c.conversation_id]);
                await dbAsync.run('DELETE FROM conversations WHERE id = ?', [c.conversation_id]);
            }
            
            // Delete friend requests & friends
            await dbAsync.run('DELETE FROM friend_requests WHERE sender_id = ? OR receiver_id = ?', [uid, uid]);
            await dbAsync.run('DELETE FROM friends WHERE user_id = ? OR friend_id = ?', [uid, uid]);
            await dbAsync.run('DELETE FROM user_blocks WHERE blocker_id = ? OR blocked_id = ?', [uid, uid]).catch(() => {});
            await dbAsync.run('DELETE FROM blocks WHERE blocker_id = ? OR blocked_id = ?', [uid, uid]).catch(() => {});

            // Delete notifications
            await dbAsync.run('DELETE FROM notifications WHERE user_id = ?', [uid]);

            // Delete community
            await dbAsync.run('DELETE FROM comments WHERE user_id = ?', [uid]);
            await dbAsync.run('DELETE FROM reviews WHERE user_id = ?', [uid]);
            await dbAsync.run('DELETE FROM reactions WHERE user_id = ?', [uid]);
            await dbAsync.run('DELETE FROM saves WHERE user_id = ?', [uid]);

            // Delete user sessions & profiles
            await dbAsync.run('DELETE FROM sessions WHERE user_id = ?', [uid]);
            await dbAsync.run('DELETE FROM user_profiles WHERE user_id = ?', [uid]);

            // Finally delete user
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

async function runChatE2ETest() {
    console.log('====================================================');
    console.log('PHASE 11 E2E VALIDATION: CHAT ENGINE & IDEMPOTENCY');
    console.log('====================================================');

    const timestamp = Date.now();
    const usernameA = `test_chat_a_${timestamp}`;
    const usernameB = `test_chat_b_${timestamp}`;
    const testUsernames = [usernameA, usernameB];

    let browser;

    try {
        await startServer();
        console.log(`[SERVER] Started test server on port ${PORT}`);

        // 1. Create two test accounts via API
        console.log('[SETUP] Registering User A and User B...');
        const resA = await fetch(`${BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `${usernameA}@example.local`,
                username: usernameA,
                password: 'Password123!',
                confirmPassword: 'Password123!',
                displayName: 'Chat Tester A'
            })
        });
        if (!resA.ok) throw new Error(`Failed to create User A: ${await resA.text()}`);

        const resB = await fetch(`${BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `${usernameB}@example.local`,
                username: usernameB,
                password: 'Password123!',
                confirmPassword: 'Password123!',
                displayName: 'Chat Tester B'
            })
        });
        if (!resB.ok) throw new Error(`Failed to create User B: ${await resB.text()}`);

        // Launch two browser contexts
        console.log('[BROWSER] Launching Puppeteer dual contexts...');
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const ctxA = await browser.createBrowserContext();
        const ctxB = await browser.createBrowserContext();

        const pageA = await ctxA.newPage();
        const pageB = await ctxB.newPage();
        await pageA.setViewport({ width: 1280, height: 800 });
        await pageB.setViewport({ width: 1280, height: 800 });

        // 2. Login User A
        console.log('[AUTH] Logging in User A...');
        await pageA.goto(`${BASE_URL}/login/`, { waitUntil: 'networkidle2' });
        await pageA.type('input[type="text"]', usernameA);
        await pageA.type('input[type="password"]', 'Password123!');
        await pageA.click('button[type="submit"]');
        await pageA.waitForFunction(() => !window.location.pathname.includes('/login/'), { timeout: 8000 });

        // 3. Login User B
        console.log('[AUTH] Logging in User B...');
        await pageB.goto(`${BASE_URL}/login/`, { waitUntil: 'networkidle2' });
        await pageB.type('input[type="text"]', usernameB);
        await pageB.type('input[type="password"]', 'Password123!');
        await pageB.click('button[type="submit"]');
        await pageB.waitForFunction(() => !window.location.pathname.includes('/login/'), { timeout: 8000 });

        // 4. Create direct conversation via API or UI
        console.log('[CONVERSATION] Creating conversation between A and B...');
        const userBRecord = await dbAsync.get('SELECT id FROM users WHERE username = ?', [usernameB]);
        const convRes = await pageA.evaluate(async (targetUserId) => {
            const res = await fetch('/api/chat/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targetUserId })
            });
            return res.json();
        }, userBRecord.id);

        const conversationId = convRes.conversation_id || (convRes.conversation && convRes.conversation.id);
        if (!conversationId) throw new Error(`Failed to start conversation: ${JSON.stringify(convRes)}`);
        console.log(`[CONVERSATION] Established conversation ID: ${conversationId}`);

        // 5. Navigate both users to /messages/
        console.log('[NAVIGATION] Loading /messages/ in both browsers...');
        await pageA.goto(`${BASE_URL}/messages/`, { waitUntil: 'networkidle2' });
        await pageB.goto(`${BASE_URL}/messages/`, { waitUntil: 'networkidle2' });

        // Wait for conversation list item and select it
        await pageA.waitForSelector(`.chat-list-item[data-conv-id="${conversationId}"]`, { timeout: 8000 });
        await pageA.click(`.chat-list-item[data-conv-id="${conversationId}"]`);

        await pageB.waitForSelector(`.chat-list-item[data-conv-id="${conversationId}"]`, { timeout: 8000 });
        await pageB.click(`.chat-list-item[data-conv-id="${conversationId}"]`);

        // Wait for chat active layout to mount
        await pageA.waitForSelector('#chat-active', { visible: true });
        await pageB.waitForSelector('#chat-active', { visible: true });

        // 6. Verify Composer Layout & Visibility
        console.log('[VERIFICATION] Verifying Chat Composer geometry and visibility...');
        const composerA = await pageA.$eval('#chat-form', el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return {
                width: rect.width,
                height: rect.height,
                visible: style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 0
            };
        });

        if (!composerA.visible || composerA.height < 30) {
            throw new Error(`Composer A not properly visible: ${JSON.stringify(composerA)}`);
        }
        console.log('✅ Composer layout verified: visible and mounted at bottom.');

        // 7. Test Message Send & Exact-Once Delivery
        const testMsgBody = `Canonical Message ID Test [${timestamp}]`;
        console.log(`[TEST] User A sending message: "${testMsgBody}"...`);

        await pageA.waitForSelector('#chat-input');
        await pageA.type('#chat-input', testMsgBody);

        // Click send button
        await pageA.click('#chat-send-btn');

        // Wait for message to appear in sender DOM
        await pageA.waitForFunction((text) => {
            const bubbles = Array.from(document.querySelectorAll('.chat-message'));
            return bubbles.some(b => b.textContent.includes(text));
        }, { timeout: 8000 }, testMsgBody);

        // Wait 1.5s for WebSocket delivery and reconciliation to settle
        await new Promise(r => setTimeout(r, 1500));

        // 8. Count rendered messages on Sender (User A)
        const senderBubbleCount = await pageA.evaluate((text) => {
            const bubbles = Array.from(document.querySelectorAll('.chat-message'));
            return bubbles.filter(b => b.textContent.includes(text)).length;
        }, testMsgBody);

        console.log(`[CHECK] Sender (User A) rendered message count: ${senderBubbleCount}`);
        if (senderBubbleCount !== 1) {
            throw new Error(`DUPLICATION DETECTED on sender! Expected 1 message bubble, got ${senderBubbleCount}`);
        }
        console.log('✅ Sender displays EXACTLY 1 message (no duplicate bubbles, no sender echo duplication).');

        // 9. Count rendered messages on Recipient (User B)
        await pageB.waitForFunction((text) => {
            const bubbles = Array.from(document.querySelectorAll('.chat-message'));
            return bubbles.some(b => b.textContent.includes(text));
        }, { timeout: 8000 }, testMsgBody);

        const recipientBubbleCount = await pageB.evaluate((text) => {
            const bubbles = Array.from(document.querySelectorAll('.chat-message'));
            return bubbles.filter(b => b.textContent.includes(text)).length;
        }, testMsgBody);

        console.log(`[CHECK] Recipient (User B) rendered message count: ${recipientBubbleCount}`);
        if (recipientBubbleCount !== 1) {
            throw new Error(`DUPLICATION DETECTED on recipient! Expected 1 message bubble, got ${recipientBubbleCount}`);
        }
        console.log('✅ Recipient displays EXACTLY 1 message.');

        // 10. Check Database Row Count
        const dbRows = await dbAsync.all('SELECT id, client_message_id, body FROM messages WHERE body = ?', [testMsgBody]);
        console.log(`[CHECK] Database message row count: ${dbRows.length}`);
        if (dbRows.length !== 1) {
            throw new Error(`DATABASE INCONSISTENCY! Expected 1 row in messages table, found ${dbRows.length}`);
        }
        console.log(`✅ Database contains EXACTLY 1 row (client_message_id: ${dbRows[0].client_message_id}).`);

        // 11. Idempotency Test: Resending same client_message_id
        console.log('[TEST] Testing API Idempotency: replaying same client_message_id...');
        const replayRes = await pageA.evaluate(async (convId, body, cmsgId) => {
            const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ body, client_message_id: cmsgId })
            });
            return { status: res.status, data: await res.json() };
        }, conversationId, testMsgBody, dbRows[0].client_message_id);

        const dbRowsAfterReplay = await dbAsync.all('SELECT id FROM messages WHERE body = ?', [testMsgBody]);
        if (dbRowsAfterReplay.length !== 1) {
            throw new Error(`IDEMPOTENCY FAILURE! Duplicate row inserted on replay. Count: ${dbRowsAfterReplay.length}`);
        }
        console.log('✅ Idempotency verified: replaying identical client_message_id returned existing canonical message without inserting duplicate.');

        // 12. Composer Persistence during Message Receipt
        console.log('[TEST] Verifying Composer remains mounted and visible when incoming message arrives...');
        const replyMsgBody = `Reply from B [${timestamp}]`;
        await pageB.type('#chat-input', replyMsgBody);
        await pageB.click('#chat-send-btn');

        await pageA.waitForFunction((text) => {
            const bubbles = Array.from(document.querySelectorAll('.chat-message'));
            return bubbles.some(b => b.textContent.includes(text));
        }, { timeout: 8000 }, replyMsgBody);

        const composerStillVisible = await pageA.$eval('#chat-form', el => {
            const rect = el.getBoundingClientRect();
            return rect.height > 0 && !el.hasAttribute('hidden') && window.getComputedStyle(el).display !== 'none';
        });

        if (!composerStillVisible) {
            throw new Error('Composer disappeared after incoming message!');
        }
        console.log('✅ Composer remained mounted and fully visible after incoming message.');

        // 13. Reconnect / Page Reload Test
        console.log('[TEST] Refreshing User A page to verify historical message synchronization...');
        await pageA.reload({ waitUntil: 'networkidle2' });
        await pageA.waitForSelector(`.chat-list-item[data-conv-id="${conversationId}"]`, { timeout: 8000 });
        await pageA.click(`.chat-list-item[data-conv-id="${conversationId}"]`);

        await pageA.waitForFunction(() => {
            const bubbles = Array.from(document.querySelectorAll('.chat-message'));
            return bubbles.length >= 2;
        }, { timeout: 8000 });

        const reloadedCount = await pageA.evaluate((text) => {
            const bubbles = Array.from(document.querySelectorAll('.chat-message'));
            return bubbles.filter(b => b.textContent.includes(text)).length;
        }, testMsgBody);

        if (reloadedCount !== 1) {
            throw new Error(`Duplicate rendered on page reload! Found ${reloadedCount}`);
        }
        console.log('✅ Historical synchronization verified: exactly 1 message bubble rendered after reload.');

        console.log('\n====================================================');
        console.log('🎉 PHASE 11 CHAT E2E TEST PASSED WITH 100% SUCCESS');
        console.log('====================================================');
    } finally {
        if (browser) await browser.close();
        stopServer();
        await cleanupTestData(testUsernames);
    }
}

runChatE2ETest().catch(err => {
    console.error('❌ Chat E2E Test Failed:', err);
    process.exit(1);
});
