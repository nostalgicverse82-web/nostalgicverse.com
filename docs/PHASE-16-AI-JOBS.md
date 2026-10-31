# NostalgicVerse — Phase 16 AI Job Queue & Lifecycle Engine

## 1. Job Queue Overview

All AI processing runs asynchronously on a robust server-side priority job queue (`server/services/aiJobQueueService.cjs`). Operations are persisted in the `ai_jobs` table to guarantee zero state loss across server restarts.

---

## 2. Queue Lifecycle State Machine

```
               ┌───────────────┐
               │    ENQUEUE    │
               └───────┬───────┘
                       │
             [Budget Check Passed?]
              ├── No ────────► [ HELD ] (Awaiting budget reset or CRITICAL bypass)
              └── Yes ───────┐
                             ▼
                     ┌───────────────┐
                     │    QUEUED     │
                     └───────┬───────┘
                             │
                     [Worker Picks Job]
                             │
                             ▼
                     ┌───────────────┐
        ┌───────────►│  PROCESSING   ├─────────────┐
        │            └───────┬───────┘             │
        │                    │                     │
 [Transient Error]    [AI Synthesis Done]    [Fatal Error]
        │                    │                     │
        │                    ▼                     ▼
 ┌──────┴──────┐     ┌───────────────┐     ┌───────────────┐
 │  RETRYING   │     │AWAITING_OWNER │     │    FAILED     │
 └─────────────┘     └───────┬───────┘     └───────────────┘
                             │
                   [Owner Curatorial Gate]
                    ├── Approve ─────► [ COMPLETED ] (Canonical DB updated)
                    └── Reject  ─────► [ CANCELLED ] (Draft archived)
```

---

## 3. Priority Scheduling & Idempotency

### Priority Weights:
Jobs are executed based on strict architectural tiers:
1. `CRITICAL` (System security audits, active data corruption repairs) — Bypasses budget holds.
2. `HIGH` (Direct owner interactive enrichment requests).
3. `NORMAL` (Automated news candidate ingestion, game candidate scraping).
4. `LOW` (Bulk background metadata backfills).

### Idempotency Keys:
To prevent duplicate job creation from rapid webhook clicks or overlapping polling loops:
- Format: `${job_type}:${entity_type}:${entity_id}:${prompt_version}`
- If a job with an identical key exists in `QUEUED`, `PROCESSING`, or `AWAITING_OWNER`, the queue service returns the existing job without re-enqueuing.

---

## 4. Entity Concurrency Locks & Crash Recovery

### Entity Locks:
To prevent race conditions where two simultaneous jobs attempt to enrich the same game or article:
- `activeEntityLocks` (`Set<string>`) locks `${entity_type}:${entity_id}` during active processing.
- Parallel worker iterations skip locked entities until the active job completes or fails.

### Stale Job Recovery on Reboot:
If the Node.js server process is killed or restarted while jobs are in `PROCESSING`:
```javascript
async function recoverStaleAIJobs() {
    const result = await dbAsync.run(`
        UPDATE ai_jobs 
        SET status = 'FAILED', 
            error = 'Process restart interrupted active AI job', 
            completed_at = CURRENT_TIMESTAMP, 
            updated_at = CURRENT_TIMESTAMP 
        WHERE status = 'PROCESSING'
    `);
}
```
This guarantees no job remains orphaned in an eternal `PROCESSING` state.

---

## 5. Exponential Backoff Retries

Jobs encountering transient network failures (timeouts, HTTP 429, HTTP 503) transition to `RETRYING` with exponential backoff:
- **Delay Formula**: `Math.min(attempt * 1500, 10000)` ms.
- **Max Attempts**: Configured via `AI_MAX_RETRIES` (default: 3).
- **Non-Transient Errors**: Schema mismatches, invalid JSON, or database constraints fail immediately without wasteful retries.
