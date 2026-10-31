-- Migration 009: Phase 11 Social + Community Engine Rebuild

-- 1. Messages Idempotency
ALTER TABLE messages ADD COLUMN client_message_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_id ON messages(conversation_id, client_message_id) WHERE client_message_id IS NOT NULL;

-- 2. Saves / Bookmarks Table
CREATE TABLE IF NOT EXISTS saves (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, target_type, target_id)
);

-- 3. Comments Soft-Delete Support
ALTER TABLE comments ADD COLUMN deleted_at DATETIME;

-- 4. Social & Community Performance & Integrity Indexes (Requirement 87)
CREATE INDEX IF NOT EXISTS idx_comments_target_created ON comments(target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_target_created ON reviews(target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_friend_requests_sender ON friend_requests(sender_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_requests_recipient ON friend_requests(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_friends_users ON friends(user_id, friend_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_favorites_user_content ON favorites(user_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_saves_user_target ON saves(user_id, target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_status_time ON reports(status, created_at);

