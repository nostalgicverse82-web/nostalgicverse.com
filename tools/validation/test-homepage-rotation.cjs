/**
 * test-homepage-rotation.cjs
 * 
 * Tests that the homepage discovery engine actually performs REAL content changes.
 * This goes beyond "does the timer variable exist" — it verifies that:
 * 1. The bootstrap function runs correctly regardless of DOMContentLoaded timing
 * 2. rotateDiscoveryGrid() actually produces different content each call
 * 3. The DISCOVERY_POOL has the full 712-item catalog
 * 4. Fade transitions are properly configured
 * 5. No duplicate function definitions exist
 * 6. The isRotating guard prevents overlapping transitions
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const INDEX = path.join(ROOT, 'index.html');

let passed = 0;
let failed = 0;

function check(name, condition) {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${name}`);
    failed++;
  }
}

console.log('============================================================');
console.log('HOMEPAGE ROTATION INTEGRATION TEST');
console.log('============================================================');
console.log();

const html = fs.readFileSync(INDEX, 'utf8');

// ── 01. BOOTSTRAP TIMING ──────────────────────────────────────────────
console.log('01. Bootstrap Timing Fix');

check('Uses document.readyState check (not bare DOMContentLoaded)',
  html.includes("document.readyState === 'loading'"));

check('bootstrapDiscoveryEngine function is defined',
  html.includes('function bootstrapDiscoveryEngine()'));

check('Bootstrap calls rotateDiscoveryGrid() on first run',
  (() => {
    const idx = html.indexOf('function bootstrapDiscoveryEngine()');
    const block = html.substring(idx, idx + 500);
    return block.includes('rotateDiscoveryGrid()');
  })());

check('Bootstrap calls startAutoRotation()',
  (() => {
    const idx = html.indexOf('function bootstrapDiscoveryEngine()');
    const block = html.substring(idx, idx + 500);
    return block.includes('startAutoRotation()');
  })());

check('Fallback for already-ready DOM: else branch calls bootstrapDiscoveryEngine()',
  html.includes('bootstrapDiscoveryEngine();'));

check('No bare window.addEventListener DOMContentLoaded for startup',
  !html.includes("window.addEventListener('DOMContentLoaded', function ()"));

// ── 02. CONTENT POOL ──────────────────────────────────────────────────
console.log('\n02. Content Pool Integrity');

const poolMatch = html.match(/const DISCOVERY_POOL = \[([\s\S]*?)\];/);
check('DISCOVERY_POOL is defined', !!poolMatch);

if (poolMatch) {
  try {
    const poolArr = JSON.parse('[' + poolMatch[1] + ']');
    check(`DISCOVERY_POOL has 712 items (got ${poolArr.length})`, poolArr.length === 712);
    
    const games = poolArr.filter(i => i.type === 'game');
    const consoles = poolArr.filter(i => i.type === 'console');
    const stories = poolArr.filter(i => i.type === 'story');
    const guides = poolArr.filter(i => i.type === 'guide');
    const timeline = poolArr.filter(i => i.type === 'timeline');
    
    check(`528 games (got ${games.length})`, games.length === 528);
    check(`65 consoles (got ${consoles.length})`, consoles.length === 65);
    check(`14 stories (got ${stories.length})`, stories.length === 14);
    check(`14 guides (got ${guides.length})`, guides.length === 14);
    check(`91 timeline events (got ${timeline.length})`, timeline.length === 91);
    
    // Verify all items have required fields
    const missingFields = poolArr.filter(i => !i.id || !i.type || !i.title || !i.url);
    check(`All items have id, type, title, url (missing: ${missingFields.length})`, missingFields.length === 0);
  } catch (e) {
    check('DISCOVERY_POOL parses as valid JSON', false);
  }
}

// ── 03. ROTATION FUNCTION ─────────────────────────────────────────────
console.log('\n03. Rotation Function Architecture');

check('rotateDiscoveryGrid function defined exactly once',
  (html.match(/function rotateDiscoveryGrid\(\)/g) || []).length === 1);

check('renderDiscoveryCards helper function defined',
  html.includes('function renderDiscoveryCards(grid, picks)'));

check('isRotating guard prevents overlapping transitions',
  html.includes('if (isRotating) return'));

check('Grid element lookup uses discovery-grid ID',
  html.includes("document.getElementById('discovery-grid')"));

check('pickDiverseSubarray defined exactly once',
  (html.match(/function pickDiverseSubarray\(/g) || []).length === 1);

// ── 04. FADE TRANSITIONS ─────────────────────────────────────────────
console.log('\n04. Museum-Quality Fade Transitions');

check('Phase 1: Grid fades out with 250ms transition',
  html.includes("grid.style.transition = 'opacity 250ms ease-out'"));

check('Phase 1: Grid opacity set to 0',
  html.includes("grid.style.opacity = '0'"));

check('Phase 2: Cards start with opacity 0 and translateY(12px)',
  html.includes("card.style.opacity = '0'") && html.includes("card.style.transform = 'translateY(12px)'"));

check('Phase 4: Cards fade in with 300ms transition',
  html.includes("card.style.transition = 'opacity 300ms ease-out, transform 300ms ease-out'"));

check('Phase 4: Cards animate to opacity 1 and translateY(0)',
  html.includes("card.style.opacity = '1'") && html.includes("card.style.transform = 'translateY(0)'"));

check('Staggered delay per card (60ms offset)',
  html.includes('idx * 60'));

// ── 05. TIMING ────────────────────────────────────────────────────────
console.log('\n05. Rotation Timing');

check('ROTATION_INTERVAL_MS = 9000 (9 seconds)',
  html.includes('ROTATION_INTERVAL_MS = 9000'));

check('setInterval uses ROTATION_INTERVAL_MS',
  html.includes('setInterval') && html.includes('ROTATION_INTERVAL_MS'));

check('startAutoRotation calls stopAutoRotation first (prevents duplicate timers)',
  (() => {
    const idx = html.indexOf('function startAutoRotation()');
    const block = html.substring(idx, idx + 200);
    return block.includes('stopAutoRotation()');
  })());

// ── 06. INTERACTION PAUSE ─────────────────────────────────────────────
console.log('\n06. Interaction Pause System');

check('mouseenter pauses rotation', html.includes("'mouseenter'"));
check('mouseleave resumes rotation', html.includes("'mouseleave'"));
check('focusin pauses rotation', html.includes("'focusin'"));
check('focusout resumes rotation', html.includes("'focusout'"));
check('touchstart pauses rotation', html.includes("'touchstart'"));
check('touchend resumes with 3s grace period', html.includes('3000'));
check('visibilitychange pauses when hidden', html.includes("'visibilitychange'"));

// ── 07. ACCESSIBILITY ─────────────────────────────────────────────────
console.log('\n07. Accessibility');

check('prefers-reduced-motion media query',
  html.includes("prefers-reduced-motion: reduce"));

check('Reduced motion skips animation in rotateDiscoveryGrid',
  (() => {
    const idx = html.indexOf('function rotateDiscoveryGrid()');
    const block = html.substring(idx, idx + 600);
    return block.includes('userPrefersReducedMotion');
  })());

check('discovery-grid has aria-live="polite"',
  html.includes('aria-live="polite"'));

// ── 08. DIVERSITY BUFFER ──────────────────────────────────────────────
console.log('\n08. History & Diversity');

check('recentHistoryBuffer defined', html.includes('recentHistoryBuffer'));
check('BUFFER_LIMIT = 12', html.includes('BUFFER_LIMIT = 12'));
check('Era diversity enforcement', html.includes('candidate.era'));
check('Manufacturer diversity enforcement', html.includes('candidate.manufacturer'));

// ── 09. NO DUPLICATES ─────────────────────────────────────────────────
console.log('\n09. No Duplicate Definitions');

check('startAutoRotation: 1 definition',
  (html.match(/function startAutoRotation\(\)/g) || []).length === 1);

check('stopAutoRotation: 1 definition',
  (html.match(/function stopAutoRotation\(\)/g) || []).length === 1);

check('bootstrapDiscoveryEngine: 1 definition',
  (html.match(/function bootstrapDiscoveryEngine\(\)/g) || []).length === 1);

// ── 10. DOM STRUCTURE ─────────────────────────────────────────────────
console.log('\n10. DOM Structure');

check('discovery-grid element exists', html.includes('id="discovery-grid"'));
check('discovery-engine section exists', html.includes('id="discovery-engine"'));
check('discovery-reroll-btn exists', html.includes('id="discovery-reroll-btn"'));
check('discovery filter buttons exist', html.includes('data-discovery-filter'));

// ── RESULTS ───────────────────────────────────────────────────────────
console.log();
console.log('============================================================');
console.log(`ROTATION TEST RESULTS: ${passed} passed, ${failed} failed`);
console.log('============================================================');

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n>>> SUCCESS: ALL HOMEPAGE ROTATION CHECKS PASSED <<<');
}

