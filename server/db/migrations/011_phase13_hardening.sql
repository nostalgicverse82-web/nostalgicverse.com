-- Phase 13 Database Hardening & Performance Indexes
-- Migration 011_phase13_hardening.sql

-- 1. Optimized catalogue sorting index (Status + Release Year)
CREATE INDEX IF NOT EXISTS idx_games_status_year ON games(status, release_year);

-- 2. Optimized published comments filtering
CREATE INDEX IF NOT EXISTS idx_comments_target_status ON comments(target_type, target_id, status);

-- 3. Optimized published reviews aggregation
CREATE INDEX IF NOT EXISTS idx_reviews_target_status ON reviews(target_type, target_id, status);

