# Phase 13 — Enterprise Disaster Recovery Strategy

## 1. Executive Summary & Recovery Objectives

The NostalgicVerse Disaster Recovery (DR) system guarantees complete business continuity, authoritative database restoration, search index synchronization, and zero data corruption in the event of hardware failures, host crashes, or disk faults.

### Target Recovery Metrics:
- **Recovery Point Objective (RPO)**: $<1\text{ second}$. With SQLite in WAL mode and `PRAGMA synchronous = NORMAL`, all committed transactions are stored in durable write-ahead log frames on disk.
- **Recovery Time Objective (RTO)**: $<30\text{ seconds}$. Automated snapshot restoration, integrity verification, and atomic search index compilation execute within seconds.

---

## 2. Disaster Recovery Subsystems

```
                                [ Active Production System ]
                                  - Server: Express / Node
                                  - DB: nostalgicverse.db (WAL)
                                  - Index: search-index.json
                                             |
             +-------------------------------+-------------------------------+
             |                               |                               |
             v                               v                               v
    [ Automated Snapshots ]         [ Atomic Search Rebuild ]       [ Atomic Sitemap Sync ]
    - VACUUM INTO                   - Output to .tmp file           - XML valid schema
    - Deflag / Compacted            - Strict JSON Validation        - Root https:// URLs
    - Verified with integrity_check - Atomic fs.renameSync          - Canonical linking
             |
             v
    [ Sandbox Test Restore ]
    - Copy to temporary db
    - PRAGMA integrity_check
    - PRAGMA foreign_key_check
    - Verify owner & tables
    - Safe cleanup of sandbox
```

---

## 3. Authoritative Snapshot Mechanics

### 3.1 Live Database Snapshots via `VACUUM INTO`
Standard file copy (`cp` or `copy`) of an active SQLite database in WAL mode risks copying dirty or half-written pages. NostalgicVerse uses SQLite's native online snapshot command:
```sql
VACUUM INTO 'data/backups/nostalgicverse-backup-<timestamp>.db';
```
- **Non-blocking**: Readers continue accessing the database without interruption during snapshot generation.
- **Self-contained**: Fuses WAL log pages into a single, compacted, defragmented `.db` file.
- **Durability**: Guaranteed to be 100% structurally consistent upon creation.

### 3.2 Automated Validation Pipeline
Every generated snapshot is immediately verified via:
1. `PRAGMA integrity_check`: Validates B-tree node indices, freelist pages, and table page checksums.
2. `PRAGMA foreign_key_check`: Confirms zero orphaned records across all relations.
3. **Core Schema Audit**: Verifies presence of all primary tables (`users`, `sessions`, `games`, `consoles`, `comments`, `reviews`, `reactions`, `conversations`, `messages`).
4. **Owner Account Integrity**: Confirms exactly one valid `OWNER` account exists in the snapshot.

---

## 4. Sandbox Non-Destructive Restore Testing

To guarantee that a backup can actually be restored in an emergency, NostalgicVerse provides an automated dry-run sandbox restore procedure:
1. Clones the snapshot into `data/backups/restore-test-sandbox-<timestamp>.tmp`.
2. Opens the sandbox database in read/write mode.
3. Tests transactions (`BEGIN IMMEDIATE ... COMMIT`).
4. Validates table count and game/console records.
5. Safely unlinks the temporary sandbox file upon completion.

---

## 5. Atomic Search Index & Sitemap Rebuilding

### 5.1 Atomic Search Index Rebuild
If the server crashes while writing `data/search-index.json`, a truncated file would crash the frontend search page.
Phase 13 implements **atomic replacement**:
1. Search index is generated and written to `data/search-index.json.tmp`.
2. The temporary file is parsed with `JSON.parse()` to guarantee syntactical correctness.
3. An array size check confirms $>500$ valid entries.
4. An atomic operating system rename (`fs.renameSync`) swaps the temporary file into place.
Concurrent readers never observe an incomplete or half-written index file.

### 5.2 Atomic Sitemap Rebuild
Rebuilds `sitemap.xml` with canonical museum URLs, validating standard `<urlset>` schema and ensuring search engines receive updated URLs without 404s.

---

## 6. Disaster Recovery CLI Commands

The suite is operated via `tools/maintenance/disaster-recovery.cjs`:

```powershell
# 1. Create a verified snapshot
node tools/maintenance/disaster-recovery.cjs snapshot

# 2. Verify an existing backup file
node tools/maintenance/disaster-recovery.cjs verify data/backups/nostalgicverse-backup-latest.db

# 3. Perform a non-destructive sandbox dry-run restoration
node tools/maintenance/disaster-recovery.cjs test-restore data/backups/nostalgicverse-backup-latest.db

# 4. Atomically rebuild search index
node tools/maintenance/disaster-recovery.cjs rebuild-search

# 5. Atomically rebuild sitemap
node tools/maintenance/disaster-recovery.cjs rebuild-sitemap

# 6. Execute full disaster recovery validation suite
node tools/maintenance/disaster-recovery.cjs all
```

