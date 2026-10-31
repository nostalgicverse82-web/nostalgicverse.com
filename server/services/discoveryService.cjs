/**
 * NostalgicVerse — Archive Discovery Engine Service (Phase 17)
 * ==============================================================
 * Powers dynamic museum discovery, era/platform-interleaved exploration feeds,
 * daily spotlight curations, and user exploration telemetry.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');

/**
 * Get balanced discovery feed with era and platform diversity
 */
async function getDiscoveryFeed(options = {}) {
    const limit = Math.min(parseInt(options.limit, 10) || 12, 60);
    const offset = Math.max(parseInt(options.offset, 10) || 0, 0);
    const era = options.era ? options.era.trim() : null;
    const genre = options.genre ? options.genre.trim() : null;
    const platform = options.platform ? options.platform.trim() : null;
    const type = options.type ? options.type.toLowerCase().trim() : null; // 'game', 'console', or null for mixed

    const items = [];
    let totalGames = 0;
    let totalConsoles = 0;

    // 1. Fetch games if type allows
    if (!type || type === 'game' || type === 'games') {
        let gameSql = `
            SELECT id, slug, title, short_description, original_platform, platforms, 
                   genre, release_year, local_image, remote_image, historical_significance, featured
            FROM games 
            WHERE status = 'PUBLISHED'
        `;
        const gameParams = [];

        if (era) {
            const decade = parseInt(era.substring(0, 4), 10);
            if (!isNaN(decade)) {
                gameSql += ' AND release_year >= ? AND release_year < ?';
                gameParams.push(decade, decade + 10);
            }
        }
        if (genre) {
            gameSql += ' AND (genre = ? OR subgenre = ?)';
            gameParams.push(genre, genre);
        }
        if (platform) {
            gameSql += ' AND (original_platform LIKE ? OR platforms LIKE ?)';
            gameParams.push(`%${platform}%`, `%"${platform}"%`);
        }

        const countRow = await dbAsync.get(gameSql.replace('SELECT id, slug, title, short_description, original_platform, platforms, \n                   genre, release_year, local_image, remote_image, historical_significance, featured', 'SELECT COUNT(*) as c'), gameParams);
        totalGames = countRow ? countRow.c : 0;

        gameSql += ' ORDER BY release_year DESC, title ASC LIMIT ? OFFSET ?';
        const games = await dbAsync.all(gameSql, [...gameParams, limit, offset]);

        games.forEach(g => {
            const decade = Math.floor(g.release_year / 10) * 10;
            items.push({
                id: g.id,
                slug: g.slug,
                type: 'game',
                typeName: 'Game Exhibit',
                title: g.title,
                url: `/games/${g.slug}/`,
                releaseYear: g.release_year,
                platform: g.original_platform,
                genre: g.genre,
                era: `${decade}s`,
                image: g.local_image || g.remote_image || `/assets/images/games/${g.slug}.webp`,
                summary: g.short_description || g.historical_significance || `${g.title} (${g.release_year})`,
                featured: !!g.featured
            });
        });
    }

    // 2. Fetch consoles if type allows and no restrictive genre filter
    if ((!type || type === 'console' || type === 'consoles') && !genre) {
        let consoleSql = `
            SELECT id, slug, name, description, manufacturer, release_year, generation, local_image, featured
            FROM consoles 
            WHERE status = 'PUBLISHED'
        `;
        const consoleParams = [];

        if (era) {
            const decade = parseInt(era.substring(0, 4), 10);
            if (!isNaN(decade)) {
                consoleSql += ' AND release_year >= ? AND release_year < ?';
                consoleParams.push(decade, decade + 10);
            }
        }

        const countRow = await dbAsync.get(consoleSql.replace('SELECT id, slug, name, description, manufacturer, release_year, generation, local_image, featured', 'SELECT COUNT(*) as c'), consoleParams);
        totalConsoles = countRow ? countRow.c : 0;

        consoleSql += ' ORDER BY release_year DESC, name ASC LIMIT ? OFFSET ?';
        const consoles = await dbAsync.all(consoleSql, [...consoleParams, Math.ceil(limit / 3), offset]);

        consoles.forEach(c => {
            const decade = Math.floor(c.release_year / 10) * 10;
            items.push({
                id: c.id,
                slug: c.slug,
                type: 'console',
                typeName: 'Hardware Specimen',
                title: c.name,
                url: `/consoles/${c.slug}/`,
                releaseYear: c.release_year,
                platform: c.manufacturer,
                genre: 'Hardware',
                era: `${decade}s`,
                image: c.local_image || `/assets/images/consoles/${c.slug}.webp`,
                summary: c.description || `${c.name} (${c.release_year})`,
                featured: !!c.featured
            });
        });
    }

    // Interleave if mixed
    if (!type || type === 'all') {
        items.sort((a, b) => b.releaseYear - a.releaseYear || a.title.localeCompare(b.title));
    }

    const paginatedItems = items.slice(0, limit);

    return {
        total: totalGames + totalConsoles,
        count: paginatedItems.length,
        offset,
        limit,
        items: paginatedItems
    };
}

