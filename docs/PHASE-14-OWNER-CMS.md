# NOSTALGICVERSE — PHASE 14 OWNER CMS & VERSIONING ENGINE

## 1. Scope & Content Models
The CMS manages 9 distinct content entities through a unified CRUD and versioning API:
- `games` (Title, slug, release year, developer, publisher, platforms, genres, description, media, status)
- `consoles` (Title, slug, manufacturer, generation, release year, technical specs, media, status)
- `stories` (Title, slug, summary, content body, hero image, author, status)
- `guides` (Title, slug, summary, sections JSON, game reference, status)
- `news_articles` (Headline, slug, summary, body, sources, factual status, status)
- `timeline_events` (Date, precision, title, description, media, status)
- `genres` (Name, slug, description, subgenres, status)
- `releases` (Game ID, system, region, release date, precision, status)
- `compatibility_records` (Game ID, system, compatibility status, tested version, notes)

---

## 2. Versioning & Optimistic Locking
- **Snapshot Storage:** Full record snapshots are serialized to `content_versions` on every update.
- **Optimistic Concurrency Control:** When submitting updates, the client must pass the current record `version`. If another tab or operator updated the record in the interim, the server detects the mismatch and returns `409 Conflict` with a descriptive message to prevent silent overwrites.
- **Restoration:** The owner can restore any previous version via `POST /api/owner/content/:type/:id/restore-version`. Restoring writes a NEW version snapshot, maintaining an immutable append-only history.

---

## 3. Publication Workflow & Derivation
1. Content begins in `DRAFT` status.
2. In `DRAFT` status, exhibits are strictly excluded from:
   - Public search index (`data/search-index.json`)
   - Sitemap (`sitemap.xml`)
   - Public listing collections
3. Publishing requires explicit owner action. Upon status transition to `PUBLISHED`, the system logs an audit event and can trigger atomic search/sitemap regeneration jobs.

