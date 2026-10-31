-- Migration: 015_phase17_search_seo_analytics.sql
-- Description: Phase 17 Search Engine, SEO Health & Privacy-First Analytics Infrastructure

-- 1. Analytics Events (First-party privacy-preserving interaction telemetry)
CREATE TABLE IF NOT EXISTS analytics_events (
    id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    session_id TEXT,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    path TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    query TEXT,
    results_count INTEGER,
    position INTEGER,
    referrer TEXT,
    device_class TEXT,
    duration_ms INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_date ON analytics_events(event_name, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_events_path ON analytics_events(path);
CREATE INDEX IF NOT EXISTS idx_analytics_events_session ON analytics_events(session_id);

-- 2. Analytics Daily Aggregates
CREATE TABLE IF NOT EXISTS analytics_daily_aggregates (
    day TEXT NOT NULL,
    metric TEXT NOT NULL,
    dimension TEXT DEFAULT '',
    count INTEGER DEFAULT 0,
    PRIMARY KEY (day, metric, dimension)
);

-- 3. Discovery Feedback (Anonymous interaction tracking for balanced exhibit curation)
CREATE TABLE IF NOT EXISTS discovery_feedback (
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    event_type TEXT NOT NULL,
    session_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_discovery_feedback_type_date ON discovery_feedback(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_discovery_feedback_item ON discovery_feedback(item_id, item_type);

-- 4. Search Queries (Aggregated search engine analytics and zero-result tracking)
CREATE TABLE IF NOT EXISTS search_queries (
    id TEXT PRIMARY KEY,
    query TEXT NOT NULL,
    normalized_query TEXT NOT NULL,
    hit_count INTEGER DEFAULT 1,
    last_result_count INTEGER DEFAULT 0,
    last_searched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_search_queries_normalized ON search_queries(normalized_query);
CREATE INDEX IF NOT EXISTS idx_search_queries_hits ON search_queries(hit_count DESC);

-- 5. SEO Health Audits (Automated crawler & metadata validation logs)
CREATE TABLE IF NOT EXISTS seo_health_audits (
    id TEXT PRIMARY KEY,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    completed_at DATETIME,
    pages_audited INTEGER DEFAULT 0,
    issues_found INTEGER DEFAULT 0,
    details_json TEXT,
    status TEXT DEFAULT 'RUNNING'
);

CREATE INDEX IF NOT EXISTS idx_seo_health_audits_started ON seo_health_audits(started_at DESC);

