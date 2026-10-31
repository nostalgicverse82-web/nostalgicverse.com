# NostalgicVerse — Phase 11 Historical Retrospective Reviews

## Problem Statement & Architecture
Video game preservation requires substantive critical retrospectives rather than shallow star ratings. Prior to Phase 11, museum exhibits lacked a unified, database-backed review and rating system with nuanced historical context.

---

## Technical Solution

### 1. Database Schema
Reviews are stored in the authoritative `reviews` table with strict single-review-per-user-per-exhibit uniqueness:
```sql
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,  -- 'GAME', 'CONSOLE'
    target_id TEXT NOT NULL,    -- Exhibit slug / ID
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 10),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    pros TEXT,
    cons TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, target_type, target_id)
);
```

### 2. Retrospective Rating Scale (1–10)
Reviews use a 10-point curated historical assessment scale:
- `10 / 10`: Masterpiece — Defining historical work
- `9 / 10`: Essential — Landmark achievement in game design
- `8 / 10`: Great — Highly influential and engaging
- `7 / 10`: Good — Solid entry of historical merit
- `6 / 10`: Decent — Enjoyable despite flaws
- `5 / 10`: Mediocre — Average execution of standard concepts
- `4 / 10`: Flawed — Significant mechanical or technical issues
- `3 / 10`: Poor — Heavily compromised historical experience
- `2 / 10`: Bad — Severe design and implementation failures
- `1 / 10`: Historic Failure — Catastrophic release of historical note

### 3. Community Score Aggregation
When querying `GET /api/community/reviews/:type/:id`, SQLite computes aggregate metrics dynamically:
```sql
SELECT COUNT(*) as total_reviews,
       ROUND(AVG(rating), 1) as average_rating
FROM reviews
WHERE target_type = ? AND target_id = ?;
```

The response includes:
- `stats.count`: Total submitted reviews
- `stats.averageRating`: Authoritative arithmetic mean formatted to 1 decimal place
- `reviews`: List of published reviews with author profiles, rating badges, pros, and cons

### 4. Review Submission & Idempotent Upsert
Submitting the review form (`#nv-review-form`) executes `POST /api/community/reviews`. The server performs an atomic upsert:
```sql
INSERT INTO reviews (id, user_id, target_type, target_id, rating, title, body, pros, cons, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT(user_id, target_type, target_id) DO UPDATE SET
    rating = excluded.rating,
    title = excluded.title,
    body = excluded.body,
    pros = excluded.pros,
    cons = excluded.cons,
    updated_at = CURRENT_TIMESTAMP;
```
This guarantees that users can update their historical critique over time without corrupting aggregate score counts.

---

## Verification
Verified via `tools/validation/test-phase11-interactions-e2e.cjs`:
- 10/10 review submitted with title, body, pros, and cons.
- Stored in SQLite `reviews` table.
- Community average score and review counter rendered accurately in the exhibit header.

