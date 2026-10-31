# NOSTALGICVERSE — PHASE 15 NEWS INTELLIGENCE ENGINE

**System:** News Curation, Source Enforcement, and Editorial Lifecycle  
**Version:** 2026.1.0  
**Authority:** NostalgicVerse Editorial & Archival News Operations  

---

## 1. Engine Purpose

The News Intelligence Engine is the canonical platform service responsible for publishing historical dispatches, preservation announcements, and community retrospective reports. It prevents unverified rumors from being published as facts and guarantees all public articles maintain traceable sources.

---

## 2. Factual Status Governance

Every news article carries a semantic `factual_status`:

| Status | Definition | Editorial Rule |
|---|---|---|
| **CONFIRMED** | Primary historical documentation or physical artifact verified. | Highest confidence historical reporting. |
| **OFFICIAL** | Formal announcement from original rights holder, publisher, or developer. | Official press release or direct developer statement. |
| **REPORTED** | Reported by reputable secondary journalism sources (e.g., Famitsu, Retro Gamer). | Multiple corroborating citations required. |
| **RUMOR** | Unverified industry speculation or community rumor. | Clearly marked in the UI; never presented as confirmed truth. |
| **UNVERIFIED** | Initial submission awaiting curatorial source verification. | Held in draft/review state; excluded from public search index. |

---

## 3. Publication Rules & Source Enforcement

An article **cannot be published** unless all of the following requirements are met:
1. **Title:** At least 3 non-whitespace characters.
2. **Editorial Summary:** At least 10 characters providing high-level context.
3. **Body:** At least 50 characters of detailed archival commentary.
4. **Authoritative Source:** At least one verified URL or source citation (`primary_source` or `sources` JSON array).
5. **Duplicate Check:** Headline and normalized slug must not duplicate an existing active article.

---

## 4. URL Stability & Slug Change History

When an editor updates an article's slug:
- The system checks for collisions against existing articles.
- The previous slug and new slug are written to the `slug_history` table:
  ```sql
  INSERT INTO slug_history (id, entity_type, entity_id, old_slug, new_slug, changed_by, changed_at)
  VALUES (?, 'NEWS', ?, ?, ?, ?, CURRENT_TIMESTAMP);
  ```
- Public routing recognizes historical slugs and executes non-breaking 301 redirects, preserving bookmarks and incoming backlinks.

---

## 5. Audit Trail & Change Versioning

All modifications (title updates, body edits, publication state changes) append structured delta records to `change_history`:
```json
[
  {
    "action": "CREATED",
    "userId": "168807b4-4c17-46ab-aa2c-2c911040fa24",
    "timestamp": "2026-09-26T12:00:00.000Z",
    "status": "DRAFT"
  },
  {
    "action": "PUBLISHED",
    "userId": "168807b4-4c17-46ab-aa2c-2c911040fa24",
    "timestamp": "2026-09-26T12:30:00.000Z",
    "changes": ["status", "published_date"]
  }
]
```
No edit overwrites previous editorial truth.

