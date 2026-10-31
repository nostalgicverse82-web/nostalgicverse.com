# NostalgicVerse — Phase 11 Threaded Comments Engine

## Problem Statement & Root Cause
Prior to Phase 11:
1. **Disconnected Exhibits**: Museum exhibit pages lacked universal community discussion threads.
2. **Flat Structure**: Legacy comments had no nesting or reply capability.
3. **No Author Modification**: Users could not edit or delete their own comments after posting.
4. **Field Mismatch**: Legacy endpoints expected different property names than frontend models, leading to silent rendering failures.

---

## Technical Solution

### 1. Database Schema & Migration 009
The `comments` table supports hierarchical threaded discussions:
```sql
CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL,  -- 'GAME', 'CONSOLE', 'STORY', 'GUIDE', etc.
    target_id TEXT NOT NULL,    -- Exhibit slug / ID
    parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    deleted_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Threaded Tree Assembly
The endpoint `GET /api/community/comments/:type/:id`:
1. Queries all non-deleted comments for the target content item, sorted chronologically.
2. Formats author display details (`displayName`, `username`, `avatarId`).
3. Flags `isOwn = (comment.user_id === currentUserId)` for permission handling.
4. Returns the structured comment stream. The frontend renders top-level comments and nests child replies under `.nv-comment-card.is-reply` containers matching `data-id="${c.id}"`.

### 3. Comment Lifecycle Actions

#### A. Publishing Top-Level Comments
- Authenticated user submits `#nv-comment-form`.
- `POST /api/community/comments` validates non-empty body, persists row, and returns the canonical comment object.
- DOM appends the card and toasts "Comment published".

#### B. Replying to Comments
- User clicks `.reply-btn` on any comment card.
- An inline reply form expands immediately below the parent comment:
  `[ Replying to @username... ]`
- Submitting dispatches `POST /api/community/comments` with `{ target_type, target_id, parent_id, body }`.
- Reply renders nested within the parent thread with `.is-reply` styling.

#### C. In-Place Editing
- Authors see an `.edit-btn` on their own comments (`isOwn === true`).
- Clicking `.edit-btn` replaces the text body with an inline `<textarea>` and Save/Cancel buttons.
- Submitting calls `PATCH /api/community/comments/:id` with `{ body }`.
- Server validates `comment.user_id === req.user.id` (returns 403 Forbidden for unauthorized users).
- Database updates `body` and `updated_at`. DOM updates in-place.

#### D. Soft Deletion & Tombstoning
- Authors see a `.delete-btn` on their comments.
- Submitting calls `DELETE /api/community/comments/:id`.
- Server updates `is_deleted = 1, deleted_at = CURRENT_TIMESTAMP, body = '[Comment removed by author]'`.
- Preserves child reply tree structure while scrubbing personal content.

#### E. Moderation Reporting
- Community members can click `.report-btn` on any comment.
- Prompt collects a reason (spam, harassment, inappropriate content) and submits to `POST /api/community/reports` for curatorial moderation.

---

## Verification
Verified via `tools/validation/test-phase11-interactions-e2e.cjs` and `test-phase11-security.cjs`:
- Top-level comment posted and persisted in SQLite.
- Reply nested under parent comment with authoritative `parent_id`.
- In-place edit updated the database and reflected in DOM.
- Cross-user edit/delete attempts rejected with HTTP 403 Forbidden.

