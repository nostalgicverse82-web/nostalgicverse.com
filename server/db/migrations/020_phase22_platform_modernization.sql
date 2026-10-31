-- Migration: 020_phase22_platform_modernization.sql
-- Description: Platform modernization - notifications lifecycle (archive/severity) and audit log indexes

ALTER TABLE notifications ADD COLUMN is_archived INTEGER DEFAULT 0;
ALTER TABLE notifications ADD COLUMN severity TEXT DEFAULT 'INFO';

CREATE INDEX IF NOT EXISTS idx_notifications_user_status ON notifications(user_id, is_read, is_archived);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
