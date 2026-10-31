# NostalgicVerse — Phase 12 Security & Governance Architecture

This document describes the security controls, authentication mechanisms, role-based access restrictions, ownership verification, and audit logging architecture implemented in Phase 12.

---

## 1. Authentication & Session Security

1. **Password Hashing**:
   - Implemented via node crypto `pbkdf2` using `sha512` digest, 100,000 iterations, and a 16-byte cryptographically secure random salt (`crypto.randomBytes`).
   - Plaintext passwords never stored or logged.
2. **Session Management**:
   - Stateful sessions stored in SQLite `sessions` table (`session_token_hash`).
   - Browser receives a random UUID v4 token via an `httpOnly`, `SameSite=Lax` cookie.
   - Database stores a SHA-256 hash of the token (`hashToken`), protecting against session hijacking even in the event of database snapshot exposure.
   - Logout calls `destroySession` which immediately timestamps `revoked_at`, instantly invalidating access across all open tabs.

---

## 2. Role-Based Access Control (RBAC)

Two primary roles govern platform privileges:

| Role | Permitted Capabilities | Restricted Capabilities |
| :--- | :--- | :--- |
| `USER` | View public exhibits, search catalog, manage own profile/bio, add friends, send chat messages, like/dislike, post comments/reviews, create collections/favorites, submit support tickets, submit exhibits | Accessing `/owner/` routes, viewing other users' private tickets, editing/deleting others' comments, moderating reviews, viewing audit logs |
| `OWNER` | All `USER` capabilities plus: view 4 metric clusters, search user directory with emails, moderate/delete comments & reviews, approve/reject submissions, resolve support tickets, trigger site generators, view audit logs | Modifying others' hashed passwords directly |

Enforcement is performed via strict middleware:
```javascript
// server/middleware/authMiddleware.cjs
function requireAuth(req, res, next) {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    next();
}

function requireOwner(req, res, next) {
    if (!req.user || req.user.role !== 'OWNER') {
        return res.status(403).json({ error: 'Forbidden: Owner privilege required' });
    }
    next();
}
```

---

## 3. Ownership Verification on Content Mutations

Users can only modify or delete content they personally authored:
- **Comments (`PATCH /api/community/comments/:id`, `DELETE /api/community/comments/:id`)**:
  - Checks `comment.user_id === req.user.id || req.user.role === 'OWNER'`.
  - Non-authors receive HTTP 403 Forbidden.
  - Comment deletion performs a soft delete (`status = 'DELETED', body = '[deleted]'`) so that nested replies remain threaded without orphan broken nodes.
- **Reviews (`DELETE /api/community/reviews/:id`)**:
  - Checks `review.user_id === req.user.id || req.user.role === 'OWNER'`.
- **Collections & Favorites**:
  - Users can only manage their own collection items.

---

## 4. Curatorial Moderation & Audit Logging

Every administrative mutation performed by an owner automatically creates an immutable record in the `audit_logs` table:
```sql
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    result TEXT DEFAULT 'SUCCESS',
    metadata TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### 4.1 Audited Actions
- `REVIEW_SUBMISSION_APPROVED` / `REVIEW_SUBMISSION_REJECTED`
- `CLOSE_TICKET`
- `RESOLVE_REPORT`
- `DELETE_COMMENT`
- `DELETE_REVIEW`
- `RUN_GENERATORS`

Curators can review the full, unedited audit trail chronologically via `GET /api/owner/audit-logs` in the Owner Dashboard.

---

## 5. Zero Disposable User Leakage Policy

Automated testing harnesses (`test-phase12-*.cjs`) adhere to strict cleanup procedures:
- All disposable test users (e.g. `e2e_p12_*`) are completely purged in test `finally` blocks and through `tools/validation/purge-test-users.cjs`.
- All dependent entities (messages, friend requests, notifications, comments, reviews, reactions, saves, favorites, collections, tickets, submissions, audit logs, sessions, profiles) are deleted prior to user row deletion.
- Authoritative database integrity verification (`PRAGMA foreign_key_check`) is executed after every test run to guarantee 0 foreign key violations.

