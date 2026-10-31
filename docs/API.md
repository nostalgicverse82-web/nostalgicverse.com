# NostalgicVerse API Specification (Phase 11 Rebuild)

## 1. Authentication (`/api/auth`)

### `POST /api/auth/signup`
Creates a new account. Normalizes email and username. Hashes password securely via PBKDF2 with salt. Sets an HTTP-only session cookie.
- **Body**: `{ "email": string, "username": string, "password": string, "displayName"?: string }`
- **Response**: `{ "success": true, "user": UserObject }`

### `POST /api/auth/login`
Authenticates via username or email (case-insensitive). Sets session cookie.
- **Body**: `{ "username": string, "password": string }`
- **Response**: `{ "success": true, "user": UserObject }`

### `POST /api/auth/logout`
Invalidates the current session server-side in SQLite `sessions` and clears the cookie.
- **Response**: `{ "success": true }`

### `GET /api/auth/me`
Returns current authenticated user details: `id, username, display_name, role, avatar_id`. Strips out all sensitive credentials. Returns 401 if unauthenticated.
- **Response**: `{ "user": UserObject }`

---

## 2. User Discovery & Social Relations (`/api/users`)

### `GET /api/users/discover`
Automatically queries community members directly from the database without requiring search input. Computes relationship status relative to requesting user.
- **Query Params**: `limit` (default 20), `offset` (default 0), `sort` (`recent` | `new` | `alpha`)
- **Response**:
  ```json
  {
    "users": [
      {
        "id": "uuid",
        "username": "retrogamer",
        "displayName": "Pixel Master",
        "avatarId": "img22",
        "createdAt": "2026-09-21 18:00:00",
        "isOnline": true,
        "friendStatus": "NONE" // "SELF" | "FRIENDS" | "REQUEST_SENT" | "REQUEST_RECEIVED" | "BLOCKED" | "NONE"
      }
    ],
    "total": 45,
    "limit": 20,
    "offset": 0,
    "hasMore": true
  }
  ```

### `GET /api/users/search`
Filters registered members by username prefix or display name substring.
- **Query Params**: `q` (string)
- **Response**: `{ "users": UserSummary[] }`

### `GET /api/users/friends`
Returns all mutual friends for the authenticated user with online presence flags and avatars.
- **Response**: `{ "friends": FriendObject[] }`

### `POST /api/users/friends/request`
Sends a friend request to a target user.
- **Body**: `{ "target_id": string }` or `{ "target_username": string }`
- **Response**: `{ "success": true, "request_id": string }`

### `POST /api/users/friends/request/:id/accept`
Accepts a pending friend request. In an atomic transaction, updates request status and inserts bidirectional records in `friends`.
- **Response**: `{ "success": true }`

### `POST /api/users/friends/request/:id/decline`
Declines a pending friend request.
- **Response**: `{ "success": true }`

### `DELETE /api/users/friends/request/:id/cancel`
Cancels an outgoing pending friend request sent by the current user.
- **Response**: `{ "success": true }`

### `DELETE /api/users/friends/:friendId`
Removes a mutual friend. Removes bidirectional rows in `friends`.
- **Response**: `{ "success": true }`

### `POST /api/users/block`
Blocks a target user, preventing them from sending messages or friend requests.
- **Body**: `{ "target_id": string }`
- **Response**: `{ "success": true }`

### `DELETE /api/users/block/:userId`
Unblocks a previously blocked user.
- **Response**: `{ "success": true }`

---

## 3. Notifications (`/api/users/notifications`)

### `GET /api/users/notifications`
Returns the 50 most recent notifications for the authenticated user with joined actor information (`actor_avatar_id`, `actor_username`).
- **Response**:
  ```json
  {
    "notifications": [
      {
        "id": "notif-uuid",
        "type": "FRIEND_REQUEST",
        "reference_id": "req-uuid",
        "message": "Alice sent you a friend request",
        "is_read": 0,
        "actor_avatar_id": "img15",
        "actor_username": "alice",
        "created_at": "2026-09-23 15:00:00"
      }
    ]
  }
  ```

### `POST /api/users/notifications/mark-read`
Marks specific notification IDs as read.
- **Body**: `{ "ids": ["notif-uuid-1", "notif-uuid-2"] }`
- **Response**: `{ "success": true }`

### `POST /api/users/notifications/mark-all-read`
Marks all unread notifications for current user as read.
- **Response**: `{ "success": true }`

