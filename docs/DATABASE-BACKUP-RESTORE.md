# Database Backup and Restore Procedure

## Database Location
The canonical database for NostalgicVerse is stored in the `server/db/` directory. The production path is configured via environment variables but defaults to `server/db/nostalgicverse.sqlite`.

## Backup Procedure (SQLite)
Because we are using SQLite in WAL (Write-Ahead Logging) mode, you should not just copy the `.sqlite` file while the server is actively writing, as it could result in corruption or missed data in the `-wal` file.

**Option 1: Hot Backup (Zero Downtime)**
Use the SQLite `VACUUM INTO` command or `.backup` from the CLI:
```bash
sqlite3 server/db/nostalgicverse.sqlite ".backup 'server/db/backup_$(date +%Y%m%d).sqlite'"
```

**Option 2: Cold Backup**
1. Stop the Node.js server.
2. Copy `nostalgicverse.sqlite`, `nostalgicverse.sqlite-wal`, and `nostalgicverse.sqlite-shm`.
3. Restart the server.

## Restore Procedure
1. Stop the Node.js server to prevent any active writes.
2. Move the existing database files to a safe `_old` directory.
3. Copy your backup file into the `server/db/` directory and rename it to `nostalgicverse.sqlite`.
4. (Optional) Run `node server/db/migrate.cjs` to ensure the schema is completely up-to-date.
5. Start the Node.js server.

## Data-Loss Considerations
- Restoring from an older backup will permanently lose any accounts, messages, and profile updates made since the time of the backup. 
- For High Availability, consider running a CRON job to automatically run `sqlite3 .backup` nightly and ship it to an external S3 bucket.

