/**
 * NostalgicVerse — Comprehensive Media & Asset Audit Script
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

function walk(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'backups') continue;
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      walk(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  return fileList;
}

console.log('==================================================');
console.log('NOSTALGICVERSE MEDIA & ASSET COMPREHENSIVE AUDIT');
console.log('==================================================');

// 1. Inventory physical assets in assets/
const assetsDir = path.join(ROOT, 'assets');
const physicalAssets = walk(assetsDir).map(p => path.relative(ROOT, p).replace(/\\/g, '/'));

console.log('Total physical assets in /assets/: ' + physicalAssets.length);

const assetsByCategory = {};
for (const p of physicalAssets) {
  const parts = p.split('/');
  const sub = parts[2] || 'root';
  assetsByCategory[sub] = (assetsByCategory[sub] || 0) + 1;
}
console.log('Assets by subfolder in assets/images/:');
for (const [cat, count] of Object.entries(assetsByCategory)) {
  console.log('  - ' + cat + ': ' + count + ' files');
}

// 2. Check console assets in assets/images/consoles/
const consolesAssetDir = path.join(ROOT, 'assets/images/consoles');
const consoleFiles = fs.readdirSync(consolesAssetDir);
const consolePngs = consoleFiles.filter(f => f.endsWith('.png'));
const consoleWebps = consoleFiles.filter(f => f.endsWith('.webp'));
const consoleOthers = consoleFiles.filter(f => !f.endsWith('.png') && !f.endsWith('.webp'));

console.log('\nConsole image files:');
console.log('  PNG files:   ' + consolePngs.length);
console.log('  WebP files:  ' + consoleWebps.length);
console.log('  Other files: ' + consoleOthers.length);

// 3. Check consoles data & 65 consoles
const consolesData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/consoles.json'), 'utf8'));
const consolesList = consolesData.consoles;
console.log('\nTotal consoles in data/consoles.json: ' + consolesList.length);

let consolesWithPng = 0;
let consolesMissingPng = 0;
const missingConsoles = [];

for (const c of consolesList) {
  const expectedPng = c.slug + '.png';
  const fullPath = path.join(consolesAssetDir, expectedPng);
  if (fs.existsSync(fullPath)) {
    consolesWithPng++;
  } else {
    consolesMissingPng++;
    missingConsoles.push(c.slug);
  }
}
console.log('Consoles with PNG asset on disk: ' + consolesWithPng);
console.log('Consoles missing PNG asset on disk: ' + consolesMissingPng);
if (missingConsoles.length > 0) {
  console.log('Missing console PNGs: ' + missingConsoles.join(', '));
}

// Extra console PNGs on disk that are aliases or uncatalogued
const catalogSlugs = new Set(consolesList.map(c => c.slug));
const extraFiles = consolePngs.filter(f => !catalogSlugs.has(f.replace('.png', '')));
console.log('Extra PNG files (e.g. aliases): ' + extraFiles.join(', '));

// 4. Scan all HTML files for media references
const allHtmlFiles = walk(ROOT).filter(f => f.endsWith('.html'));
console.log('\nTotal HTML files scanned: ' + allHtmlFiles.length);

const mediaReferences = [];
const mediaRegex = /(?:src|href|content|data-image|poster)=["']([^"']+\.(?:png|webp|jpg|jpeg|svg|gif|ico|mp4|webm|mov|ogg|mp3|wav))["']/gi;

for (const htmlFile of allHtmlFiles) {
  const relPath = path.relative(ROOT, htmlFile).replace(/\\/g, '/');
  const content = fs.readFileSync(htmlFile, 'utf8');
  let match;
  while ((match = mediaRegex.exec(content)) !== null) {
    let mediaUrl = match[1];
    mediaReferences.push({
      file: relPath,
      url: mediaUrl,
      ext: path.extname(mediaUrl).toLowerCase()
    });
  }
}

console.log('Total media references found in HTML files: ' + mediaReferences.length);

// 5. Check for any video and audio references
const videoRefs = mediaReferences.filter(r => ['.mp4', '.webm', '.mov', '.ogg'].includes(r.ext));
const audioRefs = mediaReferences.filter(r => ['.mp3', '.wav'].includes(r.ext));
console.log('\nVideo references in HTML: ' + videoRefs.length);
videoRefs.forEach(r => console.log('  ' + r.file + ' -> ' + r.url));
console.log('Audio references in HTML: ' + audioRefs.length);
audioRefs.forEach(r => console.log('  ' + r.file + ' -> ' + r.url));

// Check <video, <audio, youtube, vimeo in HTML
let videoTags = 0;
let audioTags = 0;
let youtubeEmbeds = 0;
for (const htmlFile of allHtmlFiles) {
  const content = fs.readFileSync(htmlFile, 'utf8');
  if (/<video\b/i.test(content)) videoTags++;
  if (/<audio\b/i.test(content)) audioTags++;
  if (/youtube\.com|youtu\.be/i.test(content)) youtubeEmbeds++;
}
console.log('HTML <video> tags: ' + videoTags);
console.log('HTML <audio> tags: ' + audioTags);
console.log('YouTube embeds: ' + youtubeEmbeds);

// 6. Check for any news references
let newsReferences = 0;
for (const htmlFile of allHtmlFiles) {
  const content = fs.readFileSync(htmlFile, 'utf8');
  if (/\/news\//i.test(content)) {
    newsReferences++;
    console.log('Found /news/ reference in ' + path.relative(ROOT, htmlFile));
  }
}
console.log('Total /news/ route references across site: ' + newsReferences);

// 7. Check games image references
const gamesDataDir = path.join(ROOT, 'data/games');
const gameFiles = fs.readdirSync(gamesDataDir).filter(f => f.endsWith('.json'));
console.log('\nTotal game data files: ' + gameFiles.length);

const gamesAssetDir = path.join(ROOT, 'assets/images/games');
const gameAssetFiles = fs.existsSync(gamesAssetDir) ? fs.readdirSync(gamesAssetDir) : [];
console.log('Total files in assets/images/games/: ' + gameAssetFiles.length);

let gamesWithAsset = 0;
let gamesMissingAsset = 0;
const missingGameAssets = [];
for (const gf of gameFiles) {
  const gameData = JSON.parse(fs.readFileSync(path.join(gamesDataDir, gf), 'utf8'));
  const slug = gameData.slug || gf.replace('.json', '');
  const expectedWebp = slug + '.webp';
  const exists = fs.existsSync(path.join(gamesAssetDir, expectedWebp));
  if (exists) {
    gamesWithAsset++;
  } else {
    gamesMissingAsset++;
    missingGameAssets.push(slug);
  }
}
console.log('Games with asset on disk: ' + gamesWithAsset);
console.log('Games missing asset on disk: ' + gamesMissingAsset);
console.log('Missing game asset slugs (' + missingGameAssets.length + '): ' + missingGameAssets.join(', '));

// 8. Check genres
const genresDataPath = path.join(ROOT, 'data/genres.json');
if (fs.existsSync(genresDataPath)) {
  const genresData = JSON.parse(fs.readFileSync(genresDataPath, 'utf8'));
  console.log('\nTotal genres in data/genres.json: ' + (genresData.genres ? genresData.genres.length : genresData.length));
}
const genresAssetDir = path.join(ROOT, 'assets/images/genres');
console.log('assets/images/genres/ exists: ' + fs.existsSync(genresAssetDir));

// 9. Check timeline
const timelineDataPath = path.join(ROOT, 'data/timeline.json');
if (fs.existsSync(timelineDataPath)) {
  const timelineData = JSON.parse(fs.readFileSync(timelineDataPath, 'utf8'));
  console.log('\nTotal timeline events: ' + (timelineData.events ? timelineData.events.length : timelineData.length));
}
const timelineAssetDir = path.join(ROOT, 'assets/images/timeline');
console.log('assets/images/timeline/ exists: ' + fs.existsSync(timelineAssetDir));

// 10. Check guides
const guidesDataPath = path.join(ROOT, 'data/guides.json');
if (fs.existsSync(guidesDataPath)) {
  const guidesData = JSON.parse(fs.readFileSync(guidesDataPath, 'utf8'));
  console.log('\nTotal guides: ' + (guidesData.guides ? guidesData.guides.length : guidesData.length));
}
const guidesAssetDir = path.join(ROOT, 'assets/images/guides');
console.log('assets/images/guides/ exists: ' + fs.existsSync(guidesAssetDir));

// 11. Check stories
const storiesDataPath = path.join(ROOT, 'data/stories.json');
if (fs.existsSync(storiesDataPath)) {
  const storiesData = JSON.parse(fs.readFileSync(storiesDataPath, 'utf8'));
  console.log('\nTotal stories: ' + (storiesData.stories ? storiesData.stories.length : storiesData.length));
}
const storiesAssetDir = path.join(ROOT, 'assets/images/stories');
console.log('assets/images/stories/ exists: ' + fs.existsSync(storiesAssetDir));

// 12. Check branding
const brandingAssetDir = path.join(ROOT, 'assets/images/branding');
console.log('\nBranding files:');
if (fs.existsSync(brandingAssetDir)) {
  walk(brandingAssetDir).forEach(f => console.log('  - ' + path.relative(ROOT, f)));
}

// 13. Check operating-system
const osAssetDir = path.join(ROOT, 'assets/images/operating-system');
console.log('\nOperating System files:');
if (fs.existsSync(osAssetDir)) {
  walk(osAssetDir).forEach(f => console.log('  - ' + path.relative(ROOT, f)));
}

