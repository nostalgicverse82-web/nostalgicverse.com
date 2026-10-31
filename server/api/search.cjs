const express = require('express');
const { dbAsync } = require('../db/index.cjs');
const { searchService } = require('../services/searchService.cjs');

const router = express.Router();

// Fast suggestions / autocomplete (supports /suggest, /suggestions, /autocomplete)
const handleSuggestions = async (req, res) => {
    try {
        const q = (req.query.q || '').trim();
        const suggestions = await searchService.suggest(q, req.query.limit);
        res.json({ query: q, suggestions, typoSuggestion: null });
    } catch (e) {
        console.error('Search suggest error:', e);
        res.status(500).json({ error: 'Server error' });
    }
};

router.get('/suggest', handleSuggestions);
router.get('/suggestions', handleSuggestions);
router.get('/autocomplete', handleSuggestions);

router.get('/', async (req, res) => {
    let q = (req.query.q || '').trim();
    if (!q) {
        return res.json({ query: '', total: 0, results: [] });
    }

    // Bound query length to protect against abuse
    if (q.length > 100) {
        q = q.slice(0, 100);
    }
    
    try {
        // Escape special LIKE pattern characters (% and _)
        const escapedQ = q.replace(/[%_\\]/g, '\\$&');
        const likeQuery = '%' + escapedQ + '%';
        const limit = Math.min(parseInt(req.query.limit, 10) || 50, 50);
        const results = [];
        
        // Search games with bounded LIMIT and ESCAPE
        const games = await dbAsync.all(
            `SELECT id, title, slug, release_year as year, short_description as snippet, local_image as thumbnail 
             FROM games 
             WHERE status = 'PUBLISHED' AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR alternate_titles LIKE ? ESCAPE '\\') 
             LIMIT ?`,
            [likeQuery, likeQuery, likeQuery, limit]
        );
        games.forEach(g => results.push({ ...g, type: 'game', url: `/games/${g.slug}/` }));

        // Search consoles
        if (results.length < limit) {
            const consoles = await dbAsync.all(
                `SELECT id, name as title, slug, release_year as year, description as snippet, local_image as thumbnail 
                 FROM consoles 
                 WHERE status = 'PUBLISHED' AND (name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\') 
                 LIMIT ?`,
                [likeQuery, likeQuery, limit - results.length]
            );
            consoles.forEach(c => results.push({ ...c, type: 'console', url: `/consoles/${c.slug}/` }));
        }

        // Search genres
        if (results.length < limit) {
            try {
                const genres = await dbAsync.all(
                    `SELECT id, name as title, slug, description as snippet 
                     FROM genres 
                     WHERE name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' 
                     LIMIT ?`,
                    [likeQuery, likeQuery, limit - results.length]
                );
                genres.forEach(gn => results.push({ ...gn, type: 'genre', url: `/genres/${gn.slug}/` }));
            } catch (e) {}
        }

        // Search timeline events
        if (results.length < limit) {
            try {
                const timeline = await dbAsync.all(
                    `SELECT id, title, year, description as snippet 
                     FROM timeline_events 
                     WHERE status = 'PUBLISHED' AND (title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' OR CAST(year AS TEXT) LIKE ? ESCAPE '\\') 
                     LIMIT ?`,
                    [likeQuery, likeQuery, likeQuery, limit - results.length]
                );
                timeline.forEach(t => results.push({ ...t, type: 'timeline', url: `/timeline/#${t.id}` }));
            } catch (e) {}
        }

        // Search news
        if (results.length < limit) {
            const news = await dbAsync.all(
                `SELECT id, title, summary as snippet, hero_image as thumbnail 
                 FROM news_articles 
                 WHERE status = 'PUBLISHED' AND (title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\' OR body LIKE ? ESCAPE '\\') 
                 LIMIT ?`,
                [likeQuery, likeQuery, likeQuery, limit - results.length]
            );
            news.forEach(n => results.push({ ...n, type: 'news', url: `/news/${n.id}/` }));
        }

        // Search stories
        if (results.length < limit) {
            const stories = await dbAsync.all(
                `SELECT id, title, slug, excerpt as snippet 
                 FROM stories 
                 WHERE status = 'PUBLISHED' AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\') 
                 LIMIT ?`,
                [likeQuery, likeQuery, limit - results.length]
            );
            stories.forEach(s => results.push({ ...s, type: 'story', url: `/stories/${s.slug}/` }));
        }

        // Search guides
        if (results.length < limit) {
            const guides = await dbAsync.all(
                `SELECT id, title, slug, excerpt as snippet 
                 FROM guides 
                 WHERE status = 'PUBLISHED' AND (title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\') 
                 LIMIT ?`,
                [likeQuery, likeQuery, limit - results.length]
            );
            guides.forEach(g => results.push({ ...g, type: 'guide', url: `/guides/${g.slug}/` }));
        }

        res.json({
            query: q,
            total: results.length,
            results: results.slice(0, limit)
        });
    } catch (e) {
        console.error('Search error:', e);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;
