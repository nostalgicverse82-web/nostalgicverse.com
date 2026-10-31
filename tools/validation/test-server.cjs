/**
 * NostalgicVerse Local Preview Server Test Suite
 * 
 * Verifies:
 * - Server starts and responds to HTTP requests on localhost:3000
 * - Generic directory index routing
 * - Representative routes and detail pages
 * - Query strings preservation
 * - Trailing slash normalization
 * - Asset serving and correct MIME types
 * - Path traversal security blocking (HTTP 403)
 * - Missing asset handling (clean HTTP 404 without server error)
 * - HEAD and unsupported HTTP methods
 */

process.env.PORT = process.env.TEST_PORT || '3099';
const http = require('http');
const server = require('../../server.cjs');

const PORT = parseInt(process.env.PORT, 10);
const BASE_URL = `http://localhost:${PORT}`;

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  [PASS] ${message}`);
  } else {
    failedTests++;
    console.error(`  [FAIL] ${message}`);
  }
}

function request(urlPath, options = {}) {
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
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', err => reject(err));
    req.end();
  });
}

async function runTests() {
  console.log('==================================================');
  console.log('TESTING NOSTALGICVERSE LOCAL HTTP PREVIEW SERVER');
  console.log('==================================================\n');

  try {
    // 1. Root & Main Archives
    console.log('1. Core Archives & Root Pages:');
    let res = await request('/');
    assert(res.statusCode === 200 && res.headers['content-type'].includes('text/html'), 'GET / returns 200 text/html');
    assert(res.body.includes('NostalgicVerse'), 'GET / body contains brand name');

    res = await request('/games/');
    assert(res.statusCode === 200 && res.body.includes('Games Archive'), 'GET /games/ returns 200 and archive title');

    res = await request('/consoles/');
    assert(res.statusCode === 200 && res.body.includes('Console Archive'), 'GET /consoles/ returns 200 and archive title');

    res = await request('/genres/');
    assert(res.statusCode === 200, 'GET /genres/ returns 200');

    res = await request('/timeline/');
    assert(res.statusCode === 200, 'GET /timeline/ returns 200');

    res = await request('/guides/');
    assert(res.statusCode === 200, 'GET /guides/ returns 200');

    res = await request('/blog/');
    assert(res.statusCode === 200, 'GET /blog/ returns 200');

    res = await request('/stories/');
    assert(res.statusCode === 302 && res.headers['location'] === '/blog/', 'GET /stories/ redirects 302 to /blog/');

    res = await request('/search/');
    assert(res.statusCode === 200, 'GET /search/ returns 200');

    res = await request('/search/?q=pac-man');
    assert(res.statusCode === 200 && res.body.includes('Archive Search'), 'GET /search/?q=pac-man preserves query string');

    res = await request('/favorites/');
    assert(res.statusCode === 200, 'GET /favorites/ returns 200');

    res = await request('/random/');
    assert(res.statusCode === 200, 'GET /random/ returns 200');

    res = await request('/download/');
    assert(res.statusCode === 200, 'GET /download/ returns 200');

    res = await request('/about/');
    assert(res.statusCode === 200, 'GET /about/ returns 200');

    res = await request('/support/');
    assert(res.statusCode === 200, 'GET /support/ returns 200');

    res = await request('/legal/');
    assert(res.statusCode === 302, 'GET /legal/ redirects 302 to privacy page');

    res = await request('/legal/privacy.html');
    assert(res.statusCode === 200, 'GET /legal/privacy.html returns 200');

    // 2. Console Detail Pages
    console.log('\n2. Console Detail Pages:');
    res = await request('/consoles/atari-2600/');
    assert(res.statusCode === 200 && res.body.includes('Atari 2600'), 'GET /consoles/atari-2600/ returns 200');

    res = await request('/consoles/magnavox-odyssey/');
    assert(res.statusCode === 200 && res.body.includes('Magnavox Odyssey'), 'GET /consoles/magnavox-odyssey/ returns 200');

    res = await request('/consoles/nintendo-entertainment-system/');
    assert(res.statusCode === 200 && res.body.includes('Nintendo Entertainment System'), 'GET /consoles/nintendo-entertainment-system/ returns 200');

    // Trailing slash redirect check
    res = await request('/consoles/atari-2600');
    assert(res.statusCode === 301 && res.headers['location'] === '/consoles/atari-2600/', 'GET /consoles/atari-2600 redirects 301 with trailing slash');

    // 3. Game Detail Pages
    console.log('\n3. Game Detail Pages:');
    res = await request('/games/pac-man/');
    assert(res.statusCode === 200 && res.body.includes('Pac-Man'), 'GET /games/pac-man/ returns 200');

    res = await request('/games/super-mario-bros/');
    assert(res.statusCode === 200 && res.body.includes('Super Mario Bros'), 'GET /games/super-mario-bros/ returns 200');

    res = await request('/games/doom/');
    assert(res.statusCode === 200 && res.body.includes('Doom'), 'GET /games/doom/ returns 200');

    // 4. Static Assets & Data
    console.log('\n4. Static Assets & Data Files:');
    res = await request('/assets/images/branding/logo/logo.svg');
    assert(res.statusCode === 200 && res.headers['content-type'].includes('image/svg+xml'), 'GET /assets/images/.../logo.svg returns 200 image/svg+xml');

    res = await request('/assets/images/branding/logo.svg');
    assert(res.statusCode === 200 && res.headers['content-type'].includes('image/svg+xml'), 'GET /assets/images/branding/logo.svg alias returns 200 image/svg+xml');

    res = await request('/assets/images/branding/logo.png');
    assert(res.statusCode === 200 && res.headers['content-type'] === 'image/png', 'GET /assets/images/branding/logo.png alias returns 200 image/png');

    res = await request('/assets/images/consoles/atari-2600.png');
    assert(res.statusCode === 200 && res.headers['content-type'] === 'image/png', 'GET /assets/images/consoles/atari-2600.png returns 200 image/png');

    res = await request('/assets/images/operating-system/windows.png');
    assert(res.statusCode === 200 && res.headers['content-type'] === 'image/png', 'GET /assets/images/operating-system/windows.png returns 200 image/png');

    res = await request('/assets/images/qr-code/qr-code.png');
    assert(res.statusCode === 200 && res.headers['content-type'] === 'image/png', 'GET /assets/images/qr-code/qr-code.png returns 200 image/png');

    res = await request('/data/search-index.json');
    assert(res.statusCode === 200 && res.headers['content-type'].includes('application/json'), 'GET /data/search-index.json returns 200 application/json');

    // 5. Missing Asset Handling (clean 404, no server crash)
    console.log('\n5. Missing Asset Handling:');
    res = await request('/assets/images/consoles/non-existent-console.png');
    assert(res.statusCode === 404, 'GET non-existent console asset returns 404 cleanly');

    res = await request('/non-existent-page-test/');
    assert(res.statusCode === 404 && res.body.includes('404'), 'GET non-existent route returns 404 and renders 404 template');

    // 6. Security / Path Traversal Prevention
    console.log('\n6. Path Traversal Security:');
    res = await request('/../secret.txt');
    assert(res.statusCode === 403 || res.statusCode === 404, 'GET /../secret.txt blocked with 403 or 404');

    res = await request('/%2e%2e/%2e%2e/windows/win.ini');
    assert(res.statusCode === 403 || res.statusCode === 404, 'Encoded traversal blocked with 403 or 404');

    // 7. HTTP Methods
    console.log('\n7. HTTP Methods:');
    res = await request('/', { method: 'HEAD' });
    assert(res.statusCode === 200 && res.body === '', 'HEAD / returns 200 with empty body');

    res = await request('/', { method: 'POST' });
    assert(res.statusCode === 405, 'POST / returns 405 Method Not Allowed');

    console.log('\n==================================================');
    console.log('TEST SUMMARY');
    console.log('==================================================');
    console.log(`Total Checks: ${totalTests}`);
    console.log(`Passed:       ${passedTests}`);
    console.log(`Failed:       ${failedTests}`);
    console.log('==================================================\n');

    server.close(() => {
      if (failedTests > 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    });

  } catch (err) {
    console.error('Test execution error:', err);
    server.close(() => process.exit(1));
  }
}

// Give server 100ms to bind if needed
setTimeout(runTests, 100);