/**
 * Get prominent featured exhibits across the archive
 */
async function getFeaturedExhibits(limit = 6) {
    const safeLimit = Math.min(parseInt(limit, 10) || 6, 24);
    const games = await dbAsync.all(`
        SELECT id, slug, title, short_description, original_platform, genre, release_year, local_image, remote_image
        FROM games 
        WHERE status = 'PUBLISHED' AND featured = 1
        ORDER BY release_year DESC
        LIMIT ?
    `, [safeLimit]);

    return games.map(g => ({
        id: g.id,
        slug: g.slug,
        type: 'game',
        typeName: 'Game Exhibit',
        title: g.title,
        url: `/games/${g.slug}/`,
        releaseYear: g.release_year,
        platform: g.original_platform,
        genre: g.genre,
        image: g.local_image || g.remote_image || `/assets/images/games/${g.slug}.webp`,
        summary: g.short_description
    }));
}

/**
 * Get random preserved exhibits for exploratory serendipity
 */
async function getRandomExhibits(limit = 6) {
    const safeLimit = Math.min(parseInt(limit, 10) || 6, 20);
    const games = await dbAsync.all(`
        SELECT id, slug, title, short_description, original_platform, genre, release_year, local_image, remote_image
        FROM games 
        WHERE status = 'PUBLISHED'
        ORDER BY RANDOM()
        LIMIT ?
    `, [safeLimit]);

    return games.map(g => ({
        id: g.id,
        slug: g.slug,
        type: 'game',
        typeName: 'Game Exhibit',
        title: g.title,
        url: `/games/${g.slug}/`,
        releaseYear: g.release_year,
        platform: g.original_platform,
        genre: g.genre,
        image: g.local_image || g.remote_image || `/assets/images/games/${g.slug}.webp`,
        summary: g.short_description
    }));
}

/**
 * Deterministic daily curated spotlight
 */
async function getDailyPicks(dateStr) {
    const date = dateStr ? new Date(dateStr) : new Date();
    const daySeed = date.getUTCFullYear() * 1000 + (date.getUTCMonth() + 1) * 50 + date.getUTCDate();
    
    // Pick 4 games and 2 consoles deterministically based on daySeed
    const gamesCountRow = await dbAsync.get("SELECT COUNT(*) as c FROM games WHERE status = 'PUBLISHED'");
    const totalGames = gamesCountRow ? gamesCountRow.c : 500;
    const offset = Math.abs(daySeed * 7) % Math.max(1, totalGames - 6);

    const games = await dbAsync.all(`
        SELECT id, slug, title, short_description, original_platform, genre, release_year, local_image, remote_image
        FROM games 
        WHERE status = 'PUBLISHED'
        ORDER BY id ASC
        LIMIT 6 OFFSET ?
    `, [offset]);

    return {
        date: date.toISOString().split('T')[0],
        picks: games.map(g => ({
            id: g.id,
            slug: g.slug,
            type: 'game',
            title: g.title,
            url: `/games/${g.slug}/`,
            releaseYear: g.release_year,
            platform: g.original_platform,
            genre: g.genre,
            image: g.local_image || g.remote_image || `/assets/images/games/${g.slug}.webp`,
            summary: g.short_description
        }))
    };
}

/**
 * Record interaction telemetry (impression, click, bookmark, share)
 */
async function recordFeedback({ itemId, itemType, eventType, sessionId }) {
    if (!itemId || !itemType || !eventType) {
        throw new Error('itemId, itemType, and eventType are required');
    }

    const id = uuidv4();
    await dbAsync.run(`
        INSERT INTO discovery_feedback (id, item_id, item_type, event_type, session_id, created_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [id, String(itemId).slice(0, 100), String(itemType).slice(0, 50), String(eventType).slice(0, 50), sessionId ? String(sessionId).slice(0, 100) : null]);

    return { success: true, feedbackId: id };
}

/**
 * Aggregate telemetry for Owner Command Center
 */
async function getDiscoveryFeedbackStats(range = '30d') {
    const days = parseInt(range, 10) || 30;
    const totals = await dbAsync.all(`
        SELECT event_type, COUNT(*) as count 
        FROM discovery_feedback 
        WHERE created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY event_type
    `, [days]);

    const topItems = await dbAsync.all(`
        SELECT item_id, item_type, COUNT(*) as interactions 
        FROM discovery_feedback 
        WHERE created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY item_id, item_type
        ORDER BY interactions DESC 
        LIMIT 10
    `, [days]);

    return {
        range: `${days}d`,
        eventTotals: totals.reduce((acc, r) => ({ ...acc, [r.event_type]: r.count }), {}),
        topItems
    };
}

module.exports = {
    getDiscoveryFeed,
    getFeaturedExhibits,
    getRandomExhibits,
    getDailyPicks,
    recordFeedback,
    getDiscoveryFeedbackStats
};