---

## 4. Chat & Messaging (`/api/chat`)

### `GET /api/chat/conversations`
Returns all active conversations with other participant details, unread count, and last message snippet.
- **Response**: `{ "conversations": ConversationObject[] }`

### `POST /api/chat/conversations`
Idempotent conversation creator. Returns existing conversation if one already exists between the two users.
- **Body**: `{ "target_id"?: string, "target_username"?: string, "targetUserId"?: string }`
- **Response**: `{ "success": true, "conversation_id": string }`

### `GET /api/chat/conversations/:id/messages`
Fetches chronological messages for a conversation. Enforces that requesting user is a member of the conversation (returns 403 otherwise).
- **Query Params**: `limit` (default 50), `before` (cursor UUID)
- **Response**: `{ "messages": MessageObject[] }`

### `POST /api/chat/conversations/:id/messages`
Idempotent message delivery endpoint.
- **Body**: `{ "body": string, "client_message_id"?: string }`
- **Behavior**:
  - If `client_message_id` matches an existing message, returns that canonical record without duplicate insertion.
  - Commits message to SQLite, then emits `message.created` to room members via WebSocket.
- **Response**: `{ "success": true, "message": MessageObject }`

### `POST /api/chat/conversations/:id/read`
Updates `last_read_at` timestamp for the user in `conversation_members`.
- **Response**: `{ "success": true }`

---

## 5. Universal Community Interactions (`/api/community`)

### `GET /api/community/reactions/:type/:id`
Returns authoritative like and dislike counts along with the calling user's active reaction.
- **Response**: `{ "counts": { "likes": 24, "dislikes": 1 }, "userReaction": "LIKE" | "DISLIKE" | null }`

### `POST /api/community/reactions`
Idempotently toggles or mutates user reaction.
- **Body**: `{ "target_type": string, "target_id": string, "reaction_type": "LIKE" | "DISLIKE" | null }`
- **Response**: `{ "success": true, "counts": { "likes": 25, "dislikes": 0 }, "userReaction": "LIKE" }`

### `GET /api/community/comments/:type/:id`
Returns threaded comments and nested replies sorted chronologically.
- **Response**: `{ "comments": CommentObject[] }`

### `POST /api/community/comments`
Creates a top-level comment or a nested reply.
- **Body**: `{ "target_type": string, "target_id": string, "parent_id"?: string, "body": string }`
- **Response**: `{ "success": true, "comment": CommentObject }`

### `PATCH /api/community/comments/:id`
Edits a comment. Enforces author ownership (returns 403 Forbidden for non-authors).
- **Body**: `{ "body": string }`
- **Response**: `{ "success": true, "comment": CommentObject }`

### `DELETE /api/community/comments/:id`
Soft-deletes a comment. Sets `is_deleted = 1` and replaces body with tombstone while preserving reply hierarchy. Enforces author ownership.
- **Response**: `{ "success": true }`

### `POST /api/community/reports`
Submits a comment for curatorial moderation review.
- **Body**: `{ "target_type": "COMMENT", "target_id": string, "reason": string }`
- **Response**: `{ "success": true }`

### `GET /api/community/reviews/:type/:id`
Returns retrospective reviews and community rating statistics.
- **Response**:
  ```json
  {
    "stats": { "count": 12, "averageRating": 9.4 },
    "reviews": [
      {
        "id": "rev-uuid",
        "rating": 10,
        "title": "Masterpiece",
        "body": "Detailed assessment...",
        "pros": "Soundtrack, tight physics",
        "cons": "None",
        "author": { "username": "gamer", "displayName": "Gamer", "avatarId": "img1" },
        "createdAt": "2026-09-22 14:00:00"
      }
    ]
  }
  ```

### `POST /api/community/reviews`
Submits or updates a 1–10 historical retrospective review. Performs an atomic upsert on conflict.
- **Body**: `{ "target_type": string, "target_id": string, "rating": number, "title": string, "body": string, "pros"?: string, "cons"?: string }`
- **Response**: `{ "success": true }`

### `GET /api/community/saves/:type/:id`
Checks if the target exhibit is bookmarked by the user.
- **Response**: `{ "isSaved": boolean }`

### `POST /api/community/saves`
Toggles bookmark state.
- **Body**: `{ "target_type": string, "target_id": string }`
- **Response**: `{ "success": true, "isSaved": boolean }`

---

