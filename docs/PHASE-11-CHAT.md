# NostalgicVerse — Phase 11 Chat Engine Architecture

## Problem Statement & Root Cause
Prior to Phase 11, the chat interface exhibited two major failure modes:
1. **Message Duplication (2–3x for Sender)**:
   - When a user submitted a message, the HTTP POST response immediately appended a bubble to the DOM.
   - Concurrently, the WebSocket server broadcasted the message back to the sender because the sender had subscribed to the conversation room and `broadcastMessage()` did not exclude the originating socket.
   - An independent background WebSocket opened by `auth-ui.js` received a secondary copy and dispatched a duplicate DOM append.
2. **Composer Disappearance / Collapse**:
   - The flexbox container lacked `min-height: 0` on intermediate flex children (`.chat-main`, `.chat-active`, `.chat-messages`).
   - As messages accumulated, the scrollable area pushed the composer form below the viewport boundaries.
   - In some transitions, DOM re-renders completely unmounted the composer rather than updating only the message list.

---

## Technical Solution

### 1. Canonical Message ID & Idempotency
Every message record is governed by a canonical server UUID (`id`) and an optional idempotency key (`client_message_id`):
```sql
-- Migration 009: Idempotency column & partial unique index
ALTER TABLE messages ADD COLUMN client_message_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_client_id 
ON messages(client_message_id) 
WHERE client_message_id IS NOT NULL;
```

When a user submits a message:
1. Client generates `client_message_id = 'cmsg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)`.
2. Client renders an optimistic message bubble tagged with `data-client-id="${client_message_id}"` and status `.sending`.
3. Client dispatches `POST /api/chat/conversations/:id/messages` with `{ body, client_message_id }`.
4. The server checks if a message with this `client_message_id` already exists:
   - **If exists**: The server returns the existing canonical message immediately with HTTP 200 without creating a duplicate row.
   - **If new**: The server inserts the row, commits the transaction, returns the canonical message, and broadcasts to room members.

### 2. Sender Echo Handling & Reconciliation
The client deduplication function `renderOrUpdateMessage(m)` in `assets/js/chat-ui.js` operates as follows:
```javascript
function renderOrUpdateMessage(m, shouldScroll = true) {
    if (!m || !m.body) return;

    // 1. Check if message already exists by canonical id
    let existingNode = null;
    if (m.id) {
        existingNode = els.messages.querySelector(`[data-id="${m.id}"]`);
    }
    
    // 2. Check if message exists by client_message_id
    if (!existingNode && m.client_message_id) {
        existingNode = els.messages.querySelector(`[data-client-id="${m.client_message_id}"]`);
    }

    if (existingNode) {
        // Reconcile optimistic node in place
        if (m.id) existingNode.setAttribute('data-id', m.id);
        if (m.client_message_id) existingNode.setAttribute('data-client-id', m.client_message_id);
        existingNode.classList.remove('sending', 'failed');
        return existingNode;
    }

    // Otherwise, create new bubble...
}
```
If the server broadcasts the event back to the sender, the sender's client immediately matches `data-client-id` and updates the existing bubble rather than appending a second element.

### 3. Composer Geometry & Persistence
The chat layout was rebuilt with strict flex containment to ensure the composer never disappears:
```css
.chat-container {
    display: flex;
    height: calc(100vh - 120px);
    overflow: hidden;
}

.chat-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0; /* CRITICAL: Allows flex child to shrink and enable child scrolling */
}

.chat-active {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0; /* CRITICAL */
}

.chat-messages {
    flex: 1;
    overflow-y: auto;
    min-height: 0; /* CRITICAL */
    padding: 24px;
}

.chat-composer {
    flex-shrink: 0;
    position: sticky;
    bottom: 0;
    z-index: 10;
    background: var(--nv-surface);
    border-top: 1px solid var(--nv-border);
}
```

### 4. Smart Scrolling & New Messages Indicator
- When opening a conversation: Messages scroll automatically to the latest message.
- When a new message arrives:
  - If the user is near the bottom (scroll distance < 140px) or is the sender: The container smoothly scrolls to bottom.
  - If the user is reviewing older history: The container does **not** forcibly scroll. Instead, an interactive floating badge `↓ New messages` appears. Clicking it smoothly jumps to the bottom.

### 5. Reconnection & Catchup Sync
Upon network reconnection, `NVRealtime` emits `connection.open`. The chat engine re-subscribes to the active conversation and queries `/api/chat/conversations/:id/messages?limit=30`. The returned messages are reconciled via `renderOrUpdateMessage()`, populating any missed frames without duplicating existing DOM nodes.

---

## Verification & Proof
The automated Puppeteer E2E test `tools/validation/test-phase11-chat-e2e.cjs` verified:
- **Exact-Once Delivery**: User A sends 1 message -> Database rows = 1 -> Sender DOM bubbles = 1 -> Recipient DOM bubbles = 1.
- **Idempotency**: Replaying identical `client_message_id` returns existing message with 0 duplicate DB rows.
- **Composer Stability**: Composer remains 100% visible and mounted during typing, message send, incoming messages, and page refresh.

