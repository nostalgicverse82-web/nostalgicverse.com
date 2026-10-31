# NostalgicVerse — Phase 16 AI Observability & Auditability

## 1. Observability Overview

NostalgicVerse Phase 16 provides comprehensive real-time telemetry, structured application logging, and an immutable audit trail covering every AI operation, review decision, and state transition.

---

## 2. Real-Time Telemetry & SSE Streaming

The Owner Command Center maintains a real-time Server-Sent Events (SSE) / WebSocket connection (`/api/owner/ai/stream`) to observe background jobs without manual page reloading:

### Event Types Emitted:
| Event Type | Payload Attributes | Trigger Condition |
| :--- | :--- | :--- |
| `AI_JOB_ENQUEUED` | `id, job_type, entity_type, entity_id, status, priority` | New job created in `ai_jobs` |
| `AI_JOB_PROCESSING` | `id, job_type, status` | Queue worker begins execution |
| `AI_JOB_AWAITING_OWNER` | `id, output_id, job_type, status, duration_ms` | Drafting completed; pending human review |
| `AI_JOB_FAILED` | `id, job_type, status, error` | Job failed non-transiently or exhausted retries |
| `AI_KILL_SWITCH_UPDATED`| `state, reason, updated_at` | Kill switch toggled by owner |

---

## 3. Structured Logging Architecture

All intelligence services emit structured JSON logs via the central server logger (`server/utils/logger.cjs`):

```json
{
  "timestamp": "2026-09-26T19:43:55.554Z",
  "level": "INFO",
  "service": "AI_QUEUE",
  "jobId": "9d62355a-0d29-4169-8c58-1b6864319cc2",
  "jobType": "GAME_ENRICHMENT",
  "status": "AWAITING_OWNER",
  "durationMs": 412
}
```

---

## 4. Immutable Audit Ledger (`ai_audit`)

Every privileged owner review, job creation, or kill switch adjustment writes directly to the `ai_audit` table:

```sql
CREATE TABLE ai_audit (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    job_id TEXT,
    details TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Audited Actions:
- `ENQUEUE`: Job submitted to queue.
- `APPROVE_DRAFT`: Owner approved AI draft and committed data to canonical table.
- `REJECT_DRAFT`: Owner discarded draft with curatorial notes.
- `KILL_SWITCH`: AI automation state changed.
- `CONFLICT_RESOLVED`: Discrepancy between opposing historical sources resolved.
- `RETRY`: Job re-enqueued after transient failure.
