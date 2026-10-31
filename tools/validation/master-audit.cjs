/**
 * NostalgicVerse Master Production Audit & Validation Tool
 * 
 * Verifies:
 * - Single HTML document roots (1x DOCTYPE, 1x HTML, 1x HEAD, 1x BODY)
 * - Zero markdown code fences
 * - Zero malformed/unclosed comments
 * - Required semantic elements (<title>, <h1>)
 * - Zero external runtime dependencies (CDNs, remote scripts, remote CSS)
 * - Zero runtime AI endpoints or exposed credentials
 * - Strict canonical storage key: 'nostalgicverse_favs'
 * - Clean JavaScript syntax in inline scripts
 * - Valid canonical URLs & JSON-LD structured data
 * - Integrity of all JSON datasets and schemas
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');
let totalFailures = 0;
let totalChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (!condition) {
    totalFailures++;
    console.error(`  [FAIL] ${message}`);
  } else {
    console.log(`  [PASS] ${message}`);
  }
}

// 1. Audit Public HTML Pages
console.log('\n==================================================');
console.log('1. AUDITING PUBLIC HTML PAGES');
console.log('==================================================');

const publicPages = [
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
  'games/pac-man/index.html',
  'games/space-invaders/index.html',
  'games/pong/index.html',
  'games/donkey-kong/index.html',
  'games/galaga/index.html',
  'games/tetris/index.html',
  'games/super-mario-bros/index.html',
  'games/the-legend-of-zelda/index.html',
  'games/doom/index.html',
  'games/street-fighter-ii/index.html',
  'games/asteroids/index.html',
  'games/ms-pac-man/index.html',
  'games/frogger/index.html',
  'games/defender/index.html',
  'games/contra/index.html',
  'games/sonic-the-hedgehog/index.html',
  'games/super-metroid/index.html',
  'games/pokemon-red-blue/index.html',
  'games/final-fantasy-vii/index.html',
  'games/minecraft/index.html',
  'games/castlevania-symphony-of-the-night/index.html',
  'games/resident-evil/index.html',
  'games/the-legend-of-zelda-ocarina-of-time/index.html',
  'games/metal-gear-solid/index.html',
  'games/half-life/index.html',
  'games/grand-theft-auto-iii/index.html',
  'games/the-sims/index.html',
  'games/wii-sports/index.html',
  'games/portal/index.html',
  'games/the-elder-scrolls-v-skyrim/index.html'
];

// Add all generated console exhibit pages
const consolesDir = path.join(ROOT, 'consoles');
if (fs.existsSync(consolesDir)) {
  const consoleSlugs = fs.readdirSync(consolesDir).filter(f => {
    try {
      return fs.statSync(path.join(consolesDir, f)).isDirectory() && fs.existsSync(path.join(consolesDir, f, 'index.html'));
    } catch (e) {
      return false;
    }
  });
  consoleSlugs.forEach(s => publicPages.push(`consoles/${s}/index.html`));
}

// Add all generated game exhibit pages
const gamesDir = path.join(ROOT, 'games');
if (fs.existsSync(gamesDir)) {
  const gameSlugs = fs.readdirSync(gamesDir).filter(f => {
    try {
      return fs.statSync(path.join(gamesDir, f)).isDirectory() && fs.existsSync(path.join(gamesDir, f, 'index.html'));
    } catch (e) {
      return false;
    }
  });
  gameSlugs.forEach(s => {
    const p = `games/${s}/index.html`;
    if (!publicPages.includes(p)) publicPages.push(p);
  });
}

publicPages.forEach(relPath => {
  const fullPath = path.join(ROOT, relPath);
  console.log(`\nAuditing: ${relPath}`);
  
  if (!fs.existsSync(fullPath)) {
    assert(false, `File exists: ${relPath}`);
    return;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Document structure
  const doctypes = (content.match(/<!DOCTYPE html>/gi) || []).length;
  const htmlOpens = (content.match(/<html[\s>]/gi) || []).length;
  const htmlCloses = (content.match(/<\/html>/gi) || []).length;
  const headOpens = (content.match(/<head[\s>]/gi) || []).length;
  const headCloses = (content.match(/<\/head>/gi) || []).length;
  const bodyOpens = (content.match(/<body[\s>]/gi) || []).length;
  const bodyCloses = (content.match(/<\/body>/gi) || []).length;
  
  assert(doctypes === 1, `Single <!DOCTYPE html> (found: ${doctypes})`);
  assert(htmlOpens === 1 && htmlCloses === 1, `Single <html> tag pair (opens: ${htmlOpens}, closes: ${htmlCloses})`);
  assert(headOpens === 1 && headCloses === 1, `Single <head> tag pair (opens: ${headOpens}, closes: ${headCloses})`);
  assert(bodyOpens === 1 && bodyCloses === 1, `Single <body> tag pair (opens: ${bodyOpens}, closes: ${bodyCloses})`);

  // Code fences & comments
  const markdownFences = (content.match(/^\`\`\`/gm) || []).length;
  assert(markdownFences === 0, `Zero markdown code fences inside HTML (found: ${markdownFences})`);
  
  const unclosedComment = content.match(/<!--(?:(?!-->)[\s\S])*$/);
  assert(!unclosedComment, 'No unclosed HTML comments at end of file');

  // Semantic elements
  const hasTitle = /<title>[^<]+<\/title>/i.test(content);
  assert(hasTitle, 'Contains valid <title> tag');
  
  const hasH1 = /<h1[^>]*>[\s\S]*?<\/h1>/i.test(content);
  assert(hasH1, 'Contains valid <h1> heading');

  // Zero external runtime dependencies
  const extScripts = content.match(/<script[^>]+src=["']https?:\/\//gi);
  const extStyles = content.match(/<link[^>]+href=["']https?:\/\/[^>]+rel=["']stylesheet["']/gi);
  assert(!extScripts, `Zero external CDN scripts (found: ${extScripts ? extScripts.length : 0})`);
  assert(!extStyles, `Zero external stylesheets (found: ${extStyles ? extStyles.length : 0})`);

  // Zero AI API calls or secrets
  const aiApiMatch = content.match(/api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com/i);
  assert(!aiApiMatch, `Zero client-side AI API references`);

  const secretMatch = content.match(/sk-[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{35}/);
  assert(!secretMatch, `Zero exposed API tokens / credentials`);

  // Storage key compatibility
  if (content.includes('localStorage')) {
    assert(content.includes('nostalgicverse_favs'), `Uses canonical 'nostalgicverse_favs' key`);
  }

  // JavaScript syntax check
  const scripts = content.match(/<script(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/gi) || [];
  scripts.forEach((s, idx) => {
    const jsCode = s.replace(/<\/?script[^>]*>/gi, '');
    try {
      new Function(jsCode);
      assert(true, `Inline script #${idx + 1} syntax valid`);
    } catch (err) {
      assert(false, `Inline script #${idx + 1} syntax error: ${err.message}`);
    }
  });

  // Canonical tag & JSON-LD
  const canonicalMatch = content.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  assert(!!canonicalMatch && canonicalMatch[1].startsWith('https://nostalgicverse.com/'), `Canonical URL valid: ${canonicalMatch ? canonicalMatch[1] : 'missing'}`);

  const jsonLdMatch = content.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      JSON.parse(jsonLdMatch[1]);
      assert(true, 'JSON-LD structured data parses cleanly');
    } catch (err) {
      assert(false, `JSON-LD structured data invalid JSON: ${err.message}`);
    }
  }
});

// 2. Audit JSON Datasets & Schemas
console.log('\n==================================================');
console.log('2. AUDITING JSON DATASETS & SCHEMAS');
console.log('==================================================');

const jsonFiles = [
  'data/site-manifest.json',
  'data/route-manifest.json',
  'data/asset-manifest.json',
  'data/search-index.json',
  'data/guides.json',
  'data/stories.json',
  'data/schemas/game.schema.json',
  'data/schemas/console.schema.json',
  'data/schemas/genre.schema.json',
  'data/schemas/timeline.schema.json',
  'data/schemas/guide.schema.json',
  'data/schemas/story.schema.json',
  'data/games/pac-man.json',
  'data/games/space-invaders.json',
  'data/games/pong.json',
  'data/games/donkey-kong.json',
  'data/games/galaga.json',
  'data/games/tetris.json',
  'data/games/super-mario-bros.json',
  'data/games/the-legend-of-zelda.json',
  'data/games/doom.json',
  'data/games/street-fighter-ii.json',
  'data/games/asteroids.json',
  'data/games/ms-pac-man.json',
  'data/games/frogger.json',
  'data/games/defender.json',
  'data/games/contra.json',
  'data/games/sonic-the-hedgehog.json',
  'data/games/super-metroid.json',
  'data/games/pokemon-red-blue.json',
  'data/games/final-fantasy-vii.json',
  'data/games/minecraft.json',
  'data/games/castlevania-symphony-of-the-night.json',
  'data/games/resident-evil.json',
  'data/games/the-legend-of-zelda-ocarina-of-time.json',
  'data/games/metal-gear-solid.json',
  'data/games/half-life.json',
  'data/games/grand-theft-auto-iii.json',
  'data/games/the-sims.json',
  'data/games/wii-sports.json',
  'data/games/portal.json',
  'data/games/the-elder-scrolls-v-skyrim.json'
];

// Add all game JSON records
const gamesDataDir = path.join(ROOT, 'data/games');
if (fs.existsSync(gamesDataDir)) {
  const gFiles = fs.readdirSync(gamesDataDir).filter(f => f.endsWith('.json'));
  gFiles.forEach(f => {
    const p = `data/games/${f}`;
    if (!jsonFiles.includes(p)) jsonFiles.push(p);
  });
}

// Add all console JSON records
const consolesDataDir = path.join(ROOT, 'data/consoles');
if (fs.existsSync(consolesDataDir)) {
  const cFiles = fs.readdirSync(consolesDataDir).filter(f => f.endsWith('.json'));
  cFiles.forEach(f => {
    const p = `data/consoles/${f}`;
    if (!jsonFiles.includes(p)) jsonFiles.push(p);
  });
}

jsonFiles.forEach(relPath => {
  const fullPath = path.join(ROOT, relPath);
  if (!fs.existsSync(fullPath)) {
    assert(false, `JSON file exists: ${relPath}`);
    return;
  }
  try {
    const raw = fs.readFileSync(fullPath, 'utf8');
    JSON.parse(raw);
    assert(true, `JSON valid: ${relPath} (${raw.length} bytes)`);
  } catch (err) {
    assert(false, `JSON parse error in ${relPath}: ${err.message}`);
  }
});

// 3. Summary
console.log('\n==================================================');
console.log('AUDIT SUMMARY');
console.log('==================================================');
console.log(`Total Checks Run: ${totalChecks}`);
console.log(`Passed: ${totalChecks - totalFailures}`);
console.log(`Failed: ${totalFailures}`);

if (totalFailures === 0) {
  console.log('\n>>> SUCCESS: ALL AUDITS PASSED CLEANLY (EXIT CODE 0) <<<\n');
  process.exit(0);
} else {
  console.error(`\n>>> FAILURE: ${totalFailures} AUDIT CHECKS FAILED <<<\n`);
  process.exit(1);
}
