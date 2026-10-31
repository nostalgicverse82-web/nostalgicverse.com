-- Migration: 019_phase21_ai_jobs_schema_repair.sql
-- Description: Repair ai_jobs table schema - add prompt, execution_mode, metadata, retry_count
-- Resolves blocker: SQLITE_ERROR: table ai_jobs has no column named prompt

ALTER TABLE ai_jobs ADD COLUMN prompt TEXT;
ALTER TABLE ai_jobs ADD COLUMN execution_mode TEXT DEFAULT 'plan_approve';
ALTER TABLE ai_jobs ADD COLUMN metadata TEXT;
ALTER TABLE ai_jobs ADD COLUMN retry_count INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ai_jobs_created_at ON ai_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_jobs_mode ON ai_jobs(execution_mode);
