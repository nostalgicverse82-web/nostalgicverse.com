-- Migration 010: Phase 12 Product Surfaces & Profile Bio Support

-- 1. Users Bio Column
ALTER TABLE users ADD COLUMN bio TEXT DEFAULT '';

-- 2. Performance & Collection Indexes
CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id, is_public);
CREATE INDEX IF NOT EXISTS idx_collection_items_coll ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

