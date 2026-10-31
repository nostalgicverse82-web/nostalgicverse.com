# NostalgicVerse — Phase 11 Notification Engine

## Problem Statement & Root Cause
Prior to Phase 11:
1. **Passive Markup**: Friend request notifications were static text strings without interactive controls. To accept a request, users were forced to navigate away to the user's profile or friends directory.
2. **Missing Actor Context**: Notifications lacked enriched metadata (`actor_avatar_id`, `actor_username`, `reference_id`), rendering default placeholders.
3. **Desynchronized Read States**: Reading notifications on one tab did not update the header badge or persist reliably across sessions.

---

## Technical Solution

### 1. Database-Backed Actionable Notifications
The `notifications` table stores authoritative notification records:
- `id`: UUID primary key
- `user_id`: Target recipient user UUID
- `type`: Notification type enum (`FRIEND_REQUEST`, `FRIEND_ACCEPT`, `COMMENT_REPLY`, `SYSTEM`)
- `reference_id`: Contextual entity UUID (e.g. `request_id` or `comment_id`)
- `message`: Descriptive message string
- `is_read`: Boolean flag (0 = unread, 1 = read)
- `created_at`: Authoritative server timestamp

### 2. Enriched Notification API
When queried via `GET /api/users/notifications`, the server joins actor data to provide rich context:
```sql
SELECT n.id, n.type, n.reference_id, n.message, n.is_read, n.created_at,
       fr.sender_id as actor_id,
       u.username as actor_username,
       u.display_name as actor_display_name,
       u.avatar_id as actor_avatar_id
FROM notifications n
LEFT JOIN friend_requests fr ON n.type = 'FRIEND_REQUEST' AND n.reference_id = fr.id
LEFT JOIN users u ON fr.sender_id = u.id
WHERE n.user_id = ?
ORDER BY n.created_at DESC
LIMIT 50;
```

### 3. Inline Direct Actions & In-Place Resolution
When `type === 'FRIEND_REQUEST'`, the notifications interface (`assets/js/notifications-ui.js`) renders direct inline action buttons:
```html
<div class="notification-actions">
    <button class="social-btn primary" onclick="acceptFriendRequestFromNotif('req_123', 'notif_456')">Accept</button>
    <button class="social-btn danger" onclick="declineFriendRequestFromNotif('req_123', 'notif_456')">Decline</button>
</div>
```

When clicked:
1. `POST /api/users/friends/request/:id/accept` executes the database transaction.
2. `POST /api/users/notifications/mark-read` marks the notification as read.
3. The UI updates the notification card in-place with a warm success indicator ("Request accepted") without requiring a full page refresh.
4. The global header notification badge decrements automatically.

### 4. Realtime Notification Delivery
When a friend request or reply is created, `websocket.cjs` emits a realtime event `notification.created` directly to the recipient's authenticated socket connection. `NVRealtime` triggers an unread badge animation in the header and increments the counter in real time.

---

## Verification
Verified via `tools/validation/test-phase11-friends-e2e.cjs`:
- Notification item rendered with inline `[ ACCEPT ]` and `[ DECLINE ]` buttons.
- Direct click on `[ ACCEPT ]` executed the API and marked the notification as read.
- Bidirectional friendship confirmed in database immediately following the inline action.

