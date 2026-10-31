# PHASE 02 DATABASE

## Engine and Location
- **Engine:** SQLite3
- **Configuration:** `PRAGMA foreign_keys = ON;`, `PRAGMA journal_mode = WAL;`, `PRAGMA busy_timeout = 5000;`.
- **Database Location:** `./data/nostalgicverse.db` (Configurable via `DATABASE_URL` environment variable).

## Migration Strategy
- **Migration Engine:** `server/db/migrate.cjs` processes strict, ordered SQL migrations inside atomic transactions.
- **Tracking:** Applies `.sql` scripts from `server/db/migrations/` exactly once using the `schema_migrations` tracking table.
- **Rollback:** Automatic transaction rollback on SQL errors during application.

## Backup Strategy
- **Backup:** Perform safe offline backups via `sqlite3 nostalgicverse.db ".backup 'nostalgicverse_backup.db'"`.
- **Restore Strategy:** Ensure the server is shut down, replace `nostalgicverse.db` with the backup file, and restart.

## Seed Strategy
- Seed data avoids hardcoding owner passwords or exposing secrets. Owner accounts are provisioned via strict `.env` usage (`OWNER_USERNAME`, `OWNER_INITIAL_PASSWORD`). 
- Sensitive private data is strictly excluded from JSON imports and dev seeds.

## Environment Variables
- `DATABASE_URL`: Defines the absolute or relative path to the SQLite DB file. Defaults to `./data/nostalgicverse.db`.

## Schema Overview
- **Users & Identity:** `users`, `user_profiles`, `sessions` (Case-insensitive via `username_normalized` UNIQUE index, HTTP-Only UUID sessions).
- **Content:** `games`, `consoles`, `stories`, `guides`, `timeline_events`, `genres` (Universal content properties and publication lifecycles).
- **Submissions:** `submissions` (User content submissions guarded by strict owner review workflow).
- **Support & Moderation:** `support_tickets`, `ticket_messages`, `ticket_attachments` (Persistent 1-to-1 owner/user interaction, category tracking, internal notes).
- **System:** `schema_migrations`, `audit_logs`, `rate_limits`.

