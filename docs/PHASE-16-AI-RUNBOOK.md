# NostalgicVerse — Phase 16 Operator & Production Runbook

## 1. Environment Configuration

To operate Phase 16 in production or local development, configure the following keys in `.env`:

```ini
# AI Provider Configuration
AI_PROVIDER=gemini              # Options: gemini | anthropic | openai | mock
AI_MODEL=gemini-2.0-flash       # Model ID
AI_API_KEY=your_api_key_here    # Secret API key (never commit to git)

# Queue & Resilience Settings
AI_TIMEOUT_MS=15000             # Request timeout in ms (default: 15s)
AI_MAX_RETRIES=3                # Max retries on transient errors
AI_TEST_MODE=false              # Set true for deterministic mock execution
AI_DAILY_BUDGET_USD=5.00        # Daily spending cap in USD
AI_AUTOMATION_ENABLED=true      # Master switch: true/false
```

---

## 2. Emergency Operations

### Scenario A: AI Provider Outage or Rate Limit Flurry
1. **Symptom**: Jobs accumulating with status `RETRYING` or `FAILED`, circuit breaker tripped.
2. **Action**:
   - Access Owner Command Center -> AI Operations tab.
   - Switch AI Provider (e.g. from `gemini` to `anthropic` or `mock`).
   - If upstream outage is severe, set Kill Switch to `DISABLED` or `DEGRADED`.
   - Alternatively via CLI or DB:
     ```sql
     UPDATE site_settings SET value = 'DISABLED' WHERE key = 'ai_kill_switch';
     ```

### Scenario B: Unexpected Spending or Runaway Ingestion
1. **Symptom**: Daily budget warning alert or unexpected surge in `ai_usage`.
2. **Action**:
   - Set Kill Switch to `DISABLED`.
   - Review top operations in `ai_usage`:
     ```sql
     SELECT operation, COUNT(*), SUM(cost_estimate) 
     FROM ai_usage 
     WHERE created_at >= date('now', 'start of day') 
     GROUP BY operation;
     ```
   - Cancel stuck queued jobs:
     ```sql
     UPDATE ai_jobs SET status = 'CANCELLED' WHERE status = 'QUEUED';
     ```

### Scenario C: Server Crash Recovery
1. **Symptom**: Server unexpectedly restarted while jobs were processing.
2. **Action**:
   - Built-in automatic recovery executes on server boot: any job left in `PROCESSING` status is marked `FAILED` with error message `"Process restart interrupted active AI job"`.
   - Curators can review failed jobs in Command Center and click **Retry** for any interrupted job.

---

## 3. Routine Maintenance & Cleanups

### Purging Expired Snapshots & Audit Logs:
```sql
-- Clean up raw HTTP source checks older than 30 days
DELETE FROM source_checks WHERE checked_at < datetime('now', '-30 days');

-- Clean up cancelled or completed jobs older than 60 days
DELETE FROM ai_jobs WHERE status IN ('COMPLETED', 'CANCELLED') AND updated_at < datetime('now', '-60 days');
```
