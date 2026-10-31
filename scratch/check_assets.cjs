const fs = require('fs');
const path = require('path');
const root = 'd:/nostalgicverse1.com';

const genresHtml = fs.readFileSync(path.join(root, 'genres/index.html'), 'utf8');

const mediaIdx = genresHtml.indexOf('class="curated-card-media"');
if (mediaIdx !== -1) {
  console.log(genresHtml.slice(mediaIdx - 100, mediaIdx + 1200));
} else {
  // Search in scripts
  const scripts = genresHtml.match(/<script[\s\S]*?<\/script>/gi) || [];
  console.log('Searching in scripts...');
  scripts.forEach(s => {
    if (s.includes('curated-card-media') || s.includes('curated-genre-card')) {
      console.log('Script matches:', s.slice(0, 500));
    }
  });
}
