# NOSTALGICVERSE — PHASE 15 CONTENT & MEDIA GAP MATRIX

**Audit Date:** 2026-09-26  
**Auditor:** NostalgicVerse Curatorial & Core Systems Engineering Team  
**Scope:** Canonical Content Architecture, Media Registry, Remote Image Verification, News & Release Intelligence, Content Relationships, Content Health Engine, Derived Data Pipelines, Scale & Recovery Hardening.

---

## 1. Executive Summary

Phase 15 builds the foundational **Content + Media + Source + News + Release Intelligence Engine** designed to scale NostalgicVerse from hundreds of exhibits to tens of thousands of exhibits without manual maintenance failure.

The core architectural principle is:
```
DATABASE / CANONICAL RECORD
        ↓
CONTENT SERVICES
        ↓
MEDIA RESOLVER
        ↓
PUBLIC PAGES  ──> SEARCH  ──> SITEMAP  ──> DISCOVERY  ──> OWNER HEALTH
```

Derived artifacts (`data/search-index.json`, `sitemap.xml`, static HTML exhibits, discovery feeds) may exist for performance, but they must **never become independent conflicting sources of truth**.

---

## 2. Subsystem Audit Matrix

Classification Key:
- **IMPLEMENTED**: Built, operational, and verified in codebase.
- **VERIFIED**: Measured and validated by automated test suites.
- **PARTIAL**: Partially constructed; missing complete edge cases or full catalogue coverage.
- **SCAFFOLDED**: Database schema or route placeholder exists without full business logic.
- **DESIGNED**: Architecture specified in requirements but code not yet written.
- **BROKEN**: Exists but fails validation or corrupts state under edge conditions.
- **MISSING**: Not yet implemented.

| # | Subsystem | Previous State | Target State (Phase 15) | Classification | Notes / Gap Action |
|---|---|---|---|---|---|
| 1 | Canonical Game Catalogue | SQLite (530 rows) vs JSON (528 games) | Unified canonical DB authority with normalized attributes, alias indexing, zero test pollution | PARTIAL | Reconcile 2 test records (`test-game`, `test-game-7`); ensure single authoritative source. |
| 2 | Game Media Registry | `game_images` (528 rows), 0 `media_metadata` | Strict unified registry (`game_images` + `media_metadata` + `data/media/game-images.json`) tracking dimensions, MIME, hash, license, attribution | PARTIAL | 2 games missing rows; `media_metadata` empty; sync canonical JSON. |
| 3 | Remote Image Verification | Basic HTTP HEAD check in `verify-remote-images.cjs` | Robust engine: HTTP HEAD/GET, content-type, magic-byte decode, redirect tracking, 429 backoff, 403 handling | PARTIAL | Needs magic-byte validation (reject HTML 200s), exponential backoff, per-domain rate limiting. |
| 4 | SSRF & Fetch Security | Basic URL check | Private IP filter (127.0.0.1, 10.x, 192.168.x, 172.16-31.x, 169.254.x, ::1), cloud metadata block, scheme whitelist (http/https only) | SCAFFOLDED | Enforce strict network-layer validation on all server-side fetch tools. |
| 5 | Local Media Migration | None | Dormant CLI tool (`npm run media:migrate-games`) converting verified remote images to `assets/images/games/{slug}.webp` with decode validation | DESIGNED | Build reversible, incremental migration with hash deduplication. |
| 6 | News Intelligence Engine | `news_articles` (6 rows) with draft/publish status | Canonical news schema with factual status (`CONFIRMED`, `OFFICIAL`, `REPORTED`, `RUMOR`), source linking, duplicate detection | PARTIAL | Enforce source requirement, version history, and relations to games/consoles. |
| 7 | Release Intelligence | `releases` table empty | Release tracking with platform, region, edition, date precision (`EXACT`, `MONTH_YEAR`, `YEAR`, `TBA`), change audit trail | SCAFFOLDED | Schema exists; populate canonical releases, link to games, track audit history. |
| 8 | Compatibility System | `compatibility_records` table empty | Website-side compatibility tracking with test versions, hardware tags, evidence verification | SCAFFOLDED | Emulator core separate; website compatibility records need validation & history. |
| 9 | Content Relationships | `content_relationships` table empty | Many-to-many relationship graph (game-console, game-series, game-news, game-story, console-timeline) with orphan validation | SCAFFOLDED | Build orphan auditor, prevent self/circular references, populate canonical links. |
| 10 | Content Health Engine | Phase 14 health placeholder | Multi-severity check (`CRITICAL`, `WARNING`, `INFO`), owner health UI (`/owner/content-health/`), ignore audit trail, individual recheck | PARTIAL | Connect health checks directly to DB: missing images, dead links, orphaned relations. |
| 11 | Media Management UI | Phase 14 media list placeholder | Full `/owner/media/` dashboard with filtering (local, remote, fallback, broken, unverified), bulk verification jobs, replacement workflow | PARTIAL | Wire up bulk audit job, candidate management, attribution editor. |
| 12 | Atomic Derived Data | Ad-hoc rebuild scripts in `tools/generation/` | Atomic file swapping (write to `.tmp`, validate schema/count, atomic rename) for `search-index.json`, `sitemap.xml`, and exhibits | PARTIAL | Build `tools/content/repair-content-derived-data.cjs` and atomic writers. |
| 13 | Homepage Discovery Resilience | Rotation script in `index.html` | Defensive double-buffering: preload next candidate, skip failed images, maintain visible card, museum fallback | PARTIAL | Eliminate flash-to-blank on network delay or broken candidate URL. |
| 14 | Scale Testing & Benchmarking | Phase 13 performance scripts | Synthetic scaling benchmarks for 500, 1k, 5k, 10k catalogue items across search, media audit, and discovery | DESIGNED | Test memory, query execution times, and pagination thresholds. |
| 15 | Backup & Disaster Recovery | Phase 13 `disaster-recovery.cjs` | Verification of WAL persistence, atomic DB restarts, media rollback, zero data loss | IMPLEMENTED | Verified operational; ensure Phase 15 tables are included in automated backup schemas. |

