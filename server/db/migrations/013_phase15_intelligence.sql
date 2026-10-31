-- Migration: 013_phase15_intelligence.sql
-- Description: Phase 15 Content, Media, Source, News, Release Intelligence Schema Enhancements

-- 1. Enhance game_images with verification, dimensional and attribution columns
ALTER TABLE game_images ADD COLUMN mime_type TEXT;
ALTER TABLE game_images ADD COLUMN width INTEGER;
ALTER TABLE game_images ADD COLUMN height INTEGER;
ALTER TABLE game_images ADD COLUMN aspect_ratio TEXT;
ALTER TABLE game_images ADD COLUMN license_status TEXT DEFAULT 'UNKNOWN';
ALTER TABLE game_images ADD COLUMN attribution TEXT;
ALTER TABLE game_images ADD COLUMN last_checked_at DATETIME;
ALTER TABLE game_images ADD COLUMN last_http_status INTEGER;
ALTER TABLE game_images ADD COLUMN failure_reason TEXT;
ALTER TABLE game_images ADD COLUMN fallback_available INTEGER DEFAULT 1;
ALTER TABLE game_images ADD COLUMN local_path TEXT;
ALTER TABLE game_images ADD COLUMN local_status TEXT;
ALTER TABLE game_images ADD COLUMN media_type TEXT DEFAULT 'HERO';

-- 2. Enhance media_metadata with hash, aspect ratio and updated_at
ALTER TABLE media_metadata ADD COLUMN hash TEXT;
ALTER TABLE media_metadata ADD COLUMN aspect_ratio TEXT;
ALTER TABLE media_metadata ADD COLUMN updated_at DATETIME;

-- 3. Enhance releases with date precision and change history
ALTER TABLE releases ADD COLUMN date_precision TEXT DEFAULT 'EXACT';
ALTER TABLE releases ADD COLUMN last_verified_at DATETIME;
ALTER TABLE releases ADD COLUMN change_history TEXT;

-- 4. Enhance news_articles with source and relationship fields
ALTER TABLE news_articles ADD COLUMN primary_source TEXT;
ALTER TABLE news_articles ADD COLUMN source_domain TEXT;
ALTER TABLE news_articles ADD COLUMN sources TEXT;
ALTER TABLE news_articles ADD COLUMN related_games TEXT;
ALTER TABLE news_articles ADD COLUMN related_consoles TEXT;
ALTER TABLE news_articles ADD COLUMN editorial_notes TEXT;
ALTER TABLE news_articles ADD COLUMN change_history TEXT;

-- 5. Create slug_history for URL stability and redirection tracking
CREATE TABLE IF NOT EXISTS slug_history (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL, -- 'GAME', 'CONSOLE', 'NEWS', 'STORY', 'GUIDE'
    entity_id TEXT NOT NULL,
    old_slug TEXT NOT NULL,
    new_slug TEXT NOT NULL,
    changed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    changed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_slug_history_lookup ON slug_history(entity_type, old_slug);

-- 6. Create content_health_issues table for automated health tracking
CREATE TABLE IF NOT EXISTS content_health_issues (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_title TEXT,
    issue_code TEXT NOT NULL,
    severity TEXT NOT NULL, -- 'CRITICAL', 'WARNING', 'INFO'
    message TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN', -- 'OPEN', 'IGNORED', 'RESOLVED'
    ignored_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    ignored_at DATETIME,
    ignore_reason TEXT,
    last_detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_health_status ON content_health_issues(status, severity);
CREATE INDEX IF NOT EXISTS idx_health_entity ON content_health_issues(entity_type, entity_id);

-- 7. Create media_candidates table for owner review workflows
CREATE TABLE IF NOT EXISTS media_candidates (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    candidate_order INTEGER DEFAULT 1,
    image_url TEXT NOT NULL,
    source_url TEXT,
    source_domain TEXT,
    license_status TEXT DEFAULT 'UNKNOWN',
    attribution TEXT,
    verification_status TEXT DEFAULT 'UNVERIFIED',
    last_checked_at DATETIME,
    is_selected INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_candidates_game ON media_candidates(game_id);

-- 8. Add performance indexes for content_relationships
CREATE INDEX IF NOT EXISTS idx_cr_source ON content_relationships(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_cr_target ON content_relationships(target_type, target_id);

