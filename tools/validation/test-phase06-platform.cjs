// Native fetch is available
const http = require('http');
const { dbAsync } = require('../../server/db/index.cjs');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

async function runTests() {
    console.log('=== NostalgicVerse Phase 06 Platform Tests ===');
    
    // Check DB Tables
    const tables = await dbAsync.all("SELECT name FROM sqlite_master WHERE type='table'");
    const tableNames = tables.map(t => t.name);
    
    const requiredTables = [
        'users', 'sessions', 'friends', 'friend_requests', 'notifications', 
        'submissions', 'support_tickets', 'ticket_messages', 'games', 'emulator_compatibility'
    ];
    
    let allTablesPresent = true;
    for (const t of requiredTables) {
        if (!tableNames.includes(t)) {
            console.error(`[FAIL] Missing table: ${t}`);
            allTablesPresent = false;
        }
    }
    
    if (allTablesPresent) {
        console.log('[PASS] All Phase 06 tables are present in the database.');
    } else {
        process.exit(1);
    }
    
    // Check API Endpoints accessibility (just ensuring they are mounted)
    const endpoints = [
        '/api/users/search',
        '/api/users/friends',
        '/api/users/notifications',
        '/api/support/tickets',
        '/api/submissions',
        '/api/owner/stats'
    ];
    
    for (const ep of endpoints) {
        try {
            // Unauthenticated requests should return 401/403 or JSON error, not 404
            const res = await fetch(BASE_URL + ep);
            if (res.status === 404) {
                console.error(`[FAIL] Endpoint ${ep} is missing (returned 404).`);
                process.exit(1);
            }
        } catch (e) {
            console.error(`[FAIL] Failed to hit ${ep}:`, e.message);
            process.exit(1);
        }
    }
    console.log('[PASS] All Phase 06 API routes are mounted and responding.');
    
    // Check generated pages
    const pages = [
        '/friends/',
        '/notifications/',
        '/support/',
        '/ideas/',
        '/settings/',
        '/owner/'
    ];
    
    for (const p of pages) {
        try {
            const res = await fetch(BASE_URL + p);
            if (res.status !== 200) {
                console.error(`[FAIL] Page ${p} did not return 200 OK. Status: ${res.status}`);
                process.exit(1);
            }
            const html = await res.text();
            if (!html.includes('auth-layout-container')) {
                console.error(`[FAIL] Page ${p} does not contain standard layout.`);
                process.exit(1);
            }
        } catch(e) {
            console.error(`[FAIL] Failed to fetch ${p}:`, e.message);
            process.exit(1);
        }
    }
    console.log('[PASS] All Phase 06 frontend shell pages generated successfully.');
    
    console.log('\n✅ Phase 06 Validation Completed Successfully.');
    process.exit(0);
}

// Ensure server is running for fetch tests, otherwise skip fetch tests or start it
const serverCheck = http.request(BASE_URL, (res) => {
    runTests();
});
serverCheck.on('error', () => {
    console.log('Server is not running on port 3000. Start it first with "npm run dev" or similar.');
    process.exit(1);
});
serverCheck.end();
