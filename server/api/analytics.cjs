/**
 * NostalgicVerse — Privacy-First Analytics Public Ingestion API (Phase 17)
 * =========================================================================
 * Provides ethical, anonymous first-party telemetry endpoints for client interactions,
 * search telemetry, exhibit views, and feature adoption.
 */

'use strict';

const express = require('express');
const analyticsService = require('../services/analyticsService.cjs');
const { dbAsync } = require('../db/index.cjs');

const router = express.Router();

// POST /api/analytics/event — Ingest single client telemetry event
router.post('/event', async (req, res) => {
    try {
        const body = req.body || {};
        if (!body.eventName && !body.event_name) {
            return res.status(400).json({ error: 'eventName is required' });
        }

        // Attach authenticated user ID if session exists
        if (req.user && req.user.id) {
            body.userId = req.user.id;
        }

        // Capture device class from user agent if not provided
        if (!body.deviceClass && !body.device_class) {
            const ua = req.headers['user-agent'] || '';
            if (/mobile|android|iphone|ipad/i.test(ua)) {
                body.deviceClass = 'mobile';
            } else if (/tablet/i.test(ua)) {
                body.deviceClass = 'tablet';
            } else {
                body.deviceClass = 'desktop';
            }
        }

        const result = await analyticsService.recordEvent(body);
        res.json(result);
    } catch (err) {
        console.error('Analytics event ingestion error:', err);
        res.status(500).json({ error: 'Failed to record event' });
    }
});

// POST /api/analytics/batch — Ingest multiple client telemetry events
router.post('/batch', async (req, res) => {
    try {
        const events = req.body && Array.isArray(req.body.events) ? req.body.events : [];
        if (events.length === 0) {
            return res.status(400).json({ error: 'events array is required' });
        }

        const userId = req.user ? req.user.id : null;
        const enriched = events.map(e => ({
            ...e,
            userId: e.userId || userId
        }));

        const result = await analyticsService.recordEvents(enriched);
        res.json(result);
    } catch (err) {
        console.error('Analytics batch ingestion error:', err);
        res.status(500).json({ error: 'Failed to record event batch' });
    }
});

// GET /api/analytics/stats — Public high-level archive statistics
router.get('/stats', async (req, res) => {
    try {
        const gamesCount = (await dbAsync.get("SELECT COUNT(*) as c FROM games WHERE status = 'PUBLISHED'")).c;
        const consolesCount = (await dbAsync.get("SELECT COUNT(*) as c FROM consoles WHERE status = 'PUBLISHED'")).c;
        const eventsCount = (await dbAsync.get("SELECT COUNT(*) as c FROM analytics_events")).c;

        res.json({
            publishedGames: gamesCount,
            publishedConsoles: consolesCount,
            totalHistoricalInteractions: eventsCount,
            status: 'operational'
        });
    } catch (err) {
        console.error('Analytics stats error:', err);
        res.status(500).json({ error: 'Failed to retrieve stats' });
    }
});

module.exports = router;

