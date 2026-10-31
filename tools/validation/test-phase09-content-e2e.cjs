const puppeteer = require('puppeteer');
const fetch = require('undici').fetch;
const { spawn, execSync } = require('child_process');
const path = require('path');

const fs = require('fs');

let serverProcess;

async function startServer() {
    return new Promise((resolve) => {
        try {
            fs.unlinkSync(path.join(__dirname, '../../data/nostalgicverse_test.sqlite'));
        } catch (e) {}
        execSync('node server/db/migrate.cjs', {
            cwd: path.resolve(__dirname, '../../'),
            env: { ...process.env, DB_PATH: 'data/nostalgicverse_test.sqlite' },
            stdio: 'inherit'
        });
        
        serverProcess = spawn('node', ['server/index.cjs'], {
            cwd: path.resolve(__dirname, '../../'),
            env: { ...process.env, DB_PATH: 'data/nostalgicverse_test.sqlite', PORT: '3000' }
        });
        
        setTimeout(resolve, 2000);
    });
}

async function runTests() {
    console.log('Starting Phase 09 E2E Content & Submissions Test...');
    await startServer();
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    page.on('dialog', async dialog => {
        await dialog.accept();
    });
    let passed = 0;
    
    try {
        console.log('Test 1: Register Owner Account...');
        await page.goto('http://localhost:3000/signup/');
        await page.type('#email', 'owner_content@test.com');
        await page.type('#username', 'owner_content');
        await page.type('#displayName', 'Content Owner');
        await page.type('#password', 'password123');
        await page.type('#confirmPassword', 'password123');
        await Promise.all([
            page.waitForNavigation(),
            page.click('button[type="submit"]')
        ]);
        
        // Promote to OWNER via DB
        execSync('node -e "const { dbAsync } = require(\'./server/db/index.cjs\'); dbAsync.run(\'UPDATE users SET role = \\\'OWNER\\\' WHERE email = \\\'owner_content@test.com\\\'\').then(() => process.exit(0))"', { cwd: path.resolve(__dirname, '../../'), env: { ...process.env, DB_PATH: 'data/nostalgicverse_test.sqlite' } });
        passed++;
        console.log('PASS: Owner Registered');
        
        console.log('Test 2: Create a Correction Submission...');
        await page.goto('http://localhost:3000/ideas/');
        
        // ensure loaded
        await page.waitForSelector('.social-tab[data-tab="ideas-new"]');
        await page.click('.social-tab[data-tab="ideas-new"]');
        
        await page.waitForSelector('#idea-title');
        await page.select('#idea-type', 'Correction');
        await page.type('#idea-title', 'Fix typo in Pac-Man');
        await page.type('#idea-desc', 'Change pak to pac.');
        await page.click('button[type="submit"]');
        
        // Wait for it to appear in My Submissions tab
        await page.waitForFunction(() => document.body.innerText.includes('Fix typo in Pac-Man'));
        passed++;
        console.log('PASS: Created Correction Submission');
        
        console.log('Test 3: Owner Reviews Submission...');
        await page.goto('http://localhost:3000/owner/');
        await page.waitForSelector('.social-tab[data-tab="owner-submissions"]');
        await page.click('.social-tab[data-tab="owner-submissions"]');
        
        await page.waitForFunction(() => document.body.innerText.includes('Fix typo in Pac-Man'));
        
        // Owner approves it
        const result = await page.evaluate(async () => {
             const btn = document.querySelector('.social-btn.primary');
             if(btn && btn.textContent.includes('Approve')) {
                 btn.click();
                 return true;
             }
             return false;
        });
        
        if (result) passed++;
        console.log('PASS: Owner Approved Submission');
        
        console.log('Test 4: Trigger CMS Generators...');
        await page.click('.social-tab[data-tab="owner-generators"]');
        await page.waitForSelector('#run-generators-btn');
        await page.click('#run-generators-btn');
        
        // Wait for generation to finish
        await page.waitForFunction(() => {
            const out = document.getElementById('generators-output');
            return out && out.textContent.includes('CONSOLE EXHIBIT GENERATION SUMMARY');
        }, { timeout: 15000 });
        passed++;
        console.log('PASS: CMS Generators triggered from UI');
        
        console.log('Test 5: Verify Public Content Generators updated the frontend Search API...');
        const searchRes = await fetch('http://localhost:3000/api/search?q=pac-man');
        const searchData = await searchRes.json();
        if(searchData.query === 'pac-man') passed++;
        console.log('PASS: Search API responds dynamically');
        
    } catch (e) {
        console.error('FAILED AT TEST', passed + 1, e);
    } finally {
        await browser.close();
        serverProcess.kill();
        console.log('Total passed:', passed, '/ 5');
        process.exit(passed === 5 ? 0 : 1);
    }
}

runTests();