const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const indexHtmlPath = path.join(root, 'index.html');

console.log('Testing Homepage 9-Second Rotating Discovery Engine...');

if (!fs.existsSync(indexHtmlPath)) {
  console.error('FAIL: index.html does not exist');
  process.exit(1);
}

const html = fs.readFileSync(indexHtmlPath, 'utf8');

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

// 1. Extract DISCOVERY_POOL
const matchPool = html.match(/const DISCOVERY_POOL = (\[[\s\S]*?\]);/);
assert(matchPool !== null, 'DISCOVERY_POOL defined in index.html');

if (matchPool) {
  try {
    const pool = JSON.parse(matchPool[1]);
    assert(pool.length >= 700, `DISCOVERY_POOL contains 700+ specimens (found ${pool.length})`);
    
    const types = new Set(pool.map(item => item.type));
    assert(types.has('game'), 'Pool contains Games');
    assert(types.has('console'), 'Pool contains Consoles');
    assert(types.has('story'), 'Pool contains Stories');
    assert(types.has('guide'), 'Pool contains Guides');
    assert(types.has('timeline'), 'Pool contains Timeline Milestones');

    const gameCount = pool.filter(i => i.type === 'game').length;
    const consoleCount = pool.filter(i => i.type === 'console').length;
    const storyCount = pool.filter(i => i.type === 'story').length;
    const guideCount = pool.filter(i => i.type === 'guide').length;
    const timelineCount = pool.filter(i => i.type === 'timeline').length;

    assert(gameCount === 528, `Games count in pool is 528 (found ${gameCount})`);
    assert(consoleCount === 65, `Consoles count in pool is 65 (found ${consoleCount})`);
    assert(storyCount === 14, `Stories count in pool is 14 (found ${storyCount})`);
    assert(guideCount === 14, `Guides count in pool is 14 (found ${guideCount})`);
    assert(timelineCount === 91, `Timeline events count in pool is 91 (found ${timelineCount})`);
  } catch (e) {
    assert(false, `DISCOVERY_POOL parses as valid JSON: ${e.message}`);
  }
}

// 2. Toolbar controls
assert(html.includes('data-discovery-filter="all"'), 'Toolbar has All filter');
assert(html.includes('data-discovery-filter="game"'), 'Toolbar has Games filter');
assert(html.includes('data-discovery-filter="console"'), 'Toolbar has Consoles filter');
assert(html.includes('data-discovery-filter="story"'), 'Toolbar has Stories filter');
assert(html.includes('data-discovery-filter="guide"'), 'Toolbar has Guides filter');
assert(html.includes('data-discovery-filter="timeline"'), 'Toolbar has Timeline filter');

// 3. CSS badge styling
assert(html.includes('.badge-game'), 'CSS has .badge-game');
assert(html.includes('.badge-console'), 'CSS has .badge-console');
assert(html.includes('.badge-story'), 'CSS has .badge-story');
assert(html.includes('.badge-guide'), 'CSS has .badge-guide');
assert(html.includes('.badge-timeline'), 'CSS has .badge-timeline');

// 4. Auto-rotation cadence (9000ms)
assert(html.includes('ROTATION_INTERVAL_MS = 9000'), 'Rotation interval is exactly 9000ms (9 seconds)');
assert(html.includes('autoRotateTimer = setInterval('), 'Auto-rotate timer setup via setInterval');

// 5. prefers-reduced-motion accessibility
assert(html.includes("window.matchMedia('(prefers-reduced-motion: reduce)')"), 'Reduced motion media query checked');
assert(html.includes('userPrefersReducedMotion'), 'userPrefersReducedMotion handled in rotation control');

// 6. Interactive pause handlers
assert(html.includes("mouseenter"), 'mouseenter pause listener present');
assert(html.includes("mouseleave"), 'mouseleave resume listener present');
assert(html.includes("focusin"), 'focusin pause listener present');
assert(html.includes("focusout"), 'focusout resume listener present');
assert(html.includes("touchstart"), 'touchstart pause listener present');
assert(html.includes("visibilitychange"), 'visibilitychange pause listener present');

// 7. Diversity buffer
assert(html.includes('recentHistoryBuffer'), 'recentHistoryBuffer defined');
assert(html.includes('BUFFER_LIMIT = 12'), 'Diversity buffer limit is 12 items');
assert(html.includes('pickDiverseSubarray'), 'pickDiverseSubarray function defined');

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('Discovery Engine tests passed successfully!\n');
}

