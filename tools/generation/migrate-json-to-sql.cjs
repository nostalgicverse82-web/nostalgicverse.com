const fs = require('fs');
const path = require('path');
const { dbAsync } = require('../../server/db/index.cjs');

function loadJson(filename) {
    const p = path.join(__dirname, '../../data', filename);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function run() {
    console.log('Migrating JSON to SQLite...');

    // Games
    const gamesData = loadJson('games.json');
    if (gamesData && gamesData.games) {
        for (const g of gamesData.games) {
            await dbAsync.run(`
                INSERT OR IGNORE INTO games (id, slug, title, description, short_description, release_year, release_date, original_platform, platforms, developer, publisher, genre, subgenre, region, historical_significance, featured, local_image)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                g.id, g.slug, g.title, g.description, g.shortDescription, g.originalReleaseYear, g.originalReleaseDate, g.originalLaunchPlatform, JSON.stringify(g.platforms || []), g.developer, g.publisher, g.genre, g.subgenre, g.originalLaunchRegion, g.historicalSignificance, g.featured ? 1 : 0, g.localAssetPath || g.image
            ]);
        }
        console.log(`Migrated ${gamesData.games.length} games.`);
    }

    // Remote Images (game_images)
    const imagesData = loadJson('remote-game-images.json');
    if (imagesData && imagesData.games) {
        for (const slug of Object.keys(imagesData.games)) {
            const entry = imagesData.games[slug];
            const game = await dbAsync.get('SELECT id FROM games WHERE slug = ?', [slug]);
            if (game) {
                await dbAsync.run(`
                    INSERT OR IGNORE INTO game_images (id, game_id, image_url, image_type, source_url, source_domain, verification_status)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, [
                    'img_' + slug, game.id, entry.imageUrl || entry.localPath || entry.candidateUrl || '', entry.imageType || 'FALLBACK', entry.sourceUrl, entry.sourceDomain, entry.verificationStatus
                ]);
                
                // Update game table remote/local image if missing
                if (entry.imageType === 'local' && entry.localPath) {
                   await dbAsync.run('UPDATE games SET local_image = ? WHERE id = ?', [entry.localPath, game.id]);
                }
            }
        }
        console.log(`Migrated game images.`);
    }

    // Consoles
    const consolesData = loadJson('consoles.json');
    if (consolesData && consolesData.consoles) {
        for (const c of consolesData.consoles) {
            await dbAsync.run(`
                INSERT OR IGNORE INTO consoles (id, slug, name, description, manufacturer, release_year, generation, featured, local_image)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                c.id, c.slug, c.name, c.description, c.manufacturer, c.releaseYear, c.generation, c.featured ? 1 : 0, c.localAssetPath
            ]);
        }
        console.log(`Migrated ${consolesData.consoles.length} consoles.`);
    }

    // Genres
    const genresData = loadJson('genres.json');
    if (genresData && genresData.genres) {
        for (const g of genresData.genres) {
            await dbAsync.run(`
                INSERT OR IGNORE INTO genres (id, slug, name, description)
                VALUES (?, ?, ?, ?)
            `, [
                g.id, g.slug, g.name, g.description
            ]);
        }
        console.log(`Migrated ${genresData.genres.length} genres.`);
    }

    // Timeline
    const timelineData = loadJson('timeline.json');
    if (timelineData && timelineData.events) {
        for (const t of timelineData.events) {
            await dbAsync.run(`
                INSERT OR IGNORE INTO timeline_events (id, year, title, description, category)
                VALUES (?, ?, ?, ?, ?)
            `, [
                t.id, t.year, t.title, t.description, t.category
            ]);
        }
        console.log(`Migrated ${timelineData.events.length} timeline events.`);
    }
    
    // Stories
    const storiesData = loadJson('stories.json');
    if (storiesData && storiesData.stories) {
        for (const s of storiesData.stories) {
            await dbAsync.run(`
                INSERT OR IGNORE INTO stories (id, slug, title, excerpt, content, published_date)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [
                s.id, s.slug, s.title, s.excerpt, s.content, s.publishedDate
            ]);
        }
        console.log(`Migrated ${storiesData.stories.length} stories.`);
    }

    // Guides
    const guidesData = loadJson('guides.json');
    if (guidesData && guidesData.guides) {
        for (const g of guidesData.guides) {
            await dbAsync.run(`
                INSERT OR IGNORE INTO guides (id, slug, title, excerpt, content)
                VALUES (?, ?, ?, ?, ?)
            `, [
                g.id, g.slug, g.title, g.excerpt, g.content
            ]);
        }
        console.log(`Migrated ${guidesData.guides.length} guides.`);
    }
    
    // News
    const newsData = loadJson('news.json');
    if (newsData && newsData.articles) {
        for (const n of newsData.articles) {
            await dbAsync.run(`
                INSERT OR IGNORE INTO news_articles (id, title, summary, body, hero_image, tags, status, published_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                n.id, n.title, n.summary, n.body, n.heroImage, JSON.stringify(n.tags || []), n.status || 'PUBLISHED', n.publishedDate
            ]);
        }
        console.log(`Migrated ${newsData.articles.length} news articles.`);
    }

    console.log('Migration complete.');
    await dbAsync.close();
}

run().catch(console.error);

