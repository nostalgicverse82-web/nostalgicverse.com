-- Phase 06 Extra Tables

CREATE TABLE IF NOT EXISTS emulator_compatibility (
    id TEXT PRIMARY KEY,
    game_id TEXT NOT NULL REFERENCES games(id) ON DELETE CASCADE,
    emulator_core TEXT NOT NULL,
    status TEXT DEFAULT 'UNKNOWN', -- PERFECT, PLAYABLE, GLITCHY, UNPLAYABLE, UNKNOWN
    notes TEXT,
    tested_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    tested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(game_id, emulator_core)
);

CREATE INDEX IF NOT EXISTS idx_emulator_compatibility_game ON emulator_compatibility(game_id);

