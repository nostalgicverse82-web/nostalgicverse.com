# NostalgicVerse — Phase 12 Owner Metrics & Administration Architecture

This document specifies the authoritative metrics architecture exposed to platform curators and administrators via `/api/owner/stats` and displayed in `/owner/index.html`.

---

## 1. Metric Clusters Overview

The owner dashboard organizes platform health into four distinct, authoritative clusters. In strict adherence to platform standards, every metric is computed directly from SQLite database tables or operating system file statistics—zero hardcoded numbers or mock statistics are permitted.

```
+---------------------------------------------------------------------------------+
|                                OWNER DASHBOARD                                  |
+------------------------+------------------------+-------------------------------+
|  1. PLATFORM CLUSTER   |   2. CONTENT CLUSTER   |     3. COMMUNITY CLUSTER      |
|  - Total Users         |   - Published Games    |     - Total Comments          |
|  - Realtime Online     |   - Published Consoles |     - Total Reviews           |
|  - Pending Submissions |   - Published Stories  |     - Pending Reports         |
|  - Open Support Tickets|   - Published Guides   |     - Total Friendships       |
|                        |   - Published News     |                               |
+------------------------+------------------------+-------------------------------+
|                               4. SYSTEM CLUSTER                                 |
|  - Authoritative DB Size (MB)    - SQLite Journal Mode (WAL)                    |
|  - Realtime Status (Online)      - Search Index Document Count                  |
|  - Total Registered Media Items                                                 |
+---------------------------------------------------------------------------------+
```

---

## 2. Cluster Definitions & Authoritative Queries

### Cluster 1: Platform Cluster
Measures core user population, live engagement, and incoming queue volume:
1. **Total Registered Users**:
   ```sql
   SELECT COUNT(*) as c FROM users;
   ```
2. **Realtime Online Users**:
   Computed live in-memory via WebSocket connection manager:
   ```javascript
   function getOnlineUserCount() {
       return userSockets.size;
   }
   ```
3. **Pending Community Submissions**:
   ```sql
   SELECT COUNT(*) as c FROM submissions WHERE status = 'PENDING_REVIEW';
   ```
4. **Open Support Tickets**:
   ```sql
   SELECT COUNT(*) as c FROM support_tickets WHERE status = 'OPEN';
   ```

---

### Cluster 2: Content Cluster
Measures catalog richness and curated archive depth:
1. **Published Games**:
   ```sql
   SELECT COUNT(*) as c FROM games WHERE status = 'PUBLISHED';
   ```
2. **Published Consoles**:
   ```sql
   SELECT COUNT(*) as c FROM consoles WHERE status = 'PUBLISHED';
   ```
3. **Published Stories**:
   ```sql
   SELECT COUNT(*) as c FROM stories;
   ```
4. **Published Guides**:
   ```sql
   SELECT COUNT(*) as c FROM guides;
   ```
5. **Published News Articles**:
   ```sql
   SELECT COUNT(*) as c FROM news_articles WHERE status = 'PUBLISHED';
   ```

---

### Cluster 3: Community Cluster
Quantifies social engagement, community interactions, and safety flags:
1. **Total Comments**:
   ```sql
   SELECT COUNT(*) as c FROM comments WHERE deleted_at IS NULL;
   ```
2. **Total Reviews**:
   ```sql
   SELECT COUNT(*) as c FROM reviews WHERE status = 'PUBLISHED';
   ```
3. **Pending Reports (Flagged Content)**:
   ```sql
   SELECT COUNT(*) as c FROM reports WHERE status = 'PENDING';
   ```
4. **Total Active Friendships**:
   ```sql
   SELECT COUNT(*) as c FROM friends;
   ```

---

### Cluster 4: System & Infrastructure Cluster
Monitors underlying storage, database configuration, search indices, and media assets:
1. **Authoritative Database Size**:
   ```javascript
   const dbPath = path.resolve(__dirname, '../../data/nostalgicverse.db');
   const databaseSize = (fs.statSync(dbPath).size / (1024 * 1024)).toFixed(2) + ' MB';
   ```
2. **SQLite Journal Mode**:
   ```sql
   PRAGMA journal_mode; -- Returns 'wal'
   ```
3. **Realtime Engine Status**:
   Reported as `Online (Connected)` with live health pinging.
4. **Search Index Entries**:
   Count of searchable documents indexed in `data/search-index.json`.
5. **Total Media Files**:
   ```sql
   SELECT COUNT(*) as c FROM game_images;
   ```

---

## 3. Realtime Activity Feed

The dashboard aggregates the 5 most recent platform events in chronological order by combining submissions and user registrations:
```sql
SELECT 'New submission: ' || title as event, created_at FROM submissions ORDER BY created_at DESC LIMIT 3;
SELECT 'New registration: @' || username as event, created_at FROM users WHERE role != 'OWNER' ORDER BY created_at DESC LIMIT 3;
```
Results are merged and sorted by timestamp `DESC` to provide immediate visibility into community activity.

