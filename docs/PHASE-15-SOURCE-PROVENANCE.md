# NOSTALGICVERSE — PHASE 15 SOURCE & PROVENANCE GOVERNANCE

**Standard:** Curatorial Citation, Rights Tracking, and Historical Provenance  
**Version:** 2026.1.0  
**Authority:** NostalgicVerse Curatorial Standards Board  

---

## 1. Provenance Philosophy

In an educational digital museum, imagery and content metadata must carry clear provenance:
1. **Never Invent Source Metadata:** If a source cannot be verified, it is classified as `UNVERIFIED` or `UNKNOWN`.
2. **Never Erase Historical Provenance:** When an image or exhibit fact is replaced or updated, previous sources and URLs are preserved in `media_metadata` and `content_versions`.
3. **No Automatic Rights Claims:** Public availability does not imply public domain. All media records track curatorial license classifications explicitly.

---

## 2. License Classifications

| License Status | Definition | Application |
|---|---|---|
| **DOCUMENTED** | Verified historical source documented for educational museum exhibition. | Standard arcade flyer, box scan, screenshot archive. |
| **VERIFIED** | Formal open-access license verified (e.g., CC-BY-SA, Wikimedia Commons open license). | Community open-source photography. |
| **ATTRIBUTION_REQUIRED** | Exhibition permitted with explicit credit display in the exhibit inspector. | Specific archival donor collections. |
| **UNKNOWN** | Source origin unresolved; scheduled for curatorial research. | Legacy unverified intake. |
| **REVIEW_REQUIRED** | Potential rights dispute or inaccessible source URL requiring owner action. | Flagged in Content Health Dashboard. |

---

## 3. Database Provenance Schema

Provenance is maintained across three core SQLite structures:
- `game_images`: Current operational presentation record (`source_url`, `source_domain`, `license_status`, `attribution`, `last_checked_at`, `last_http_status`).
- `media_metadata`: Immutable audit history of all ingested assets (`content_id`, `storage_path`, `source_url`, `hash`, `width`, `height`, `file_size`, `attribution`, `created_at`).
- `content_sources`: External citations linking entities (games, news, releases) to reputable documentation repositories.

---

## 4. Replacement & Deprecation Workflow

When the owner updates or replaces an asset via `/api/owner/media/replace`:
1. The new URL is validated against the SSRF safety filter.
2. The protected asset guard ensures museum core iconography (`/assets/images/profile-icons/`, `/assets/images/consoles/`, `/assets/images/support/qr-support.png`) cannot be overwritten.
3. The previous image URL is committed to `media_metadata` as a historical record.
4. An immutable entry is written to `audit_logs`.
5. The unified media resolver updates its in-memory pointers with zero downtime.

---

## 5. Source Health & Domain Monitoring

The owner command center exposes `/api/owner/sources/health` to aggregate domain-level reliability:
- Tracks total records, verified count, and breakdown of HTTP 403, 404, and 429 errors per domain.
- Allows curatorial operators to detect dead archival sources before they degrade public exhibits.

