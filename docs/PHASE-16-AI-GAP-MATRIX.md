# Phase 16: AI & Content Automation Gap Matrix

## Overview
This matrix provides an exhaustive, honest architectural audit of all artificial intelligence, automated content ingestion, source verification, and background pipeline components across NostalgicVerse prior to and during Phase 16 execution.

## Capability Classification Matrix

| Domain / Capability | Status | Current Baseline | Target State (Phase 16) |
|---|---|---|---|
| **AI PROVIDER** | IMPLEMENTED | Multi-vendor abstraction (Mock, Gemini, Anthropic, OpenAI) in `server/automation/ai-provider.cjs` | Unified `server/ai/` provider interface with timeouts, circuit breaker & deterministic test mode |
| **AI SERVICE** | PARTIAL | `server/automation/ai-engine.cjs` manages draft lifecycle | Enhanced AI service with structured claim extraction, schema validation, and provenance tags |
| **JOB QUEUE** | IMPLEMENTED | SQLite-backed job engine in `server/automation/job-engine.cjs` | Dedicated `ai_jobs` state machine (QUEUED, PROCESSING, VALIDATING, AWAITING_OWNER, COMPLETED, FAILED, HELD, CANCELLED, RETRYING) with priority & idempotency |
| **SOURCE FETCHING** | SCAFFOLDED | Ad-hoc fetch in media and news tools | Hardened `SourceFetchService` with strict SSRF protection, redirect limit, size capping (2MB), and per-domain rate limiting |
| **SOURCE VALIDATION** | DESIGNED | Verification status columns in database | Content hashing (`source_hash`), MIME inspection, trust tier assignment (OFFICIAL, REPUTABLE, COMMUNITY, UNKNOWN) |
| **EXTRACTION** | PARTIAL | Basic HTML regex/JSON extraction in scrapers | Structured HTML & metadata extraction engine (title, date, author, main text slice, clean links) |
| **NORMALIZATION** | IMPLEMENTED | Slug and string normalizers across CMS | Universal deterministic normalizer for dates, slugs, platforms, and canonical URLs |
| **DEDUPLICATION** | PARTIAL | Title equality & hash check in news-engine | Multi-factor deduplication: canonical URL, content hash, normalized title similarity, and fuzzy slug matching |
| **CONTRADICTION DETECTION** | DESIGNED | Schema tables designed in Phase 15/16 | Automated cross-source claim comparison; conflicting dates/facts flagged as `CONFLICT` for owner review |
| **AI DRAFTING** | IMPLEMENTED | Structured JSON generation via provider prompts | Source-locked draft synthesis; model prohibited from inventing facts not present in verified evidence |
| **AI ENRICHMENT** | PARTIAL | Historical retrospective generation | Deep museum specimen enrichment (historical context, hardware quirks, cultural legacy) tagged as `AI_DRAFT` |
| **SEO GENERATION** | PARTIAL | Static meta generators | Structured SEO proposal generator (meta title, description, OG tags, keywords) with length and hallucination guardrails |
| **MEDIA CANDIDATES** | IMPLEMENTED | `media_candidates` table & Phase 15 validator | Automated discovery of candidate images linked to sources with license verification and owner selection |
| **NEWS INGESTION** | PARTIAL | `server/automation/news-engine.cjs` generating anniversaries | Full discovery-to-exhibition pipeline with duplicate filtering, conflict gates, and owner publication |
| **GAME INGESTION** | PARTIAL | `server/automation/game-ingestion.cjs` file-based | Comprehensive candidate pipeline with identity matching (EXACT, LIKELY, POSSIBLE, NEW, CONFLICT) |
| **RELEASE MONITORING** | SCAFFOLDED | `releases` table with date precision | Active release watch daemon tracking official developer/publisher sources for date, delay, or cancellation changes |
| **COMPATIBILITY** | PARTIAL | `compatibility_records` table and reporting | Evidence-based test note summarization; strictly prohibited from fabricating playable status |
| **OWNER APPROVAL** | IMPLEMENTED | Owner Command Center review actions | Dedicated Owner AI Command Center at `/owner/ai/` with side-by-side diffs, claim citations, and explicit approval |
| **VALIDATION** | IMPLEMENTED | Schema checking before persistence | Multi-stage deterministic validation: strict JSON schema, URL sanity, date formatting, and script stripping |
| **AUDIT** | IMPLEMENTED | `audit_logs` in database | Immutable `ai_audit` recording all queue actions, approvals, rejections, kill-switch events, and prompt versions |
| **COST CONTROL** | DESIGNED | Scaffolded metrics | Granular token and cost estimation in `ai_usage`, daily spending limits, and automated job holding on budget exhaustion |
| **RETRY** | IMPLEMENTED | Exponential backoff in job engine | Context-aware retry policy: retry only transient 5xx/timeouts/rate limits; never retry schema or validation rejections |
| **FAILOVER** | DESIGNED | Multi-provider fallback in provider factory | Configured graceful degradation with circuit breaker and fallback to secondary provider or mock in test mode |
| **SECURITY** | IMPLEMENTED | Zero frontend key exposure, server-only execution | Comprehensive defense: SSRF blocker, prompt injection data sandboxing, XSS/SQLi sanitization, and private user data boundary |
| **OBSERVABILITY** | PARTIAL | WebSocket job broadcasts to owner | Aggregated dashboard metrics: latency, error rates, token consumption, provider health, and queue depth |
