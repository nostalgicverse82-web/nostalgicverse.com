-- Phase 02 Schema Upgrades

-- 1. Users Table Enhancements
ALTER TABLE users ADD COLUMN username_normalized TEXT;
ALTER TABLE users ADD COLUMN email_normalized TEXT;
ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'ACTIVE';
ALTER TABLE users ADD COLUMN force_password_change INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN last_login_at DATETIME;

-- Enforce Uniqueness
CREATE UNIQUE INDEX idx_users_username_normalized ON users(username_normalized);
CREATE UNIQUE INDEX idx_users_email_normalized ON users(email_normalized);

-- Normalize existing users (if any)
UPDATE users SET 
    username_normalized = LOWER(TRIM(username)),
    email_normalized = LOWER(TRIM(email));

-- 2. Sessions 
DROP TABLE IF EXISTS sessions;
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    expires_at DATETIME NOT NULL,
    last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- 3. Content Relationships
CREATE TABLE content_relationships (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    relation_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(source_type, source_id, target_type, target_id, relation_type)
);

-- 4. Content Sources
CREATE TABLE content_sources (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    source_url TEXT NOT NULL,
    source_domain TEXT,
    source_type TEXT,
    title TEXT,
    verification_status TEXT DEFAULT 'UNVERIFIED',
    notes TEXT,
    retrieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Media Metadata
CREATE TABLE media_metadata (
    id TEXT PRIMARY KEY,
    content_id TEXT,
    content_type TEXT,
    type TEXT NOT NULL, -- 'IMAGE', 'THUMBNAIL', 'HERO', 'DOCUMENT'
    storage_path TEXT NOT NULL,
    source_url TEXT,
    source_domain TEXT,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    license_status TEXT,
    attribution TEXT,
    verification_status TEXT DEFAULT 'UNVERIFIED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Submissions
CREATE TABLE submissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    submission_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'PENDING_REVIEW', -- PENDING_REVIEW, APPROVED, REJECTED
    review_notes TEXT,
    reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_submissions_status ON submissions(status);
CREATE INDEX idx_submissions_created_at ON submissions(created_at);
CREATE INDEX idx_submissions_user_id ON submissions(user_id);

-- 7. Support / Contact
CREATE TABLE support_tickets (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL, -- nullable for guest
    subject TEXT NOT NULL,
    category TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN', -- OPEN, IN_REVIEW, WAITING_FOR_USER, RESOLVED, CLOSED, REJECTED, SPAM
    priority TEXT DEFAULT 'NORMAL',
    assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
    related_content_type TEXT,
    related_content_id TEXT,
    closed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_category ON support_tickets(category);
CREATE INDEX idx_support_tickets_created_at ON support_tickets(created_at);
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);

CREATE TABLE ticket_messages (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    sender_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_internal_note INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    edited_at DATETIME,
    deleted_at DATETIME
);
CREATE INDEX idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX idx_ticket_messages_created_at ON ticket_messages(created_at);

CREATE TABLE ticket_attachments (
    id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    message_id TEXT REFERENCES ticket_messages(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Rate Limiting (Persistent store for basic rate limits)
CREATE TABLE rate_limits (
    key TEXT PRIMARY KEY,
    points INTEGER DEFAULT 0,
    reset_at DATETIME NOT NULL
);

-- Audit log indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity_id ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(created_at);

-- Content Indexes
CREATE INDEX IF NOT EXISTS idx_games_slug ON games(slug);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_consoles_slug ON consoles(slug);
CREATE INDEX IF NOT EXISTS idx_stories_slug ON stories(slug);

