const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTests() {
    let passed = 0;
    let failed = 0;

    function check(cond, msg) {
        if (cond) {
            console.log(`  ✓ PASS: ${msg}`);
            passed++;
        } else {
            console.error(`  ✗ FAIL: ${msg}`);
            failed++;
        }
    }

    try {
        console.log('--- Phase 03 Account UI Validation ---');
        
        const rootDir = path.resolve(__dirname, '../../');
        
        // 1. Check generated pages exist
        const requiredPages = [
            'login/index.html',
            'signup/index.html',
            'forgot-password/index.html',
            'account/index.html',
            'profile/index.html'
        ];
        
        for (const page of requiredPages) {
            const exists = fs.existsSync(path.join(rootDir, page));
            check(exists, `${page} exists`);
        }

        // 2. Check injected JS and CSS in index.html
        const indexHTML = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
        check(indexHTML.includes('auth-ui.css'), 'auth-ui.css is linked in index.html');
        check(indexHTML.includes('auth-ui.js'), 'auth-ui.js is included in index.html');
        
        // 3. Check Account Control UI in header
        check(indexHTML.includes('account-control-wrap'), 'Account control wrapper injected');
        check(indexHTML.includes('account-dropdown-menu'), 'Account dropdown menu injected');
        check(indexHTML.includes('href="/login/"'), 'Login link present in dropdown');
        check(indexHTML.includes('href="/signup/"'), 'Signup link present in dropdown');
        
        // 4. Verify no fake auth localStorage in JS
        const authJS = fs.readFileSync(path.join(rootDir, 'assets/js/auth-ui.js'), 'utf8');
        check(!authJS.includes('localStorage.setItem'), 'No fake localStorage auth found');
        check(authJS.includes('fetch(\'/api/auth/me\')'), 'Centralized auth state fetch present');
        
        // 5. Verify password fields
        const loginHTML = fs.readFileSync(path.join(rootDir, 'login/index.html'), 'utf8');
        check(loginHTML.includes('type="password"'), 'Password field uses type="password"');
        
        // 6. Check existing museum navigation is preserved
        check(indexHTML.includes('<nav class="site-nav"'), 'Primary navigation preserved');
        check(indexHTML.includes('href="/games/"'), 'Games link preserved');
        check(indexHTML.includes('brand-logo-wrap'), 'Brand logo preserved');
        
    } catch (e) {
        console.error('Validation crashed:', e);
        failed++;
    }

    console.log(`\nResults: ${passed} passed, ${failed} failed`);
    process.exit(failed > 0 ? 1 : 0);
}

runTests();

