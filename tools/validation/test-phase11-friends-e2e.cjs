const puppeteer = require('puppeteer');
const { spawn } = require('child_process');
const path = require('path');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3004;
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

async function runFriendsE2ETest() {
    console.log('====================================================');
    console.log('PHASE 11 E2E VALIDATION: FRIENDS & NOTIFICATIONS');
    console.log('====================================================');

    const timestamp = Date.now();
    const usernameA = `test_fr_a_${timestamp}`;
    const usernameB = `test_fr_b_${timestamp}`;
    const testUsernames = [usernameA, usernameB];

    let browser;

    try {
        await startServer();
        console.log(`[SERVER] Started test server on port ${PORT}`);

        console.log('[SETUP] Registering User A and User B...');
        const resA = await fetch(`${BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: `${usernameA}@example.local`,
                username: usernameA,
                password: 'Password123!',
                confirmPassword: 'Password123!',
                displayName: 'Alice Adventurer'
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
                displayName: 'Bob Browser'
            })
        });
        if (!resB.ok) throw new Error(`Failed to create User B: ${await resB.text()}`);

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

        // Login User A
        console.log('[AUTH] Logging in User A...');
        await pageA.goto(`${BASE_URL}/login/`, { waitUntil: 'networkidle2' });
        await pageA.type('input[type="text"]', usernameA);
        await pageA.type('input[type="password"]', 'Password123!');
        await pageA.click('button[type="submit"]');
        await pageA.waitForFunction(() => !window.location.pathname.includes('/login/'), { timeout: 8000 });

        // Login User B
        console.log('[AUTH] Logging in User B...');
        await pageB.goto(`${BASE_URL}/login/`, { waitUntil: 'networkidle2' });
        await pageB.type('input[type="text"]', usernameB);
        await pageB.type('input[type="password"]', 'Password123!');
        await pageB.click('button[type="submit"]');
        await pageB.waitForFunction(() => !window.location.pathname.includes('/login/'), { timeout: 8000 });

        // 1. Discover People: Test automatic listing without search requirement
        console.log('[TEST] User A navigating to Friends -> Discover People tab...');
        await pageA.goto(`${BASE_URL}/friends/`, { waitUntil: 'networkidle2' });

        // Click Discover People tab
        await pageA.waitForSelector('.social-tab[data-tab="friends-discover"]', { timeout: 8000 });
        await pageA.click('.social-tab[data-tab="friends-discover"]');

        // Wait for member card to appear (Bob Browser should be automatically loaded)
        console.log('[VERIFICATION] Checking automatic user listing in Discover People...');
        await pageA.waitForFunction((uname) => {
            const cards = Array.from(document.querySelectorAll('.social-list-item'));
            return cards.some(c => c.textContent.includes(uname) || c.textContent.includes('Bob Browser'));
        }, { timeout: 8000 }, usernameB);

        console.log('✅ Discover People loaded community members automatically without search!');

        // 2. User A sends Friend Request to User B
        console.log('[TEST] User A clicking Add Friend on User B card...');
        const userBCardHandle = await pageA.evaluateHandle((uname) => {
            const cards = Array.from(document.querySelectorAll('.social-list-item'));
            return cards.find(c => c.textContent.includes(uname) || c.textContent.includes('Bob Browser'));
        }, usernameB);

        const addFriendBtn = await userBCardHandle.$('button.social-btn');
        if (!addFriendBtn) throw new Error('Could not find Add Friend button on User B card');
        await addFriendBtn.click();

        // Verify button updates in-place to "Request Sent"
        await pageA.waitForFunction((uname) => {
            const cards = Array.from(document.querySelectorAll('.social-list-item'));
            const card = cards.find(c => c.textContent.includes(uname) || c.textContent.includes('Bob Browser'));
            return card && card.textContent.includes('Request Sent');
        }, { timeout: 8000 }, usernameB);

        console.log('✅ In-place UI updated to "Request Sent".');

        // Verify DB record
        const userAObj = await dbAsync.get('SELECT id FROM users WHERE username = ?', [usernameA]);
        const userBObj = await dbAsync.get('SELECT id FROM users WHERE username = ?', [usernameB]);
        const reqRow = await dbAsync.get('SELECT * FROM friend_requests WHERE sender_id = ? AND receiver_id = ?', [userAObj.id, userBObj.id]);
        if (!reqRow || reqRow.status !== 'PENDING') {
            throw new Error(`Friend request record missing or invalid: ${JSON.stringify(reqRow)}`);
        }
        console.log('✅ Database contains PENDING friend_requests row.');

        // 3. User B checks Notifications Page for Direct Accept Action
        console.log('[TEST] User B navigating to /notifications/...');
        await pageB.goto(`${BASE_URL}/notifications/`, { waitUntil: 'networkidle2' });

        // Wait for notification card with inline Accept / Decline buttons
        console.log('[VERIFICATION] Verifying notification item with inline action buttons...');
        await pageB.waitForSelector('.social-list-item', { timeout: 8000 });

        const notifHasActions = await pageB.evaluate((uname) => {
            const items = Array.from(document.querySelectorAll('.social-list-item'));
            const frItem = items.find(i => i.textContent.includes(uname) || i.textContent.includes('Alice Adventurer'));
            if (!frItem) return false;
            const acceptBtn = Array.from(frItem.querySelectorAll('button')).find(b => b.textContent.includes('Accept'));
            const declineBtn = Array.from(frItem.querySelectorAll('button')).find(b => b.textContent.includes('Decline'));
            return !!(acceptBtn && declineBtn);
        }, usernameA);

        if (!notifHasActions) {
            throw new Error('Notification did not render direct inline Accept / Decline buttons!');
        }
        console.log('✅ Notification rendered with inline [ ACCEPT ] and [ DECLINE ] action buttons.');

        // 4. User B clicks [ ACCEPT ] directly from Notifications
        console.log('[TEST] User B accepting friend request directly from notification...');
        await pageB.evaluate((uname) => {
            const items = Array.from(document.querySelectorAll('.social-list-item'));
            const frItem = items.find(i => i.textContent.includes(uname) || i.textContent.includes('Alice Adventurer'));
            const acceptBtn = Array.from(frItem.querySelectorAll('button')).find(b => b.textContent.includes('Accept'));
            acceptBtn.click();
        }, usernameA);

        // Wait 1.5s for request to process and reloadNotifications
        await new Promise(r => setTimeout(r, 1500));
        console.log('✅ Notification action clicked and handled successfully.');

        // 5. Database Verification: Bidirectional friendship established
        const friendships = await dbAsync.all(`
            SELECT * FROM friends 
            WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
        `, [userAObj.id, userBObj.id, userBObj.id, userAObj.id]);

        if (friendships.length < 2) {
            throw new Error(`Expected bidirectional friendship in database, found ${friendships.length} rows`);
        }
        console.log('✅ Database verified: authoritative bidirectional friendship established in friends table.');

        // 6. User A verifies friendship reflected in My Friends tab
        console.log('[TEST] User A checking My Friends list...');
        await pageA.click('.social-tab[data-tab="friends-list"]');
        await pageA.waitForFunction((uname) => {
            const cards = Array.from(document.querySelectorAll('.social-list-item'));
            return cards.some(c => c.textContent.includes(uname) || c.textContent.includes('Bob Browser'));
        }, { timeout: 8000 }, usernameB);

        console.log('✅ User B successfully appears in User A\'s "My Friends" list.');

        console.log('\n====================================================');
        console.log('🎉 PHASE 11 FRIENDS & NOTIFICATIONS E2E PASSED (100%)');
        console.log('====================================================');
    } finally {
        if (browser) await browser.close();
        stopServer();
        await cleanupTestData(testUsernames);
    }
}

runFriendsE2ETest().catch(err => {
    console.error('❌ Friends E2E Test Failed:', err);
    process.exit(1);
});
