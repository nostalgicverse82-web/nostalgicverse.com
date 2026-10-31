const puppeteer = require('puppeteer');
const fetch = require('undici').fetch;
const { spawn } = require('child_process');
const path = require('path');

let serverProcess;

async function startServer() {
    return new Promise((resolve) => {
        require('child_process').execSync('node server/db/migrate.cjs', {
            cwd: path.resolve(__dirname, '../../'),
            env: { ...process.env, DB_PATH: 'data/nostalgicverse_test.sqlite' },
            stdio: 'inherit'
        });
        
        serverProcess = spawn('node', ['server/index.cjs'], {
            cwd: path.resolve(__dirname, '../../'),
            env: { ...process.env, DB_PATH: 'data/nostalgicverse_test.sqlite', PORT: '3000' }
        });
        
        serverProcess.stdout.on('data', d => {
            console.log('[SERVER]', d.toString().trim());
            if (d.toString().includes('listening on')) resolve();
        });
        serverProcess.stderr.on('data', d => console.error('[SERVER_ERR]', d.toString().trim()));
    });
}

function stopServer() {
    if (serverProcess) serverProcess.kill();
}

async function runTest() {
    console.log('Starting Phase 08 E2E Real Browser Test...');
    await startServer();
    
    // First, let's register two users via API to save time
    const userA = { 
        email: `a_${Date.now()}@test.com`,
        username: `userA_${Date.now()}`, 
        password: 'Password123!', 
        confirmPassword: 'Password123!', 
        displayName: 'Test User A' 
    };
    const userB = { 
        email: `b_${Date.now()}@test.com`,
        username: `userB_${Date.now()}`, 
        password: 'Password123!', 
        confirmPassword: 'Password123!', 
        displayName: 'Test User B' 
    };
    
    console.log('Registering test users...');
    const resA = await fetch('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userA)
    });
    if (!resA.ok) throw new Error("Failed to register User A: " + await resA.text());

    const resB = await fetch('http://localhost:3000/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userB)
    });
    if (!resB.ok) throw new Error("Failed to register User B: " + await resB.text());

    console.log('Launching browser contexts...');
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Create two incognito contexts
    const ctxA = await browser.createBrowserContext();
    const ctxB = await browser.createBrowserContext();

    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();
    pageA.on('console', msg => console.log('PAGE A LOG:', msg.text()));
    pageB.on('console', msg => console.log('PAGE B LOG:', msg.text()));
    pageA.on('dialog', async dialog => {
        console.log('PAGE A DIALOG:', dialog.message());
        await dialog.dismiss();
    });
    pageB.on('dialog', async dialog => {
        console.log('PAGE B DIALOG:', dialog.message());
        await dialog.dismiss();
    });

    console.log(`[Browser A] Logging in as ${userA.username}`);
    await pageA.goto('http://localhost:3000/login/');
    await pageA.type('input[type="text"]', userA.username);
    await pageA.type('input[type="password"]', userA.password);
    await pageA.click('button[type="submit"]');
    await pageA.waitForFunction(() => {
        return window.location.pathname !== '/login/' || document.getElementById('login-error').innerText.length > 0;
    }, { timeout: 10000 });
    const errTextA = await pageA.$eval('#login-error', el => el.innerText).catch(()=>'');
    if (errTextA) throw new Error("Login A failed: " + errTextA);

    console.log(`[Browser B] Logging in as ${userB.username}`);
    await pageB.goto('http://localhost:3000/login/');
    await pageB.type('input[type="text"]', userB.username);
    await pageB.type('input[type="password"]', userB.password);
    await pageB.click('button[type="submit"]');
    await pageB.waitForFunction(() => {
        return window.location.pathname !== '/login/' || document.getElementById('login-error').innerText.length > 0;
    }, { timeout: 10000 });
    const errTextB = await pageB.$eval('#login-error', el => el.innerText).catch(()=>'');
    if (errTextB) throw new Error("Login B failed: " + errTextB);

    console.log(`[Browser A] Searching for User B...`);
    await pageA.goto('http://localhost:3000/users/search/');
    await pageA.type('#user-search-input', userB.username);
    await pageA.click('#user-search-btn');
    await pageA.waitForSelector('.social-list-item');
    
    console.log(`[Browser A] Opening User B profile...`);
    await Promise.all([
        pageA.waitForNavigation(),
        pageA.click('.social-list-item a')
    ]);
    try {
        await pageA.waitForSelector('h1', { timeout: 5000 }); // Wait for profile render
    } catch (e) {
        const errHtml = await pageA.$eval('#public-profile-area', el => el.innerHTML).catch(()=>'No area');
        throw new Error("Profile render failed. InnerHTML: " + errHtml);
    }

    // B goes to their own profile just to have the WS open and receive events, or anywhere really.
    // The WS connects on all pages via auth-ui.js
    console.log(`[Browser B] Waiting on homepage...`);
    await pageB.goto('http://localhost:3000/');
    
    // Wait for WS connection
    await new Promise(r => setTimeout(r, 2000));

    console.log(`[Browser A] Adding Friend...`);
    // Need to use XPath or robust selector for Add Friend
    const addFriendBtn = await pageA.waitForSelector('button ::-p-text(Add Friend)');
    await addFriendBtn.click();
    
    console.log(`[Browser A] Verifying UI changes to Request Sent...`);
    await pageA.waitForSelector('button ::-p-text(Request Sent)', { timeout: 5000 });

    console.log(`[Browser B] Checking Notifications for Realtime Request...`);
    await pageB.waitForSelector('#account-toggle-btn .badge', { visible: true }); // A badge should appear in header!

    console.log(`[Browser B] Opening Profile of A to Accept Request...`);
    await pageB.goto(`http://localhost:3000/u/${userA.username}`);
    const acceptBtn = await pageB.waitForSelector('button ::-p-text(Accept Friend Request)');
    
    console.log(`[Browser B] Accepting Request...`);
    await acceptBtn.click();
    await pageB.waitForSelector('button ::-p-text(Remove Friend)'); // UI updates to Friends

    console.log(`[Browser A] Verifying Realtime Friendship Appearance...`);
    // Browser A is still on B's profile. The WS should trigger a DOM re-render!
    await pageA.waitForSelector('button ::-p-text(Remove Friend)', { timeout: 5000 });

    console.log(`[Browser A] Clicking Message...`);
    const msgHref = await pageA.$eval('a.social-btn.primary', el => el.href);
    await pageA.goto(msgHref);
    await pageA.waitForFunction(() => window.location.pathname.startsWith('/messages'), { timeout: 10000 });

    console.log(`[Browser A] Sending realtime message...`);
    await pageA.waitForSelector('#chat-input', { visible: true });
    await pageA.type('#chat-input', 'Hello from the E2E test!');
    
    // Wait for the message POST to complete
    const [msgResponse] = await Promise.all([
        pageA.waitForResponse(res => res.url().includes('/messages') && res.request().method() === 'POST', { timeout: 10000 }),
        pageA.click('#chat-send-btn')
    ]);

    console.log(`[Browser B] Navigating to Chat...`);
    await pageB.goto('http://localhost:3000/messages/');
    // Click the conversation
    let conv;
    try {
        conv = await pageB.waitForSelector('.chat-list-item', { timeout: 10000 });
    } catch (e) {
        const html = await pageB.$eval('#chat-list', el => el.innerHTML);
        console.error("Browser B chat-list HTML:", html);
        throw e;
    }
    await conv.click();
    
    console.log(`[Browser B] Verifying Message Receipt...`);
    try {
        await pageB.waitForFunction(() => document.body.innerText.includes('Hello from the E2E test!'), { timeout: 10000 });
    } catch(e) {
        const html = await pageB.$eval('#chat-messages', el => el.innerHTML);
        console.error("Browser B chat-messages HTML:", html);
        throw e;
    }

    console.log(`[Browser B] Sending Reply...`);
    await pageB.waitForSelector('#chat-input', { visible: true });
    await pageB.type('#chat-input', 'Got it loud and clear.');
    await pageB.click('#chat-send-btn');

    console.log(`[Browser A] Verifying Realtime Reply Receipt...`);
    await pageA.waitForFunction(() => document.body.innerText.includes('Got it loud and clear.'), { timeout: 10000 });

    console.log(`[E2E] Success! Real browser journey verified!`);
    await browser.close();
    stopServer();
}

runTest().catch(err => {
    console.error('❌ Test failed:', err);
    stopServer();
    process.exit(1);
});
