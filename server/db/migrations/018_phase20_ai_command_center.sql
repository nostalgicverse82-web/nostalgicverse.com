-- =====================================================================
-- Migration 018: Phase 20 — Owner AI Command Center & Key Vault
-- =====================================================================

-- 1. Multi-Provider API Key Vault
CREATE TABLE IF NOT EXISTS ai_provider_keys (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,                     -- GOOGLE, ANTHROPIC, OPENAI, XAI, OPENROUTER, TOGETHER, GROQ, MISTRAL, DEEPSEEK, CUSTOM
    label TEXT NOT NULL,                        -- Human-readable label (e.g., "Google Key 01")
    encrypted_key TEXT NOT NULL,                -- AES-256-GCM encrypted secret
    key_suffix TEXT NOT NULL,                   -- Masked suffix (e.g., "****AB12")
    priority INTEGER NOT NULL DEFAULT 1,        -- 1 = highest priority
    is_enabled INTEGER NOT NULL DEFAULT 1,      -- 1 = enabled, 0 = disabled
    health TEXT NOT NULL DEFAULT 'HEALTHY',     -- HEALTHY, RATE_LIMITED, COOLDOWN, DEAD
    last_used_at DATETIME,
    cooldown_until DATETIME,
    request_count INTEGER NOT NULL DEFAULT 0,
    error_count INTEGER NOT NULL DEFAULT 0,
    token_count INTEGER NOT NULL DEFAULT 0,
    rate_limit_count INTEGER NOT NULL DEFAULT 0,
    custom_base_url TEXT,                       -- Custom API endpoint if applicable
    models_supported TEXT,                      -- JSON array of model names or null
    metadata TEXT,                              -- Extensible JSON metadata
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_keys_provider ON ai_provider_keys(provider, is_enabled, health, priority);

-- 2. Owner AI Conversations (Memory)
CREATE TABLE IF NOT EXISTS ai_conversations (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Session',
    provider TEXT NOT NULL DEFAULT 'GOOGLE',
    model TEXT NOT NULL DEFAULT 'gemini-3.1-flash-lite',
    mode TEXT NOT NULL DEFAULT 'plan_approve',   -- plan_only, plan_approve, execute, dry_run
    autonomous_mode INTEGER NOT NULL DEFAULT 0,  -- 0 = prompt on destructive, 1 = autonomous
    is_archived INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Owner AI Conversation Messages
CREATE TABLE IF NOT EXISTS ai_conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL,                         -- user, assistant, system, tool
    content TEXT NOT NULL,
    plan_json TEXT,                             -- Structured action plan (JSON)
    execution_json TEXT,                        -- Detailed execution results & diffs (JSON)
    job_id TEXT,                                -- Linked ai_jobs/jobs ID
    tokens_used INTEGER DEFAULT 0,
    cost_estimate REAL DEFAULT 0.0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv ON ai_conversation_messages(conversation_id, created_at);

-- 4. Change Snapshots & Rollback Registry
CREATE TABLE IF NOT EXISTS ai_snapshots (
    id TEXT PRIMARY KEY,
    conversation_id TEXT REFERENCES ai_conversations(id) ON DELETE SET NULL,
    message_id TEXT,
    label TEXT NOT NULL,
    snapshot_path TEXT NOT NULL,                -- Local archive/directory path
    manifest_json TEXT NOT NULL,                -- Files affected, pre-change hashes, DB diffs
    status TEXT NOT NULL DEFAULT 'ACTIVE',      -- ACTIVE, ROLLED_BACK, EXPIRED
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Model Registry & Capabilities
CREATE TABLE IF NOT EXISTS ai_model_registry (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    model_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    alias TEXT,                                 -- FAST, BALANCED, POWERFUL, IMAGE, VISION, EMBEDDING
    capabilities TEXT NOT NULL,                 -- JSON array: ["text", "code", "structured", "tools", "vision", "image_gen"]
    context_window INTEGER DEFAULT 128000,
    speed_tier TEXT DEFAULT 'FAST',             -- FAST, NORMAL, SLOW
    cost_tier TEXT DEFAULT 'FREE_OR_CHEAP',     -- FREE_OR_CHEAP, MODERATE, EXPENSIVE
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider, model_id)
);

-- Prepopulate Model Registry with authoritative models and standard aliases
INSERT OR IGNORE INTO ai_model_registry (id, provider, model_id, display_name, alias, capabilities, context_window, speed_tier, cost_tier) VALUES
('google-gemini-3.1-flash-lite', 'GOOGLE', 'gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite', 'FAST', '["text", "code", "structured", "tools", "vision"]', 1000000, 'FAST', 'FREE_OR_CHEAP'),
('google-gemini-3.5-flash-lite', 'GOOGLE', 'gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', NULL, '["text", "code", "structured", "tools", "vision"]', 1000000, 'FAST', 'FREE_OR_CHEAP'),
('google-gemini-3.5-flash', 'GOOGLE', 'gemini-3.5-flash', 'Gemini 3.5 Flash', 'BALANCED', '["text", "code", "structured", "tools", "vision", "thinking"]', 1000000, 'FAST', 'FREE_OR_CHEAP'),
('google-gemini-3.6-flash', 'GOOGLE', 'gemini-3.6-flash', 'Gemini 3.6 Flash', NULL, '["text", "code", "structured", "tools", "vision", "thinking"]', 1000000, 'FAST', 'FREE_OR_CHEAP'),
('google-gemini-3.7-flash', 'GOOGLE', 'gemini-3.7-flash', 'Gemini 3.7 Flash', NULL, '["text", "code", "structured", "tools", "vision", "thinking", "hybrid_reasoning"]', 1000000, 'FAST', 'FREE_OR_CHEAP'),
('google-gemini-3.8-flash', 'GOOGLE', 'gemini-3.8-flash', 'Gemini 3.8 Flash', 'POWERFUL', '["text", "code", "structured", "tools", "vision", "thinking", "deep_reasoning"]', 2000000, 'NORMAL', 'MODERATE'),
('anthropic-claude-3.5-sonnet', 'ANTHROPIC', 'claude-3-5-sonnet-20241022', 'Claude 3.5 Sonnet', 'POWERFUL', '["text", "code", "structured", "tools", "vision", "reasoning"]', 200000, 'NORMAL', 'MODERATE'),
('anthropic-claude-3-haiku', 'ANTHROPIC', 'claude-3-haiku-20240307', 'Claude 3 Haiku', 'FAST', '["text", "code", "structured", "tools"]', 200000, 'FAST', 'FREE_OR_CHEAP'),
('openai-gpt-4o', 'OPENAI', 'gpt-4o', 'GPT-4o', 'BALANCED', '["text", "code", "structured", "tools", "vision"]', 128000, 'FAST', 'MODERATE'),
('openai-gpt-4o-mini', 'OPENAI', 'gpt-4o-mini', 'GPT-4o Mini', 'FAST', '["text", "code", "structured", "tools", "vision"]', 128000, 'FAST', 'FREE_OR_CHEAP'),
('openai-dall-e-3', 'OPENAI', 'dall-e-3', 'DALL-E 3', 'IMAGE', '["image_gen"]', 0, 'NORMAL', 'MODERATE'),
('xai-grok-2', 'XAI', 'grok-2', 'Grok 2', 'POWERFUL', '["text", "code", "structured", "tools"]', 128000, 'NORMAL', 'MODERATE'),
('mock-archival-engine', 'MOCK', 'mock-archival-v1', 'Mock Archival Engine (Offline)', 'FAST', '["text", "code", "structured", "tools"]', 32000, 'FAST', 'FREE_OR_CHEAP');
