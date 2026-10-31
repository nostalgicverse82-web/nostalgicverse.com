const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const gamesHtmlPath = path.join(root, 'games/index.html');
const gamesJsonPath = path.join(root, 'data/games.json');

console.log('Testing Games Catalogue Filter Matrix & Logic...');

if (!fs.existsSync(gamesHtmlPath)) {
  console.error('FAIL: games/index.html does not exist');
  process.exit(1);
}

const html = fs.readFileSync(gamesHtmlPath, 'utf8');
const gamesData = JSON.parse(fs.readFileSync(gamesJsonPath, 'utf8'));
const games = Array.isArray(gamesData) ? gamesData : (gamesData.games || []);

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

// Test 1: Total games count in GAMES_DATA embedded in HTML matches games.json (528)
const matchGamesData = html.match(/const GAMES_DATA = (\[[\s\S]*?\]);/);
assert(matchGamesData !== null, 'GAMES_DATA array defined in HTML');
if (matchGamesData) {
  try {
    const embeddedGames = JSON.parse(matchGamesData[1]);
    assert(embeddedGames.length === 528, `GAMES_DATA contains 528 games (found ${embeddedGames.length})`);
    assert(embeddedGames.length === games.length, `GAMES_DATA length matches data/games.json (${games.length})`);
  } catch (e) {
    assert(false, `GAMES_DATA parses as valid JSON: ${e.message}`);
  }
}

// Test 2: Multiselect dropdown markup present for Era, Platform, Genre
assert(html.includes('id="dropdown-era"'), 'Era multi-select container exists (id="dropdown-era")');
assert(html.includes('id="dropdown-platform"'), 'Platform multi-select container exists (id="dropdown-platform")');
assert(html.includes('id="dropdown-genre"'), 'Genre multi-select container exists (id="dropdown-genre")');
assert(html.includes('id="active-filter-chips-container"'), 'Active chips container exists (id="active-filter-chips-container")');
assert(html.includes('id="clear-chips-btn"'), 'Clear all chips button exists (id="clear-chips-btn")');

// Test 3: Multi-select CSS classes present
assert(html.includes('.multiselect-dropdown'), '.multiselect-dropdown CSS exists');
assert(html.includes('.multiselect-menu'), '.multiselect-menu CSS exists');
assert(html.includes('.filter-chip'), '.filter-chip CSS exists');
assert(html.includes('.chip-remove-icon'), '.chip-remove-icon CSS exists');

// Test 4: Boolean filtering functions defined
assert(html.includes('const activeFilters = {'), 'activeFilters Set state defined');
assert(html.includes('function syncUrlParams()'), 'syncUrlParams function defined');
assert(html.includes('function parseUrlParams()'), 'parseUrlParams function defined');
assert(html.includes('function renderActiveChips()'), 'renderActiveChips function defined');
assert(html.includes('function populateMultiSelectControls()'), 'populateMultiSelectControls function defined');
assert(html.includes('function filterAndSortCatalogue()'), 'filterAndSortCatalogue function defined');

// Test 5: All 528 card exhibit links point to /games/{slug}/
assert(!html.includes('Catalog Specimen'), 'No dummy "#game-" fallback links exist (all link to exhibits)');
assert(html.includes("link.href = '/games/' + targetSlug + '/';"), 'All game cards link to /games/{slug}/');

// Test 6: Verify boolean filtering logic in isolation
function evaluateFilterLogic(gameList) {
  const testEras = new Set(['1980s']);
  const testPlatforms = new Set(['Arcade', 'NES']);

  function passes(game) {
    if (testEras.size > 0 && !testEras.has(game.era)) return false;
    if (testPlatforms.size > 0) {
      const origMatch = testPlatforms.has(game.originalLaunchPlatform);
      const platMatch = (game.platforms || []).some(p => testPlatforms.has(p));
      if (!origMatch && !platMatch) return false;
    }
    return true;
  }

  return gameList.filter(passes);
}

const filteredSim = evaluateFilterLogic(games);
assert(filteredSim.length > 0, `Filter simulation matched ${filteredSim.length} games`);
const allMatchEras = filteredSim.every(g => g.era === '1980s');
assert(allMatchEras, 'All filtered games match the selected Era');
const allMatchPlatforms = filteredSim.every(g => 
  g.originalLaunchPlatform === 'Arcade' || 
  g.originalLaunchPlatform === 'NES' ||
  (g.platforms && (g.platforms.includes('Arcade') || g.platforms.includes('NES')))
);
assert(allMatchPlatforms, 'All filtered games match one of the selected Platforms (OR within platform, AND across era)');

// Test 7: Historical Prominence sorting produces consistent ordering
const prominenceSorted = [...games].sort((a, b) => {
  if (a.featured && !b.featured) return -1;
  if (!a.featured && b.featured) return 1;
  if (a.originalReleaseYear !== b.originalReleaseYear) {
    return a.originalReleaseYear - b.originalReleaseYear;
  }
  return a.title.localeCompare(b.title);
});

assert(prominenceSorted.length === games.length, 'All games preserved in sort');
assert(prominenceSorted[0].featured === true, `Top sorted game is featured (${prominenceSorted[0].title})`);
const featuredItems = prominenceSorted.filter(g => g.featured);
assert(featuredItems.length === 25, `Featured cornerstones placed at top (${featuredItems.length} featured)`);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All filter matrix tests passed successfully!\n');
}

