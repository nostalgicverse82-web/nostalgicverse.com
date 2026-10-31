# NostalgicVerse — Phase 16 News Intelligence & Contradiction Detection

## 1. News Automation Overview

The News Intelligence Engine (`server/services/newsIntelligenceService.cjs`) processes retro gaming press, historical anniversaries, homebrew announcements, and hardware discovery articles. It features cross-source duplicate detection, atomic factual claim extraction, and cross-source contradiction adjudication.

---

## 2. Ingestion & Duplicate Detection

When a new story candidate is ingested:
1. **Exact Slug Check**: Verifies if the canonical slug already exists in `news_articles` or pending `news_candidates`.
2. **Title Similarity Matching**: Detects existing coverage of the same event using token overlap.
3. If an identical story is detected, it is marked `DUPLICATE` to prevent catalog clutter.

---

## 3. Factual Claim Extraction & Contradiction Detection

AI parses historical articles into structured atomic claims (`content_claims`):
- `claim_type`: e.g. `RELEASE_YEAR`, `CREATOR`, `HARDWARE_SPEC`
- `claim_text`: The factual assertion
- `confidence_score`: 0.0 – 1.0

### Cross-Source Contradiction Adjudication:
When two different sources report conflicting facts for the same entity:
- Example: Source A claims *Pac-Man* launched in **1978**; Source B claims *Pac-Man* launched in **1982**.
- The engine flags this conflict and records both values in `content_conflicts`:
  ```sql
  INSERT INTO content_conflicts (
      id, entity_type, entity_id, field_name, 
      source_a_id, claim_a_value, source_b_id, claim_b_value, status
  ) VALUES (?, 'NEWS', ?, 'release_year', ?, '1978', ?, '1982', 'CONFLICT');
  ```
- The candidate cannot be published autonomously. The conflict must be reviewed and resolved by the human owner.

---

## 4. Owner Review & Promotion to Canonical News

Once curated by the owner:
- Atomic transaction promotes the story to `news_articles` (populating `title`, `slug`, `body`, `published_date`, `status = 'PUBLISHED'`).
- Any linked `content_conflicts` are updated to `RESOLVED` with the owner's curatorial resolution notes.
- Search index and RSS feeds are flagged for regeneration.
