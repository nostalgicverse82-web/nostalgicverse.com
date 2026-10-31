# NostalgicVerse — Phase 16 AI Architecture & System Topology

## 1. Architectural Philosophy & Principles

NostalgicVerse is a digital preservation museum dedicated to computing and gaming history. Phase 16 introduces private server-side intelligence, content automation, source verification, and candidate pipelines without compromising museum integrity, user privacy, or operational authority.

### Core Architecture Principle:
> **AI is an archival tool, NOT the source of truth.**

Under no circumstances is generative AI permitted to invent release dates, fabricate developers/publishers, forge compatibility records, hallucinate museum facts, or autonomously modify public catalog records.

### Authoritative Order of Precedence:
1. **Canonical Database Records** (`games`, `consoles`, `news_articles`, `companies`)
2. **Verified Source Evidence** (Cryptographic snapshots, historical archival records, primary sources)
3. **Owner Policy & Human Curatorial Decisions**
4. **Deterministic Validation Rules** (Schema constraints, type checkers, integrity rules)
5. **AI-Drafted Material** (Unpublished until human sign-off)

---

## 2. End-to-End System Pipeline

```
EXTERNAL DISCOVERY
        │
        ▼
SOURCE FETCH & SSRF FIREWALL
        │
        ▼
CRYPTOGRAPHIC SNAPSHOT & NORMALIZATION
        │
        ▼
CROSS-SOURCE DEDUPLICATION & IDENTITY RESOLUTION
        │
        ▼
FACTUAL CLAIM EXTRACTION & CONTRADICTION ENGINE
        │
        ├── [Contradiction Detected] ──► Flag to content_conflicts (Status: CONFLICT)
        │
        ▼
AI DRAFTING & ENRICHMENT (Server-side job queue)
        │
        ▼
STRICT SCHEMA VALIDATION & OUTPUT PACKAGING
        │
        ▼
TAGGED AS AI_DRAFT (ai_outputs status: AWAITING_OWNER)
        │
        ▼
OWNER COMMAND CENTER REVIEW GATE
        │
        ├── [Rejected] ──► Discarded / Archived with curatorial rationale
        └── [Approved] ──► Atomic Promotion to Canonical Database
                                    │
                                    ├── Live Website exhibits updated
                                    ├── Search indices refreshed
                                    ├── In-app user notifications dispatched
                                    └── Immutable audit entry recorded (ai_audit)
```

---

## 3. Database Schema Topology

Phase 16 establishes 12 relational tables under SQLite with strict foreign key constraints and transactional integrity:

| Table Name | Primary Role | Key Columns / Constraints |
| :--- | :--- | :--- |
| `ai_jobs` | Asynchronous job execution queue | `id, job_type, entity_type, entity_id, status, priority, idempotency_key, provider, model, prompt_version, payload, result, error, attempts, max_attempts, created_by, started_at, completed_at` |
| `ai_outputs` | Immutable staging store for generated drafts awaiting human review | `id, job_id REFERENCES ai_jobs(id), entity_type, entity_id, model, provider, prompt_version, draft_content, output_hash, status, reviewed_by REFERENCES users(id), reviewed_at, review_notes` |
| `ai_usage` | Cost, duration, and token accounting ledger | `id, job_id, provider, model, operation, input_tokens_est, output_tokens_est, cost_estimate, duration_ms, success, error_code, created_at` |
| `ai_audit` | Immutable compliance and operations trail | `id, actor_id REFERENCES users(id), action, entity_type, entity_id, job_id, details, created_at` |
| `source_candidates` | External news/game/exhibit candidate URLs | `id, domain, url, canonical_url, title, source_type, status, error_count, last_checked_at` |
| `source_snapshots` | Cryptographic evidence cache of fetched web pages | `id, source_id REFERENCES source_candidates(id), content_hash, title, author, published_date, text_content, raw_html_path, fetched_at` |
| `source_checks` | HTTP status and availability logs | `id, source_id REFERENCES source_candidates(id), http_status, response_time_ms, content_changed, error_message, checked_at` |
| `content_claims` | Atomic historical claims extracted from documents | `id, source_snapshot_id REFERENCES source_snapshots(id), entity_type, entity_id, claim_type, claim_text, confidence_score, status, verified_at` |
| `content_conflicts` | Contradiction tracker for divergent source claims | `id, entity_type, entity_id, field_name, source_a_id, claim_a_value, source_b_id, claim_b_value, status, resolution_notes, resolved_by REFERENCES users(id), resolved_at` |
| `news_candidates` | Curated news stories awaiting owner publication | `id, source_id, title, slug, summary, content, category, published_at, factual_status, identity_match, matched_article_id, status` |
| `game_candidates` | Newly discovered game specimens awaiting curation | `id, title, slug, platform, developer, publisher, release_year, genre, short_description, source_url, identity_match, matched_game_id, image_candidate_url, status` |
| `release_watch_records` | Tracked upcoming release records & change monitor | `id, entity_type, entity_id, source_url, current_release_date, detected_release_date, change_type, confidence_score, status, last_verified_at` |

---

## 4. Key Component Responsibilities

1. **AI Provider Abstraction (`server/ai/provider.cjs`)**:
   Standardized polymorphic interface wrapping Gemini, Anthropic, OpenAI, and a zero-dependency deterministic Mock Provider for CI/CD test modes.
2. **Safe Source Fetcher (`server/services/sourceFetchService.cjs`)**:
   SSRF-hardened ingestion layer with IP range blocklists, URL canonicalization, HTML article extraction, and SHA-256 fingerprinting.
3. **AI Job Queue (`server/services/aiJobQueueService.cjs`)**:
   Priority-aware background queue with idempotency keys, entity locks, exponential backoff retries, crash recovery, circuit breakers, and owner kill switch.
4. **News Intelligence (`server/services/newsIntelligenceService.cjs`)**:
   Deduplication engine and cross-source contradiction detector with atomic promotion into live `news_articles`.
5. **Game Discovery (`server/services/gameDiscoveryService.cjs`)**:
   Multi-tier identity matching (`EXACT`, `LIKELY`, `POSSIBLE`, `NEW`, `CONFLICT`) and artwork curation pipeline into live `games` and `game_images`.
6. **Release Monitor (`server/services/releaseMonitorService.cjs`)**:
   Automated change detection daemon notifying catalog followers on owner-verified release date revisions.
7. **Owner Command Center (`server/api/owner.cjs` & `assets/js/owner-ui.js`)**:
   Single pane of glass for curatorial review, cost analytics, queue oversight, and kill switch controls.
