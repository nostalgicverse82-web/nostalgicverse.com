# NostalgicVerse — Phase 11 Friends & Social Discovery

## Problem Statement & Root Cause
Prior to Phase 11:
1. **Search Bottleneck**: Users could not discover friends or other community members without knowing and manually typing exact usernames. There was no automatic member directory.
2. **Disconnected UI State**: Sending a friend request often required page refreshes to see state changes.
3. **Passive Request Handling**: Friend requests lacked inline contextual actions, forcing users through multiple routing layers.

---

## Technical Solution

### 1. Automatic Database-Backed Member Discovery
The new endpoint `GET /api/users/discover` queries registered users directly from SQLite, calculating each member's relationship to the requesting user:
```sql
SELECT u.id, u.username, u.display_name, u.avatar_id, u.created_at,
       (SELECT 1 FROM friends WHERE user_id = :currentUserId AND friend_id = u.id) as is_friend,
       (SELECT id FROM friend_requests WHERE sender_id = :currentUserId AND receiver_id = u.id AND status = 'PENDING') as outgoing_request_id,
       (SELECT id FROM friend_requests WHERE sender_id = u.id AND receiver_id = :currentUserId AND status = 'PENDING') as incoming_request_id,
       (SELECT 1 FROM user_blocks WHERE blocker_id = :currentUserId AND blocked_id = u.id) as is_blocked
FROM users u
WHERE u.id != :currentUserId
ORDER BY u.created_at DESC
LIMIT :limit OFFSET :offset;
```

This returns an authoritative status enum for each user:
- `SELF`: Current logged-in user
- `FRIENDS`: Mutual friendship established
- `REQUEST_SENT`: Outgoing pending friend request
- `REQUEST_RECEIVED`: Incoming pending friend request (renders direct Accept/Decline)
- `BLOCKED`: User is blocked
- `NONE`: No relationship (renders primary "Add Friend" button)

### 2. Five-Tab Unified Management
The Friends page (`/friends/`) features 5 dedicated tabs:
1. **My Friends (`friends-list`)**: Active mutual friends with Online presence badge, direct `[ Message ]` link, and `[ Remove ]` option.
2. **Discover People (`friends-discover`)**: Automatically lists all community members without requiring search. Includes search filter input and sorting dropdowns (`Recently Active`, `Newest Members`, `Alphabetical`).
3. **Incoming Requests (`friends-incoming`)**: Pending requests with direct `[ Accept ]` and `[ Decline ]` buttons.
4. **Outgoing Requests (`friends-outgoing`)**: Sent requests awaiting response, with direct `[ Cancel ]` option.
5. **Blocked Users (`friends-blocked`)**: Managed list of blocked accounts with `[ Unblock ]` action.

### 3. Bidirectional Database Integrity
When a friend request is accepted via `POST /api/users/friends/request/:id/accept`:
1. The request status is updated to `ACCEPTED` in `friend_requests`.
2. Bidirectional records are inserted into `friends` in a single ACID transaction:
   ```sql
   INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP);
   INSERT OR IGNORE INTO friends (user_id, friend_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP);
   ```
3. A notification is dispatched to the sender: `${recipient} accepted your friend request`.
4. WebSocket event `friend_request.accepted` is emitted to both users to refresh active UI states.

---

## Verification
Verified via `tools/validation/test-phase11-friends-e2e.cjs`:
- Member card rendered automatically in Discover tab without typing search terms.
- Button changed in-place to "Request Sent" upon click.
- Recipient accepted request, establishing bidirectional rows in `friends`.
- Sender's "My Friends" tab automatically listed recipient.

