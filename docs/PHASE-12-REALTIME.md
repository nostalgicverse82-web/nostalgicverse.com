# NostalgicVerse — Phase 12 Realtime Architecture

This document describes the WebSocket transport layer, client connection lifecycle, room subscriptions, event deduplication, and badge synchronization.

---

## 1. Architectural Principles

1. **Database is Authoritative**:
   - The SQLite database commits every state change (message, friend request, notification, reaction) before any realtime event is broadcast.
   - The browser never relies on WebSocket as an authoritative storage engine; REST endpoints provide canonical history and state initialization.
2. **WebSocket is Pure Transport**:
   - Used exclusively for instantaneous pushes of state changes to connected clients.
3. **Canonical Event ID & Deduplication**:
   - Every broadcast packet carries a unique `event_id`.
   - Clients maintain an in-memory Set of processed `event_id` keys to ensure duplicate network deliveries are discarded silently without duplicating UI nodes.

---

## 2. Event Types & Payloads

### 2.1 Chat Messages (`message.created`)
Broadcast to members of an active conversation room after database insert:
```json
{
  "event_id": "evt_1790157580742_f81d4fae",
  "type": "message.created",
  "data": {
    "conversation_id": "c71a3999-9065-4f4a-8106-e77ad2ba7dbf",
    "message": {
      "id": "m981b29a-2410-449e-ba50-13f508a8e100",
      "client_message_id": "client-msg-p12-001",
      "sender_id": "u45b... ",
      "body": "Hello Bob!",
      "created_at": "2026-09-23T11:00:00.000Z"
    }
  }
}
```

### 2.2 Friend Request Created (`friend_request.created`)
Broadcast directly to the targeted recipient's user socket:
```json
{
  "event_id": "evt_...",
  "type": "friend_request.created",
  "data": {
    "request_id": "req-uuid",
    "sender": {
      "id": "uuid",
      "username": "alice",
      "displayName": "Alice Curates",
      "avatarId": "img22"
    }
  }
}
```

### 2.3 Friend Request Accepted (`friend_request.accepted`)
Broadcast to the original sender to notify them of friendship confirmation:
```json
{
  "event_id": "evt_...",
  "type": "friend_request.accepted",
  "data": {
    "friend": {
      "id": "uuid",
      "username": "bob",
      "displayName": "Bob Cartridge",
      "avatarId": "img15"
    }
  }
}
```

### 2.4 Actionable Notification Created (`notification.created`)
Direct push frame containing notification record and metadata:
```json
{
  "event_id": "evt_...",
  "type": "notification.created",
  "data": {
    "id": "notif-uuid",
    "type": "SUBMISSION_REVIEWED",
    "message": "Your submission 'Chrono Trigger' was approved.",
    "created_at": "2026-09-23T11:05:00.000Z"
  }
}
```

---

## 3. Dynamic Badge Synchronization

The global header badge manager in `assets/js/auth-ui.js` observes realtime events to adjust counts immediately:
1. **Initial Load**:
   - Executes `GET /api/users/counts` to populate authoritative badge counts:
     - `messages` (unread direct messages)
     - `friendRequests` (pending incoming requests)
     - `notifications` (unread notifications)
2. **Realtime Increment**:
   - `message.created` (if recipient is not currently viewing that conversation thread): increments message badge.
   - `friend_request.created`: increments friend request badge.
   - `notification.created`: increments notifications badge.
3. **Realtime Decrement**:
   - When a user opens a conversation, marks notifications as read, or accepts/declines a friend request, the UI decrements the respective badge or re-fetches authoritative counts.
   - When count reaches 0, the badge element is hidden smoothly.

---

## 4. Connection Resilience & Exponential Backoff

`window.NVRealtime` manages connection health automatically:
- **Ping/Pong Heartbeats**: 30-second interval keep-alives prevent proxy timeouts.
- **Exponential Reconnect**: If connection drops, attempts reconnection at intervals of 1s, 2s, 4s, 8s, up to a maximum of 30s.
- **State Recovery**: Upon reconnection, `NVRealtime` automatically re-subscribes to active conversation rooms and triggers a refresh of header counts.

