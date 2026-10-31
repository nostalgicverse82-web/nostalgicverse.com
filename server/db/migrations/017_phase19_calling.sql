CREATE TABLE IF NOT EXISTS call_sessions (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    caller_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    call_type TEXT NOT NULL DEFAULT 'VOICE',
    status TEXT NOT NULL DEFAULT 'REQUESTED',
    started_at DATETIME,
    ended_at DATETIME,
    end_reason TEXT,
    duration_seconds INTEGER DEFAULT 0,
    caller_tab_id TEXT,
    recipient_tab_id TEXT,
    ice_servers_config TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS call_events (
    id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL REFERENCES call_sessions(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    payload TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_call_sessions_conversation ON call_sessions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_caller ON call_sessions(caller_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_recipient ON call_sessions(recipient_id);
CREATE INDEX IF NOT EXISTS idx_call_sessions_status ON call_sessions(status);
CREATE INDEX IF NOT EXISTS idx_call_sessions_active ON call_sessions(status) WHERE status IN ('REQUESTED', 'RINGING', 'ACCEPTED', 'NEGOTIATING', 'CONNECTING', 'CONNECTED');

CREATE INDEX IF NOT EXISTS idx_call_events_call ON call_events(call_id);
CREATE INDEX IF NOT EXISTS idx_call_events_type ON call_events(event_type);

INSERT OR IGNORE INTO site_settings (key, value) VALUES ('calling_enabled', 'true');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('calling_max_duration_minutes', '120');
INSERT OR IGNORE INTO site_settings (key, value) VALUES ('calling_require_friendship', 'false');