---

## 3. Detailed Catalogue Baseline (Current Database)

- **Total Games in SQLite:** 530 (528 canonical historical games + 2 test games `test-game`, `test-game-7`)
- **Total Consoles:** 65
- **Total Stories:** 14
- **Total Guides:** 14
- **Total News Articles:** 6
- **Total Timeline Events:** 91
- **Total Genres:** 32
- **Game Images Registered:** 528
  - `local` + `verified`: 296
  - `remote` + `verified`: 24
  - `fallback` + `fallback`: 208
  - Missing image records: 2 games (`test-game`, `test-game-7`)
- **Local Files in `assets/images/games/`:** 297 files (including fallback placeholder)
- **Authoritative User Accounts:** Exactly 3 (`owner`, `sufiyan0207`, `keep-me-up`)

---

## 4. Phase 15 Implementation Roadmap

1. **Database Migration (`013_phase15_intelligence.sql`)**:
   - Enhance `game_images` with technical columns (`mime_type`, `width`, `height`, `aspect_ratio`, `license_status`, `attribution`, `last_checked_at`, `last_http_status`, `failure_reason`, `fallback_available`, `local_path`).
   - Enhance `releases` with `date_precision`, `last_verified_at`, `change_history`.
   - Add `slug_history` table for immutable redirect and slug evolution tracking.
   - Add indexes on `content_relationships(source_type, source_id)`, `content_relationships(target_type, target_id)`.
2. **Canonical Game Media Audit & Registry Synchronization**:
   - Audit all 528+ games against disk files and remote network endpoints with SSRF guards.
   - Generate `data/media/game-images.json`.
   - Author `docs/PHASE-15-GAME-MEDIA-REPORT.md`.
3. **Core Services & Tools**:
   - `server/services/mediaService.cjs`: SSRF-safe fetching, MIME & magic-byte validation, resolution rules.
   - `tools/content/audit-game-media.cjs`: Full catalogue CLI auditor with rate-limiting.
   - `tools/content/migrate-game-media.cjs`: Dormant local migration tool (`npm run media:migrate-games`).
   - `tools/content/repair-content-derived-data.cjs`: Atomic derived data pipeline.
4. **News, Releases, and Relationships Engine**:
   - Relationship validation and orphan detection.
   - Release audit trail and precision handling.
   - Factual status and source management for news articles.
5. **Frontend Resilience**:
   - Harden homepage rotation with double-buffered candidate verification.
   - Guarantee zero layout shifts or blank UI states across all public views.
6. **Automated Validation Suite**:
   - Implement the 10 dedicated test suites in `tools/validation/test-phase15-*.cjs`.
   - Execute master regression suite.
7. **Complete Documentation**:
   - Author the 13 required Phase 15 documentation artifacts.

