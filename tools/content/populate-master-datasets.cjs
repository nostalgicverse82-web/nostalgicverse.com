/**
 * NostalgicVerse — Populate Master Datasets
 * Synchronizes authoritative data from archive pages into structured JSON master datasets:
 * - data/games.json
 * - data/genres.json
 * - data/timeline.json
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');

function extractArray(filePath, varName) {
  const content = fs.readFileSync(filePath, 'utf8');
  const startIdx = content.indexOf(varName);
  if (startIdx === -1) throw new Error('Variable not found: ' + varName);
  const openBracket = content.indexOf('[', startIdx);
  let depth = 0;
  let inString = null;
  let endIdx = -1;
  for (let i = openBracket; i < content.length; i++) {
    const char = content[i];
    const prev = content[i - 1];
    if (inString) {
      if (char === inString && prev !== '\\') inString = null;
    } else {
      if (char === '"' || char === "'" || char === '`') {
        inString = char;
      } else if (char === '[') {
        depth++;
      } else if (char === ']') {
        depth--;
        if (depth === 0) {
          endIdx = i;
          break;
        }
      }
    }
  }
  if (endIdx === -1) throw new Error('Array end not found for: ' + varName);
  const arrayCode = content.substring(openBracket, endIdx + 1);
  return eval(arrayCode);
}

// 1. GAMES
const gamesData = extractArray(path.join(root, 'games/index.html'), 'GAMES_DATA');
console.log(`Loaded ${gamesData.length} games from games/index.html`);

const gamesMaster = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "NostalgicVerse Games Master Dataset",
  "description": "Canonical structured source data for video game exhibits, preserved records, and metadata.",
  "lastUpdated": "2026-09-10",
  "totalGames": gamesData.length,
  "games": gamesData
};

fs.writeFileSync(
  path.join(root, 'data/games.json'),
  JSON.stringify(gamesMaster, null, 2),
  'utf8'
);
console.log(`Successfully updated data/games.json (${gamesData.length} games)`);

// 2. GENRES
const genresData = extractArray(path.join(root, 'genres/index.html'), 'GENRES_DATA');
console.log(`Loaded ${genresData.length} genres from genres/index.html`);

const genresMaster = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "NostalgicVerse Genres Master Dataset",
  "description": "Canonical structured source data for genre taxonomy, mechanical traditions, and gameplay classifications.",
  "lastUpdated": "2026-09-10",
  "totalGenres": genresData.length,
  "genres": genresData
};

fs.writeFileSync(
  path.join(root, 'data/genres.json'),
  JSON.stringify(genresMaster, null, 2),
  'utf8'
);
console.log(`Successfully updated data/genres.json (${genresData.length} genres)`);

// 3. TIMELINE
const timelineData = extractArray(path.join(root, 'timeline/index.html'), 'TIMELINE_DATA');
console.log(`Loaded ${timelineData.length} timeline milestones from timeline/index.html`);

const timelineMaster = {
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "NostalgicVerse Timeline Master Dataset",
  "description": "Canonical structured source data for chronological milestones, industry turning points, and hardware launches.",
  "lastUpdated": "2026-09-10",
  "totalEvents": timelineData.length,
  "events": timelineData,
  "milestones": timelineData
};

fs.writeFileSync(
  path.join(root, 'data/timeline.json'),
  JSON.stringify(timelineMaster, null, 2),
  'utf8'
);
console.log(`Successfully updated data/timeline.json (${timelineData.length} milestones)`);

