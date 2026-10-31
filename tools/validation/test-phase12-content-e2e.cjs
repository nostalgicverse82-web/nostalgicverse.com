/**
 * Phase 12 E2E Test Suite 2: Content Interaction & Social Engine E2E
 * Tests reactions (like/dislike), comments & replies, reviews & ratings aggregation,
 * saves/bookmarks, reports, and database foreign key integrity.
 */
const { spawn } = require('child_process');
const path = require('path');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3005;
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

async function cleanupTestData(usernames = ['e2e_p12_critic1', 'e2e_p12_critic2']) {
    for (const u of usernames) {
        const row = await dbAsync.get('SELECT id FROM users WHERE username = ?', [u]);
        if (!row) continue;
        const uid = row.id;

        await dbAsync.run('DELETE FROM reports WHERE reporter_id = ?', [uid]);
        await dbAsync.run('DELETE FROM reactions WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM reviews WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM comments WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM saves WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM favorites WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM sessions WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM user_profiles WHERE user_id = ?', [uid]);
        await dbAsync.run('DELETE FROM users WHERE id = ?', [uid]);
    }
}

async function run() {
    console.log('=== PHASE 12: CONTENT INTERACTION E2E TEST ===');
    await startServer();
    console.log('[SERVER] Running on', BASE_URL);

    const USER1 = { username: 'e2e_p12_critic1', email: 'critic1@test.local', password: 'Password123!', confirmPassword: 'Password123!', displayName: 'Retro Critic One' };
    const USER2 = { username: 'e2e_p12_critic2', email: 'critic2@test.local', password: 'Password123!', confirmPassword: 'Password123!', displayName: 'Retro Critic Two' };

    try {
        await cleanupTestData([USER1.username, USER2.username]);

        // 1. Register test users
        let reg1 = await fetch(`${BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(USER1)
        });
        assert(reg1.ok, 'User 1 registered');
        const cookie1 = reg1.headers.get('set-cookie');

        let reg2 = await fetch(`${BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(USER2)
        });
        assert(reg2.ok, 'User 2 registered');
        const cookie2 = reg2.headers.get('set-cookie');

        // Fetch a real game to interact with
        const gamesRes = await fetch(`${BASE_URL}/api/content/games?limit=1`);
        assert(gamesRes.ok, 'Fetched published games');
        const gamesData = await gamesRes.json();
        assert(gamesData.games && gamesData.games.length > 0, 'At least 1 published game exists in DB');
        const testGame = gamesData.games[0];
        const targetType = 'GAME';
        const targetId = testGame.id;
        console.log(`[TEST TARGET] ${testGame.title} (ID: ${targetId})`);

        // 2. Reactions: Like by User 1
        const likeRes = await fetch(`${BASE_URL}/api/community/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie1 },
            body: JSON.stringify({ target_type: targetType, target_id: targetId, reaction_type: 'LIKE' })
        });
        assert(likeRes.ok, 'User 1 liked game');
        const likeData = await likeRes.json();
        assert(likeData.userReaction === 'LIKE', 'User 1 reaction recorded as LIKE');
        assert(likeData.counts.likes >= 1, 'Likes count incremented');

        // Dislike by User 2
        const dislikeRes = await fetch(`${BASE_URL}/api/community/reactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie2 },
            body: JSON.stringify({ target_type: targetType, target_id: targetId, reaction_type: 'DISLIKE' })
        });
        assert(dislikeRes.ok, 'User 2 disliked game');

        // Query reaction stats unauthenticated
        const reactStats = await fetch(`${BASE_URL}/api/community/reactions/${targetType}/${targetId}`);
        assert(reactStats.ok, 'Fetched reaction stats unauthenticated');
        const reactStatsData = await reactStats.json();
        assert(reactStatsData.counts.likes >= 1, 'Verified authoritative likes count');
        assert(reactStatsData.counts.dislikes >= 1, 'Verified authoritative dislikes count');
        assert(reactStatsData.userReaction === null, 'Unauthenticated user has null userReaction');

        // 3. Comments & Nested Replies
        const commentRes = await fetch(`${BASE_URL}/api/community/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie1 },
            body: JSON.stringify({
                target_type: targetType,
                target_id: targetId,
                body: 'An undisputed masterpiece of early arcade engineering!'
            })
        });
        assert(commentRes.ok, 'User 1 posted top-level comment');
        const commentData = await commentRes.json();
        const parentCommentId = commentData.comment.id;
        assert(!!parentCommentId, 'Received canonical comment ID');

        // User 2 replies to User 1's comment
        const replyRes = await fetch(`${BASE_URL}/api/community/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie2 },
            body: JSON.stringify({
                target_type: targetType,
                target_id: targetId,
                parent_id: parentCommentId,
                body: 'Fully agree, the sound design specifically set the industry standard.'
            })
        });
        assert(replyRes.ok, 'User 2 posted nested reply');

        // Fetch comments and verify thread nesting
        const getComments = await fetch(`${BASE_URL}/api/community/comments/${targetType}/${targetId}`);
        assert(getComments.ok, 'Fetched comments thread');
        const threadData = await getComments.json();
        assert(threadData.comments.length >= 2, 'Retrieved both comments');
        const replyItem = threadData.comments.find(c => c.parentId === parentCommentId);
        assert(!!replyItem, 'Found nested reply referencing parentId');
        assert(replyItem.body.includes('sound design'), 'Reply body matches accurately');

        // 4. Reviews & Aggregate Rating Calculation
        // User 1 gives rating 9
        const rev1 = await fetch(`${BASE_URL}/api/community/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie1 },
            body: JSON.stringify({
                target_type: targetType,
                target_id: targetId,
                rating: 9,
                title: 'Timeless Gem',
                body: 'Holds up remarkably well even decades later.',
                pros: 'Responsive controls, memorable music',
                cons: 'Steep difficulty curve'
            })
        });
        assert(rev1.ok, 'User 1 posted review with rating 9');

        // User 2 gives rating 7
        const rev2 = await fetch(`${BASE_URL}/api/community/reviews`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie2 },
            body: JSON.stringify({
                target_type: targetType,
                target_id: targetId,
                rating: 7,
                title: 'Charming but punishing',
                body: 'A great classic, though coin-muncher mechanics can frustrate modern players.',
                pros: 'Iconic art direction',
                cons: 'Trial-and-error gameplay'
            })
        });
        assert(rev2.ok, 'User 2 posted review with rating 7');

        // Fetch aggregate reviews and verify average calculation
        const getReviews = await fetch(`${BASE_URL}/api/community/reviews/${targetType}/${targetId}`);
        assert(getReviews.ok, 'Fetched reviews and rating statistics');
        const reviewsData = await getReviews.json();
        assert(reviewsData.reviews.length >= 2, 'Reviews list contains at least 2 reviews');
        assert(reviewsData.stats.count >= 2, 'Review count is at least 2');
        assert(reviewsData.stats.averageRating >= 7 && reviewsData.stats.averageRating <= 9, 'Average rating mathematically computed between 7 and 9');

        // 5. Saves / Bookmarks
        const saveToggle1 = await fetch(`${BASE_URL}/api/community/saves`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie1 },
            body: JSON.stringify({ target_type: targetType, target_id: targetId })
        });
        assert(saveToggle1.ok, 'User 1 toggled save ON');
        const save1Data = await saveToggle1.json();
        assert(save1Data.isSaved === true, 'Content is now saved');

        const checkSaved = await fetch(`${BASE_URL}/api/community/saves/${targetType}/${targetId}`, {
            headers: { 'Cookie': cookie1 }
        });
        assert(checkSaved.ok, 'Checked save status');
        const checkSavedData = await checkSaved.json();
        assert(checkSavedData.isSaved === true, 'Verified content is marked saved');

        // 6. User Report
        const reportRes = await fetch(`${BASE_URL}/api/community/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cookie': cookie2 },
            body: JSON.stringify({
                target_type: 'COMMENT',
                target_id: parentCommentId,
                reason: 'Testing report functionality for content moderation.'
            })
        });
        assert(reportRes.ok, 'User 2 filed a test report');

        console.log('[SUCCESS] All Content Interaction E2E assertions passed cleanly!');
    } finally {
        await cleanupTestData([USER1.username, USER2.username]);
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

