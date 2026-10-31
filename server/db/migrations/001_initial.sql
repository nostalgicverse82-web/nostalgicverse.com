-- 001_initial.sql

-- USERS & AUTH
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'USER', -- 'USER', 'OWNER'
    email_verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_disabled INTEGER DEFAULT 0
);

CREATE TABLE user_profiles (
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    avatar TEXT,
    bio TEXT,
    privacy_setting TEXT DEFAULT 'PUBLIC', -- 'PUBLIC', 'FRIENDS_ONLY', 'PRIVATE'
    notification_settings TEXT DEFAULT '{}'
);

CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE email_verification (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_reset_tokens (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- SOCIAL
CREATE TABLE friends (
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    friend_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE friend_requests (
    id TEXT PRIMARY KEY,
    sender_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    receiver_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING', -- 'PENDING', 'ACCEPTED', 'DECLINED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(sender_id, receiver_id)
);

CREATE TABLE blocks (
    blocker_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    blocked_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id)
);

-- CHAT
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    type TEXT DEFAULT 'DIRECT', -- 'DIRECT', 'GROUP'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversation_members (
    conversation_id TEXT REFERENCES conversations(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    muted INTEGER DEFAULT 0,
    PRIMARY KEY (conversation_id, user_id)
);

CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    edited_at DATETIME,
    deleted_at DATETIME
);

CREATE TABLE message_reads (
    message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id)
);

CREATE TABLE message_reactions (
    message_id TEXT REFERENCES messages(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (message_id, user_id, emoji)
);

-- NOTIFICATIONS
CREATE TABLE notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    reference_id TEXT,
    message TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- CONTENT (Migrated from JSON)
CREATE TABLE games (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    short_description TEXT,
    release_year INTEGER,
    release_date TEXT,
    original_platform TEXT,
    platforms TEXT, -- JSON array
    developer TEXT,
    publisher TEXT,
    genre TEXT,
    subgenre TEXT,
    region TEXT,
    historical_significance TEXT,
    featured INTEGER DEFAULT 0,
    status TEXT DEFAULT 'PUBLISHED',
    local_image TEXT,
    remote_image TEXT,
    meta_title TEXT,
    meta_description TEXT,
    keywords TEXT, -- JSON array
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE consoles (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    manufacturer TEXT,
    release_year INTEGER,
    generation TEXT,
    featured INTEGER DEFAULT 0,
    local_image TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE genres (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE timeline_events (
    id TEXT PRIMARY KEY,
    year INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stories (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT,
    published_date TEXT,
    status TEXT DEFAULT 'PUBLISHED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE guides (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    excerpt TEXT,
    content TEXT,
    status TEXT DEFAULT 'PUBLISHED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE news_articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    summary TEXT,
    body TEXT,
    hero_image TEXT,
    tags TEXT, -- JSON array
    status TEXT DEFAULT 'DRAFT', -- 'DRAFT', 'REVIEW', 'PUBLISHED', 'UNPUBLISHED', 'ARCHIVED', 'HELD'
    published_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE releases (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    game_id TEXT REFERENCES games(id) ON DELETE SET NULL,
    announcement_date TEXT,
    release_date TEXT,
    region TEXT,
    platform TEXT,
    edition TEXT,
    status TEXT DEFAULT 'ANNOUNCED', -- 'ANNOUNCED', 'COMING_SOON', 'TBA', 'DELAYED', 'RELEASED', 'CANCELLED'
    source TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_images (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_type TEXT NOT NULL, -- 'LOCAL', 'REMOTE', 'FALLBACK'
    source_url TEXT,
    source_domain TEXT,
    verification_status TEXT DEFAULT 'UNVERIFIED',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE image_sources (
    id TEXT PRIMARY KEY,
    domain TEXT UNIQUE NOT NULL,
    is_allowed INTEGER DEFAULT 1
);

CREATE TABLE content_versions (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    content TEXT NOT NULL, -- JSON snapshot
    created_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- FAVORITES & COLLECTIONS
CREATE TABLE favorites (
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL, -- 'GAME', 'CONSOLE', 'STORY', 'GUIDE'
    entity_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, entity_type, entity_id)
);

CREATE TABLE collections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_public INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE collection_items (
    collection_id TEXT REFERENCES collections(id) ON DELETE CASCADE,
    game_id TEXT REFERENCES games(id) ON DELETE CASCADE,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (collection_id, game_id)
);

-- EMULATOR
CREATE TABLE emulator_devices (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    platform TEXT,
    os_version TEXT,
    app_version TEXT,
    emulator_version TEXT,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'ONLINE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE emulator_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL REFERENCES emulator_devices(id) ON DELETE CASCADE,
    game_id TEXT REFERENCES games(id) ON DELETE SET NULL,
    platform TEXT,
    emulator TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'PLAYING' -- 'STARTING', 'PLAYING', 'PAUSED', 'STOPPED', 'DISCONNECTED'
);

CREATE TABLE emulator_heartbeats (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES emulator_sessions(id) ON DELETE CASCADE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    payload TEXT -- JSON metrics
);

-- ADMIN & LOGS
CREATE TABLE audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    result TEXT,
    metadata TEXT, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE site_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL, -- JSON
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- MODERATION
CREATE TABLE reports (
    id TEXT PRIMARY KEY,
    reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL, -- 'USER', 'MESSAGE', 'PROFILE', 'CONTENT'
    target_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT DEFAULT 'OPEN', -- 'OPEN', 'RESOLVED', 'DISMISSED'
    moderator_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

