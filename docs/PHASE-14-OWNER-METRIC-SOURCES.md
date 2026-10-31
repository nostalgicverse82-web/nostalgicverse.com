# NOSTALGICVERSE — PHASE 14 OWNER DASHBOARD METRIC SOURCES

**Policy:** 100% Real Measured Data. Zero hardcoded counters, fabricated charts, or simulated visitor stats.

---

## 1. Platform Metrics

### Total Registered Users
- **Query:** `SELECT COUNT(*) as c FROM users WHERE role != 'OWNER'`
- **Authority:** SQLite `users` table
- **Filters:** Excludes system owner
- **Caching:** None (Real-time live aggregation)
- **Refresh Strategy:** On overview dashboard request & via WebSocket `USER_REGISTERED` push

### Suspended Users
- **Query:** `SELECT COUNT(*) as c FROM users WHERE status = 'SUSPENDED'`
- **Authority:** SQLite `users` table
- **Filters:** Explicit status match
- **Caching:** None
- **Refresh Strategy:** Immediate upon owner moderation action

### Open Moderation Reports
- **Query:** `SELECT COUNT(*) as c FROM reports WHERE status = 'OPEN'`
- **Authority:** SQLite `reports` table
- **Filters:** Open reports pending investigation
- **Caching:** None
- **Refresh Strategy:** Live DB count; push notification on new report submission

---

## 2. Content Inventory Metrics

### Published Games
- **Query:** `SELECT COUNT(*) as c FROM games WHERE status = 'PUBLISHED'`
- **Authority:** SQLite `games` table
- **Filters:** `status = 'PUBLISHED'`
- **Caching:** In-memory cached query invalidation on CMS publish/unpublish
- **Refresh Strategy:** On demand via `/api/owner/stats`

### Published Consoles
- **Query:** `SELECT COUNT(*) as c FROM consoles WHERE status = 'PUBLISHED'`
- **Authority:** SQLite `consoles` table
- **Filters:** Published records
- **Caching:** None
- **Refresh Strategy:** On demand

### Published Articles (News, Stories, Guides)
- **Query:**
  - News: `SELECT COUNT(*) as c FROM news_articles WHERE status = 'PUBLISHED'`
  - Stories: `SELECT COUNT(*) as c FROM stories WHERE status = 'PUBLISHED'`
  - Guides: `SELECT COUNT(*) as c FROM guides WHERE status = 'PUBLISHED'`
- **Authority:** Dedicated SQLite content tables
- **Filters:** Status check
- **Caching:** None
- **Refresh Strategy:** Live retrieval

### Timeline Events & Genres
- **Query:**
  - Events: `SELECT COUNT(*) as c FROM timeline_events`
  - Genres: `SELECT COUNT(*) as c FROM genres`
- **Authority:** SQLite canonical tables
- **Filters:** All active records
- **Caching:** None
- **Refresh Strategy:** Live retrieval

---

## 3. Operations & Queue Metrics

### Pending User Submissions
- **Query:** `SELECT COUNT(*) as c FROM submissions WHERE status = 'PENDING_REVIEW'`
- **Authority:** SQLite `submissions` table
- **Filters:** Submissions awaiting owner triage
- **Caching:** None
- **Refresh Strategy:** Immediate on `/api/owner/submissions` load and WebSocket event

### Open Support Tickets
- **Query:** `SELECT COUNT(*) as c FROM support_tickets WHERE status IN ('OPEN', 'WAITING_ON_ADMIN')`
- **Authority:** SQLite `support_tickets` table
- **Filters:** Actionable open tickets
- **Caching:** None
- **Refresh Strategy:** Real-time push + REST fetch

### Background Jobs Backlog
- **Query:** `SELECT COUNT(*) as c FROM background_jobs WHERE status IN ('QUEUED', 'RUNNING')`
- **Authority:** SQLite `background_jobs` table
- **Filters:** Unfinished queue items
- **Caching:** None
- **Refresh Strategy:** Polled by job engine and pushed via WS

---

## 4. Digital Assets & Media Metrics

### Local Verified Artwork
- **Query:** `SELECT COUNT(*) as c FROM game_images WHERE verification_status = 'VERIFIED_LOCAL' OR image_type = 'local'`
- **Authority:** SQLite `game_images` table cross-referenced with `assets/images/games/`
- **Filters:** Disk-verified local files
- **Caching:** Memory Set (`localGamesImageCache`)
- **Refresh Strategy:** Updated on file migration

### Remote Verified Artwork
- **Query:** `SELECT COUNT(*) as c FROM game_images WHERE verification_status = 'VERIFIED_REMOTE' OR (image_type = 'remote' AND verification_status = 'verified')`
- **Authority:** SQLite `game_images` table
- **Filters:** Network reachable with verified MIME
- **Caching:** None
- **Refresh Strategy:** Full catalogue audit & individual verification rechecks

### Museum Accession Fallback Plates
- **Query:** `SELECT COUNT(*) as c FROM game_images WHERE verification_status = 'FALLBACK' OR image_type = 'fallback'`
- **Authority:** SQLite `game_images` table
- **Filters:** Fallback-assigned items
- **Caching:** None
- **Refresh Strategy:** Auto-resolved during media audits

---

## 5. System Health Instrumentation

### SQLite WAL Health
- **Query:** `PRAGMA integrity_check`, `PRAGMA foreign_key_check`
- **Authority:** Embedded SQLite engine
- **Filters:** Zero errors expected
- **Caching:** Evaluated on health probe
- **Refresh Strategy:** `/api/owner/health` endpoint

### Search Index Synchronization
- **Method:** `JSON.parse(fs.readFileSync('data/search-index.json')).length` compared with canonical database published count
- **Authority:** Filesystem artifact vs SQLite DB
- **Filters:** Published content types
- **Caching:** In-memory document count
- **Refresh Strategy:** Evaluated on every search rebuild job

