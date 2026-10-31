-- Migration 006: Phase 07 Platform Additions
-- Comments, Reactions, Reviews, Sponsor Inquiries, Ad Slots

CREATE TABLE comments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL, -- 'GAME', 'CONSOLE', 'STORY', 'GUIDE', 'NEWS', 'RELEASE', 'IDEA', 'TIMELINE', 'GENRE'
    target_id TEXT NOT NULL,
    parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    status TEXT DEFAULT 'PUBLISHED', -- 'PUBLISHED', 'HIDDEN', 'DELETED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_comments_target ON comments(target_type, target_id);
CREATE INDEX idx_comments_user ON comments(user_id);

CREATE TABLE reactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL, -- 'GAME', 'CONSOLE', 'COMMENT', 'REVIEW'
    target_id TEXT NOT NULL,
    reaction_type TEXT NOT NULL, -- 'LIKE', 'DISLIKE'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX idx_reactions_target ON reactions(target_type, target_id);

CREATE TABLE reviews (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL, -- 'GAME', 'CONSOLE'
    target_id TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
    title TEXT,
    body TEXT NOT NULL,
    pros TEXT,
    cons TEXT,
    is_spoiler INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PUBLISHED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX idx_reviews_target ON reviews(target_type, target_id);

CREATE TABLE sponsor_inquiries (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    email TEXT NOT NULL,
    website TEXT,
    campaign TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN', -- 'OPEN', 'CONTACTED', 'ARCHIVED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE ad_slots (
    id TEXT PRIMARY KEY,
    slot_name TEXT NOT NULL, -- 'HOME_HERO', 'GAMES_SIDEBAR', etc.
    provider TEXT NOT NULL,
    status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'INACTIVE'
    start_date DATETIME,
    end_date DATETIME,
    config TEXT, -- JSON config
    device_visibility TEXT DEFAULT 'ALL', -- 'ALL', 'DESKTOP', 'MOBILE'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

