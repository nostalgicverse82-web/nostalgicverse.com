/**
 * NostalgicVerse — Build Expanded Games Dataset
 * Merges all landmark expansion modules into data/games/{slug}.json,
 * rebuilds data/games.json, and synchronizes games/index.html.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

// 1. Source files for 113 expanded games
const sourceFiles = [
  'games-1970s.cjs',
  'games-1980s-p1.cjs',
  'games-1980s-p2.cjs',
  'games-1990s-p1.cjs',
  'games-1990s-p2.cjs',
  'games-2000s-p1.cjs',
  'games-2000s-p2.cjs',
  'games-2010s-2020s.cjs'
];

console.log('=== Step 1: Ingesting Modular Game Files ===');
const newGames = [];
sourceFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  const games = require(filePath);
  console.log(`- Loaded ${games.length} games from ${file}`);
  newGames.push(...games);
});

console.log(`Total new games loaded: ${newGames.length}`);

// 2. Write individual JSON records in data/games/{slug}.json
console.log('\n=== Step 2: Writing data/games/{slug}.json files ===');
const gamesDir = path.join(ROOT, 'data/games');
if (!fs.existsSync(gamesDir)) {
  fs.mkdirSync(gamesDir, { recursive: true });
}

newGames.forEach(game => {
  if (!game.$schema) {
    game.$schema = "https://nostalgicverse.com/schemas/game.schema.json";
  }
  if (!game.url) {
    game.url = `/games/${game.slug}/`;
  }
  const targetPath = path.join(gamesDir, `${game.slug}.json`);
  fs.writeFileSync(targetPath, JSON.stringify(game, null, 2), 'utf8');
});
console.log(`Wrote ${newGames.length} new game JSON files to data/games/`);

// 3. Collect ALL games from data/games/*.json (existing 30 + new 113 = 143)
console.log('\n=== Step 3: Loading ALL games from data/games/*.json ===');
const allGameFiles = fs.readdirSync(gamesDir).filter(f => f.endsWith('.json'));
console.log(`Found ${allGameFiles.length} files in data/games/`);

const allFullGames = allGameFiles.map(file => {
  const content = fs.readFileSync(path.join(gamesDir, file), 'utf8');
  return JSON.parse(content);
});

// Sort chronologically by year, then title
allFullGames.sort((a, b) => {
  if (a.originalReleaseYear !== b.originalReleaseYear) {
    return a.originalReleaseYear - b.originalReleaseYear;
  }
  return a.title.localeCompare(b.title);
});

// 4. Map into compact summary format for data/games.json and games/index.html
function formatReleaseDate(g) {
  if (g.exactReleaseDate) {
    try {
      const d = new Date(g.exactReleaseDate);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
      }
    } catch (e) {}
  }
  if (g.verifiedFactualData && g.verifiedFactualData.releaseDate) {
    return g.verifiedFactualData.releaseDate;
  }
  return String(g.originalReleaseYear);
}

const summaryGames = allFullGames.map(g => {
  return {
    id: g.id || `game-${g.slug}`,
    slug: g.slug,
    title: g.title,
    originalReleaseDate: formatReleaseDate(g),
    originalReleaseYear: g.originalReleaseYear,
    originalLaunchPlatform: g.originalLaunchPlatform,
    originalLaunchRegion: g.originalLaunchRegion || (g.platforms && g.platforms[0]) || "Worldwide",
    platforms: g.platforms || [g.originalLaunchPlatform],
    era: g.era,
    genre: g.genre,
    developer: g.developer,
    publisher: g.publisher || g.developer,
    image: (g.assets && g.assets.cover) || `/assets/images/games/${g.slug}.webp`,
    url: g.url || `/games/${g.slug}/`,
    shortDescription: g.shortDescription || (g.editorialContent && g.editorialContent.overview ? g.editorialContent.overview.slice(0, 180) + '...' : ''),
    historicalSignificance: g.historicalSignificance || (g.editorialContent && g.editorialContent.culturalImpact ? g.editorialContent.culturalImpact.slice(0, 180) + '...' : ''),
    keywords: g.keywords || [g.slug, g.developer, g.genre, String(g.originalReleaseYear)],
    featured: Boolean(g.featured)
  };
});

// 5. Rebuild data/games.json
console.log('\n=== Step 4: Rebuilding data/games.json ===');
const gamesMaster = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "NostalgicVerse Games Master Dataset",
  "description": "Canonical structured source data for video game exhibits, preserved records, and metadata.",
  "lastUpdated": new Date().toISOString().split('T')[0],
  "totalGames": summaryGames.length,
  "games": summaryGames
};

fs.writeFileSync(
  path.join(ROOT, 'data/games.json'),
  JSON.stringify(gamesMaster, null, 2),
  'utf8'
);
console.log(`Successfully updated data/games.json with ${summaryGames.length} games.`);

// 6. Update games/index.html
console.log('\n=== Step 5: Updating games/index.html ===');
const gamesIndexPath = path.join(ROOT, 'games/index.html');
let gamesHtml = fs.readFileSync(gamesIndexPath, 'utf8');

// Replace GAMES_DATA array
const gamesDataStart = gamesHtml.indexOf('const GAMES_DATA = [');
if (gamesDataStart === -1) {
  throw new Error('Could not find const GAMES_DATA in games/index.html');
}

// Find closing ]; for GAMES_DATA
const arrayEndMarker = '];\n\n      /* --------------------------------------------------------------------------\n         02. STORAGE ARCHITECTURE & FAVORITES COMPATIBILITY';
const gamesDataEnd = gamesHtml.indexOf(arrayEndMarker, gamesDataStart);

if (gamesDataEnd === -1) {
  // Try alternative marker
  const altMarker = 'FAV_STORAGE_KEY';
  const favIdx = gamesHtml.indexOf(altMarker, gamesDataStart);
  if (favIdx === -1) {
    throw new Error('Could not find end of GAMES_DATA in games/index.html');
  }
  const lastSemi = gamesHtml.lastIndexOf('];', favIdx);
  gamesHtml = gamesHtml.substring(0, gamesDataStart) +
    'const GAMES_DATA = ' + JSON.stringify(summaryGames, null, 2) + gamesHtml.substring(lastSemi);
} else {
  const newGamesDataCode = 'const GAMES_DATA = ' + JSON.stringify(summaryGames, null, 8);
  gamesHtml = gamesHtml.substring(0, gamesDataStart) + newGamesDataCode + gamesHtml.substring(gamesDataEnd);
}

// Update exhibitsOnDisk to include all 143 slugs
const allSlugs = summaryGames.map(g => g.slug);
const exhibitsRegex = /const exhibitsOnDisk = \[[^\]]*\];/;
const newExhibitsCode = `const exhibitsOnDisk = ${JSON.stringify(allSlugs)};`;
gamesHtml = gamesHtml.replace(exhibitsRegex, newExhibitsCode);

fs.writeFileSync(gamesIndexPath, gamesHtml, 'utf8');
console.log(`Successfully updated games/index.html with all ${allSlugs.length} exhibits!`);

console.log('\n=== Complete! ===');