## 6. Realtime WebSocket Protocol (`/`)
Standard WebSocket endpoint managed by `window.NVRealtime` singleton. Authenticates via cookie session token.

### Standard Message Frame Structure
```json
{
  "event_id": "evt_1790157580742_abc123",
  "type": "message.created",
  "data": { ... },
  "timestamp": "2026-09-23T10:00:00.000Z"
}
```

### Client Inbound Frames
- `conversation.join`: Subscribes socket to conversation ID room.
- `conversation.leave`: Unsubscribes socket from conversation ID room.
- `typing.send`: Volatile debounced typing notification.

### Server Broadcast Frames
- `message.created`: New canonical message broadcast to room members after DB commit.
- `typing.started`: Volatile typing indicator for other conversation members.
- `friend_request.created`: Direct notification frame to recipient socket.
- `friend_request.accepted`: Notification frame to sender socket.
- `notification.created`: Direct push of new actionable notification.

---

## 7. Account Dashboard & Profile Surface (`/api/account`)

### `GET /api/account/summary`
Returns fully computed, authoritative metrics and profile metadata for the authenticated user without mocks or placeholder counts.
- **Headers**: Cookie session required. Returns 401 if unauthenticated.
- **Response**:
  ```json
  {
    "user": {
      "id": "uuid",
      "username": "alice",
      "displayName": "Alice Archivist",
      "email": "alice@test.local",
      "role": "USER",
      "avatarId": "img22",
      "bio": "Curating retro classics from 1980 to 1999.",
      "createdAt": "2026-09-21 18:00:00"
    },
    "metrics": {
      "friendsCount": 5,
      "favoritesCount": 12,
      "collectionsCount": 3,
      "submissionsCount": 2,
      "openTicketsCount": 1,
      "reviewsCount": 4,
      "commentsCount": 8,
      "unreadNotifications": 2,
      "pendingFriendRequests": 1,
      "unreadMessages": 0
    }
  }
  ```

### `PATCH /api/account/profile`
Updates user profile fields including `display_name` and `bio`. Synchronizes across `users` and `user_profiles` tables.
- **Body**: `{ "display_name"?: string, "bio"?: string }`
- **Validation**: `display_name` (2–40 chars), `bio` (max 500 chars).
- **Response**: `{ "success": true, "user": UserProfileObject }`

---

## 8. Owner Dashboard & Moderation (`/api/owner`)
Strictly restricted to users with `role = 'OWNER'`. Enforced via `requireAuth` and `requireOwner` middleware (returns 401 for unauthenticated, 403 for non-owners).

### `GET /api/owner/stats`
Returns authoritative metrics grouped into 4 distinct operational clusters:
- **Response**:
  ```json
  {
    "platform": {
      "totalUsers": 124,
      "onlineUsers": 8,
      "pendingSubmissions": 3,
      "openTickets": 2
    },
    "content": {
      "publishedGames": 256,
      "publishedConsoles": 62,
      "publishedStories": 15,
      "publishedGuides": 18,
      "publishedNews": 24
    },
    "community": {
      "totalComments": 412,
      "totalReviews": 89,
      "pendingReports": 1,
      "totalFriendships": 58
    },
    "system": {
      "databaseSize": "14.20 MB",
      "walMode": "WAL",
      "realtimeStatus": "Online (Connected)",
      "searchIndexCount": 318,
      "mediaCount": 850
    },
    "activity": [ ... ]
  }
  ```

### `GET /api/owner/users`
Searches registered user accounts across username, display name, and email.
- **Query Params**: `q` (string, optional)
- **Response**: `{ "users": UserDetailObject[] }`

### `GET /api/owner/reviews`
Fetches published reviews for curatorial and safety review.
- **Response**: `{ "reviews": ReviewObject[] }`

### `POST /api/owner/reviews/:id/delete`
Rejects/deletes a review and automatically creates an authoritative audit log entry in `audit_logs`.
- **Response**: `{ "success": true }`

### `GET /api/owner/audit-logs`
Returns the recent curatorial audit trail with actor details, action, entity type, target ID, metadata, and timestamps.
- **Response**: `{ "logs": AuditLogObject[] }`

---

## 9. Content, Media, and Intelligence Services (Phase 15)

