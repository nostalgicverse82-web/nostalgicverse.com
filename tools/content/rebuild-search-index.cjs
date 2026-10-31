#!/usr/bin/env node
/**
 * NostalgicVerse — Atomic Search Index Rebuilder (Phase 15)
 * 
 * Rebuilds data/search-index.json strictly from CANONICAL PUBLISHED RECORDS:
 * - Games
 * - Consoles
 * - Timeline Events
 * - Genres
 * - Guides
 * - Stories
 * - News Articles
 * 
 * Guarantees:
 * - Atomic write via temporary file swapping (.tmp -> .json)
 * - Validation of document count & parseability before replacement
 * - Inclusion of aliases and regional titles where present
 * - Zero downtime / zero corrupted search states
 */

const fs = require('fs');
const path = require('path');
const { dbAsync, db } = require('../../server/db/connection.cjs');

const ROOT = path.resolve(__dirname, '../..');
const TARGET_FILE = path.join(ROOT, 'data/search-index.json');
const TEMP_FILE = path.join(ROOT, 'data/search-index.json.tmp');

async function rebuildSearchIndex() {
    console.log('======================================================================');
    console.log('NOSTALGICVERSE — ATOMIC SEARCH INDEX REBUILD');
    console.log('======================================================================');
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    const searchIndex = [];

    // 1. Games (Published only)
    const games = await dbAsync.all(`
        SELECT id, title, slug, short_description as summary, release_year as year,
               publisher, developer, platforms, alternate_titles, genre
        FROM games 
        WHERE status = 'PUBLISHED'
        ORDER BY release_year ASC, title ASC
    `);

    games.forEach(g => {
        let keywords = [];
        try {
            if (g.platforms) {
                const parsed = JSON.parse(g.platforms);
                if (Array.isArray(parsed)) keywords.push(...parsed);
            }
        } catch (e) {}

        if (g.alternate_titles) {
            keywords.push(...g.alternate_titles.split(',').map(s => s.trim()));
        }
        if (g.genre) keywords.push(g.genre);

        searchIndex.push({
            id: g.id,
            type: 'game',
            typeName: 'Game',
            title: g.title,
            url: `/games/${g.slug}/`,
            year: g.year,
            category: g.publisher || g.developer || 'Game',
            subtitle: 'Video Game',
            summary: g.summary || `${g.title} (${g.year})`,
            keywords: [...new Set(keywords.filter(Boolean))]
        });
    });

    // 2. Consoles (Published only)
    const consoles = await dbAsync.all(`
        SELECT id, name as title, slug, description as summary, release_year as year, manufacturer as category 
        FROM consoles 
        WHERE status = 'PUBLISHED'
        ORDER BY release_year ASC
    `);

    consoles.forEach(c => {
        searchIndex.push({
            id: c.id,
            type: 'console',
            typeName: 'Console',
            title: c.title,
            url: `/consoles/${c.slug}/`,
            year: c.year,
            category: c.category || 'Hardware',
            subtitle: 'Console',
            summary: c.summary || `${c.title} hardware platform.`
        });
    });

    // 3. Timeline Events (Published only)
    const timeline = await dbAsync.all(`
        SELECT id, title, year, description as summary, category 
        FROM timeline_events 
        WHERE status = 'PUBLISHED'
        ORDER BY year ASC
    `);

    timeline.forEach(t => {
        searchIndex.push({
            id: t.id,
            type: 'timeline',
            typeName: 'Timeline',
            title: t.title,
            url: `/timeline/#${t.id}`,
            year: t.year,
            category: t.category || 'History',
            subtitle: 'Milestone',
            summary: t.summary || ''
        });
    });

    // 4. Genres (Published only)
    const genres = await dbAsync.all(`
        SELECT id, name as title, slug, description as summary 
        FROM genres 
        WHERE status = 'PUBLISHED'
        ORDER BY name ASC
    `);

    genres.forEach(g => {
        searchIndex.push({
            id: g.id,
            type: 'genre',
            typeName: 'Genre',
            title: g.title,
            url: `/genres/#${g.slug}`,
            category: 'Genre',
            subtitle: 'Mechanics',
            summary: g.summary || ''
        });
    });

    // 5. Guides (Published only)
    const guides = await dbAsync.all(`
        SELECT id, title, slug, excerpt as summary 
        FROM guides 
        WHERE status = 'PUBLISHED'
        ORDER BY title ASC
    `);

    guides.forEach(g => {
        searchIndex.push({
            id: g.id,
            type: 'guide',
            typeName: 'Guide',
            title: g.title,
            url: `/guides/#guide-${g.slug}`,
            category: 'Preservation',
            subtitle: 'Guide',
            summary: g.summary || ''
        });
    });

    // 6. Stories (Published only)
    const stories = await dbAsync.all(`
        SELECT id, title, slug, excerpt as summary 
        FROM stories 
        WHERE status = 'PUBLISHED'
        ORDER BY title ASC
    `);

    stories.forEach(s => {
        searchIndex.push({
            id: s.id,
            type: 'story',
            typeName: 'Story',
            title: s.title,
            url: `/blog/#story-${s.slug}`,
            category: 'Archival Story',
            subtitle: 'Story',
            summary: s.summary || ''
        });
    });

    // 7. News Articles (Published only)
    const news = await dbAsync.all(`
        SELECT id, title, slug, summary, published_date, factual_status 
        FROM news_articles 
        WHERE status = 'PUBLISHED'
        ORDER BY published_date DESC
    `);

    news.forEach(n => {
        searchIndex.push({
            id: n.id,
            type: 'news',
            typeName: 'News',
            title: n.title,
            url: `/news/#${n.slug || n.id}`,
            year: n.published_date ? new Date(n.published_date).getFullYear() : null,
            category: n.factual_status || 'News',
            subtitle: 'Archive Dispatch',
            summary: n.summary || ''
        });
    });

    console.log(`Compiled ${searchIndex.length} canonical search documents:`);
    console.log(`  - Games: ${games.length}`);
    console.log(`  - Consoles: ${consoles.length}`);
    console.log(`  - Timeline: ${timeline.length}`);
    console.log(`  - Genres: ${genres.length}`);
    console.log(`  - Guides: ${guides.length}`);
    console.log(`  - Stories: ${stories.length}`);
    console.log(`  - News: ${news.length}\n`);

    if (searchIndex.length < 50) {
        throw new Error(`Sanity check failed: Rebuilt index record count (${searchIndex.length}) is unexpectedly low.`);
    }

    // Step 1: Write to temporary file
    const serialized = JSON.stringify(searchIndex, null, 2);
    fs.writeFileSync(TEMP_FILE, serialized, 'utf8');

    // Step 2: Validate written file
    const readBack = JSON.parse(fs.readFileSync(TEMP_FILE, 'utf8'));
    if (!Array.isArray(readBack) || readBack.length !== searchIndex.length) {
        if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE);
        throw new Error('Validation failed on temp search index file. Atomic swap aborted.');
    }

    // Step 3: Atomic swap
    fs.renameSync(TEMP_FILE, TARGET_FILE);
    console.log(`[SUCCESS] Atomically updated ${TARGET_FILE} (${(Buffer.byteLength(serialized) / 1024).toFixed(1)} KB)`);
    console.log('======================================================================\n');

    return { total: searchIndex.length, path: TARGET_FILE };
}

if (require.main === module) {
    rebuildSearchIndex().then(() => {
        db.close();
        process.exit(0);
    }).catch(err => {
        console.error('Fatal search rebuild failure:', err);
        if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE);
        db.close();
        process.exit(1);
    });
}

module.exports = { rebuildSearchIndex };

