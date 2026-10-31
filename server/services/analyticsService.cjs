/**
 * NostalgicVerse — Privacy-First Analytics Engine Service (Phase 17)
 * ===================================================================
 * First-party, zero-third-party-tracker telemetry engine.
 * Records internal museum telemetry, search behavior, discovery engagement,
 * and compiles privacy-preserving analytics aggregates for the Owner Command Center.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/index.cjs');

function parseDays(rangeStr) {
    if (!rangeStr) return 30;
    const match = String(rangeStr).match(/^(\d+)/);
    return match ? Math.min(Math.max(parseInt(match[1], 10), 1), 365) : 30;
}

/**
 * Record a single client or server analytics event
 */
async function recordEvent(eventData = {}) {
    const {
        eventName,
        event_name = eventName,
        sessionId,
        session_id = sessionId,
        userId,
        user_id = userId,
        path = '/',
        entityType,
        entity_type = entityType,
        entityId,
        entity_id = entityId,
        query,
        resultsCount,
        results_count = resultsCount,
        position,
        referrer,
        deviceClass,
        device_class = deviceClass,
        durationMs,
        duration_ms = durationMs
    } = eventData;

    if (!event_name) {
        throw new Error('event_name is required');
    }

    const id = uuidv4();
    const safeEvent = String(event_name).slice(0, 80);
    const safePath = String(path).slice(0, 255);
    const safeSession = session_id ? String(session_id).slice(0, 100) : null;
    const safeUser = user_id ? String(user_id).slice(0, 100) : null;
    const safeType = entity_type ? String(entity_type).slice(0, 50) : null;
    const safeEntity = entity_id ? String(entity_id).slice(0, 100) : null;
    const safeQuery = query ? String(query).slice(0, 150) : null;
    const safeRef = referrer ? String(referrer).slice(0, 255) : null;
    const safeDevice = device_class ? String(device_class).slice(0, 30) : 'unknown';

    await dbAsync.run(`
        INSERT INTO analytics_events (
            id, event_name, session_id, user_id, path, entity_type, entity_id, 
            query, results_count, position, referrer, device_class, duration_ms, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
        id, safeEvent, safeSession, safeUser, safePath, safeType, safeEntity,
        safeQuery, Number.isInteger(results_count) ? results_count : null,
        Number.isInteger(position) ? position : null, safeRef, safeDevice,
        Number.isInteger(duration_ms) ? duration_ms : null
    ]);

    // Also update search_queries table if this was a search event
    if (safeEvent === 'search' && safeQuery) {
        const norm = safeQuery.toLowerCase().trim();
        const existing = await dbAsync.get('SELECT id, hit_count FROM search_queries WHERE normalized_query = ?', [norm]);
        if (existing) {
            await dbAsync.run(`
                UPDATE search_queries 
                SET hit_count = hit_count + 1, last_result_count = ?, last_searched_at = CURRENT_TIMESTAMP 
                WHERE id = ?
            `, [results_count || 0, existing.id]);
        } else {
            await dbAsync.run(`
                INSERT INTO search_queries (id, query, normalized_query, hit_count, last_result_count, last_searched_at)
                VALUES (?, ?, ?, 1, ?, CURRENT_TIMESTAMP)
            `, [uuidv4(), safeQuery, norm, results_count || 0]);
        }
    }

    return { success: true, id };
}

/**
 * Record a batch of analytics events
 */
async function recordEvents(events = []) {
    if (!Array.isArray(events) || events.length === 0) {
        return { success: true, count: 0 };
    }

    const batch = events.slice(0, 100);
    let inserted = 0;
    for (const evt of batch) {
        try {
            await recordEvent(evt);
            inserted++;
        } catch (e) {
            // ignore individual malformed events in batch
        }
    }
    return { success: true, count: inserted };
}

/**
 * Phase 17: Platform Overview Analytics (used by Owner Command Center)
 */
async function getOverviewAnalytics(rangeStr = '30d') {
    const days = parseDays(rangeStr);

    const totalViewsRow = await dbAsync.get(`
        SELECT COUNT(*) as c FROM analytics_events 
        WHERE created_at >= datetime('now', '-' || ? || ' days')
    `, [days]);

    const uniqueSessionsRow = await dbAsync.get(`
        SELECT COUNT(DISTINCT session_id) as c FROM analytics_events 
        WHERE created_at >= datetime('now', '-' || ? || ' days') AND session_id IS NOT NULL
    `, [days]);

    const topPages = await dbAsync.all(`
        SELECT path, COUNT(*) as views 
        FROM analytics_events 
        WHERE created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY path 
        ORDER BY views DESC 
        LIMIT 10
    `, [days]);

    const deviceRows = await dbAsync.all(`
        SELECT device_class, COUNT(*) as count 
        FROM analytics_events 
        WHERE created_at >= datetime('now', '-' || ? || ' days') AND device_class IS NOT NULL
        GROUP BY device_class
    `, [days]);

    const dailyTrends = await dbAsync.all(`
        SELECT date(created_at) as day, COUNT(*) as views, COUNT(DISTINCT session_id) as visitors 
        FROM analytics_events 
        WHERE created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY date(created_at) 
        ORDER BY day DESC
        LIMIT 30
    `, [days]);

    return {
        range: `${days}d`,
        totalPageViews: totalViewsRow ? totalViewsRow.c : 0,
        uniqueVisitors: uniqueSessionsRow ? uniqueSessionsRow.c : 0,
        topPages,
        deviceBreakdown: deviceRows.reduce((acc, r) => ({ ...acc, [r.device_class]: r.count }), {}),
        dailyTrends
    };
}

/**
 * Phase 17: Search Analytics (used by Owner Command Center)
 */
async function getSearchAnalytics(rangeStr = '30d') {
    const days = parseDays(rangeStr);

    const totalSearchesRow = await dbAsync.get(`
        SELECT COUNT(*) as c FROM analytics_events 
        WHERE event_name = 'search' AND created_at >= datetime('now', '-' || ? || ' days')
    `, [days]);

    const topQueries = await dbAsync.all(`
        SELECT query, hit_count, last_result_count, last_searched_at
        FROM search_queries 
        ORDER BY hit_count DESC 
        LIMIT 15
    `);

    const zeroResultQueries = await dbAsync.all(`
        SELECT query, hit_count, last_searched_at
        FROM search_queries 
        WHERE last_result_count = 0
        ORDER BY hit_count DESC 
        LIMIT 15
    `);

    return {
        range: `${days}d`,
        totalSearches: totalSearchesRow ? totalSearchesRow.c : (topQueries.reduce((a, b) => a + b.hit_count, 0)),
        topQueries,
        zeroResultQueries
    };
}

/**
 * Phase 17: Discovery Analytics (used by Owner Command Center)
 */
async function getDiscoveryAnalytics(rangeStr = '30d') {
    const days = parseDays(rangeStr);

    const feedbackTotals = await dbAsync.all(`
        SELECT event_type, COUNT(*) as count 
        FROM discovery_feedback 
        WHERE created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY event_type
    `, [days]);

    const topDiscovered = await dbAsync.all(`
        SELECT item_id, item_type, COUNT(*) as interactions 
        FROM discovery_feedback 
        WHERE created_at >= datetime('now', '-' || ? || ' days')
        GROUP BY item_id, item_type
        ORDER BY interactions DESC 
        LIMIT 10
    `, [days]);

    const totalsMap = feedbackTotals.reduce((acc, r) => ({ ...acc, [r.event_type]: r.count }), {});
    const impressions = totalsMap['impression'] || totalsMap['view'] || 0;
    const clicks = totalsMap['click'] || totalsMap['open'] || 0;
    const ctr = impressions > 0 ? Number(((clicks / impressions) * 100).toFixed(2)) : 0;

    return {
        range: `${days}d`,
        totalImpressions: impressions,
        totalClicks: clicks,
        clickThroughRate: ctr,
        feedbackByType: totalsMap,
        topDiscoveredItems: topDiscovered
    };
}

module.exports = {
    recordEvent,
    recordEvents,
    getOverviewAnalytics,
    getSearchAnalytics,
    getDiscoveryAnalytics
};