### `GET /api/owner/content-health`
Returns aggregated content health summary and paginated active issues across all published entities.
- **Query Params**: `status` (OPEN, IGNORED, ALL), `severity` (CRITICAL, WARNING, INFO, ALL), `page` (int), `limit` (int)
- **Response**:
  ```json
  {
    "summary": { "status": "CRITICAL", "critical": 5, "warning": 5, "info": 530, "open": 540, "ignored": 0, "resolved": 0 },
    "total": 540,
    "page": 1,
    "limit": 50,
    "issues": [ ... ]
  }
  ```

### `POST /api/owner/content-health/audit`
Triggers an immediate full-catalogue curatorial health audit scan.
- **Response**: `{ "success": true, "summary": HealthSummaryObject }`

### `POST /api/owner/content-health/ignore`
Flags a specific issue as curatorial exception. Requires mandatory reason (minimum 5 characters).
- **Body**: `{ "issueId": string, "reason": string }`
- **Response**: `{ "success": true, "issueId": string }`

### `POST /api/owner/content-health/recheck`
Re-audits an individual entity without full catalogue rebuilding.
- **Body**: `{ "entityType": string, "entityId": string }`
- **Response**: `{ "healthy": boolean, "issues": HealthIssueObject[] }`

### `GET /api/owner/media`
Returns paginated game media records with status filtering and aggregate counts.
- **Query Params**: `status` (LOCAL, REMOTE, FALLBACK, BROKEN, UNVERIFIED, ALL), `q` (string), `page` (int), `limit` (int)
- **Response**:
  ```json
  {
    "images": [ ... ],
    "total": 530,
    "counts": { "total": 530, "local": 296, "remote": 24, "fallback": 210, "broken": 0, "unverified": 0 },
    "page": 1,
    "limit": 25
  }
  ```

### `POST /api/owner/media/audit`
Enqueues a background `MEDIA_AUDIT` job to audit all 530 games.
- **Response**: `{ "success": true, "message": "Full catalogue media audit enqueued", "job": JobObject }`

### `GET /api/owner/media/candidates`
Returns candidate artwork for games needing review.
- **Query Params**: `game_id` (string, optional)
- **Response**: `{ "candidates": CandidateObject[] }`

### `POST /api/owner/media/candidates`
Submits a new candidate image for curatorial review with SSRF validation.
- **Body**: `{ "game_id": string, "image_url": string, "source_url"?: string, "attribution"?: string, "license_status"?: string }`
- **Response**: `{ "success": true, "candidateId": string }`

### `GET /api/owner/sources/health`
Returns external source domain health and failure distribution (HTTP 403, 404, 429).
- **Response**: `{ "domains": DomainHealthObject[] }`

---

## 12. Private Server-Side AI & Automation (`/api/owner/ai`, `/api/owner/sources`, `/api/owner/news-candidates`, `/api/owner/game-candidates`, `/api/owner/release-monitor`)

All endpoints in this section require `ownerAuth` (active session with role `OWNER`).

### `GET /api/owner/ai/overview`
Returns high-level AI operation telemetry, queue breakdown by status, 24h expenditure vs daily budget cap, and kill switch status.
- **Response**:
  ```json
  {
    "queue": { "QUEUED": 0, "PROCESSING": 0, "AWAITING_OWNER": 2, "COMPLETED": 45, "FAILED": 1, "HELD": 0 },
    "usage24h": { "costEst": 0.045, "calls": 48 },
    "dailyBudgetUsd": 5.0,
    "killSwitch": { "state": "ENABLED", "reason": null }
  }
  ```

### `GET /api/owner/ai/config`
Returns active AI provider details and model configuration without leaking API keys.
- **Response**:
  ```json
  {
    "activeProvider": "gemini",
    "activeModel": "gemini-2.0-flash",
    "timeoutMs": 15000,
    "maxRetries": 3,
    "testMode": false,
    "budgetUsd": 5.0,
    "killSwitchState": "ENABLED"
  }
  ```

### `GET /api/owner/ai/jobs`
Returns paginated list of AI jobs with optional status filter.
- **Query Params**: `status` (string, optional: `QUEUED`, `PROCESSING`, `AWAITING_OWNER`, `COMPLETED`, `FAILED`, `HELD`), `limit` (int, default 50), `offset` (int, default 0)
- **Response**: `{ "jobs": AIJobObject[], "total": int }`

### `POST /api/owner/ai/jobs`
Enqueues a new background AI task.
- **Body**:
  ```json
  {
    "jobType": "GAME_ENRICHMENT" | "NEWS_SYNTHESIS" | "SEO_GENERATION" | "RELEASE_ANALYSIS",
    "entityType": "GAME" | "NEWS" | "CONSOLE" | "SYSTEM",
    "entityId": string,
    "priority"?: "CRITICAL" | "HIGH" | "NORMAL" | "LOW",
    "payload": object
  }
  ```
