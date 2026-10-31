const express = require('express');
const { dbAsync } = require('../db/index.cjs');

const router = express.Router();
const VALID_TYPES = ['games', 'consoles', 'stories', 'guides', 'news_articles', 'timeline_events', 'genres', 'releases', 'ideas'];

// Get published content by type
router.get('/:type', async (req, res) => {
    const { type } = req.params;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid content type' });

    const { q, featured, sort = 'releaseDate', era } = req.query;
    const parsedLimit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 50));
    const pageNum = req.query.page ? Math.max(1, parseInt(req.query.page, 10)) : null;
    const effectiveOffset = pageNum ? (pageNum - 1) * parsedLimit : Math.max(0, parseInt(req.query.offset, 10) || 0);
    const currentPage = pageNum || Math.floor(effectiveOffset / parsedLimit) + 1;
    
    // Status check where applicable
    let sql = `SELECT * FROM ${type} WHERE status = 'PUBLISHED'`;
    const params = [];

    if (q) {
        if (type === 'timeline_events') {
            sql += ' AND title LIKE ?';
        } else if (type === 'consoles') {
             sql += ' AND name LIKE ?';
        } else {
             sql += ' AND title LIKE ?';
        }
        params.push('%' + q + '%');
    }

    if (featured === 'true') {
        sql += ' AND featured = 1';
    }

    if (era && type === 'games') {
        const decade = parseInt(era.substring(0, 4), 10);
        if (!isNaN(decade)) {
            sql += ' AND release_year >= ? AND release_year < ?';
            params.push(decade, decade + 10);
        }
    }

    const countQuery = sql.replace('SELECT *', 'SELECT COUNT(*) as c');
    const totalMatch = (await dbAsync.get(countQuery, params)).c;
    const totalPages = Math.ceil(totalMatch / parsedLimit);

    if (type === 'games') {
        sql += ` ORDER BY release_year ${sort === 'releaseDate' ? 'ASC' : 'DESC'}`;
    } else if (type === 'timeline_events') {
        sql += ' ORDER BY year DESC';
    } else if (type === 'news_articles') {
        sql += ' ORDER BY published_date DESC';
    } else {
        sql += ' ORDER BY created_at DESC';
    }

    sql += ' LIMIT ? OFFSET ?';
    params.push(parsedLimit, effectiveOffset);

    try {
        const items = await dbAsync.all(sql, params);
        
        if (type === 'games') {
            const games = items.map(g => {
                const decade = Math.floor(g.release_year / 10) * 10;
                return { ...g, era: `${decade}s` };
            });
            res.json({ total: totalMatch, page: currentPage, totalPages, offset: effectiveOffset, limit: parsedLimit, count: games.length, games });
        } else if (type === 'consoles') {
            res.json({ total: totalMatch, page: currentPage, totalPages, offset: effectiveOffset, limit: parsedLimit, count: items.length, consoles: items });
        } else {
            res.json({ total: totalMatch, page: currentPage, totalPages, offset: effectiveOffset, limit: parsedLimit, count: items.length, items });
        }
    } catch (e) {
        console.error('Error fetching content:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get published content by type and slug
router.get('/:type/:slug', async (req, res) => {
    const { type, slug } = req.params;
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid content type' });

    try {
        const sql = `SELECT * FROM ${type} WHERE slug = ? AND status = 'PUBLISHED'`;
        
        const item = await dbAsync.get(sql, [slug]);
        if (!item) return res.status(404).json({ error: 'Not found or not published' });

        res.json({ item });
    } catch (e) {
        console.error('Error fetching content item:', e);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
