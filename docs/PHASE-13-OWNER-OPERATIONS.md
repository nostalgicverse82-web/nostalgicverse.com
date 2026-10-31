# Phase 13 — Owner & Administrator Operations Playbook

## 1. System Health & Probing Endpoints

NostalgicVerse provides two authoritative monitoring endpoints for uptime checkers, container orchestrators, and system administrators.

### 1.1 Liveness Probe (`GET /api/health`)
- **Purpose**: Confirms the Express process and Node.js event loop are alive.
- **Typical Response**:
  ```json
  {
    "status": "ok",
    "uptime": 3612.45,
    "timestamp": "2026-09-23T11:25:00.000Z"
  }
  ```
- **Operator Action on Failure**: If this endpoint times out or returns HTTP 0, the Node.js process is hung or event-loop starved. Restart the Node process via PM2 / Service Manager.

### 1.2 Readiness Probe (`GET /api/ready`)
- **Purpose**: Verifies database connectivity, WAL mode, and disk query execution.
- **Typical Response**:
  ```json
  {
    "status": "ready",
    "checks": {
      "database": "ok",
      "journalMode": "WAL",
      "uptime": 3612.45
    }
  }
  ```
- **Operator Action on Failure**: If this endpoint returns HTTP 503, the SQLite database is locked or corrupted. Inspect the WAL file and run the integrity check.

---

## 2. Routine Database Maintenance Procedures

### 2.1 Taking an On-Demand Backup Snapshot
Run the disaster recovery snapshot tool:
```powershell
node tools/maintenance/disaster-recovery.cjs snapshot
```
The snapshot is automatically verified and stored in `data/backups/nostalgicverse-backup-<timestamp>.db`.

### 2.2 Inspecting and Cleaning Test Users
To audit and purge disposable test accounts, ensuring only authoritative accounts remain:
```powershell
node tools/validation/purge-test-users.cjs
```
This preserves `owner`, `sufiyan0207`, and `keep-me-up`, cleans any leftover `test_` or `storm_` records, and confirms `PRAGMA foreign_key_check = 0`.

### 2.3 WAL Checkpoint Management
SQLite automatically checkpoints every 1,000 pages (~4MB). To force a complete WAL checkpoint during maintenance windows:
```powershell
node -e "const { dbAsync } = require('./server/db/connection.cjs'); dbAsync.get('PRAGMA wal_checkpoint(TRUNCATE)').then(console.log);"
```

---

## 3. Realtime & WebSocket Operational Monitoring

### 3.1 Live Online Users Count
The WebSocket engine tracks connected users in memory via `getOnlineUserCount()`.
To query live socket connections:
```powershell
Invoke-RestMethod http://localhost:3000/api/health
```

### 3.2 WebSocket Hardening Rules
- Maximum frame size is strictly limited to 64KB (`maxPayload: 65536`).
- Automatic dead-socket detection sweeps every 30 seconds via ping/pong frames.
- Clients implement full randomized reconnect jitter ($75\% \text{ to } 125\%$) to eliminate thundering herd storms on restart.

---

## 4. Rate-Limiting Policy Adjustments

Rate limits are configured in `server/middleware/rateLimitMiddleware.cjs`:

```javascript
// Thresholds per minute per IP
const authLoginLimiter      = createRateLimiter({ windowMs: 60000, maxRequests: 10, ... });
const authSignupLimiter     = createRateLimiter({ windowMs: 60000, maxRequests: 5, ... });
const searchLimiter         = createRateLimiter({ windowMs: 60000, maxRequests: 60, ... });
const communityWriteLimiter = createRateLimiter({ windowMs: 60000, maxRequests: 30, ... });
const chatMessageLimiter    = createRateLimiter({ windowMs: 60000, maxRequests: 60, ... });
```

During high-traffic exhibitions or conventions, the owner may adjust `maxRequests` without restarting the database.

---

## 5. Emergency Checklist for System Anomalies

| Symptom | Probable Cause | Action |
| :--- | :--- | :--- |
| **High CPU Usage** | Repeated PBKDF2 hashing attempts | Verify `authLoginLimiter` is active; check for bot IP in logs and block via reverse proxy. |
| **Database Busy Errors** | Uncheckpointed WAL or rogue writer | Run `PRAGMA wal_checkpoint(PASSIVE)` and verify all queries use `dbAsync.transaction`. |
| **Search 500 Errors** | Corrupt search index | Run `node tools/maintenance/disaster-recovery.cjs rebuild-search`. |
| **Image Broken Links** | Missing WebP asset | Client auto-falls back to `/assets/images/museum-fallback.svg`; run `node tools/validation/audit-media-inventory.cjs`. |

