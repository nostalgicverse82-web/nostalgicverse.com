/**
 * NostalgicVerse — Museum Search Engine Service (Phase 17)
 * =========================================================
 * Provides index validation, atomic index rebuilds, and query autocomplete/suggestions.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { dbAsync } = require('../db/index.cjs');

const ROOT = path.resolve(__dirname, '../..');
const SEARCH_INDEX_PATH = path.join(ROOT, 'data/search-index.json');
const SEARCH_INDEX_TEMP = path.join(ROOT, 'data/search-index.json.tmp');

/**
 * Validate current search index integrity
 */
async function validateIndex() {
    if (!fs.existsSync(SEARCH_INDEX_PATH)) {
        return {
            status: 'MISSING',
            documentCount: 0,
            indexSizeBytes: 0,
            lastModified: null,
            issues: ['Search index file data/search-index.json does not exist.']
        };
    }

    try {
        const stat = fs.statSync(SEARCH_INDEX_PATH);
        const raw = fs.readFileSync(SEARCH_INDEX_PATH, 'utf8');
        const index = JSON.parse(raw);

        if (!Array.isArray(index)) {
            return {
                status: 'CORRUPTED',
                documentCount: 0,
                indexSizeBytes: stat.size,
                lastModified: stat.mtime.toISOString(),
                issues: ['Search index root is not a JSON array.']
            };
        }

        const breakdown = {};
        const issues = [];
        index.forEach((doc, idx) => {
            if (!doc.id || !doc.title || !doc.url) {
                if (issues.length < 5) issues.push(`Document at index ${idx} missing required fields (id, title, or url).`);
            }
            const type = doc.type || 'unknown';
            breakdown[type] = (breakdown[type] || 0) + 1;
        });

        return {
            status: issues.length === 0 ? 'HEALTHY' : 'WARNING',
            documentCount: index.length,
            indexSizeBytes: stat.size,
            lastModified: stat.mtime.toISOString(),
            breakdown,
            issues
        };
    } catch (err) {
        return {
            status: 'ERROR',
            documentCount: 0,
            indexSizeBytes: 0,
            lastModified: null,
            issues: [err.message]
        };
    }
}

/**
 * Atomically rebuild the search index from canonical SQLite records
 */
async function rebuildIndex() {
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
    try {
        const timeline = await dbAsync.all(`
            SELECT id, title, year, description as summary, category 
            FROM timeline_events 
            WHERE status = 'PUBLISHED'
        `);
        timeline.forEach(t => {
            searchIndex.push({
                id: t.id,
                type: 'timeline',
                typeName: 'Timeline Event',
                title: t.title,
                url: `/timeline/#${t.id}`,
                year: t.year,
                category: t.category || 'History',
                subtitle: 'Timeline Event',
                summary: t.summary || `${t.title} (${t.year})`
            });
        });
    } catch (e) {}

    // 4. Genres
    try {
        const genres = await dbAsync.all(`SELECT id, slug, name, description FROM genres`);
        genres.forEach(gn => {
            searchIndex.push({
                id: gn.id,
                type: 'genre',
                typeName: 'Genre',
                title: gn.name,
                url: `/genres/${gn.slug}/`,
                category: 'Genre',
                subtitle: 'Genre Exhibit',
                summary: gn.description || `${gn.name} video game genre.`
            });
        });
    } catch (e) {}

    // 5. Guides & Stories & News
    try {
        const stories = await dbAsync.all(`SELECT id, slug, title, excerpt FROM stories WHERE status = 'PUBLISHED'`);
        stories.forEach(s => {
            searchIndex.push({
                id: s.id,
                type: 'story',
                typeName: 'Story',
                title: s.title,
                url: `/stories/${s.slug}/`,
                category: 'Story',
                subtitle: 'Retrospective Story',
                summary: s.excerpt || s.title
            });
        });
    } catch (e) {}

    try {
        const guides = await dbAsync.all(`SELECT id, slug, title, excerpt FROM guides WHERE status = 'PUBLISHED'`);
        guides.forEach(gd => {
            searchIndex.push({
                id: gd.id,
                type: 'guide',
                typeName: 'Guide',
                title: gd.title,
                url: `/guides/${gd.slug}/`,
                category: 'Guide',
                subtitle: 'Preservation Guide',
                summary: gd.excerpt || gd.title
            });
        });
    } catch (e) {}

    try {
        const news = await dbAsync.all(`SELECT id, title, summary FROM news_articles WHERE status = 'PUBLISHED'`);
        news.forEach(n => {
            searchIndex.push({
                id: n.id,
                type: 'news',
                typeName: 'News',
                title: n.title,
                url: `/news/${n.id}/`,
                category: 'News',
                subtitle: 'Archival News',
                summary: n.summary || n.title
            });
        });
    } catch (e) {}

    // Atomic write via temp file
    fs.writeFileSync(SEARCH_INDEX_TEMP, JSON.stringify(searchIndex, null, 2), 'utf8');
    fs.renameSync(SEARCH_INDEX_TEMP, SEARCH_INDEX_PATH);

    return {
        success: true,
        count: searchIndex.length,
        rebuiltAt: new Date().toISOString()
    };
}

/**
 * Autocomplete suggestions for quick search bar dropdown
 */
async function suggest(query = '', limit = 8) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return [];

    const safeLimit = Math.min(parseInt(limit, 10) || 8, 20);

    if (fs.existsSync(SEARCH_INDEX_PATH)) {
        try {
            const raw = fs.readFileSync(SEARCH_INDEX_PATH, 'utf8');
            const index = JSON.parse(raw);

            const scoredMatches = [];
            for (const item of index) {
                const titleLower = (item.title || '').toLowerCase();
                const kwJoined = (item.keywords || []).join(' ').toLowerCase();
                const subLower = (item.subtitle || '').toLowerCase();
                const catLower = (item.category || '').toLowerCase();
                const sumLower = (item.summary || '').toLowerCase();

                let score = 0;
                if (titleLower.startsWith(q)) {
                    score += 100;
                } else if (titleLower.includes(' ' + q)) {
                    score += 80;
                } else if (titleLower.includes(q)) {
                    score += 60;
                }

                if (kwJoined.includes(q)) score += 40;
                if (subLower.includes(q) || catLower.includes(q)) score += 30;
                if (String(item.year) === q) score += 35;
                if (sumLower.includes(q)) score += 10;

                if (score > 0) {
                    scoredMatches.push({ item, score });
                }
            }

            scoredMatches.sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return (b.item.year || 0) - (a.item.year || 0);
            });

            return scoredMatches.slice(0, safeLimit).map(({ item: m }) => ({
                id: m.id,
                title: m.title,
                type: m.type,
                typeName: m.typeName || m.type,
                subtitle: m.subtitle || m.category || m.typeName,
                url: m.url,
                year: m.year
            }));
        } catch (e) {}
    }

    // Fallback to direct DB query
    const results = await dbAsync.all(`
        SELECT id, title, slug, 'game' as type, release_year as year, publisher as subtitle 
        FROM games 
        WHERE status = 'PUBLISHED' AND title LIKE ? 
        LIMIT ?
    `, [`%${q}%`, safeLimit]);

    return results.map(r => ({
        ...r,
        typeName: 'Game',
        url: `/games/${r.slug}/`
    }));
}

const service = {
    validateIndex,
    rebuildIndex,
    suggest
};

module.exports = {
    searchService: service,
    validateIndex,
    rebuildIndex,
    suggest
};
