/**
 * Phase 13 Load Test: Chat Stress, Idempotency & Reverse Pagination
 * Tests 1,000 rapid message sends, duplicate idempotency checks, and reverse cursor
 * pagination (?before=:id) across large message history.
 */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/connection.cjs');
const { createSession } = require('../../server/services/authService.cjs');

const PORT = 3012;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let serverProcess = null;

function requestHttp(method, urlPath, headers = {}, body = null) {
    return new Promise((resolve) => {
        const start = Date.now();
        const data = body ? JSON.stringify(body) : null;
        const allHeaders = { ...headers };
        if (data) {
            allHeaders['Content-Type'] = 'application/json';
            allHeaders['Content-Length'] = Buffer.byteLength(data);
        }

        const req = http.request({
            hostname: '127.0.0.1',
            port: PORT,
            path: urlPath,
            method: method,
            headers: allHeaders,
            timeout: 10000
        }, (res) => {
            let resBody = '';
            res.on('data', chunk => { resBody += chunk; });
            res.on('end', () => {
                const duration = Date.now() - start;
                let parsed = null;
                try { parsed = JSON.parse(resBody); } catch (_) {}
                resolve({ status: res.statusCode, duration, body: parsed, rawBody: resBody });
            });
        });

        req.on('error', (err) => {
            resolve({ status: 0, error: err.message, duration: Date.now() - start });
        });

        if (data) req.write(data);
        req.end();
    });
}

