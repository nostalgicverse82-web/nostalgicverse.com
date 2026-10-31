const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');

const pagesToAudit = [
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
  'download/index.html',
  'about/index.html',
  'support/index.html',
  '404.html'
];

// Add generated game exhibit pages
const gameSlugs = [
  'pac-man', 'space-invaders', 'pong', 'donkey-kong', 'galaga',
  'tetris', 'super-mario-bros', 'the-legend-of-zelda', 'doom', 'street-fighter-ii',
  'asteroids', 'ms-pac-man', 'frogger', 'defender', 'contra',
  'sonic-the-hedgehog', 'super-metroid', 'pokemon-red-blue', 'final-fantasy-vii', 'minecraft',
  'castlevania-symphony-of-the-night', 'resident-evil', 'the-legend-of-zelda-ocarina-of-time',
  'metal-gear-solid', 'half-life', 'grand-theft-auto-iii', 'the-sims', 'wii-sports', 'portal',
  'the-elder-scrolls-v-skyrim'
];
gameSlugs.forEach(s => pagesToAudit.push(`games/${s}/index.html`));

// Add generated console exhibit pages
const consolesDir = path.join(ROOT, 'consoles');
if (fs.existsSync(consolesDir)) {
  const consoleSlugs = fs.readdirSync(consolesDir).filter(f => {
    try {
      return fs.statSync(path.join(consolesDir, f)).isDirectory() && fs.existsSync(path.join(consolesDir, f, 'index.html'));
    } catch (e) {
      return false;
    }
  });
  consoleSlugs.forEach(s => pagesToAudit.push(`consoles/${s}/index.html`));
}

console.log('==================================================');
console.log('NOSTALGICVERSE RESPONSIVE ARCHITECTURE AUDIT');
console.log('==================================================\n');

let totalChecks = 0;
let passCount = 0;
let warnCount = 0;

pagesToAudit.forEach(relPath => {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`MISSING: ${relPath}`);
    return;
  }

  const content = fs.readFileSync(fullPath, 'utf8');
  console.log(`Checking: ${relPath}`);

  // 1. Viewport Meta Tag
  totalChecks++;
  const hasViewport = /<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width/i.test(content);
  if (hasViewport) {
    passCount++;
    console.log(`  [PASS] Viewport meta tag present and configured.`);
  } else {
    warnCount++;
    console.warn(`  [WARN] Missing standard viewport meta tag.`);
  }

  // 2. Media Queries Count & Breakpoints
  totalChecks++;
  const mediaQueries = content.match(/@media[^{]+{/g) || [];
  const hasSmallBreakpoint = mediaQueries.some(mq => /max-width:\s*(480px|500px|600px|768px|900px|960px|991px)/i.test(mq));
  if (hasSmallBreakpoint) {
    passCount++;
    console.log(`  [PASS] Responsive media queries detected (${mediaQueries.length} rules).`);
  } else {
    warnCount++;
    console.warn(`  [WARN] Few or no mobile media queries detected.`);
  }

  // 3. Mobile Header & Drawer Navigation
  totalChecks++;
  const hasMenuToggle = /class=["'][^"']*(menu-toggle|nav-toggle|mobile-nav)[^"']*["']/i.test(content);
  const hasDrawer = /id=["'][^"']*(drawer|mobile-nav)[^"']*["']/i.test(content);
  if (hasMenuToggle && hasDrawer) {
    passCount++;
    console.log(`  [PASS] Mobile header toggle button & drawer element found.`);
  } else {
    warnCount++;
    console.log(`  [INFO] Dedicated mobile drawer not detected (desktop-nav or utility page layout).`);
  }

  // 4. Fixed width check that might cause horizontal overflow on 320px
  totalChecks++;
  const dangerousFixedStyles = content.match(/width:\s*([4-9]\d\d|1\d\d\d)px(?!;[^}]*max-width)/g) || [];
  if (dangerousFixedStyles.length === 0) {
    passCount++;
    console.log(`  [PASS] No dangerous fixed pixel widths without max-width bounds.`);
  } else {
    console.log(`  [NOTE] Fixed widths detected: ${dangerousFixedStyles.slice(0, 3).join(', ')}`);
  }

  // 5. Overflow handling on body
  totalChecks++;
  const hasOverflowX = content.includes('overflow-x');
  if (hasOverflowX) {
    passCount++;
    console.log(`  [PASS] Explicit overflow-x control detected in stylesheet.`);
  } else {
    console.log(`  [NOTE] No explicit overflow-x rule on body.`);
  }

  console.log('');
});

console.log('==================================================');
console.log(`SUMMARY: ${totalChecks} checks across ${pagesToAudit.length} pages.`);
console.log(`Passed: ${passCount}`);
console.log(`Warnings/Notes: ${warnCount}`);
console.log('==================================================');

