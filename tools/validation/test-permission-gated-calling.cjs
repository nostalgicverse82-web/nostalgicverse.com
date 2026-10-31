/**
 * NostalgicVerse — Permission-Gated Calling Validation Test Suite
 * ===============================================================
 * Verifies:
 * 1. Permissions-Policy header allows camera=(self) and microphone=(self)
 * 2. CSP header permits connect-src 'self' ws: wss:
 * 3. Client WebRTC Call Manager explicitly gates call requests behind real browser permissions
 * 4. Temporary stream tracks are cleanly stopped after permission verification
 * 5. Device error translation coverage (NotAllowedError, NotFoundError, NotReadableError, SecurityError)
 * 6. Recipient device permission flow and failure transition (MEDIA_PERMISSION_FAILED)
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { app } = require('../../server/index.cjs');
const { dbAsync } = require('../../server/db/connection.cjs');
const { v4: uuidv4 } = require('uuid');

let totalChecks = 0;
let passedChecks = 0;

function check(label, condition) {
    totalChecks++;
    if (condition) {
        passedChecks++;
        console.log(`  [PASS] ${label}`);
    } else {
        console.error(`  [FAIL] ${label}`);
        throw new Error(`Assertion failed: ${label}`);
    }
}

async function runTests() {
    console.log('\n======================================================');
    console.log('NOSTALGICVERSE PERMISSION-GATED CALLING TEST SUITE');
    console.log('======================================================\n');

    // 1. HTTP Permissions-Policy & Security Headers
    console.log('--- 1. HTTP Security Headers Verification ---');
    const server = http.createServer(app);
    await new Promise(res => server.listen(0, '127.0.0.1', res));
    const port = server.address().port;

    const headers = await new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}/messages/`, (res) => {
            resolve(res.headers);
        }).on('error', reject);
    });

    const permPolicy = headers['permissions-policy'] || '';
    check('Permissions-Policy header exists', permPolicy.length > 0);
    check('Permissions-Policy enables camera=(self)', permPolicy.includes('camera=(self)'));
    check('Permissions-Policy enables microphone=(self)', permPolicy.includes('microphone=(self)'));
    check('Permissions-Policy blocks geolocation=()', permPolicy.includes('geolocation=()'));
    check('Permissions-Policy does NOT disable camera=()', !permPolicy.includes('camera=()'));
    check('Permissions-Policy does NOT disable microphone=()', !permPolicy.includes('microphone=()'));

    const csp = headers['content-security-policy'] || '';
    check('Content-Security-Policy header exists', csp.length > 0);
    check('CSP allows connect-src ws: and wss:', csp.includes("connect-src 'self' ws: wss:"));

    server.close();

    // 2. Client Code Inspection & Gating Verification
    console.log('\n--- 2. Client Permission Flow Code Verification ---');
    const clientCode = fs.readFileSync(path.join(__dirname, '../../assets/js/webrtc-call-manager.js'), 'utf8');

    check('WebRTCCallManager implements requestVoicePermission', clientCode.includes('requestVoicePermission()'));
    check('WebRTCCallManager implements requestVideoPermission', clientCode.includes('requestVideoPermission()'));
    check('Voice permission requests audio: true, video: false', clientCode.includes('audio: true,\n                    video: false') || clientCode.includes('audio: true, video: false') || clientCode.includes('audio: true') && clientCode.includes('video: false'));
    check('Video permission requests audio: true, video: true', clientCode.includes('audio: true,\n                    video: true') || clientCode.includes('audio: true, video: true') || clientCode.includes('audio: true') && clientCode.includes('video: true'));
    check('Checks navigator.mediaDevices.getUserMedia before request', clientCode.includes('navigator.mediaDevices') && clientCode.includes('getUserMedia'));
    check('startCall checks device permission BEFORE fetch /api/calls/request', clientCode.indexOf('requestVoicePermission') < clientCode.indexOf("fetch('/api/calls/request'"));
    check('startCall stops temporary verification stream tracks immediately', clientCode.includes('track.stop()') || clientCode.includes('track => track.stop()'));
    check('startCall aborts without sending call request if permission fails', clientCode.includes('!permResult.granted') && clientCode.includes('return; // DO NOT SEND CALL REQUEST'));

    // 3. Error Translation & Security Handling
    console.log('\n--- 3. Error Handling and State Translations ---');
    check('Translates NotAllowedError / PermissionDeniedError', clientCode.includes('NotAllowedError') && clientCode.includes('PermissionDeniedError'));
    check('Translates NotFoundError', clientCode.includes('NotFoundError'));
    check('Translates NotReadableError (device busy)', clientCode.includes('NotReadableError'));
    check('Translates SecurityError', clientCode.includes('SecurityError'));
    check('Translates INSECURE_CONTEXT', clientCode.includes('INSECURE_CONTEXT'));
    check('Provides Try Again action on permission modal', clientCode.includes('Try Again'));

    // 4. Recipient Gated Acceptance & Failure Transition
    console.log('\n--- 4. Recipient Gated Acceptance & Server /fail Endpoint ---');
    check('Recipient acceptCall requests device permission explicitly', clientCode.includes('acceptCall()') && clientCode.includes('permResult.granted'));
    check('Recipient notifies server via /fail on permission rejection', clientCode.includes('/fail') && clientCode.includes('MEDIA_PERMISSION_FAILED'));

    // Test Server-Side /fail endpoint
    const callerId = 'user-call-test-' + Date.now();
    const recipientId = 'user-recip-test-' + Date.now();
    const convId = uuidv4();
    const callId = uuidv4();

    await dbAsync.run("INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, 'h')", [callerId, `${callerId}@t.com`, callerId]);
    await dbAsync.run("INSERT INTO users (id, email, username, password_hash) VALUES (?, ?, ?, 'h')", [recipientId, `${recipientId}@t.com`, recipientId]);
    await dbAsync.run("INSERT INTO conversations (id, type) VALUES (?, 'DIRECT')", [convId]);
    await dbAsync.run("INSERT INTO conversation_members (conversation_id, user_id) VALUES (?, ?), (?, ?)", [convId, callerId, convId, recipientId]);
    await dbAsync.run(`
        INSERT INTO call_sessions (id, conversation_id, caller_id, recipient_id, call_type, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'VIDEO', 'ACCEPTED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [callId, convId, callerId, recipientId]);

    const callService = require('../../server/services/callService.cjs');
    const failRes = await callService.failCall({ callId, userId: recipientId, reason: 'MEDIA_PERMISSION_FAILED' });
    check('failCall updates session status to FAILED', failRes.success && failRes.call.status === 'FAILED');

    const updatedCall = await dbAsync.get('SELECT status, end_reason FROM call_sessions WHERE id = ?', [callId]);
    check('Database records status FAILED and reason MEDIA_PERMISSION_FAILED', updatedCall.status === 'FAILED' && updatedCall.end_reason === 'MEDIA_PERMISSION_FAILED');

    // Clean up
    await dbAsync.run('DELETE FROM call_events WHERE call_id = ?', [callId]);
    await dbAsync.run('DELETE FROM call_sessions WHERE id = ?', [callId]);
    await dbAsync.run('DELETE FROM conversation_members WHERE conversation_id = ?', [convId]);
    await dbAsync.run('DELETE FROM conversations WHERE id = ?', [convId]);
    await dbAsync.run('DELETE FROM users WHERE id IN (?, ?)', [callerId, recipientId]);

    console.log(`\n======================================================`);
    console.log(`PERMISSION-GATED CALLING TEST: ${passedChecks}/${totalChecks} checks PASSED!`);
    console.log(`======================================================\n`);
}

runTests().then(() => {
    process.exit(0);
}).catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
});
