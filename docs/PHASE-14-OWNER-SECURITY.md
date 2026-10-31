# Phase 14: Owner Security, RBAC & Parameter Sanitization

## 1. Role-Based Access Control (RBAC) Architecture
NostalgicVerse enforces a strict server-side RBAC boundary. Frontend visibility or client-side routing guards are never treated as authorization boundaries.
- **Unauthenticated Visitors**: Any request targeting `/api/owner/*` without a valid session cookie is rejected immediately with `401 Unauthorized`.
- **Standard Authenticated Users (`role = 'USER'`)**: Any authenticated non-owner request attempting to query or mutate owner endpoints is rejected immediately with `403 Forbidden`.
- **System Owner (`role = 'OWNER'`)**: Granted full administrative authority across CMS, moderation, operations, jobs, backups, and security settings.

## 2. Server-Side Middleware Implementation
- Implemented in `server/middleware/authMiddleware.cjs`:
  - `requireAuth`: Ensures a valid, unexpired session exists and attaches `req.user`.
  - `requireOwner`: Evaluates `req.user.role === 'OWNER'`. Fails closed if the role is missing or invalid.
- Applied globally across all `/api/owner/*` router subtrees in `server/api/owner.cjs`.

## 3. SQL Injection Defense & Parameterized Queries
- All database queries across the owner API and repository layers use parameterized SQLite statements via `sqlite3` driver wrappers.
- Search filters (e.g., `/api/owner/users?q=`, `/api/owner/content?q=`) safely pass string parameters as bound arguments (`?`), preventing SQL injection vectors (`' OR '1'='1`).

## 4. Session Revocation & Security Audit
- Active owner and user sessions are tracked in the canonical `sessions` table.
- Owners can inspect active sessions via `GET /api/owner/security/sessions` and instantly revoke compromised sessions via `DELETE /api/owner/security/sessions/:id`.
- Revoked sessions are immediately expunged from the database and rejected by middleware.
