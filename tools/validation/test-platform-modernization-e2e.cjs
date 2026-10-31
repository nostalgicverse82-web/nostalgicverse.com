/**
 * NostalgicVerse — Full Platform Modernization End-to-End Test Suite
 * ==================================================================
 * Tests:
 * 1. Owner Authentication & Session Validation
 * 2. Real Google Gemini AI Chat Pipeline & ai_jobs persistence
 * 3. AI Agent Tooling (READ, WRITE, DESTRUCTIVE safety gates)
 * 4. Jobs Center (/api/owner/ai/jobs & /api/owner/jobs)
 * 5. Notification Center (/api/owner/notifications)
 * 6. Global Search with grouped category results (/api/owner/search)
 * 7. Analytics Export in CSV & JSON (/api/owner/analytics/export)
 * 8. System Diagnostics & Real Instrumentation (/api/owner/health & /api/owner/stats)
 */

'use strict';

const http = require('http');
const { dbAsync } = require('../../server/db/index.cjs');
const projectAgent = require('../../server/services/projectAgentService.cjs');

const BASE_URL = 'http://localhost:3000';

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        passed++;
        console.log(`  [PASS] ${message}`);
    } else {
        failed++;
        console.error(`  [FAIL] ${message}`);
    }
}

async function request(urlPath, options = {}) {
    return new Promise((resolve, reject) => {
        const url = new URL(urlPath, BASE_URL);
        const reqOptions = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + (url.search || ''),
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = http.request(reqOptions, (res) => {
            let data = '';
            res.setEncoding('utf8');
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                let parsed = null;
                try { parsed = JSON.parse(data); } catch (_) { parsed = data; }
                resolve({ status: res.statusCode, headers: res.headers, data: parsed });
            });
        });

        req.on('error', reject);
        if (options.body) {
            req.write(typeof options.body === 'object' ? JSON.stringify(options.body) : options.body);
        }
        req.end();
    });
}

