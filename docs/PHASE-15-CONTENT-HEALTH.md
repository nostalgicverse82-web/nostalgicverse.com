# NOSTALGICVERSE — PHASE 15 CONTENT HEALTH ENGINE

**System:** Automated Curatorial Integrity & Cataloguing Quality Assurance  
**Version:** 2026.1.0  
**Authority:** NostalgicVerse Quality Assurance & Operations  

---

## 1. System Overview

The Content Health Engine continuously audits the active catalogue against preservation standards, detecting missing media, dead links, orphaned relationships, unverified news sources, and duplicate slugs. Discovered anomalies are graded by severity and presented in the Owner Command Center (`/owner/content-health/`).

---

## 2. Severity Classification Matrix

| Severity | Definition | Example Anomalies | System Action |
|---|---|---|---|
| **CRITICAL** | Severe data corruption, broken public link, missing canonical identity, or unsourced public news. | `MISSING_SLUG`, `DUPLICATE_SLUG`, `BROKEN_IMAGE`, `MISSING_SOURCE` (on published news), `ORPHAN_RELATIONSHIP`. | Immediate alert in Owner Command Center; blocks publication. |
| **WARNING** | Incomplete secondary information or pending automated verification. | `UNVERIFIED_IMAGE`, `INCOMPLETE_SUMMARY`, `UNSOURCED_RELEASE`. | Displayed in health triage queues; does not block site rendering. |
| **INFO** | Minor editorial omissions or enhancement recommendations. | `MISSING_SEO` (no custom meta tag overrides, falling back to canonical defaults). | Low-priority backlog item for search optimization passes. |

---

## 3. Database Persistence & Health Issues Table

Issues discovered during automated audits are stored in `content_health_issues`:
- `id`: Unique issue UUID
- `entity_type`: `GAME`, `CONSOLE`, `NEWS`, `RELEASE`, `RELATIONSHIP`
- `entity_id`: Foreign identifier of the affected item
- `entity_title`: Human-readable label for owner triage
- `issue_code`: Semantic identifier (`MISSING_IMAGE`, `ORPHAN_RELATIONSHIP`, etc.)
- `severity`: `CRITICAL`, `WARNING`, `INFO`
- `message`: Specific diagnostic guidance
- `status`: `OPEN`, `IGNORED`, `RESOLVED`
- `ignored_by` / `ignored_at` / `ignore_reason`: Mandatory curatorial audit trail

When an issue is corrected in the database, subsequent audits automatically transition its status from `OPEN` to `RESOLVED`.

---

## 4. Curatorial Ignore Policy

If an anomaly is an intentional archival exception (e.g., an unreleased game with intentionally missing commercial publisher):
- An operator can click **Ignore** in the Owner Command Center.
- The system enforces a mandatory justification reason (minimum 5 characters).
- The action records `ignored_by`, timestamp, and reason in the audit log.
- Critical errors cannot be dismissed without explicit human review.

---

## 5. Single-Entity Recheck Pipeline

Instead of forcing a full re-audit of all 530+ games when editing a single exhibit:
- Operators invoke `POST /api/owner/content-health/recheck` with `entityType` and `entityId`.
- The engine clears old issues for that specific entity, runs targeted validation rules, and immediately returns the updated health state in milliseconds.

