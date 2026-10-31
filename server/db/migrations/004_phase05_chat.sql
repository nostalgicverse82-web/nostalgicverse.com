-- Phase 05 Chat Enhancements

ALTER TABLE conversations ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE conversation_members ADD COLUMN last_read_at DATETIME;
ALTER TABLE conversation_members ADD COLUMN left_at DATETIME;
ALTER TABLE conversation_members ADD COLUMN muted_at DATETIME;

ALTER TABLE messages ADD COLUMN message_type TEXT DEFAULT 'TEXT';

-- Unique constraint for direct conversations: 
-- We can't do this purely in SQLite schema easily without a complex trigger or strict ordering,
-- so we'll enforce this primarily at the application level.

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user_id ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation_id ON conversation_members(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Adding a simple index for read state where applicable, already covered by user_id index

