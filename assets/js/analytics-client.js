/**
 * NostalgicVerse — Phase 17 First-Party Client Analytics Beacon
 * =============================================================
 * Lightweight, non-blocking telemetry tracker. Zero external dependencies.
 * Uses navigator.sendBeacon and keepalive fetch for safe delivery.
 */

(function () {
    'use strict';

    const ENDPOINT = '/api/analytics/events';
    const FLUSH_INTERVAL_MS = 3500;
    const MAX_BATCH_SIZE = 15;

    let eventQueue = [];
    let flushTimer = null;

    // Session identifier stored in sessionStorage
    function getSessionId() {
        try {
            let sid = sessionStorage.getItem('nv_sid');
            if (!sid) {
                sid = 's_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
                sessionStorage.setItem('nv_sid', sid);
            }
            return sid;
        } catch (_) {
            return 'anon_session';
        }
    }

    const sessionId = getSessionId();

    function createEventId() {
        return 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
    }

    /**
     * Enqueues an event for batched non-blocking transmission
     */
    function track(eventName, metadata = {}) {
        if (!eventName || typeof eventName !== 'string') return;

        const eventPayload = {
            id: createEventId(),
            event_name: eventName,
            session_id: sessionId,
            path: window.location.pathname,
            referrer: document.referrer || null,
            created_at: new Date().toISOString(),
            ...metadata
        };

        eventQueue.push(eventPayload);

        if (eventQueue.length >= MAX_BATCH_SIZE) {
            flushQueue();
        } else if (!flushTimer) {
            flushTimer = setTimeout(flushQueue, FLUSH_INTERVAL_MS);
        }
    }

    /**
     * Transmits queued events to server
     */
    function flushQueue(isUnloading = false) {
        if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }

        if (eventQueue.length === 0) return;

        const batch = eventQueue.splice(0, MAX_BATCH_SIZE);
        const payloadStr = JSON.stringify(batch);

        if (isUnloading && navigator.sendBeacon) {
            try {
                const blob = new Blob([payloadStr], { type: 'application/json' });
                navigator.sendBeacon(ENDPOINT, blob);
                return;
            } catch (_) {}
        }

        // Standard fetch with keepalive
        try {
            fetch(ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: payloadStr,
                keepalive: true
            }).catch(() => {
                // Non-blocking: silently ignore transmission errors
            });
        } catch (_) {}
    }

    // Flush on page unload or visibility hide
    window.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'hidden') {
            flushQueue(true);
        }
    });

    window.addEventListener('pagehide', function () {
        flushQueue(true);
    });

    // Expose global tracker
    window.NVAnalytics = {
        track: track,
        flush: flushQueue
    };

    // Auto-track page view
    try {
        const path = window.location.pathname;
        let entityType = null;
        let entityId = null;

        if (path.startsWith('/games/') && path !== '/games/') {
            entityType = 'GAME';
            entityId = path.split('/')[2];
            track('game_view', { entity_type: entityType, entity_id: entityId });
        } else if (path.startsWith('/consoles/') && path !== '/consoles/') {
            entityType = 'CONSOLE';
            entityId = path.split('/')[2];
            track('console_view', { entity_type: entityType, entity_id: entityId });
        } else if (path.startsWith('/blog/') && path !== '/blog/') {
            entityType = 'STORY';
            track('story_view', { entity_type: entityType });
        } else if (path.startsWith('/guides/') && path !== '/guides/') {
            entityType = 'GUIDE';
            track('guide_view', { entity_type: entityType });
        } else if (path.startsWith('/timeline/')) {
            track('timeline_view', { entity_type: 'TIMELINE' });
        }

        track('page_view', { entity_type: entityType, entity_id: entityId });
    } catch (_) {}

    // Delegated click listener for interactive discovery and search results
    document.addEventListener('click', function (e) {
        const target = e.target.closest('[data-track-event], [data-specimen-id], .result-card, .discovery-card');
        if (!target) return;

        const eventName = target.getAttribute('data-track-event') || (target.classList.contains('discovery-card') ? 'discovery_click' : 'search_result_click');
        const entityId = target.getAttribute('data-specimen-id') || target.getAttribute('data-id');
        const entityType = target.getAttribute('data-specimen-type') || target.getAttribute('data-type');

        track(eventName, {
            entity_id: entityId,
            entity_type: entityType
        });
    }, { passive: true });
})();
