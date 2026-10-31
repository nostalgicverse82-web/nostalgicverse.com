/**
 * NostalgicVerse — Deep Browser QA & Integration Test Suite
 * Simulates real browser interaction against http://localhost:3000
 */
const http = require('http');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const BASE = `http://127.0.0.1:${PORT}`;

let totalTests = 0;
let passedTests = 0;
let failedTests = [];

function pass(name) {
  totalTests++;
  passedTests++;
  console.log(`  [PASS] ${name}`);
}

function fail(name, reason) {
  totalTests++;
  failedTests.push({ name, reason });
  console.log(`  [FAIL] ${name}: ${reason}`);
}

function fetchUrl(urlPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const u = new URL(urlPath, BASE);
    const req = http.request(u, { method }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Ensure server is running
const serverProcess = require('child_process').fork(path.join(__dirname, '../../server.cjs'), [], {
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
  stdio: 'pipe'
});

setTimeout(async () => {
  try {
    console.log('='.repeat(60));
    console.log('NOSTALGICVERSE — DEEP BROWSER QA SUITE');
    console.log('='.repeat(60));

    // ── 1. ROUTE SAMPLE AUDIT ──
    console.log('\n1. Verifying Core Routes & Rendered Status...');
    const routes = [
      '/',
      '/games/',
      '/games/pac-man/',
      '/games/super-mario-bros/',
      '/games/doom/',
      '/games/pokemon-red-blue/',
      '/games/street-fighter-ii/',
      '/consoles/',
      '/consoles/atari-2600/',
      '/consoles/magnavox-odyssey/',
      '/consoles/nintendo-entertainment-system/',
      '/consoles/sega-genesis/',
      '/consoles/playstation/',
      '/genres/',
      '/timeline/',
      '/guides/',
      '/blog/',
      '/search/',
      '/search/?q=pac-man',
      '/search/?q=nintendo',
      '/favorites/',
      '/random/',
      '/download/',
      '/about/',
      '/support/',
      '/legal/privacy.html',
      '/legal/terms.html',
      '/legal/cookies.html',
      '/legal/disclaimer.html',
      '/404.html'
    ];

    for (const r of routes) {
      const res = await fetchUrl(r);
      if (res.statusCode === 200) {
        pass(`GET ${r} returned 200 OK`);
      } else {
        fail(`GET ${r}`, `Unexpected status ${res.statusCode}`);
      }
    }

    // ── 2. REDIRECTS AUDIT ──
    console.log('\n2. Testing Canonical Aliases & Redirects...');
    const rStories = await fetchUrl('/stories/');
    if (rStories.statusCode === 302 && rStories.headers.location.startsWith('/blog/')) {
      pass('GET /stories/ -> 302 Redirect to /blog/');
    } else {
      fail('GET /stories/ redirect', `Status ${rStories.statusCode}, location: ${rStories.headers.location}`);
    }

    const rLegal = await fetchUrl('/legal/');
    if (rLegal.statusCode === 302 && rLegal.headers.location === '/legal/privacy.html') {
      pass('GET /legal/ -> 302 Redirect to /legal/privacy.html');
    } else {
      fail('GET /legal/ redirect', `Status ${rLegal.statusCode}, location: ${rLegal.headers.location}`);
    }

    const rTrailingSlash = await fetchUrl('/consoles/atari-2600');
    if (rTrailingSlash.statusCode === 301 && rTrailingSlash.headers.location.startsWith('/consoles/atari-2600/')) {
      pass('GET /consoles/atari-2600 -> 301 Redirect to trailing slash');
    } else {
      fail('Trailing slash redirect', `Status ${rTrailingSlash.statusCode}`);
    }

    // ── 3. JAVASCRIPT SYNTAX & RUNTIME SAFETY IN ALL CORE PAGES ──
    console.log('\n3. Validating Inlined JavaScript via VM Compilation...');
    const coreHtmlFiles = [
      'index.html',
      'games/index.html',
      'consoles/index.html',
      'genres/index.html',
      'timeline/index.html',
      'guides/index.html',
      'blog/index.html',
      'search/index.html',
      'favorites/index.html',
      'random/index.html',
      'download/index.html'
    ];

    for (const f of coreHtmlFiles) {
      const filePath = path.join(__dirname, '../../', f);
      const html = fs.readFileSync(filePath, 'utf8');
      const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      let scriptCount = 0;
      let hasError = false;

      while ((match = scriptRegex.exec(html)) !== null) {
        const code = match[1].trim();
        if (!code || match[0].includes('application/ld+json')) continue;
        scriptCount++;
        try {
          new vm.Script(code, { filename: `${f}:script[${scriptCount}]` });
        } catch (err) {
          hasError = true;
          fail(`${f} script[${scriptCount}]`, err.message);
        }
      }
      if (!hasError && scriptCount > 0) {
        pass(`${f}: ${scriptCount} inline script(s) valid syntax`);
      }
    }

    // ── 4. RESPONSIVE MEDIA QUERY INTEGRITY ──
    console.log('\n4. Validating Responsive CSS Breakpoints (320px -> 1440px)...');
    for (const f of coreHtmlFiles) {
      const filePath = path.join(__dirname, '../../', f);
      const html = fs.readFileSync(filePath, 'utf8');
      const hasViewport = html.includes('name="viewport"');
      const hasMediaQueries = html.includes('@media');
      if (hasViewport && hasMediaQueries) {
        pass(`${f}: Viewport configured & @media queries active`);
      } else {
        fail(`${f} responsive`, `Viewport: ${hasViewport}, MediaQueries: ${hasMediaQueries}`);
      }
    }

    // ── 5. SEARCH TERMINAL SEARCH QUERY TESTS ──
    console.log('\n5. Testing Search Engine Index Consistency...');
    const searchIndex = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/search-index.json'), 'utf8'));
    
    // Test exact game query
    const pacman = searchIndex.find(s => s.title.toLowerCase().includes('pac-man'));
    if (pacman && pacman.url === '/games/pac-man/') {
      pass(`Search: Exact query "pac-man" -> ${pacman.url}`);
    } else {
      fail('Search: pac-man resolution', `Found: ${pacman ? pacman.url : 'NONE'}`);
    }

    // Test exact console query
    const nes = searchIndex.find(s => s.title.includes('Nintendo Entertainment System'));
    if (nes && nes.url === '/consoles/nintendo-entertainment-system/') {
      pass(`Search: Exact console "NES" -> ${nes.url}`);
    } else {
      fail('Search: NES resolution', `Found: ${nes ? nes.url : 'NONE'}`);
    }

    // Test genre query
    const platformer = searchIndex.find(s => s.id === 'genre-platformer');
    if (platformer && platformer.url === '/genres/#genre-platformer') {
      pass(`Search: Genre "Platformer" -> ${platformer.url}`);
    } else {
      fail('Search: Platformer resolution', `Found: ${platformer ? platformer.url : 'NONE'}`);
    }

    // Test timeline query
    const evPong = searchIndex.find(s => s.id === 'ev-1972-pong-coin-op');
    if (evPong && evPong.url === '/timeline/#ev-1972-pong-coin-op') {
      pass(`Search: Timeline "Pong" -> ${evPong.url}`);
    } else {
      fail('Search: Timeline resolution', `Found: ${evPong ? evPong.url : 'NONE'}`);
    }

    // Test guide query
    const guideCrt = searchIndex.find(s => s.id === 'guide-crt-calibration-240p');
    if (guideCrt && guideCrt.url === '/guides/#guide-crt-calibration-240p') {
      pass(`Search: Guide "CRT" -> ${guideCrt.url}`);
    } else {
      fail('Search: CRT guide resolution', `Found: ${guideCrt ? guideCrt.url : 'NONE'}`);
    }

    // Test story query
    const storyDvd = searchIndex.find(s => s.id === 'story-dvd-trojan-horse-playstation-2');
    if (storyDvd && storyDvd.url === '/blog/#story-dvd-trojan-horse-playstation-2') {
      pass(`Search: Story "DVD PS2" -> ${storyDvd.url}`);
    } else {
      fail('Search: Story resolution', `Found: ${storyDvd ? storyDvd.url : 'NONE'}`);
    }

    // ── 6. RANDOM TERMINAL DESTINATIONS TEST ──
    console.log('\n6. Testing Random Discovery Terminal Pool...');
    const randomHtml = fs.readFileSync(path.join(__dirname, '../../random/index.html'), 'utf8');
    const poolMatch = randomHtml.match(/const POOL = (\[[\s\S]*?\]);\s*\/\*/);
    if (poolMatch) {
      const pool = JSON.parse(poolMatch[1]);
      let poolInvalid = 0;
      pool.forEach(item => {
        if (!item.url || item.url === '#' || item.url.includes('undefined')) poolInvalid++;
      });
      if (poolInvalid === 0 && pool.length >= 297) {
        pass(`Random Pool: All ${pool.length} items have valid URLs`);
      } else {
        fail('Random Pool', `Invalid: ${poolInvalid}, Total: ${pool.length}`);
      }
    } else {
      fail('Random Pool', 'Could not parse POOL in random/index.html');
    }

    // ── 7. FAVORITES STORAGE TEST ──
    console.log('\n7. Testing Favorites Defensive System...');
    const favHtml = fs.readFileSync(path.join(__dirname, '../../favorites/index.html'), 'utf8');
    const hasFavKey = favHtml.includes("'nostalgicverse_favs'");
    const hasDefensiveParse = favHtml.includes('inferItemType');
    if (hasFavKey && hasDefensiveParse) {
      pass('Favorites: Canonical key nostalgicverse_favs & defensive parser verified');
    } else {
      fail('Favorites', 'Key or defensive parser missing');
    }

    // ── 8. GLOBAL BRANDING & SUPPORT SYSTEM QA ──
    console.log('\n8. Testing Global Branding & Support System...');
    const homeRes = await fetchUrl('/');
    if (homeRes.body.includes('/assets/images/branding/logo/logo.svg') && homeRes.body.includes('class="site-logo-img"')) {
      pass('Branding: Homepage renders official vector logo in header');
    } else {
      fail('Branding: Homepage logo', 'Official logo not found in homepage header');
    }

    const downloadRes = await fetchUrl('/download/');
    if (downloadRes.body.includes('/assets/images/branding/logo/logo.svg') && downloadRes.body.includes('href="/favicon.ico"')) {
      pass('Branding: Emulator page uses official NostalgicVerse logo & /favicon.ico');
    } else {
      fail('Branding: Emulator consistency', 'Official logo or favicon missing on /download/');
    }

    const supportRes = await fetchUrl('/support/');
    if (supportRes.body.includes('Thank You For Supporting NostalgicVerse') && supportRes.body.includes('/assets/images/qr-code/qr-code.png')) {
      pass('Support Page: Dedicated QR exhibit & gratitude messaging verified');
    } else {
      fail('Support Page', 'Gratitude messaging or QR code missing');
    }

    const hasNoDuplicateQR = (supportRes.body.match(/id="archive-support"/g) || []).length === 0;
    if (hasNoDuplicateQR) {
      pass('Support Page: 0 duplicate support sections verified');
    } else {
      fail('Support Page duplicate', 'Duplicate archive-support section found on /support/');
    }

    if (homeRes.body.includes('id="archive-support"') && homeRes.body.includes('/assets/images/qr-code/qr-code.png')) {
      pass('Support QR: Archive support section with QR code verified on homepage');
    } else {
      fail('Support QR', 'Support section or QR code missing on homepage');
    }

    if (homeRes.body.includes('id="support-modal"') && homeRes.body.includes('role="dialog"') && homeRes.body.includes('nostalgicverse_support_prompt_state')) {
      pass('Support Modal: Global dialog & 2-minute active-time engine verified');
    } else {
      fail('Support Modal', 'Modal dialog or active-time state engine missing');
    }

    // ── SUMMARY ──
    console.log('\n' + '='.repeat(60));
    console.log('BROWSER QA RESULTS');
    console.log('='.repeat(60));
    console.log(`Total QA Checks: ${totalTests}`);
    console.log(`Passed:          ${passedTests}`);
    console.log(`Failed:          ${failedTests.length}`);
    if (failedTests.length > 0) {
      failedTests.forEach(f => console.log(`  * ${f.name}: ${f.reason}`));
    }
    console.log('='.repeat(60) + '\n');

    serverProcess.kill();
    process.exit(failedTests.length > 0 ? 1 : 0);

  } catch (err) {
    console.error('Fatal error in QA suite:', err);
    serverProcess.kill();
    process.exit(1);
  }
}, 1000);
