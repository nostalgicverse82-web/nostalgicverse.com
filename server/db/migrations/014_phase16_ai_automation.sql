-- Migration: 014_phase16_ai_automation.sql
-- Description: Phase 16 Server-Side AI, Content Automation, Source Intelligence, News, Game Discovery & Release Monitoring

-- 1. AI Jobs Table (Full Lifecycle State Machine)
CREATE TABLE IF NOT EXISTS ai_jobs (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL, -- NEWS_SYNTHESIS, GAME_ENRICHMENT, RELEASE_ANALYSIS, SEO_GENERATION, CONTRADICTION_CHECK, SOURCE_EXTRACT
    entity_type TEXT,
    entity_id TEXT,
    status TEXT NOT NULL DEFAULT 'QUEUED', -- QUEUED, PROCESSING, VALIDATING, AWAITING_OWNER, COMPLETED, FAILED, HELD, CANCELLED, RETRYING
    priority TEXT NOT NULL DEFAULT 'NORMAL', -- CRITICAL, HIGH, NORMAL, LOW
    idempotency_key TEXT UNIQUE,
    provider TEXT NOT NULL DEFAULT 'mock',
    model TEXT NOT NULL DEFAULT 'mock-engine',
    prompt_version TEXT DEFAULT 'v1',
    payload TEXT, -- JSON
    result TEXT, -- JSON
    error TEXT,
    prompt TEXT,
    execution_mode TEXT DEFAULT 'plan_approve',
    metadata TEXT,
    retry_count INTEGER DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    created_by TEXT,
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_jobs_status_prio ON ai_jobs(status, priority, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_entity ON ai_jobs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_type ON ai_jobs(job_type);

-- 2. AI Outputs (Immutable Draft Versions)
CREATE TABLE IF NOT EXISTS ai_outputs (
    id TEXT PRIMARY KEY,
    job_id TEXT REFERENCES ai_jobs(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    model TEXT NOT NULL,
    provider TEXT NOT NULL,
    prompt_version TEXT NOT NULL,
    draft_content TEXT NOT NULL, -- Structured JSON
    output_hash TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'AWAITING_OWNER', -- AWAITING_OWNER, APPROVED, REJECTED, STALE
    reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at DATETIME,
    review_notes TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_outputs_status ON ai_outputs(status);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_entity ON ai_outputs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_outputs_hash ON ai_outputs(output_hash);

-- 3. AI Usage & Cost Accounting
CREATE TABLE IF NOT EXISTS ai_usage (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    operation TEXT NOT NULL, -- completion, structured, classify, extract, summarize
    input_tokens_est INTEGER DEFAULT 0,
    output_tokens_est INTEGER DEFAULT 0,
    cost_estimate REAL DEFAULT 0.0,
    duration_ms INTEGER DEFAULT 0,
    success INTEGER DEFAULT 1,
    error_code TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_provider ON ai_usage(provider, model);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created_at ON ai_usage(created_at);

-- 4. AI Audit Trail
CREATE TABLE IF NOT EXISTS ai_audit (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL, -- ENQUEUE, APPROVE, REJECT, RETRY, CANCEL, KILL_SWITCH, REGENERATE, BULK_ENQUEUE
    entity_type TEXT,
    entity_id TEXT,
    job_id TEXT,
    details TEXT, -- JSON
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_action ON ai_audit(action, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_audit_job ON ai_audit(job_id);

-- 5. Source Candidates
CREATE TABLE IF NOT EXISTS source_candidates (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL UNIQUE,
    normalized_url TEXT NOT NULL UNIQUE,
    domain TEXT NOT NULL,
    title TEXT,
    content_type TEXT DEFAULT 'ARTICLE', -- ARTICLE, SPEC, RELEASE_NOTE, WIKI
    trust_level TEXT DEFAULT 'UNKNOWN', -- OFFICIAL, REPUTABLE, COMMUNITY, UNKNOWN
    related_entity_type TEXT,
    related_entity_id TEXT,
    status TEXT DEFAULT 'DISCOVERED', -- DISCOVERED, FETCHED, FAILED, IGNORED
    discovered_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_source_candidates_domain ON source_candidates(domain, status);
CREATE INDEX IF NOT EXISTS idx_source_candidates_norm_url ON source_candidates(normalized_url);

-- 6. Source Snapshots (Safe Metadata Cache)
CREATE TABLE IF NOT EXISTS source_snapshots (
    id TEXT PRIMARY KEY,
    candidate_id TEXT REFERENCES source_candidates(id) ON DELETE SET NULL,
    url TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    title TEXT,
    author TEXT,
    published_date TEXT,
    extracted_text TEXT,
    metadata_json TEXT,
    retrieved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_source_snapshots_hash ON source_snapshots(source_hash);
CREATE INDEX IF NOT EXISTS idx_source_snapshots_url ON source_snapshots(url);

-- 7. Source Health Checks & Rate Limit Backoff
CREATE TABLE IF NOT EXISTS source_checks (
    id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    domain TEXT NOT NULL,
    http_status INTEGER,
    duration_ms INTEGER,
    is_healthy INTEGER DEFAULT 1,
    error_message TEXT,
    checked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_source_checks_domain ON source_checks(domain, checked_at);

-- 8. Content Claims & Provenance
CREATE TABLE IF NOT EXISTS content_claims (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    claim_type TEXT NOT NULL, -- RELEASE_DATE, DEVELOPER, PUBLISHER, PLATFORM, FEATURE
    claim_value TEXT NOT NULL,
    source_url TEXT,
    source_ref TEXT,
    verification_status TEXT DEFAULT 'UNVERIFIED', -- OFFICIAL, CONFIRMED, REPORTED, RUMOR, UNVERIFIED, CONFLICT
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_claims_entity ON content_claims(entity_type, entity_id);

-- 9. Content Contradiction Detection
CREATE TABLE IF NOT EXISTS content_conflicts (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    source_a_url TEXT NOT NULL,
    source_a_value TEXT NOT NULL,
    source_b_url TEXT NOT NULL,
    source_b_value TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN', -- OPEN, RESOLVED, DISMISSED
    resolved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    resolution_choice TEXT,
    resolved_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_content_conflicts_status ON content_conflicts(status, entity_type);

-- 10. News Candidates
CREATE TABLE IF NOT EXISTS news_candidates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_hash TEXT,
    source_domain TEXT,
    published_at DATETIME,
    related_games TEXT, -- JSON array
    related_consoles TEXT, -- JSON array
    factual_status TEXT DEFAULT 'REPORTED', -- OFFICIAL, CONFIRMED, REPORTED, RUMOR, UNVERIFIED, CONFLICT
    duplicate_of TEXT REFERENCES news_articles(id) ON DELETE SET NULL,
    ai_draft TEXT, -- JSON
    status TEXT DEFAULT 'DISCOVERED', -- DISCOVERED, FETCHED, EXTRACTED, DRAFTED, AWAITING_REVIEW, APPROVED, PUBLISHED, HELD, REJECTED, DUPLICATE
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_news_candidates_status ON news_candidates(status);
CREATE INDEX IF NOT EXISTS idx_news_candidates_slug ON news_candidates(slug);

-- 11. Game Discovery Candidates
CREATE TABLE IF NOT EXISTS game_candidates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    platform TEXT NOT NULL,
    developer TEXT,
    publisher TEXT,
    release_year INTEGER,
    genre TEXT,
    short_description TEXT,
    source_url TEXT,
    identity_match TEXT DEFAULT 'NEW', -- EXACT, LIKELY, POSSIBLE, NEW, CONFLICT
    matched_game_id TEXT REFERENCES games(id) ON DELETE SET NULL,
    image_candidate_url TEXT,
    ai_enrichment TEXT, -- JSON
    status TEXT DEFAULT 'CANDIDATE', -- CANDIDATE, APPROVED, ENRICHED, PUBLISHED, REJECTED, DUPLICATE
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_candidates_status ON game_candidates(status);
CREATE INDEX IF NOT EXISTS idx_game_candidates_slug ON game_candidates(slug);

-- 12. Release Watch Records
CREATE TABLE IF NOT EXISTS release_watch_records (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL DEFAULT 'GAME',
    entity_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    platform TEXT NOT NULL,
    region TEXT NOT NULL DEFAULT 'Worldwide',
    source_url TEXT,
    current_release_date TEXT,
    detected_release_date TEXT,
    change_type TEXT, -- NEW_DATE, DELAY, CANCELLED, PLATFORM_CHANGE, NONE
    status TEXT DEFAULT 'WATCHING', -- WATCHING, CHANGE_DETECTED, AWAITING_REVIEW, APPROVED, REJECTED
    last_checked_at DATETIME,
    last_verified_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_release_watch_status ON release_watch_records(status);
CREATE INDEX IF NOT EXISTS idx_release_watch_entity ON release_watch_records(entity_type, entity_id);