- **Response**: `{ "success": true, "job": { "id": "uuid", "job_type": string, "status": "QUEUED" | "HELD", "priority": string } }`

### `GET /api/owner/ai/jobs/:id`
Retrieves detailed job status, stored draft outputs from `ai_outputs`, and audit log history.
- **Response**: `{ "job": AIJobObject, "outputs": AIOutputObject[], "audit": AIAuditObject[] }`

### `POST /api/owner/ai/jobs/:id/approve`
Owner curatorial gate: atomically commits the drafted content from `ai_outputs` into the canonical museum database (`games`, `news_articles`, etc.).
- **Body**: `{ "notes"?: string }`
- **Response**: `{ "success": true, "jobId": string, "status": "COMPLETED" }`

### `POST /api/owner/ai/jobs/:id/reject`
Owner curatorial gate: rejects the drafted content, archiving the curator's review notes without mutating canonical records.
- **Body**: `{ "notes": string }`
- **Response**: `{ "success": true, "jobId": string, "status": "CANCELLED" }`

### `POST /api/owner/ai/jobs/:id/retry`
Re-enqueues a failed AI job for another processing attempt.
- **Response**: `{ "success": true, "id": string, "status": "QUEUED" }`

### `POST /api/owner/ai/jobs/:id/cancel`
Cancels a currently queued job.
- **Response**: `{ "success": true, "id": string, "status": "CANCELLED" }`

### `POST /api/owner/ai/kill-switch`
Administrative toggle for AI automation operations.
- **Body**: `{ "state": "ENABLED" | "DEGRADED" | "DISABLED", "reason": string }`
- **Response**: `{ "success": true, "status": { "state": string, "reason": string, "updatedAt": string } }`

### `GET /api/owner/ai/stream`
Server-Sent Events (SSE) live feed emitting queue events (`AI_JOB_ENQUEUED`, `AI_JOB_PROCESSING`, `AI_JOB_AWAITING_OWNER`, `AI_JOB_FAILED`, `AI_KILL_SWITCH_UPDATED`) to the Owner Command Center.

### `POST /api/owner/sources/fetch`
Safely fetches and extracts an external source URL with SSRF protection, size caps, and content fingerprinting.
- **Body**: `{ "url": string }`
- **Response**: `{ "success": true, "snapshotId": string, "title": string, "contentHash": string, "author": string, "publishedDate": string, "textSnippet": string }`

### `GET /api/owner/news-candidates`
Lists ingested news story candidates awaiting owner curation.
- **Query Params**: `status` (default: `DRAFTED`)
- **Response**: `{ "candidates": NewsCandidateObject[] }`

### `POST /api/owner/news-candidates/:id/publish`
Approves and publishes a news candidate into live `news_articles`, atomically resolving any related content conflicts.
- **Body**: `{ "title"?: string, "body"?: string, "category"?: string }`
- **Response**: `{ "success": true, "articleId": string, "slug": string }`

### `GET /api/owner/game-candidates`
Lists newly discovered game specimens awaiting curation.
- **Query Params**: `status` (default: `CANDIDATE`)
- **Response**: `{ "candidates": GameCandidateObject[] }`

### `POST /api/owner/game-candidates/:id/publish`
Approves and publishes a game candidate into canonical `games` and `game_images`.
- **Body**: `{ "title"?: string, "slug"?: string, "platform"?: string, "developer"?: string, "publisher"?: string, "releaseYear"?: int, "genre"?: string, "description"?: string, "imageUrl"?: string }`
- **Response**: `{ "success": true, "gameId": string, "slug": string }`

### `GET /api/owner/release-monitor`
Lists tracked release watches and detected date changes.
- **Query Params**: `status` (optional: `AWAITING_REVIEW`, `WATCHING`, `APPROVED`)
- **Response**: `{ "records": ReleaseWatchRecordObject[] }`

### `POST /api/owner/release-monitor/:id/approve`
Approves a detected release date revision, updates the record, and delivers in-app notifications to all users who favorited the game.
- **Body**: `{ "releaseDate": string }`
- **Response**: `{ "success": true, "recordId": string, "updatedDate": string, "status": "APPROVED" }`



