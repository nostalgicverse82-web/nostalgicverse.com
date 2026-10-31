/**
 * NostalgicVerse — Synchronize Games Archive Page with Complete Game Catalogue
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const gamesPagePath = path.join(ROOT, 'games', 'index.html');
const masterGamesPath = path.join(ROOT, 'data', 'games.json');

const masterGames = JSON.parse(fs.readFileSync(masterGamesPath, 'utf8')).games;
let html = fs.readFileSync(gamesPagePath, 'utf8');

// Update GAMES_DATA in games/index.html
const startMarker = 'const GAMES_DATA = [';
const endMarker = '];\n\n      /* --------------------------------------------------------------------------\n         02. STORAGE ARCHITECTURE';

const sIdx = html.indexOf(startMarker);
const eIdx = html.indexOf(endMarker);

if (sIdx === -1 || eIdx === -1) {
  console.error('Failed to locate GAMES_DATA block in games/index.html');
  process.exit(1);
}

const newJsonStr = JSON.stringify(masterGames, null, 2);
const newBlock = 'const GAMES_DATA = ' + newJsonStr + ';';

html = html.substring(0, sIdx) + newBlock + html.substring(eIdx + 2);

fs.writeFileSync(gamesPagePath, html, 'utf8');
console.log(`Successfully synchronized games/index.html with ${masterGames.length} games.`);
