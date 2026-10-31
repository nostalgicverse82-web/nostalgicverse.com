const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const index = JSON.parse(fs.readFileSync(path.join(root, 'data/search-index.json'), 'utf8'));

function scoreItem(item, rawQuery, tokens) {
  if (!rawQuery || tokens.length === 0) return 0;
  const qLower = rawQuery.toLowerCase();
  const titleLower = (item.title || '').toLowerCase();
  let score = 0;

  const coreTitleLower = titleLower.replace(/^(sony|nintendo|sega|microsoft|atari|nec|snk|panasonic|mattel|magnavox)\s+/, '');

  if (titleLower === qLower || coreTitleLower === qLower) {
    score += 100;
  } else if (titleLower.startsWith(qLower) || coreTitleLower.startsWith(qLower)) {
    score += 60;
  } else if (titleLower.includes(qLower)) {
    score += 40;
  }

  if (item.aliases && Array.isArray(item.aliases)) {
    for (let i = 0; i < item.aliases.length; i++) {
      const aliasLower = item.aliases[i].toLowerCase();
      if (aliasLower === qLower) {
        score += 50;
        break;
      } else if (aliasLower.includes(qLower)) {
        score += 25;
        break;
      }
    }
  }

  tokens.forEach(t => {
    if (titleLower.includes(t)) score += 15;
  });

  const subtitleLower = (item.subtitle || '').toLowerCase();
  if (subtitleLower.includes(qLower)) {
    score += 20;
  } else {
    tokens.forEach(t => {
      if (subtitleLower.includes(t)) score += 8;
    });
  }

  const catLower = (item.category || '').toLowerCase();
  if (catLower.includes(qLower)) {
    score += 15;
  } else {
    tokens.forEach(t => {
      if (catLower.includes(t)) score += 6;
    });
  }

  if (item.year && String(item.year) === qLower) {
    score += 15;
  }

  if (item.keywords && Array.isArray(item.keywords)) {
    const kwJoined = item.keywords.join(' ').toLowerCase();
    if (kwJoined.includes(qLower)) {
      score += 10;
    } else {
      tokens.forEach(t => {
        if (kwJoined.includes(t)) score += 3;
      });
    }
  }

  const sumLower = (item.summary || '').toLowerCase();
  if (sumLower.includes(qLower)) {
    score += 5;
  }

  if (item.url && !item.url.includes('#')) {
    score += 5;
  }

  return score;
}

function testSearch(q) {
  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = index.filter(item => {
    const haystack = (
      item.title + ' ' +
      item.subtitle + ' ' +
      item.category + ' ' +
      (item.year || '') + ' ' +
      item.summary + ' ' +
      (item.keywords ? item.keywords.join(' ') : '')
    ).toLowerCase();
    return tokens.every(token => haystack.includes(token));
  });

  matches.forEach(m => {
    m._score = scoreItem(m, q, tokens);
  });
  matches.sort((a, b) => b._score - a._score);

  console.log(`Query: "${q}" -> ${matches.length} matches (sorted by relevance).`);
  matches.slice(0, 3).forEach(m => console.log(`  [Score ${m._score}] [${m.type.toUpperCase()}] ${m.title} (${m.subtitle})`));
}

testSearch('pac-man');
testSearch('playstation');
testSearch('crt');
testSearch('snes');
testSearch('doom');
testSearch('arcade classics');
testSearch('first home consoles');
