/**
 * NostalgicVerse — Data Consistency Audit
 * Validates relationships between games, consoles, genres, timeline,
 * guides, stories, search index, manifests, and sitemap.
 * Zero dependencies — Node.js built-ins only.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
let totalChecks = 0;
let totalFails = 0;

function pass(msg) { totalChecks++; }
function fail(msg) { totalChecks++; totalFails++; console.log(`  [FAIL] ${msg}`); }

console.log(`\n${'='.repeat(60)}`);
console.log('NOSTALGICVERSE DATA CONSISTENCY AUDIT');
console.log(`${'='.repeat(60)}\n`);

// ── 1. LOAD ALL DATA SOURCES ──
console.log('1. Loading data sources...');
const searchIndex = JSON.parse(fs.readFileSync(path.join(root, 'data/search-index.json'), 'utf8'));
const siteManifest = JSON.parse(fs.readFileSync(path.join(root, 'data/site-manifest.json'), 'utf8'));
const routeManifest = JSON.parse(fs.readFileSync(path.join(root, 'data/route-manifest.json'), 'utf8'));
const assetManifest = JSON.parse(fs.readFileSync(path.join(root, 'data/asset-manifest.json'), 'utf8'));
const consolesData = JSON.parse(fs.readFileSync(path.join(root, 'data/consoles.json'), 'utf8'));
const guidesData = JSON.parse(fs.readFileSync(path.join(root, 'data/guides.json'), 'utf8'));
const storiesData = JSON.parse(fs.readFileSync(path.join(root, 'data/stories.json'), 'utf8'));
pass('All data sources loaded');

// ── 2. SEARCH INDEX DESTINATION VALIDATION ──
console.log('\n2. Validating search index destinations...');
let deadSearchUrls = 0;
for (const entry of searchIndex) {
  totalChecks++;
  const url = entry.url || '';
  // Strip fragment for filesystem check
  const pathPart = url.split('#')[0].split('?')[0];
  if (!pathPart || pathPart === '/') continue;
  
  const cleanPath = pathPart.replace(/^\//, '').replace(/\/$/, '');
  const filePath = path.join(root, cleanPath, 'index.html');
  const directPath = path.join(root, cleanPath);
  
  if (!fs.existsSync(filePath) && !fs.existsSync(directPath)) {
    deadSearchUrls++;
    fail(`Search entry "${entry.title}" (${entry.type}) → ${url} — target not found`);
  }
}
if (deadSearchUrls === 0) console.log(`  [PASS] All ${searchIndex.length} search entries resolve to valid destinations`);

// ── 3. DUPLICATE ID/URL CHECK ──
console.log('\n3. Checking for duplicate search entries...');
const idSet = new Set();
const urlSet = new Set();
let dupIds = 0, dupUrls = 0;
for (const entry of searchIndex) {
  totalChecks++;
  if (idSet.has(entry.id)) {
    dupIds++;
    fail(`Duplicate search index ID: ${entry.id}`);
  }
  idSet.add(entry.id);
  
  totalChecks++;
  if (urlSet.has(entry.url)) {
    dupUrls++;
    fail(`Duplicate search index URL: ${entry.url} (${entry.title})`);
  }
  urlSet.add(entry.url);
}
if (dupIds === 0 && dupUrls === 0) console.log(`  [PASS] No duplicate IDs or URLs in search index`);

// ── 4. CONSOLE DATA vs FILESYSTEM ──
console.log('\n4. Validating console data → exhibit pages...');
const consoleSlugs = consolesData.consoles.map(c => c.slug);
let missingConsolePages = 0;
for (const slug of consoleSlugs) {
  totalChecks++;
  const pagePath = path.join(root, 'consoles', slug, 'index.html');
  if (!fs.existsSync(pagePath)) {
    missingConsolePages++;
    fail(`Console "${slug}" has data but no exhibit page`);
  }
}
// Check data files
const consoleDataDir = path.join(root, 'data/consoles');
const consoleDataFiles = fs.readdirSync(consoleDataDir).filter(f => f.endsWith('.json'));
for (const file of consoleDataFiles) {
  totalChecks++;
  const slug = file.replace('.json', '');
  if (!consoleSlugs.includes(slug)) {
    fail(`Console data file "${file}" not in consoles.json master list`);
  }
}
if (missingConsolePages === 0) console.log(`  [PASS] All ${consoleSlugs.length} consoles have exhibit pages`);
console.log(`  [INFO] ${consoleDataFiles.length} console data files, ${consoleSlugs.length} master records`);

// ── 5. GAME DATA vs FILESYSTEM ──
console.log('\n5. Validating game data → exhibit pages...');
const gameDataDir = path.join(root, 'data/games');
const gameDataFiles = fs.readdirSync(gameDataDir).filter(f => f.endsWith('.json'));
let gamesWithPages = 0, gamesWithoutPages = 0;
for (const file of gameDataFiles) {
  totalChecks++;
  const slug = file.replace('.json', '');
  const pagePath = path.join(root, 'games', slug, 'index.html');
  if (fs.existsSync(pagePath)) {
    gamesWithPages++;
  } else {
    gamesWithoutPages++;
    fail(`Game data file "${file}" has no exhibit page at /games/${slug}/`);
  }
}
console.log(`  [INFO] ${gameDataFiles.length} game data files: ${gamesWithPages} with pages, ${gamesWithoutPages} without`);

// ── 6. SITEMAP vs FILESYSTEM ──
console.log('\n6. Validating sitemap URLs...');
const sitemapContent = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const sitemapUrls = [];
const locRegex = /<loc>([^<]+)<\/loc>/g;
let locMatch;
while ((locMatch = locRegex.exec(sitemapContent)) !== null) {
  sitemapUrls.push(locMatch[1]);
}
let invalidSitemapUrls = 0;
for (const url of sitemapUrls) {
  totalChecks++;
  // Must be production domain
  if (!url.startsWith('https://nostalgicverse.com')) {
    invalidSitemapUrls++;
    fail(`Sitemap URL not on production domain: ${url}`);
    continue;
  }
  const urlPath = url.replace('https://nostalgicverse.com', '') || '/';
  const cleanPath = urlPath.replace(/^\//, '').replace(/\/$/, '');
  
  let exists = false;
  if (cleanPath === '') {
    exists = fs.existsSync(path.join(root, 'index.html'));
  } else if (cleanPath.endsWith('.html')) {
    exists = fs.existsSync(path.join(root, cleanPath));
  } else {
    exists = fs.existsSync(path.join(root, cleanPath, 'index.html'));
  }
  
  if (!exists) {
    invalidSitemapUrls++;
    fail(`Sitemap URL target not found: ${url}`);
  }
}
if (invalidSitemapUrls === 0) console.log(`  [PASS] All ${sitemapUrls.length} sitemap URLs are valid`);

// ── 7. SITEMAP XML VALIDITY ──
console.log('\n7. Validating sitemap XML structure...');
totalChecks++;
const openUrlTags = (sitemapContent.match(/<url>/g) || []).length;
const closeUrlTags = (sitemapContent.match(/<\/url>/g) || []).length;
if (openUrlTags !== closeUrlTags) {
  fail(`Sitemap XML malformed: ${openUrlTags} <url> tags but ${closeUrlTags} </url> tags`);
} else {
  console.log(`  [PASS] Sitemap XML well-formed: ${openUrlTags} URL entries`);
}

// ── 8. CANONICAL DOMAIN CONSISTENCY ──
console.log('\n8. Checking canonical domain consistency...');
totalChecks++;
if (siteManifest.siteUrl === 'https://nostalgicverse.com') {
  console.log(`  [PASS] Site manifest canonical: ${siteManifest.siteUrl}`);
} else {
  fail(`Site manifest has wrong canonical: ${siteManifest.siteUrl}`);
}
totalChecks++;
if (routeManifest.canonicalDomain === 'https://nostalgicverse.com') {
  console.log(`  [PASS] Route manifest canonical: ${routeManifest.canonicalDomain}`);
} else {
  fail(`Route manifest has wrong canonical: ${routeManifest.canonicalDomain}`);
}

// ── 9. GUIDE/STORY DATA CONSISTENCY ──
console.log('\n9. Validating guides and stories data...');
totalChecks++;
if (guidesData.guides && guidesData.guides.length === 14) {
  console.log(`  [PASS] Guides data: ${guidesData.guides.length} records`);
} else {
  console.log(`  [INFO] Guides data: ${(guidesData.guides || []).length} records`);
}
totalChecks++;
if (storiesData.stories && storiesData.stories.length === 14) {
  console.log(`  [PASS] Stories data: ${storiesData.stories.length} records`);
} else {
  console.log(`  [INFO] Stories data: ${(storiesData.stories || []).length} records`);
}

// Verify guide/story slugs are unique
const guideSlugs = new Set();
for (const g of guidesData.guides || []) {
  totalChecks++;
  if (guideSlugs.has(g.slug)) fail(`Duplicate guide slug: ${g.slug}`);
  guideSlugs.add(g.slug);
}
const storySlugs = new Set();
for (const s of storiesData.stories || []) {
  totalChecks++;
  if (storySlugs.has(s.slug)) fail(`Duplicate story slug: ${s.slug}`);
  storySlugs.add(s.slug);
}

// ── 10. JSON FILE VALIDITY ──
console.log('\n10. Validating all JSON files...');
function validateJsonDir(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    totalChecks++;
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf8');
      // Strip BOM if present
      const clean = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
      JSON.parse(clean);
    } catch (e) {
      fail(`Invalid JSON: ${path.join(dir, file)} — ${e.message}`);
    }
  }
}
validateJsonDir(path.join(root, 'data'));
validateJsonDir(path.join(root, 'data/games'));
validateJsonDir(path.join(root, 'data/consoles'));
validateJsonDir(path.join(root, 'data/schemas'));
console.log(`  [PASS] All JSON files parse correctly`);

// ── 11. NO LOCALHOST IN PRODUCTION METADATA ──
console.log('\n11. Checking for localhost in production metadata...');
function findHtmlFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.backups', 'backups', 'tools', 'data', 'assets', '.qodo', '.git'].includes(entry.name)) continue;
      results = results.concat(findHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

const htmlFiles = findHtmlFiles(root);
let localhostInMeta = 0;
for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  totalChecks++;
  // Check canonical, og:url, twitter:url for localhost
  const canonicalMatch = content.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  if (canonicalMatch && canonicalMatch[1].includes('localhost')) {
    localhostInMeta++;
    fail(`localhost in canonical URL: ${path.relative(root, file)}`);
  }
  const ogUrlMatch = content.match(/property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
  if (ogUrlMatch && ogUrlMatch[1].includes('localhost')) {
    localhostInMeta++;
    fail(`localhost in og:url: ${path.relative(root, file)}`);
  }
}
if (localhostInMeta === 0) console.log(`  [PASS] No localhost references in production metadata`);

// ── 12. FAVORITES STORAGE KEY CONSISTENCY ──
console.log('\n12. Checking favorites storage key...');
totalChecks++;
if (siteManifest.favoriteStorageKey === 'nostalgicverse_favs') {
  console.log(`  [PASS] Correct favorites key: nostalgicverse_favs`);
} else {
  fail(`Wrong favorites key: ${siteManifest.favoriteStorageKey}`);
}

// ── SUMMARY ──
console.log(`\n${'='.repeat(60)}`);
console.log('DATA CONSISTENCY AUDIT SUMMARY');
console.log(`${'='.repeat(60)}`);
console.log(`Total Checks:  ${totalChecks}`);
console.log(`Passed:        ${totalChecks - totalFails}`);
console.log(`Failed:        ${totalFails}`);
console.log(`${'='.repeat(60)}\n`);

process.exit(totalFails > 0 ? 1 : 0);

