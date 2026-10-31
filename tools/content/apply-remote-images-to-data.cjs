/**
 * NostalgicVerse — Apply Verified Remote Images to Game Data Records
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const manifestPath = path.join(ROOT, 'data', 'remote-game-images.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).games;

// 1. Update individual data/games/{slug}.json files
const gamesDir = path.join(ROOT, 'data', 'games');
const files = fs.readdirSync(gamesDir).filter(f => f.endsWith('.json'));

let individualCount = 0;
files.forEach(f => {
  const filePath = path.join(gamesDir, f);
  const game = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const slug = game.slug;

  if (manifest[slug]) {
    const entry = manifest[slug];
    if (!game.assets) game.assets = {};

    if (entry.status === 'local-verified') {
      game.assets.localAssetPath = entry.localPath;
    } else if (entry.status === 'verified' && entry.imageUrl) {
      game.assets.remoteImageUrl = entry.imageUrl;
      game.assets.remoteImage = {
        url: entry.imageUrl,
        sourceUrl: entry.sourceUrl,
        sourceDomain: entry.sourceDomain,
        license: entry.license,
        status: entry.status
      };
    }
    fs.writeFileSync(filePath, JSON.stringify(game, null, 2), 'utf8');
    individualCount++;
  }
});

console.log(`Updated ${individualCount} individual game data files.`);

// 2. Update data/games.json
const masterPath = path.join(ROOT, 'data', 'games.json');
const masterData = JSON.parse(fs.readFileSync(masterPath, 'utf8'));

let masterCount = 0;
masterData.games.forEach(game => {
  const slug = game.slug;
  if (manifest[slug]) {
    const entry = manifest[slug];
    if (entry.status === 'local-verified') {
      game.localAssetPath = entry.localPath;
      game.image = entry.localPath;
      masterCount++;
    } else if (entry.status === 'verified' && entry.imageUrl) {
      game.remoteImageUrl = entry.imageUrl;
      game.image = entry.imageUrl;
      masterCount++;
    }
  }
});

fs.writeFileSync(masterPath, JSON.stringify(masterData, null, 2), 'utf8');
console.log(`Updated ${masterCount} game records in data/games.json.`);

