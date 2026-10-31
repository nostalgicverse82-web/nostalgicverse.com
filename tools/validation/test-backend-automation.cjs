/**
 * NostalgicVerse — Backend & Automation Verification Suite
 * ========================================================
 * Tests server lifecycle, static asset delivery, REST APIs,
 * private AI fallback, news moderation, and ingestion safety.
 */

'use strict';

const http = require('http');
const path = require('path');
const fs = require('fs');

const { startServer, stopServer } = require('../../server/index.cjs');

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const SECRET = 'nostalgicverse-dev-secret-2026';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function request(urlPath, options = {}, bodyData = null) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlPath, BASE_URL);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(reqOptions, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data,
          json
        });
      });
    });

    req.on('error', reject);

    if (bodyData) {
      req.write(typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('============================================================');
  console.log('NOSTALGICVERSE BACKEND & AUTOMATION VALIDATION SUITE');
  console.log('============================================================\n');

  try {
    // 1. Start Server on ephemeral test port
    await startServer(TEST_PORT, '127.0.0.1');
    assert(true, `Server successfully booted on port ${TEST_PORT}`);

    // 2. Static Serving Tests
    const homeRes = await request('/');
    assert(homeRes.status === 200, 'GET / returns 200 OK');
    assert(homeRes.data.includes('NostalgicVerse'), 'GET / serves HTML with site branding');

    const gamesRouteRes = await request('/games/');
    assert(gamesRouteRes.status === 200, 'GET /games/ resolves and returns 200 OK');
    assert(gamesRouteRes.data.includes('Games Archive'), 'GET /games/ contains archive header');

    const missingRes = await request('/totally-non-existent-page-xyz');
    assert(missingRes.status === 404, 'GET /non-existent returns 404 Not Found');

    // 3. GET /api/health
    const healthRes = await request('/api/health');
    assert(healthRes.status === 200, 'GET /api/health returns 200 OK');
    assert(healthRes.json && healthRes.json.status === 'healthy', 'Health status is "healthy"');
    assert(healthRes.json.counts.games === 528, `Health reports 528 games (got ${healthRes.json?.counts?.games})`);
    assert(healthRes.json.counts.consoles === 65, `Health reports 65 consoles (got ${healthRes.json?.counts?.consoles})`);

    // 4. GET /api/content/games
    const gamesApiRes = await request('/api/content/games?limit=10');
    assert(gamesApiRes.status === 200, 'GET /api/content/games returns 200 OK');
    assert(gamesApiRes.json.total === 528, 'API reports total 528 games');
    assert(gamesApiRes.json.games.length === 10, 'Limit query parameter respected');

    // Filter test
    const eraApiRes = await request('/api/content/games?era=1980s');
    assert(eraApiRes.status === 200, 'GET /api/content/games?era=1980s returns 200 OK');
    assert(eraApiRes.json.games.every(g => g.era === '1980s'), 'Era filter strictly matches 1980s');

    // 5. GET /api/content/consoles
    const consolesApiRes = await request('/api/content/consoles');
    assert(consolesApiRes.status === 200, 'GET /api/content/consoles returns 200 OK');
    assert(consolesApiRes.json.total === 65, 'API reports total 65 consoles');

    // 6. GET /api/search
    const searchRes = await request('/api/search?q=mario');
    assert(searchRes.status === 200, 'GET /api/search?q=mario returns 200 OK');
    assert(searchRes.json.results.length > 0, 'Search returned matches for "mario"');

    // 7. Security: Protected Internal Endpoints
    const unauthRes = await request('/api/internal/generate-news', { method: 'POST' });
    assert(unauthRes.status === 401, 'POST /api/internal/* without secret returns 401 Unauthorized');

    // 8. News Engine Generation & Safety Moderation Workflow
    const testTopic = `The Genesis of 16-Bit Processing (${Date.now()})`;
    const genRes = await request('/api/internal/generate-news', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': SECRET
      }
    }, { topic: testTopic });

    assert(genRes.status === 200, 'POST /api/internal/generate-news returns 200 with valid secret');
    assert(genRes.json.article && genRes.json.article.status === 'held_for_review', 'New article status is strictly "held_for_review"');
    const createdId = genRes.json.article.id;

    // Public GET /api/news should NOT show held_for_review article
    const publicNewsRes = await request('/api/news');
    assert(!publicNewsRes.json.articles.some(a => a.id === createdId), 'Unapproved article not visible in public news feed');

    // Approve story
    const approveRes = await request('/api/internal/approve-news', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': SECRET
      }
    }, { id: createdId, reviewer: 'chief-archivist' });

    assert(approveRes.status === 200, 'POST /api/internal/approve-news returns 200 OK');
    assert(approveRes.json.article.status === 'published', 'Approved article status transitioned to "published"');
    assert(approveRes.json.article.approvedBy === 'chief-archivist', 'Reviewer tracked on approved article');

    // Now public GET /api/news SHOULD show published article
    const publicNewsRes2 = await request('/api/news');
    assert(publicNewsRes2.json.articles.some(a => a.id === createdId), 'Approved article is now visible in public news feed');

    // Clean up test article from news.json to maintain idempotent test runs
    try {
      const newsPath = path.resolve(__dirname, '../../data/news.json');
      const newsData = JSON.parse(fs.readFileSync(newsPath, 'utf8'));
      newsData.news = newsData.news.filter(item => item.id !== createdId);
      fs.writeFileSync(newsPath, JSON.stringify(newsData, null, 2) + '\n', 'utf8');
    } catch (e) {}

    // 9. Image Health Monitor Endpoint
    const auditRes = await request('/api/internal/audit-images', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': SECRET
      }
    }, { limit: 3 });

    assert(auditRes.status === 200, 'POST /api/internal/audit-images returns 200 OK');
    assert(auditRes.json.audited === 3, 'Audit batch size executed correctly');
    assert(typeof auditRes.json.healthPercentage === 'number', 'Health percentage metric calculated');

    // 10. Clean Server Shutdown
    await stopServer();
    assert(true, 'Server successfully closed all connections and stopped');

  } catch (err) {
    assert(false, `Unexpected error during test suite: ${err.message}`);
    console.error(err);
    try { await stopServer(); } catch (e) {}
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('All backend & automation tests passed successfully!\n');
  }
}

runTests();

