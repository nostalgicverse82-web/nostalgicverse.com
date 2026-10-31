/**
 * Phase 12 Static Social Scan Test
 * Verifies that client HTML and JS files do not contain hardcoded fake social data,
 * fake user arrays, fake comments, fake reviews, or hardcoded notification badges.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

function assert(condition, message) {
    if (!condition) {
        console.error(`[FAIL] ${message}`);
        throw new Error(message);
    }
    console.log(`[PASS] ${message}`);
}

console.log('=== PHASE 12: STATIC SOCIAL INTEGRITY SCAN ===');

const filesToScan = [
    'index.html',
    'account/index.html',
    'profile/index.html',
    'friends/index.html',
    'messages/index.html',
    'notifications/index.html',
    'support/index.html',
    'ideas/index.html',
    'owner/index.html',
    'assets/js/auth-ui.js',
    'assets/js/account-ui.js',
    'assets/js/public-profile-ui.js',
    'assets/js/notifications-ui.js',
    'assets/js/friends-ui.js',
    'assets/js/support-ui.js',
    'assets/js/ideas-ui.js',
    'assets/js/owner-ui.js',
    'assets/js/content-interactions.js'
];

let filesChecked = 0;

for (const relPath of filesToScan) {
    const fullPath = path.join(root, relPath);
    if (!fs.existsSync(fullPath)) {
        console.warn(`[WARN] File not found: ${relPath}`);
        continue;
    }
    const content = fs.readFileSync(fullPath, 'utf8');

    // 1. Check for hardcoded badges with fake counts > 0 in HTML
    if (relPath.endsWith('.html')) {
        const badgeMatch = content.match(/class=["'][^"']*badge[^"']*["']>([1-9][0-9]*)<\//);
        assert(!badgeMatch, `No hardcoded non-zero badge found in ${relPath} (found: ${badgeMatch ? badgeMatch[0] : 'none'})`);
    }

    // 2. Check for fake user arrays or mock comment fixtures
    assert(!content.includes('const mockUsers ='), `No mockUsers array in ${relPath}`);
    assert(!content.includes('const fakeUsers ='), `No fakeUsers array in ${relPath}`);
    assert(!content.includes('const mockComments ='), `No mockComments array in ${relPath}`);
    assert(!content.includes('const fakeComments ='), `No fakeComments array in ${relPath}`);
    assert(!content.includes('const mockReviews ='), `No mockReviews array in ${relPath}`);
    assert(!content.includes('const fakeReviews ='), `No fakeReviews array in ${relPath}`);

    // 3. Check for fake chat messages array
    assert(!content.includes('const mockChats ='), `No mockChats array in ${relPath}`);
    assert(!content.includes('const fakeChats ='), `No fakeChats array in ${relPath}`);

    filesChecked++;
}

assert(filesChecked >= 15, `Scanned at least 15 key production surface files (scanned ${filesChecked})`);
console.log(`[SUCCESS] Static social scan passed cleanly across ${filesChecked} files!`);

