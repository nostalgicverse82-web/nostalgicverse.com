const fs = require('fs');
const path = require('path');
const { dbAsync } = require('../../server/db/index.cjs');

async function buildSearchIndex() {
  const root = path.resolve(__dirname, '../..');
  console.log('Building search index from canonical database source...');
  
  const searchIndex = [];

  try {
    const games = await dbAsync.all("SELECT id, title, slug, short_description as summary, release_year as year, publisher, developer, platforms FROM games WHERE status = 'PUBLISHED'");
    games.forEach(g => {
        searchIndex.push({
            id: g.id, type: 'game', typeName: 'Game', title: g.title,
            url: `/games/${g.slug}/`, year: g.year, category: g.publisher || g.developer || 'Game', 
            subtitle: 'Video Game', summary: g.summary, keywords: g.platforms ? JSON.parse(g.platforms) : []
        });
    });

    const consoles = await dbAsync.all("SELECT id, name as title, slug, description as summary, release_year as year, manufacturer as category FROM consoles WHERE status = 'PUBLISHED'");
    consoles.forEach(c => {
        searchIndex.push({
            id: c.id, type: 'console', typeName: 'Console', title: c.title,
            url: `/consoles/${c.slug}/`, year: c.year, category: c.category, subtitle: 'Hardware', summary: c.summary
        });
    });

    const timeline = await dbAsync.all("SELECT id, title, year, description as summary, category FROM timeline_events WHERE status = 'PUBLISHED'");
    timeline.forEach(t => {
        searchIndex.push({
            id: t.id, type: 'timeline', typeName: 'Timeline', title: t.title,
            url: `/timeline/#${t.id}`, year: t.year, category: t.category, subtitle: 'Milestone', summary: t.summary
        });
    });

    const genres = await dbAsync.all("SELECT id, name as title, slug, description as summary FROM genres WHERE status = 'PUBLISHED'");
    genres.forEach(g => {
        searchIndex.push({
            id: g.id, type: 'genre', typeName: 'Genre', title: g.title,
            url: `/genres/#${g.slug}`, category: 'Genre', subtitle: 'Mechanics', summary: g.summary
        });
    });

    const guides = await dbAsync.all("SELECT id, title, slug, excerpt as summary FROM guides WHERE status = 'PUBLISHED'");
    guides.forEach(g => {
        searchIndex.push({
            id: g.id, type: 'guide', typeName: 'Guide', title: g.title,
            url: `/guides/#guide-${g.slug}`, category: 'Preservation', subtitle: 'Guide', summary: g.summary
        });
    });

    const stories = await dbAsync.all("SELECT id, title, slug, excerpt as summary FROM stories WHERE status = 'PUBLISHED'");
    stories.forEach(s => {
        searchIndex.push({
            id: s.id, type: 'story', typeName: 'Story', title: s.title,
            url: `/blog/#story-${s.slug}`, category: 'Archival Story', subtitle: 'Story', summary: s.summary
        });
    });

    const outputPath = path.join(root, 'data/search-index.json');
    fs.writeFileSync(outputPath, JSON.stringify(searchIndex, null, 2), 'utf8');
    
    console.log(`Generated canonical search index with ${searchIndex.length} records.`);
    console.log('Saved to', outputPath);
    process.exit(0);
  } catch (err) {
    console.error('Error building search index:', err);
    process.exit(1);
  }
}

buildSearchIndex();
