# NostalgicVerse — Phase 11 Security & Authorization Architecture

## Overview
Phase 11 reinforces the security boundaries of NostalgicVerse across all social and community operations. The platform enforces strict authentication, granular resource authorization, XSS protection, and SQL injection parameterization.

---

## 1. Authentication Middleware & Route Resolution
A critical architectural fix was applied to `server/middleware/authMiddleware.cjs`:
- **The Issue**: Express routers mounted via `app.use('/api/chat', chatApi)` strip the prefix, making `req.path` relative (e.g. `/conversations`). The legacy check `if (req.path.startsWith('/api/'))` evaluated to `false`, causing the middleware to issue a 302 redirect to `/login/` rather than returning a 401 JSON error to API clients.
- **The Fix**: The middleware now inspects `req.originalUrl`, `req.baseUrl`, and `req.path`:
  ```javascript
  function requireAuth(req, res, next) {
      if (!req.user) {
          const isApi = (req.originalUrl && req.originalUrl.startsWith('/api/')) || 
                        (req.baseUrl && req.baseUrl.startsWith('/api/')) || 
                        req.path.startsWith('/api/');
          if (isApi) {
              return res.status(401).json({ error: 'Authentication required' });
          } else {
              return res.redirect('/login/');
          }
      }
      next();
  }
  ```

---

## 2. Resource-Level Authorization

### A. Private Chat Containment
Every conversation read and message write queries `conversation_members`:
```sql
SELECT 1 FROM conversation_members WHERE conversation_id = ? AND user_id = ?;
```
If the requesting user is not a member of the conversation, the server rejects the request with **HTTP 403 Forbidden**. Outsiders cannot read messages or inject imposter chat frames.

### B. Comment & Review Ownership
Only the original author can edit or delete their commentary:
- `PATCH /api/community/comments/:id`: Compares `comment.user_id === req.user.id`. If mismatched -> **HTTP 403 Forbidden**.
- `DELETE /api/community/comments/:id`: Compares `comment.user_id === req.user.id`. If mismatched -> **HTTP 403 Forbidden**.
- Reviews enforce strict single-author uniqueness via composite primary/unique keys (`user_id, target_type, target_id`).

### C. Blocking Enforcement
When User A blocks User B via `POST /api/users/block`:
- User B cannot send friend requests to User A.
- User B cannot initiate direct chat conversations with User A.
- Historical conversations between them become read-only or hidden.

---

## 3. Cross-Site Scripting (XSS) Sanitization
All user-generated text (chat messages, comments, review titles, bodies, pros, cons) is processed through HTML entity escaping before rendering into the DOM:
```javascript
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
```
Payloads containing `<script>`, `onerror=`, `onload=`, or malicious `<iframe>` tags are neutralized into plain string literals.

---

## 4. SQL Injection Resilience
All database queries use parameterized placeholders (`?`) via SQLite's driver:
```javascript
await dbAsync.run(
    'INSERT INTO comments (id, user_id, target_type, target_id, body) VALUES (?, ?, ?, ?, ?)',
    [id, req.user.id, target_type, target_id, body]
);
```
No string concatenation or template literals are used to assemble SQL statements. Parameter injection payloads like `' OR '1'='1` or `; DROP TABLE users;--` are treated as literal text values and processed with zero syntax errors.

---

## Verification Proof
The automated suite `tools/validation/test-phase11-security.cjs` verified:
- 6 sensitive mutation endpoints reject unauthenticated access with HTTP 401.
- Cross-user comment edits and deletes are blocked with HTTP 403.
- Non-member chat reads and posts are blocked with HTTP 403.
- XSS injection payloads are stored and retrieved without script execution.
- SQL injection attempts produce 0 database errors.

