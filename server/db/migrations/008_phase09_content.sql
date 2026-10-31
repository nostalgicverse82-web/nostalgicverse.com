-- Migration 008: Phase 09 Content Engine Enhancements

-- 1. Create ideas table
CREATE TABLE ideas (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    thumbnail TEXT,
    creator_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'DRAFT',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    published_at DATETIME,
    archived_at DATETIME
);

-- 2. Create compatibility_records table
CREATE TABLE compatibility_records (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    system TEXT NOT NULL,
    status TEXT NOT NULL, -- VERIFIED_PLAYABLE, PLAYABLE_WITH_ISSUES, TESTING, PLANNED, NOT_SUPPORTED, NOT_APPLICABLE
    tested_version TEXT,
    tested_date DATETIME,
    notes TEXT,
    source TEXT,
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Enhance games table
ALTER TABLE games ADD COLUMN alternate_titles TEXT;
ALTER TABLE games ADD COLUMN series TEXT;
ALTER TABLE games ADD COLUMN franchise TEXT;
ALTER TABLE games ADD COLUMN engine TEXT;
ALTER TABLE games ADD COLUMN modes TEXT;
ALTER TABLE games ADD COLUMN multiplayer TEXT;
ALTER TABLE games ADD COLUMN age_rating TEXT;
ALTER TABLE games ADD COLUMN generation TEXT;
ALTER TABLE games ADD COLUMN manufacturer TEXT;
ALTER TABLE games ADD COLUMN consoles TEXT;
ALTER TABLE games ADD COLUMN published_at DATETIME;
ALTER TABLE games ADD COLUMN archived_at DATETIME;
ALTER TABLE games ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE games ADD COLUMN updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;

-- 4. Enhance consoles table
ALTER TABLE consoles ADD COLUMN region TEXT;
ALTER TABLE consoles ADD COLUMN history TEXT;
ALTER TABLE consoles ADD COLUMN hardware_summary TEXT;
ALTER TABLE consoles ADD COLUMN cpu TEXT;
ALTER TABLE consoles ADD COLUMN gpu TEXT;
ALTER TABLE consoles ADD COLUMN memory TEXT;
ALTER TABLE consoles ADD COLUMN storage_media_type TEXT;
ALTER TABLE consoles ADD COLUMN controllers TEXT;
ALTER TABLE consoles ADD COLUMN notable_features TEXT;
ALTER TABLE consoles ADD COLUMN published_at DATETIME;
ALTER TABLE consoles ADD COLUMN archived_at DATETIME;
ALTER TABLE consoles ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE consoles ADD COLUMN updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;

-- 5. Enhance submissions table
ALTER TABLE submissions ADD COLUMN payload TEXT; -- JSON for varying submission fields

-- 6. Add Common missing fields to other tables
ALTER TABLE stories ADD COLUMN published_at DATETIME;
ALTER TABLE stories ADD COLUMN archived_at DATETIME;
ALTER TABLE stories ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE stories ADD COLUMN updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE guides ADD COLUMN published_at DATETIME;
ALTER TABLE guides ADD COLUMN archived_at DATETIME;
ALTER TABLE guides ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE guides ADD COLUMN updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE timeline_events ADD COLUMN status TEXT DEFAULT 'PUBLISHED';
ALTER TABLE timeline_events ADD COLUMN slug TEXT;
ALTER TABLE timeline_events ADD COLUMN published_at DATETIME;
ALTER TABLE timeline_events ADD COLUMN archived_at DATETIME;
ALTER TABLE timeline_events ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE timeline_events ADD COLUMN updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE genres ADD COLUMN published_at DATETIME;
ALTER TABLE genres ADD COLUMN archived_at DATETIME;
ALTER TABLE genres ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE genres ADD COLUMN updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE genres ADD COLUMN status TEXT DEFAULT 'PUBLISHED';

ALTER TABLE releases ADD COLUMN slug TEXT;
ALTER TABLE releases ADD COLUMN published_at DATETIME;
ALTER TABLE releases ADD COLUMN archived_at DATETIME;
ALTER TABLE releases ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE releases ADD COLUMN updated_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE consoles ADD COLUMN status TEXT DEFAULT 'PUBLISHED';