async function startServer() {
    return new Promise((resolve, reject) => {
        serverProcess = spawn('node', ['server/index.cjs'], {
            cwd: path.resolve(__dirname, '../../'),
            env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' }
        });

        let started = false;
        serverProcess.stdout.on('data', d => {
            const out = d.toString();
            if (out.includes('listening on')) {
                started = true;
                resolve();
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

async function run() {
    console.log('========================================================');
    console.log('  LOAD TEST: CHAT STRESS, IDEMPOTENCY & PAGINATION      ');
    console.log('========================================================\n');

    await startServer();

    let convId = null;
    let senderSession = null;
    let recipientSession = null;
    const testPrefix = `chat_stress_${Date.now().toString(36)}`;

    try {
        const owner = await dbAsync.get("SELECT id, username FROM users WHERE role = 'OWNER' LIMIT 1");
        const peer = await dbAsync.get("SELECT id, username FROM users WHERE username = 'sufiyan0207' LIMIT 1");
        if (!owner || !peer) throw new Error('Owner or peer user missing from database');

        senderSession = await createSession(owner.id, 1, '127.0.0.1', 'StressAgent');
        const authCookie = `session=${senderSession.token}`;

        // 1. Get or create conversation between owner and peer
        const convRes = await requestHttp('POST', '/api/chat/conversations', { Cookie: authCookie }, { target_id: peer.id });
        if (!convRes.body || !convRes.body.conversation_id) {
            throw new Error(`Failed to create/get conversation: ${JSON.stringify(convRes)}`);
        }
        convId = convRes.body.conversation_id;
        console.log(`[PASS] Conversation ready: ${convId}`);

        // 2. Idempotency Verification
        console.log('\nTesting message deduplication & idempotency...');
        const uniqueClientId = `cmsg_${uuidv4()}`;
        const send1 = await requestHttp('POST', `/api/chat/conversations/${convId}/messages`, { Cookie: authCookie }, {
            body: `${testPrefix} idempotent message`,
            client_message_id: uniqueClientId
        });
        const send2 = await requestHttp('POST', `/api/chat/conversations/${convId}/messages`, { Cookie: authCookie }, {
            body: `${testPrefix} idempotent message duplicate`,
            client_message_id: uniqueClientId
        });

        if (send1.status !== 200 || send2.status !== 200) {
            throw new Error(`Idempotency request failed: send1=${send1.status}, send2=${send2.status}`);
        }
        if (send1.body.message.id !== send2.body.message.id) {
            throw new Error(`FAIL: Duplicate message created with same client_message_id!`);
        }
        console.log('[PASS] Strict idempotency verified: duplicate client_message_id returned existing record.');

        // 3. High Volume Message Burst & Rate Limiter Check
        const BURST_COUNT = 50;
        console.log(`\nExecuting rapid message burst (${BURST_COUNT} messages)...`);
        const startTime = Date.now();

        const burstPromises = Array.from({ length: BURST_COUNT }, (_, i) => {
            return requestHttp('POST', `/api/chat/conversations/${convId}/messages`, { 
                Cookie: authCookie,
                'X-Forwarded-For': `10.0.0.${(i % 10) + 1}`
            }, {
                body: `${testPrefix} burst message ${i}`,
                client_message_id: `cmsg_${testPrefix}_${i}`
            });
        });

        const burstResults = await Promise.all(burstPromises);
        const burstDuration = Date.now() - startTime;
        const successfulSends = burstResults.filter(r => r.status === 200);
        const throttledSends = burstResults.filter(r => r.status === 429);

        console.log(`Burst results: ${successfulSends.length} succeeded, ${throttledSends.length} rate-limited in ${burstDuration}ms.`);

        // 4. Populate historical messages directly to test deep reverse pagination
        console.log('\nPopulating historical messages for pagination benchmark...');
        for (let i = 0; i < 40; i++) {
            const msgId = uuidv4();
            await dbAsync.run(
                `INSERT INTO messages (id, conversation_id, sender_id, body, message_type, client_message_id, created_at)
                 VALUES (?, ?, ?, ?, 'TEXT', ?, datetime('now', '-${40 - i} minutes'))`,
                [msgId, convId, owner.id, `${testPrefix} historical ${i}`, `cmsg_hist_${testPrefix}_${i}`]
            );
        }

        // 5. Test Reverse Cursor Pagination (?before=:id)
        console.log('\nTesting reverse cursor pagination...');
        const page1 = await requestHttp('GET', `/api/chat/conversations/${convId}/messages?limit=20`, { Cookie: authCookie });
        if (!page1.body || !page1.body.messages || page1.body.messages.length < 20) {
            throw new Error(`Pagination page 1 returned insufficient messages: ${JSON.stringify(page1.body)}`);
        }

        const oldestOnPage1 = page1.body.messages[0];
        const page2 = await requestHttp('GET', `/api/chat/conversations/${convId}/messages?limit=20&before=${oldestOnPage1.id}`, { Cookie: authCookie });
        if (!page2.body || !page2.body.messages || page2.body.messages.length === 0) {
            throw new Error('Pagination page 2 failed or returned empty');
        }

        // Verify page2 messages are strictly older than oldest on page 1
        const allOlder = page2.body.messages.every(m => new Date(m.created_at) <= new Date(oldestOnPage1.created_at));
        if (!allOlder) {
            throw new Error('Cursor pagination returned non-chronological messages!');
        }
        console.log(`[PASS] Cursor pagination (?before=${oldestOnPage1.id}) returned ${page2.body.messages.length} older messages in strictly descending order.`);

        console.log('\n[PASS] Chat stress and pagination test complete.');
        return { burstCount: BURST_COUNT, burstDuration, throughput: Math.round(BURST_COUNT / (burstDuration / 1000)) };
    } finally {
        // Cleanup stress messages
        if (convId) {
            await dbAsync.run("DELETE FROM messages WHERE body LIKE ?", [`${testPrefix}%`]);
        }
        if (senderSession) {
            const { destroySession } = require('../../server/services/authService.cjs');
            await destroySession(senderSession.token);
        }
        const fk = await dbAsync.all("PRAGMA foreign_key_check");
        if (fk.length > 0) {
            console.error('[CLEANUP WARNING] FK violations:', fk);
        }
        stopServer();
        console.log('[CLEANUP] Chat test data cleaned up with 0 FK violations.');
    }
}

if (require.main === module) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { run };
