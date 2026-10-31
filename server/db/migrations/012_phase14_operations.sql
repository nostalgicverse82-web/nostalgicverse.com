-- Phase 14: Owner Command Center & Enterprise Operations Schema Migration
-- ======================================================================

-- 1. Persistent Background Job Queue Table
CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
    payload TEXT, -- JSON parameters
    result TEXT, -- JSON result data
    error TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    started_at DATETIME,
    completed_at DATETIME,
    created_by TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_type ON jobs(status, job_type);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

-- 2. Private AI Content Generation Queue Table
CREATE TABLE IF NOT EXISTS ai_queue (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL, -- GAME, CONSOLE, STORY, NEWS, SUBMISSION
    entity_id TEXT,
    status TEXT NOT NULL DEFAULT 'WAITING', -- WAITING, PROCESSING, DRAFTED, VALIDATING, VALIDATED, HELD, REJECTED, FAILED, COMPLETED
    model TEXT NOT NULL DEFAULT 'gemini-3.1-flash-lite',
    prompt TEXT NOT NULL,
    draft_content TEXT, -- JSON draft content
    validation_status TEXT DEFAULT 'PENDING',
    validation_errors TEXT,
    error_message TEXT,
    reviewed_by TEXT,
    reviewed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_queue_status ON ai_queue(status);
CREATE INDEX IF NOT EXISTS idx_ai_queue_created_at ON ai_queue(created_at);

-- 3. News Articles Schema Enhancements (slug & factual status)
ALTER TABLE news_articles ADD COLUMN slug TEXT;
ALTER TABLE news_articles ADD COLUMN factual_status TEXT DEFAULT 'CONFIRMED'; -- CONFIRMED, DEVELOPMENT, RUMOR, UNVERIFIED

-- 4. Additional Operational & Performance Indexes
CREATE INDEX IF NOT EXISTS idx_compatibility_records_system ON compatibility_records(system, status);
CREATE INDEX IF NOT EXISTS idx_compatibility_records_game ON compatibility_records(game_id);
CREATE INDEX IF NOT EXISTS idx_sponsor_inquiries_status ON sponsor_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_ad_slots_status ON ad_slots(status);
CREATE INDEX IF NOT EXISTS idx_media_metadata_verification ON media_metadata(verification_status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, priority);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

