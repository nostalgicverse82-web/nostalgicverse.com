/**
 * Phase 14 Test Suite 6: Community Moderation, Reports & Content Triage
 * Validates report inspection and resolution, comment soft-deletion and restoration,
 * and review curation.
 */

const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3019;
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
        setTimeout(() => { if (!started) reject(new Error('Server startup timed out')); }, 10000);
    });
}

function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

async function loginAsOwner() {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'owner', password: 'changeme123' })
    });
    const cookie = res.headers.get('set-cookie');
    return cookie ? cookie.split(';')[0] : '';
}

async function run() {
    console.log('=== TEST PHASE 14: COMMUNITY MODERATION ===');
    await startServer();

    const reportId = uuidv4();
    const commentId = uuidv4();
    const reviewId = uuidv4();
    const owner = await dbAsync.get("SELECT id FROM users WHERE role = 'OWNER'");
    const game = await dbAsync.get("SELECT id FROM games LIMIT 1");

    try {
        const sessionCookie = await loginAsOwner();
        assert(sessionCookie.length > 0, 'Owner authenticated');

        // Create disposable comment
        await dbAsync.run(`
            INSERT INTO comments (id, user_id, target_type, target_id, body, created_at, updated_at)
            VALUES (?, ?, 'game', ?, 'Disposable moderation test comment', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [commentId, owner.id, game.id]);

        // Create disposable review
        await dbAsync.run(`
            INSERT INTO reviews (id, user_id, target_type, target_id, rating, title, body, status, created_at, updated_at)
            VALUES (?, ?, 'game', ?, 5, 'Great Game', 'Disposable moderation test review', 'PUBLISHED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [reviewId, owner.id, game.id]);

        // Create disposable report
        await dbAsync.run(`
            INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status, created_at, updated_at)
            VALUES (?, ?, 'COMMENT', ?, 'Inappropriate language test', 'PENDING', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `, [reportId, owner.id, commentId]);

        // 1. Fetch Reports List
        const reportsRes = await fetch(`${BASE_URL}/api/owner/reports`, {
            headers: { Cookie: sessionCookie }
        });
        assert(reportsRes.status === 200, 'GET /api/owner/reports returns 200');
        const reportsData = await reportsRes.json();
        assert(reportsData.reports.some(r => r.id === reportId), 'Target report present in reports list');

        // 2. Action Report: Resolve
        const resolveRes = await fetch(`${BASE_URL}/api/owner/reports/${reportId}/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({ action: 'RESOLVE' })
        });
        assert(resolveRes.status === 200, 'Report resolve returns 200');
        const resolvedReport = await dbAsync.get('SELECT status FROM reports WHERE id = ?', [reportId]);
        assert(resolvedReport.status === 'RESOLVED', 'Report status is RESOLVED');

        // 3. Comment Moderation: Soft-delete & Restore
        const delCommentRes = await fetch(`${BASE_URL}/api/owner/comments/${commentId}/delete`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(delCommentRes.status === 200, 'Comment soft-delete returns 200');
        const deletedComment = await dbAsync.get('SELECT deleted_at FROM comments WHERE id = ?', [commentId]);
        assert(deletedComment.deleted_at !== null, 'Comment deleted_at timestamp populated');

        const restoreCommentRes = await fetch(`${BASE_URL}/api/owner/comments/${commentId}/restore`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(restoreCommentRes.status === 200, 'Comment restore returns 200');
        const restoredComment = await dbAsync.get('SELECT deleted_at FROM comments WHERE id = ?', [commentId]);
        assert(restoredComment.deleted_at === null, 'Comment deleted_at reset to NULL');

        // 4. Review Moderation: Reject & Restore
        const delReviewRes = await fetch(`${BASE_URL}/api/owner/reviews/${reviewId}/delete`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(delReviewRes.status === 200, 'Review rejection returns 200');
        const rejectedReview = await dbAsync.get('SELECT status FROM reviews WHERE id = ?', [reviewId]);
        assert(rejectedReview.status === 'REJECTED', 'Review status transitioned to REJECTED');

        const restoreReviewRes = await fetch(`${BASE_URL}/api/owner/reviews/${reviewId}/restore`, {
            method: 'POST',
            headers: { Cookie: sessionCookie }
        });
        assert(restoreReviewRes.status === 200, 'Review restoration returns 200');
        const restoredReview = await dbAsync.get('SELECT status FROM reviews WHERE id = ?', [reviewId]);
        assert(restoredReview.status === 'PUBLISHED', 'Review status restored to PUBLISHED');

        console.log('>>> [PASS] COMMUNITY MODERATION AUDIT COMPLETED CLEANLY <<<\n');
    } finally {
        await dbAsync.run('DELETE FROM reports WHERE id = ?', [reportId]);
        await dbAsync.run('DELETE FROM comments WHERE id = ?', [commentId]);
        await dbAsync.run('DELETE FROM reviews WHERE id = ?', [reviewId]);
        await dbAsync.run("DELETE FROM audit_logs WHERE entity_id IN (?, ?, ?)", [reportId, commentId, reviewId]);
        stopServer();
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

