const fs = require('fs');
const path = require('path');

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

const root = 'd:/nostalgicverse1.com';
const games = extractArray(path.join(root, 'games/index.html'), 'GAMES_DATA');
const consoles = extractArray(path.join(root, 'consoles/index.html'), 'CONSOLES_DATA');
const genres = extractArray(path.join(root, 'genres/index.html'), 'GENRES_DATA');
const timeline = extractArray(path.join(root, 'timeline/index.html'), 'TIMELINE_DATA');
const guides = extractArray(path.join(root, 'guides/index.html'), 'GUIDES_DATA');
const stories = extractArray(path.join(root, 'blog/index.html'), 'STORIES_DATA');

console.log('Extracted counts:');
console.log('Games:', games.length);
console.log('Consoles:', consoles.length);
console.log('Genres:', genres.length);
console.log('Timeline:', timeline.length);
console.log('Guides:', guides.length);
console.log('Stories:', stories.length);

const masterIndex = [];

// 1. Games from main archive
games.forEach(g => {
  masterIndex.push({
    id: g.id,
    type: 'game',
    typeName: 'Game',
    title: g.title,
    url: g.url,
    year: g.originalReleaseYear,
    category: g.genre,
    subtitle: `${g.originalLaunchPlatform} · ${g.developer}`,
    summary: g.shortDescription || g.historicalSignificance || '',
    keywords: [g.genre, g.developer, g.publisher, g.originalLaunchPlatform, ...(g.platforms || []), ...(g.keywords || []), g.era].filter(Boolean)
  });
});

// 1b. Merge individual verified game exhibit records from /data/games/
const gamesDataDir = path.join(root, 'data/games');
if (fs.existsSync(gamesDataDir)) {
  const gameFiles = fs.readdirSync(gamesDataDir).filter(f => f.endsWith('.json'));
  gameFiles.forEach(f => {
    try {
      const g = JSON.parse(fs.readFileSync(path.join(gamesDataDir, f), 'utf8'));
      const canonicalRoute = `/games/${g.slug}/`;
      const existing = masterIndex.find(item => item.id === g.id || item.url === canonicalRoute || (item.type === 'game' && item.title.toLowerCase() === g.title.toLowerCase()));
      if (existing) {
        existing.url = canonicalRoute;
        existing.year = g.originalReleaseYear || existing.year;
        existing.category = g.genre || existing.category;
        existing.subtitle = `${g.originalLaunchPlatform || ''} · ${g.developer || ''}`;
        existing.summary = g.shortDescription || g.historicalSignificance || existing.summary;
        existing.keywords = Array.from(new Set([...(existing.keywords || []), ...(g.keywords || []), g.genre, g.developer, g.publisher, g.originalLaunchPlatform, ...(g.platforms || [])].filter(Boolean)));
      } else {
        masterIndex.push({
          id: g.id || `game-${g.slug}`,
          type: 'game',
          typeName: 'Game',
          title: g.title,
          url: canonicalRoute,
          year: g.originalReleaseYear,
          category: g.genre,
          subtitle: `${g.originalLaunchPlatform} · ${g.developer}`,
          summary: g.shortDescription || g.historicalSignificance || '',
          keywords: Array.from(new Set([g.genre, g.developer, g.publisher, g.originalLaunchPlatform, ...(g.platforms || []), ...(g.keywords || []), g.era].filter(Boolean)))
        });
      }
    } catch (e) {
      console.warn(`Warning: Could not parse ${f}:`, e.message);
    }
  });
}

// 2. Consoles
consoles.forEach(c => {
  masterIndex.push({
    id: c.id,
    type: 'console',
    typeName: 'Console',
    title: c.name,
    url: `/consoles/${c.slug}/`,
    year: c.originalReleaseYear,
    category: c.generation,
    subtitle: `${c.manufacturer} · Gen ${c.generationNumber || ''}`,
    summary: c.significance || `${c.name} released in ${c.originalReleaseYear} by ${c.manufacturer}.`,
    keywords: [c.manufacturer, c.generation, c.mediaFormat, ...(c.keyGames || []), ...(c.keywords || [])].filter(Boolean)
  });
});

// 3. Genres
genres.forEach(gn => {
  masterIndex.push({
    id: gn.id,
    type: 'genre',
    typeName: 'Genre',
    title: gn.name,
    url: `/genres/#genre-${gn.slug}`,
    year: gn.era || '',
    category: gn.family,
    subtitle: `${gn.type} · ${gn.family} Family`,
    summary: gn.shortDescription || gn.historicalDescription || '',
    keywords: [gn.family, gn.type, ...(gn.definingMechanics || []), ...(gn.landmarkGames || []), ...(gn.keywords || [])].filter(Boolean)
  });
});

// 4. Timeline
timeline.forEach(t => {
  masterIndex.push({
    id: t.id,
    type: 'timeline',
    typeName: 'Timeline',
    title: t.title,
    url: `/timeline/#${t.id}`,
    year: t.year,
    category: t.category,
    subtitle: `${t.year} · ${t.era}`,
    summary: t.description || t.significance || '',
    keywords: [t.era, t.category, ...(t.tags || []), t.relatedConsole, t.relatedGame].filter(Boolean)
  });
});

// 5. Guides
guides.forEach(gd => {
  masterIndex.push({
    id: gd.id,
    type: 'guide',
    typeName: 'Guide',
    title: gd.title,
    url: gd.url,
    year: gd.difficulty,
    category: gd.category,
    subtitle: `${gd.difficulty} · ${gd.system}`,
    summary: gd.summary,
    keywords: [gd.category, gd.difficulty, gd.system, ...(gd.topics || [])].filter(Boolean)
  });
});

// 6. Stories
stories.forEach(s => {
  masterIndex.push({
    id: s.id,
    type: 'story',
    typeName: 'Story',
    title: s.title,
    url: s.url,
    year: s.readingTime,
    category: s.category,
    subtitle: `${s.category} · ${s.era}`,
    summary: s.summary,
    keywords: [s.category, s.era, ...(s.topics || [])].filter(Boolean)
  });
});

console.log('Total Search Index Entries:', masterIndex.length);

fs.writeFileSync(
  path.join(root, 'data/search-index.json'),
  JSON.stringify(masterIndex, null, 2),
  'utf8'
);

console.log('Successfully saved to data/search-index.json');
