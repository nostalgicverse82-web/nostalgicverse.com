# NostalgicVerse — Phase 11 Reactions & Capability Matrix

## Problem Statement & Root Cause
Prior to Phase 11:
1. **Count Zero Discrepancy**: Legacy community scripts expected `{ summary, user_reaction }` while the server emitted `{ counts: { likes, dislikes }, userReaction }`. This resulted in reactions displaying 0 regardless of real database state.
2. **Missing Content Support**: Only games had partial reaction support; consoles, timeline events, guides, articles, and ideas lacked consistent interaction bars.
3. **No Mutex Enforcement**: Toggling like while disliked could leave inconsistent client state.

---

## Technical Solution

### 1. Database Schema
Reactions are stored in the authoritative `reactions` table:
```sql
CREATE TABLE IF NOT EXISTS reactions (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,  -- 'GAME', 'CONSOLE', etc.
    target_id TEXT NOT NULL,    -- Slug or UUID
    reaction_type TEXT NOT NULL CHECK (reaction_type IN ('LIKE', 'DISLIKE')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, target_type, target_id)
);
```

### 2. Content Capability Matrix
Different content types in the museum have distinct social capabilities:

| Content Type | Likes | Dislikes | Comments | Reviews | Favorites | Saves | Share |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **GAME** | YES | YES | YES | YES | YES | NO | YES |
| **CONSOLE** | YES | YES | YES | YES | YES | NO | YES |
| **STORY** | YES | NO | YES | NO | NO | YES | YES |
| **GUIDE** | YES | NO | YES | NO | NO | YES | YES |
| **NEWS** | YES | NO | YES | NO | NO | YES | YES |
| **TIMELINE** | YES | NO | YES | NO | NO | NO | YES |
| **GENRE** | YES | NO | YES | NO | NO | NO | YES |
| **RELEASE** | YES | NO | YES | NO | NO | NO | YES |
| **IDEA** | YES | YES | YES | NO | NO | NO | YES |

Curated historical articles, timeline eras, and guides disable dislikes to prevent unproductive downvoting while retaining full liking, commenting, bookmarking, and sharing.

### 3. Mutex Toggle Logic
When `POST /api/community/reactions` is called with `{ target_type, target_id, reaction_type }`:
1. If `reaction_type === null`: The user's active reaction is deleted (`DELETE FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ?`).
2. If `reaction_type` is `'LIKE'` or `'DISLIKE'`: An atomic upsert replaces any previous opposite reaction:
   ```sql
   INSERT INTO reactions (user_id, target_type, target_id, reaction_type, created_at)
   VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
   ON CONFLICT(user_id, target_type, target_id) DO UPDATE SET
       reaction_type = excluded.reaction_type,
       created_at = CURRENT_TIMESTAMP;
   ```
3. The server queries fresh authoritative counts and returns:
   ```json
   {
       "success": true,
       "counts": { "likes": 42, "dislikes": 1 },
       "userReaction": "LIKE"
   }
   ```
4. Client updates the active button state and counter in-place.

---

## Verification
Verified via `tools/validation/test-phase11-interactions-e2e.cjs`:
- Clicking Like toggled state from NONE -> LIKE (database inserted 1 row, count incremented).
- Clicking Dislike transitioned state from LIKE -> DISLIKE (count decremented like, incremented dislike).
- Clicking Dislike again cleared reaction completely (row deleted from SQLite).

