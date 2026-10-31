# NOSTALGICVERSE — PHASE 14 JOB ENGINE & WORKER AUTOMATION

## 1. Asynchronous Architecture & Table Schema
- **Authority:** `background_jobs` table
- **Job States:** `QUEUED`, `RUNNING`, `COMPLETED`, `FAILED`, `CANCELLED`
- **Fields:** `id`, `job_type`, `payload`, `status`, `attempts`, `max_attempts`, `error_message`, `created_by`, `created_at`, `started_at`, `completed_at`

---

## 2. Strict Allowlist & Security Boundaries
- **Zero Arbitrary Shell Execution:** The job runner executes only pre-compiled internal routines mapped by explicit job type constants.
- **Allowed Job Types:**
  - `SEARCH_REBUILD`: Regenerates `data/search-index.json` atomically.
  - `SITEMAP_REBUILD`: Rebuilds `sitemap.xml` with canonical public URLs.
  - `MEDIA_AUDIT`: Performs complete catalogue image inspection.
  - `SEO_AUDIT`: Scans content catalogue for missing meta tags.
  - `BACKUP_DATABASE`: Executes automated SQLite snapshot.

---

## 3. Concurrency Protection & Fault Recovery
- **Mutex Guard:** Two heavy rebuild jobs of the same type cannot execute concurrently.
- **Server Restart Resilience:** In-progress jobs interrupted by a process restart are detected on boot and safely marked for retry or logged as failed without duplicate execution.

