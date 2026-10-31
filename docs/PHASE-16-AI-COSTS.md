# NostalgicVerse — Phase 16 AI Cost Control & Budget Caps

## 1. Cost Control Principles

Third-party AI APIs represent a continuous variable operational expenditure. NostalgicVerse implements rigorous cost controls, budget ceiling enforcement, and micro-accounting to prevent surprise bills or runaway crawler loops.

### Key Rules:
1. **Hard Daily Budget Cap**: Enforced via `AI_DAILY_BUDGET_USD` (default `$5.00/day`).
2. **Deterministic Token Accounting**: Recorded per operation in `ai_usage`.
3. **Automatic Queue Throttling**: Jobs transition to `HELD` when the cap is reached.
4. **Emergency Kill Switch**: Instant administrative toggle to halt all AI processing.

---

## 2. Token & Cost Accounting Architecture

Every provider call calculates token throughput and estimates cost before persisting to `ai_usage`:

```sql
INSERT INTO ai_usage (
    id, job_id, provider, model, operation, 
    input_tokens_est, output_tokens_est, cost_estimate, 
    duration_ms, success, created_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP);
```

### Rate Schedules (Configurable Heuristic Models):
- **Lightweight Models** (e.g., `gemini-2.0-flash`, `gpt-4o-mini`):
  - Ingestion: ~$0.00010 per 1,000 tokens
  - Synthesis: ~$0.00015 per 1,000 tokens
- **Heuristic Counter**:
  `estimateTokens(text)` counts whitespace word boundaries (`words * 1.33`) with sub-millisecond execution overhead.

---

## 3. Daily Budget Cap Enforcement

Before any non-critical job is admitted to the active queue:

```javascript
async function checkDailyBudgetExceeded() {
    const budgetLimit = parseFloat(process.env.AI_DAILY_BUDGET_USD || '5.00');
    const row = await dbAsync.get(`
        SELECT COALESCE(SUM(cost_estimate), 0.0) as dailyCost 
        FROM ai_usage 
        WHERE created_at >= date('now', 'start of day')
    `);
    const spent = row ? parseFloat(row.dailyCost) : 0;
    return spent >= budgetLimit;
}
```

### Budget Behavior:
- **Budget Exhausted (`spent >= budgetLimit`)**:
  - `NORMAL` and `LOW` priority jobs are created with status `HELD`.
  - A real-time notification (`AI_BUDGET_EXCEEDED`) is broadcast to the Owner Command Center.
  - `CRITICAL` priority jobs (e.g. security audits) are allowed to proceed.
- **Budget Reset**:
  - Midnight UTC automatically resets daily spending aggregation.
  - The owner can manually increase `AI_DAILY_BUDGET_USD` via environment configuration.

---

## 4. Operational Kill Switch

The Owner Command Center provides a high-priority kill switch:

| State | Behavior |
| :--- | :--- |
| `ENABLED` | Normal operation. Queue processes jobs as they arrive. |
| `DEGRADED` | Only `HIGH` and `CRITICAL` jobs process. Background harvesting paused. |
| `DISABLED` | Complete AI freeze. All new enqueue attempts throw an immediate error. Active processing halted. |

All kill switch transitions are logged in `ai_audit` with the owner's user ID and administrative reason.
