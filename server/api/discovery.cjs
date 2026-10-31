/**
 * NostalgicVerse — Museum Discovery Public API (Phase 17)
 * =======================================================
 * Serves dynamic discovery feeds, randomized exploratory curation,
 * daily spotlight exhibits, and anonymous discovery engagement telemetry.
 */

'use strict';

const express = require('express');
const discoveryService = require('../services/discoveryService.cjs');

const router = express.Router();

// GET /api/discovery — Main discovery feed (supports ?limit, ?offset, ?era, ?genre, ?platform, ?type)
router.get('/', async (req, res) => {
    try {
        const feed = await discoveryService.getDiscoveryFeed(req.query);
        res.json(feed);
    } catch (err) {
        console.error('Discovery feed error:', err);
        res.status(500).json({ error: 'Failed to generate discovery feed' });
    }
});

// GET /api/discovery/feed — Alias for main feed
router.get('/feed', async (req, res) => {
    try {
        const feed = await discoveryService.getDiscoveryFeed(req.query);
        res.json(feed);
    } catch (err) {
        console.error('Discovery feed alias error:', err);
        res.status(500).json({ error: 'Failed to generate discovery feed' });
    }
});

// GET /api/discovery/featured — Curated showcase of landmark museum items
router.get('/featured', async (req, res) => {
    try {
        const items = await discoveryService.getFeaturedExhibits(req.query.limit);
        res.json({ featured: items, count: items.length });
    } catch (err) {
        console.error('Discovery featured error:', err);
        res.status(500).json({ error: 'Failed to fetch featured exhibits' });
    }
});

// GET /api/discovery/random — Serendipitous random specimens
router.get('/random', async (req, res) => {
    try {
        const items = await discoveryService.getRandomExhibits(req.query.limit);
        res.json({ random: items, count: items.length });
    } catch (err) {
        console.error('Discovery random error:', err);
        res.status(500).json({ error: 'Failed to fetch random exhibits' });
    }
});

// GET /api/discovery/daily — Deterministic daily spotlight
router.get('/daily', async (req, res) => {
    try {
        const daily = await discoveryService.getDailyPicks(req.query.date);
        res.json(daily);
    } catch (err) {
        console.error('Discovery daily error:', err);
        res.status(500).json({ error: 'Failed to fetch daily picks' });
    }
});

// POST /api/discovery/feedback — Record user interaction
router.post('/feedback', async (req, res) => {
    try {
        const { itemId, itemType, eventType, sessionId } = req.body || {};
        if (!itemId || !itemType || !eventType) {
            return res.status(400).json({ error: 'itemId, itemType, and eventType are required' });
        }
        const result = await discoveryService.recordFeedback({ itemId, itemType, eventType, sessionId });
        res.json(result);
    } catch (err) {
        console.error('Discovery feedback error:', err);
        res.status(500).json({ error: 'Failed to record discovery feedback' });
    }
});

module.exports = router;

