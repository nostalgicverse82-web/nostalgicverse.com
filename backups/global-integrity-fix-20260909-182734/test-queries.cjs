const fs = require('fs');
const path = require('path');

const index = JSON.parse(fs.readFileSync('d:/nostalgicverse1.com/data/search-index.json', 'utf8'));

function testSearch(q) {
  const tokens = q.toLowerCase().split(/\s+/);
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
  console.log(`Query: "${q}" -> ${matches.length} matches.`);
  matches.slice(0, 3).forEach(m => console.log(`  [${m.type.toUpperCase()}] ${m.title} (${m.subtitle})`));
}

testSearch('pac-man');
testSearch('playstation');
testSearch('crt');
testSearch('snes');
testSearch('doom');

