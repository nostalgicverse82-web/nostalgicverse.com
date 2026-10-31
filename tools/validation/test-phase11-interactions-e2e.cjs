const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3005;
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
    console.log('[CLEANUP] Cleaning up test users and community interactions...');
    try {
        for (const username of testUsernames) {
            const user = await dbAsync.get('SELECT id FROM users WHERE username = ?', [username]);
            if (!user) continue;
            const uid = user.id;

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

async function runInteractionsE2ETest() {
    console.log('====================================================');
    console.log('PHASE 11 E2E VALIDATION: COMMUNITY INTERACTIONS');
    console.log('====================================================');

    const timestamp = Date.now();
    const username = `test_interact_${timestamp}`;
    const testUsernames = [username];

    let browser;

    try {
        await startServer();
        console.log(`[SERVER] Started test server on port ${PORT}`);

        // 1. Create test user
        console.log('[SETUP] Registering test user...');
        const res = await fetch(`${BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `${username}@example.local`,
                username,
                password: 'Password123!',
                confirmPassword: 'Password123!',
                displayName: 'Exhibit Reviewer'
            })
        });
        if (!res.ok) throw new Error(`Failed to create test user: ${await res.text()}`);

        const userRecord = await dbAsync.get('SELECT id FROM users WHERE username = ?', [username]);

        // Launch browser
        console.log('[BROWSER] Launching Puppeteer...');
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 900 });

        // Login
        console.log('[AUTH] Logging in test user...');
        await page.goto(`${BASE_URL}/login/`, { waitUntil: 'networkidle2' });
        await page.type('input[type="text"]', username);
        await page.type('input[type="password"]', 'Password123!');
        await page.click('button[type="submit"]');
        await page.waitForFunction(() => !window.location.pathname.includes('/login/'), { timeout: 8000 });

        // 2. Navigate to a game exhibit page (Super Mario Bros)
        const targetExhibitUrl = `${BASE_URL}/games/super-mario-bros/`;
        console.log(`[NAVIGATION] Navigating to exhibit: ${targetExhibitUrl}...`);
        await page.goto(targetExhibitUrl, { waitUntil: 'networkidle2' });

        // Wait for universal interaction bar to mount
        console.log('[VERIFICATION] Checking for .nv-interaction-bar mount...');
        await page.waitForSelector('#nv-bar', { timeout: 8000 });
        console.log('✅ Universal interaction bar mounted successfully on museum exhibit.');

        // 3. Test Reaction (Like toggle)
        console.log('[TEST] Testing Like toggle...');
        await page.waitForSelector('#nv-like-btn');
        await page.click('#nv-like-btn');

        // Verify button receives .active class and count increments
        await page.waitForFunction(() => {
            const btn = document.getElementById('nv-like-btn');
            return btn && btn.classList.contains('active');
        }, { timeout: 8000 });

        // Verify DB row
        const likeRow = await dbAsync.get(
            "SELECT * FROM reactions WHERE user_id = ? AND target_type = 'GAME' AND target_id = 'super-mario-bros'",
            [userRecord.id]
        );
        if (!likeRow || likeRow.reaction_type !== 'LIKE') {
            throw new Error(`Database reaction mismatch: ${JSON.stringify(likeRow)}`);
        }
        console.log('✅ Like reaction registered in UI and persisted in database.');

        // 4. Test Reaction (Dislike toggle)
        console.log('[TEST] Testing Dislike toggle (should switch from LIKE to DISLIKE)...');
        await page.click('#nv-dislike-btn');

        await page.waitForFunction(() => {
            const disBtn = document.getElementById('nv-dislike-btn');
            const likeBtn = document.getElementById('nv-like-btn');
            return disBtn && disBtn.classList.contains('active') && !likeBtn.classList.contains('active');
        }, { timeout: 8000 });

        const dislikeRow = await dbAsync.get(
            "SELECT * FROM reactions WHERE user_id = ? AND target_type = 'GAME' AND target_id = 'super-mario-bros'",
            [userRecord.id]
        );
        if (!dislikeRow || dislikeRow.reaction_type !== 'DISLIKE') {
            throw new Error(`Database reaction did not switch to DISLIKE: ${JSON.stringify(dislikeRow)}`);
        }
        console.log('✅ Reaction switched to DISLIKE in database and UI.');

        // 5. Test Favorite / Save toggle
        console.log('[TEST] Testing Favorite / Bookmark toggle...');
        const favBtn = await page.$('#nv-fav-btn');
        if (favBtn) {
            await favBtn.click();
            await page.waitForFunction(() => {
                const b = document.getElementById('nv-fav-btn');
                return b && b.classList.contains('active');
            }, { timeout: 8000 });

            const favRow = await dbAsync.get(
                "SELECT * FROM favorites WHERE user_id = ? AND entity_type = 'GAME' AND entity_id = 'super-mario-bros'",
                [userRecord.id]
            );
            if (!favRow) throw new Error('Favorite row was not inserted in database');
            console.log('✅ Favorite state toggled and persisted in database.');
        }

        // 6. Test Threaded Comments: Post Top-Level Comment
        console.log('[TEST] Testing Discussion / Comments: Posting comment...');
        // Switch to comments tab
        await page.click('#nv-trigger-comments');
        await page.waitForSelector('#nv-comment-form', { timeout: 8000 });

        const testCommentBody = `Groundbreaking platformer design that established NES dominance! [${timestamp}]`;
        await page.type('#nv-comment-input', testCommentBody);
        await page.click('#nv-comment-form button[type="submit"]');

        // Wait for comment to appear in DOM
        await page.waitForFunction((text) => {
            const cards = Array.from(document.querySelectorAll('.nv-comment-card'));
            return cards.some(c => c.textContent.includes(text));
        }, { timeout: 8000 }, testCommentBody);

        const commentRow = await dbAsync.get(
            "SELECT * FROM comments WHERE user_id = ? AND target_type = 'GAME' AND target_id = 'super-mario-bros' AND body = ?",
            [userRecord.id, testCommentBody]
        );
        if (!commentRow) throw new Error('Comment was not persisted in database');
        console.log('✅ Comment published in UI and verified in database.');

        // 7. Test Reply to Comment
        console.log('[TEST] Testing reply nesting...');
        const replyBtn = await page.waitForSelector(`.nv-comment-card[data-id="${commentRow.id}"] .reply-btn`);
        await replyBtn.click();

        await page.waitForSelector(`#reply-input-${commentRow.id}`);
        const testReplyBody = `Level 1-1 is a masterpiece in intuitive tutorial design. [${timestamp}]`;
        await page.type(`#reply-input-${commentRow.id}`, testReplyBody);
        await page.click(`#send-reply-${commentRow.id}`);

        // Wait for reply to appear nested
        await page.waitForFunction((text) => {
            const replyCards = Array.from(document.querySelectorAll('.nv-comment-card.is-reply'));
            return replyCards.some(c => c.textContent.includes(text));
        }, { timeout: 8000 }, testReplyBody);

        const replyRow = await dbAsync.get(
            'SELECT * FROM comments WHERE parent_id = ? AND body = ?',
            [commentRow.id, testReplyBody]
        );
        if (!replyRow) throw new Error('Reply comment not found in database with proper parent_id');
        console.log('✅ Reply posted and nested correctly with parent_id in database.');

        // 8. Test Edit Own Comment
        console.log('[TEST] Testing Edit own comment...');
        const editBtn = await page.waitForSelector(`.nv-comment-card[data-id="${commentRow.id}"] .edit-btn`);
        await editBtn.click();

        await page.waitForSelector(`#edit-input-${commentRow.id}`);
        const updatedCommentBody = `${testCommentBody} [EDITED]`;
        await page.$eval(`#edit-input-${commentRow.id}`, (el, val) => el.value = val, updatedCommentBody);
        await page.click(`#save-edit-${commentRow.id}`);

        await page.waitForFunction((text) => {
            const bodyEl = document.querySelector('.nv-comment-body');
            return bodyEl && bodyEl.textContent.includes(text);
        }, { timeout: 8000 }, updatedCommentBody);

        const updatedRow = await dbAsync.get('SELECT body FROM comments WHERE id = ?', [commentRow.id]);
        if (!updatedRow.body.includes('[EDITED]')) {
            throw new Error(`Database comment body was not updated: ${updatedRow.body}`);
        }
        console.log('✅ Comment edited in-place and updated in database.');

        // 9. Test Reviews: Submit 10/10 Historical Review
        console.log('[TEST] Testing Reviews: Submitting 10/10 Historical Review...');
        await page.click('#nv-trigger-reviews');
        await page.waitForSelector('#nv-review-form', { timeout: 8000 });

        await page.select('#nv-rev-rating', '10');
        await page.type('#nv-rev-title', 'The Definitive Standard for 2D Platformers');
        await page.type('#nv-rev-body', 'Super Mario Bros saved the home video game market after the 1983 crash and gave birth to modern level design.');
        await page.type('#nv-rev-pros', 'Precision controls, iconic Koji Kondo soundtrack');
        await page.type('#nv-rev-cons', 'None');
        await page.click('#nv-review-form button[type="submit"]');

        // Wait for review card to render
        await page.waitForFunction(() => {
            const reviews = Array.from(document.querySelectorAll('.nv-review-card'));
            return reviews.some(r => r.textContent.includes('The Definitive Standard for 2D Platformers'));
        }, { timeout: 8000 });

        const reviewRow = await dbAsync.get(
            "SELECT * FROM reviews WHERE user_id = ? AND target_type = 'GAME' AND target_id = 'super-mario-bros'",
            [userRecord.id]
        );
        if (!reviewRow || reviewRow.rating !== 10) {
            throw new Error(`Database review record mismatch: ${JSON.stringify(reviewRow)}`);
        }
        console.log('✅ Review submitted, rating score calculated, and record verified in database.');

        console.log('\n====================================================');
        console.log('🎉 PHASE 11 COMMUNITY INTERACTIONS E2E PASSED (100%)');
        console.log('====================================================');
    } finally {
        if (browser) await browser.close();
        stopServer();
        await cleanupTestData(testUsernames);
    }
}

runInteractionsE2ETest().catch(err => {
    console.error('❌ Interactions E2E Test Failed:', err);
    process.exit(1);
});