async function runAllTests() {
    console.log('========================================================');
    console.log('NOSTALGICVERSE PLATFORM MODERNIZATION VERIFICATION SUITE');
    console.log('========================================================\n');

    // 1. Authenticate as Owner
    console.log('1. Owner Authentication & Session Token:');
    const { createSession } = require('../../server/services/authService.cjs');
    const ownerUser = await dbAsync.get("SELECT id, username FROM users WHERE role = 'OWNER' LIMIT 1");
    if (!ownerUser) throw new Error('Owner user missing in database.');

    const { token } = await createSession(ownerUser.id);
    const authHeaders = {
        'Content-Type': 'application/json',
        'x-session-token': token
    };

    assert(Boolean(token), `Owner session token acquired: ${token?.slice(0, 10)}...`);

    // 2. Real Google Gemini AI Chat Pipeline
    console.log('\n2. Real Google Gemini AI Chat Pipeline:');
    const chatRes = await request('/api/owner/ai/chat', {
        method: 'POST',
        headers: authHeaders,
        body: {
            prompt: 'Explain the importance of preserving 8-bit video game history in one concise sentence.',
            provider: 'GOOGLE',
            model: 'gemini-3.1-flash-lite',
            mode: 'plan_approve',
            autoFallback: true
        }
    });

    if (chatRes.status !== 200) {
        console.error('Chat error details:', chatRes.status, chatRes.data);
    }
    assert(chatRes.status === 200, `POST /api/owner/ai/chat returned HTTP 200`);
    assert(chatRes.data?.success === true, `AI Chat response success flag is true`);
    assert(Boolean(chatRes.data?.result?.response), `AI generated response: "${chatRes.data?.result?.response?.slice(0, 75)}..."`);
    assert(chatRes.data?.result?.provider === 'GOOGLE', `Provider used: ${chatRes.data?.result?.provider}`);
    assert(Boolean(chatRes.data?.result?.model), `Model used: ${chatRes.data?.result?.model}`);

    // Verify ai_jobs persistence
    const latestJob = await dbAsync.get('SELECT * FROM ai_jobs ORDER BY created_at DESC LIMIT 1');
    assert(Boolean(latestJob?.prompt), `ai_jobs record has prompt: "${latestJob?.prompt?.slice(0, 50)}..."`);
    assert(latestJob?.execution_mode === 'plan_approve', `ai_jobs record execution_mode is "${latestJob?.execution_mode}"`);
    assert(latestJob?.status === 'COMPLETED', `ai_jobs status is "${latestJob?.status}"`);

    // 3. Structured AI Agent Tools (Section 11)
    console.log('\n3. Structured AI Agent Tools & Safety Gates (Section 11):');
    const projectSummary = await projectAgent.tools.inspectProject();
    assert(projectSummary.status === 'HEALTHY', `inspectProject returned status: ${projectSummary.status}`);
    assert(projectSummary.archiveMetrics.publishedGames > 0, `inspectProject reported ${projectSummary.archiveMetrics.publishedGames} published games`);

    const gamesQuery = await projectAgent.tools.inspectGames({ limit: 5 });
    assert(gamesQuery.count > 0, `inspectGames returned ${gamesQuery.count} exhibits`);

    const consolesQuery = await projectAgent.tools.inspectConsoleData({ limit: 5 });
    assert(consolesQuery.count > 0, `inspectConsoleData returned ${consolesQuery.count} exhibits`);

    const seoAudit = await projectAgent.tools.inspectSEO();
    assert(seoAudit.healthScore > 0, `inspectSEO calculated health score: ${seoAudit.healthScore}`);

    const diagnostics = await projectAgent.tools.runDiagnostics();
    assert(diagnostics.database.status === 'HEALTHY', `runDiagnostics DB status: ${diagnostics.database.status}`);

    const sysReport = await projectAgent.tools.generateReport('system_health');
    assert(sysReport.reportType === 'system_health', `generateReport generated: ${sysReport.reportType}`);

    // Verify Destructive Safety Gates
    assert(projectAgent.TOOL_METADATA.deleteFile.requiresConfirmation === true, 'deleteFile requires confirmation');
    assert(projectAgent.TOOL_METADATA.deleteContentRecord.requiresConfirmation === true, 'deleteContentRecord requires confirmation');
    assert(projectAgent.TOOL_METADATA.purgeOldLogs.requiresConfirmation === true, 'purgeOldLogs requires confirmation');

    // 4. Jobs Center (Section 12)
    console.log('\n4. Jobs Center Endpoints (Section 12):');
    const aiJobsRes = await request('/api/owner/ai/jobs?limit=10', { headers: authHeaders });
    assert(aiJobsRes.status === 200, 'GET /api/owner/ai/jobs returned HTTP 200');
    assert(Array.isArray(aiJobsRes.data?.jobs), `Returned ${aiJobsRes.data?.jobs?.length} AI jobs`);
    assert(typeof aiJobsRes.data?.total === 'number', `Total AI jobs count returned: ${aiJobsRes.data?.total}`);
    if (aiJobsRes.data?.jobs?.length > 0) {
        assert(typeof aiJobsRes.data?.jobs[0].durationSeconds === 'number', `durationSeconds calculated: ${aiJobsRes.data?.jobs[0].durationSeconds}s`);
    }

    const bgJobsRes = await request('/api/owner/jobs?limit=10', { headers: authHeaders });
    assert(bgJobsRes.status === 200, 'GET /api/owner/jobs returned HTTP 200');

    // 5. Notification Center (Section 28)
    console.log('\n5. Notification Center (Section 28):');
    const notifsRes = await request('/api/owner/notifications', { headers: authHeaders });
    assert(notifsRes.status === 200, 'GET /api/owner/notifications returned HTTP 200');
    assert(typeof notifsRes.data?.unreadCount === 'number', `Unread notifications count: ${notifsRes.data?.unreadCount}`);

    // 6. Global Search with Grouped Category Results (Section 30)
    console.log('\n6. Global Search with Grouped Categories (Section 30):');
    const searchRes = await request('/api/owner/search?q=mario', { headers: authHeaders });
    if (searchRes.status !== 200) {
        console.error('Search error details:', searchRes.status, searchRes.data);
    }
    assert(searchRes.status === 200, 'GET /api/owner/search?q=mario returned HTTP 200');
    assert(Boolean(searchRes.data?.grouped), 'Search response contains grouped categories object');
    assert(Array.isArray(searchRes.data?.grouped?.games), 'Grouped results contain games array');
    assert(Array.isArray(searchRes.data?.results), 'Flat results array preserved for backward compatibility');

    // 7. Analytics Export in CSV and JSON (Section 9)
    console.log('\n7. Analytics Export (Section 9):');
    const jsonExportRes = await request('/api/owner/analytics/export?format=json&range=30d', { headers: authHeaders });
    assert(jsonExportRes.status === 200, 'GET /api/owner/analytics/export?format=json returned HTTP 200');
    assert(Array.isArray(jsonExportRes.data?.metrics), `JSON export contains ${jsonExportRes.data?.metrics?.length} instrumentation metrics`);

    const csvExportRes = await request('/api/owner/analytics/export?format=csv&range=30d', { headers: authHeaders });
    assert(csvExportRes.status === 200, 'GET /api/owner/analytics/export?format=csv returned HTTP 200');
    assert(typeof csvExportRes.data === 'string' && csvExportRes.data.includes('Category,Metric,Value'), 'CSV export contains valid CSV headers');

    // 8. Health and Overview Stats (Section 8 & 31)
    console.log('\n8. Real Operational Dashboard Telemetry (Section 8 & 31):');
    const healthRes = await request('/api/owner/health', { headers: authHeaders });
    assert(healthRes.status === 200, 'GET /api/owner/health returned HTTP 200');
    assert(healthRes.data?.status === 'HEALTHY' || healthRes.data?.status === 'DEGRADED', `System health status: ${healthRes.data?.status}`);

    const statsRes = await request('/api/owner/stats', { headers: authHeaders });
    assert(statsRes.status === 200, 'GET /api/owner/stats returned HTTP 200');
    assert(statsRes.data?.content?.publishedGames > 0, `Stats reported published games: ${statsRes.data?.content?.publishedGames}`);

    console.log('\n========================================================');
    console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('========================================================\n');

    if (failed > 0) {
        process.exit(1);
    }
}

runAllTests().then(() => {
    setTimeout(() => process.exit(0), 100);
}).catch(err => {
    console.error('Test Suite Fatal Error:', err);
    process.exit(1);
});
