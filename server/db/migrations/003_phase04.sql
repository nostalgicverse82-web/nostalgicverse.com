-- Phase 04 Schema Upgrades

-- Add avatar_id and display_name to users table if they don't exist
ALTER TABLE users ADD COLUMN avatar_id TEXT;
ALTER TABLE users ADD COLUMN display_name TEXT;

-- For existing users (if any), populate display_name from user_profiles if available
UPDATE users SET display_name = (SELECT display_name FROM user_profiles WHERE user_profiles.user_id = users.id) WHERE display_name IS NULL;

-- Default display_name to username if still null
UPDATE users SET display_name = username WHERE display_name IS NULL;

