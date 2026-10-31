# Phase 11: Social + Community Engine Root Cause Analysis Report

**Date:** 2026-09-23  
**Status:** ROOT CAUSES IDENTIFIED & VERIFIED  
**System Architecture Audited:** Client (`chat-ui.js`, `auth-ui.js`, `friends-ui.js`, `notifications-ui.js`, `community-ui.js`), Server (`server/index.cjs`, `server/api/chat.cjs`, `server/api/social.cjs`, `server/api/community.cjs`), Realtime (`server/realtime/websocket.cjs`), Database (`data/nostalgicverse.db` SQLite schema & migrations).

---

## 1. Chat Message Duplication (Sender 2–3x, Recipient 1x)

### Observed Symptoms
- When a user types a message and hits Send, the sender's client renders 2 or 3 copies of the exact same message.
- The recipient typically sees only 1 canonical copy.
- On page refresh, only 1 copy remains in the database.

### Concrete Source Files & Functions Involved
1. **`assets/js/chat-ui.js` -> `els.form.addEventListener('submit')` (Lines 167–188)**:
   - When the user sends a message, `fetch('/api/chat/conversations/:id/messages', { method: 'POST', ... })` is called.
   - Upon receiving the HTTP response `{ success: true, message: data.message }`, line 182 immediately calls:
     ```javascript
     appendMessageUI(data.message);
     ```
   - This appends the message directly into the DOM tree with `els.messages.appendChild(div)` without storing or checking any message ID.
2. **`server/api/chat.cjs` -> `router.post('/conversations/:id/messages')` (Lines 147–150)**:
   - After saving the new message to SQLite, line 148 invokes:
     ```javascript
     broadcastMessage(convId, fullMsg);
     ```
3. **`server/realtime/websocket.cjs` -> `broadcastMessage()` (Lines 105–111)**:
   - `broadcastMessage` forwards to `broadcastToConversation(conversationId, payload)`:
     ```javascript
     function broadcastToConversation(conversationId, message, excludeWs = null) {
         ...
         clients.forEach((clientData, ws) => {
             if (ws !== excludeWs && clientData.subscriptions.has(conversationId)) {
                 ws.send(payload);
             }
         });
     }
     ```
   - Notice that `broadcastMessage` **never passes `excludeWs`**!
   - Because the sender has subscribed to `conversationId` upon opening the chat, the server broadcasts `NEW_MESSAGE` back to the sender's own WebSocket connection.
4. **`assets/js/chat-ui.js` -> `ws.onmessage` (Lines 211–218)**:
   - The sender's WebSocket receives the `NEW_MESSAGE` event:
     ```javascript
     if (msg.conversation_id === activeConversationId) {
         appendMessageUI(msg);
     }
     ```
   - Line 217 blindly calls `appendMessageUI(msg)` **again**, creating the 2nd duplicate in the DOM!
5. **`assets/js/auth-ui.js` -> `initGlobalRealtime()` (Lines 344–367)**:
   - `auth-ui.js` opens an independent global WebSocket connection on every page load.
   - If a multi-tab or reconnect event occurs, multiple WebSocket message listeners fire or multiple sockets receive the echo, resulting in a 3rd duplicate.
6. **No Idempotency / Deduplication in Database or DOM**:
   - `server/api/chat.cjs` accepts `idempotency_key` in `req.body` on line 115 but does nothing with it. It does not store `client_message_id` in `messages` and has no unique index on `(conversation_id, client_message_id)`.
   - `appendMessageUI` does not check if `document.getElementById('msg-' + m.id)` or a message with matching `client_message_id` already exists.

---

## 2. Chat Composer / Typing Area Disappearance

### Observed Symptoms
- In active conversations, after multiple messages arrive or when scrolling, the chat composer/input box disappears or gets pushed down out of the viewport.
- On certain state updates (such as opening/closing or switching conversations), the main area can become blank.

### Concrete Source Files & Functions Involved
1. **`assets/css/chat-ui.css` -> Missing `min-height: 0` in Flex Columns (Lines 90–131)**:
   - CSS Flexbox specification defines that flex items have `min-height: auto` by default.
   - In `.chat-container` -> `.chat-main` -> `.chat-active` -> `.chat-messages`:
     - `.chat-active` has `display: flex; flex-direction: column; flex: 1;`.
     - `.chat-messages` has `flex: 1; overflow-y: auto; display: flex; flex-direction: column;`.
     - Without `min-height: 0` on `.chat-active` and `.chat-messages`, when the messages container expands with many messages, the flex child refuses to shrink below its content height. This forces `.chat-composer` below the bottom of the container or viewport, causing it to disappear.
2. **`assets/js/chat-ui.js` -> Destruction / Overwriting of DOM (Lines 60–80 & 106–125)**:
   - When switching or rendering conversations, `els.emptyState.innerHTML = ...` or `els.activeState.style.display = 'none'` are toggled dynamically.
   - When `conversations.length === 0`, `renderConversations` replaces `els.emptyState.innerHTML` unconditionally, which if misaligned with `activeConversationId` hides the composer completely.

---

## 3. Friend Discovery Limitation (Search-Only Bottleneck)

### Observed Symptoms
- Users opening `/friends/` are presented only with tabs: "Friends", "Requests", and "Search".
- To find any user, the user is forced to know and type a username or display name with at least 3 characters.
- If no query is entered, no users are discoverable.

### Concrete Source Files & Functions Involved
1. **`assets/js/friends-ui.js` (Lines 110–143)**:
   - Only implements tab `friends-search`. No `discover-people` tab exists.
   - The user must manually type into `#search-user-input` and click `#search-user-btn`.
2. **`server/api/social.cjs` (Lines 52–72)**:
   - `/api/users/search` only executes if `q.length >= 3`.
   - There is no `/api/users/discover` endpoint that returns a paginated list of real registered users with sorting (`recently_active`, `new_members`, `alphabetical`) and relationship context (`friendStatus`).

---

## 4. Friend Request Notification Limitation (No Direct Actions)

### Observed Symptoms
- When User A sends User B a friend request, User B receives a notification item in `/notifications/`.
- However, the notification only says `"New friend request from userA"` with a button to `"Mark Read"`.
- There is no way to accept or decline the request directly from the notification item. The user has to leave the page, navigate to `/friends/`, switch to the Requests tab, and click Accept there.

### Concrete Source Files & Functions Involved
1. **`assets/js/notifications-ui.js` (Lines 19–30)**:
   - The rendering logic renders every notification identically:
     ```javascript
     <div class="social-list-item ${n.is_read ? '' : 'unread'}">
         <div class="social-info">
             <h4>${n.type.replace(/_/g, ' ')}</h4>
             <p>${n.message}</p>
             <p style="font-size:0.8rem; margin-top:4px;">${time}</p>
         </div>
         ${!n.is_read ? `<div class="social-actions"><button class="social-btn" onclick="markRead('${n.id}')">Mark Read</button></div>` : ''}
     </div>
     ```
   - It completely lacks context-aware actions for `FRIEND_REQUEST` (`[ ACCEPT ]` and `[ DECLINE ]`).
2. **`server/api/social.cjs` -> Notification Payload (Lines 137–155)**:
   - When creating the notification, `reference_id` stores `requestId`, but the notification query does not join or include the sender's user details (avatar, display name, username) or structured action metadata, forcing the frontend to display plain text.

---

## 5. Missing / Inconsistent Content Interaction Systems

### Observed Symptoms
- Supported public museum content pages (Games, Consoles, Stories, Guides, News, Timeline, Genres, Releases, Ideas) do not have the universal interaction bar or community discussion engine integrated.
- On pages where `community-ui.js` was attempted, reaction counters always displayed 0.
- No support for threaded comment replies, editing own comments, soft-deleting comments, saving/bookmarking stories/guides, or native sharing.

### Concrete Source Files & Functions Involved
1. **`assets/js/community-ui.js` vs `server/api/community.cjs` API Mismatch (Lines 43–65 in `community.cjs`, Lines 119–135 in `community-ui.js`)**:
   - `server/api/community.cjs` returns:
     ```javascript
     res.json({ counts, userReaction });
     ```
   - But `community-ui.js` expects:
     ```javascript
     renderReactions(reactData.summary || [], reactData.user_reaction);
     ```
   - `reactData.summary` is always `undefined`, so `types.forEach(...)` always finds count = 0, and user reaction is never highlighted!
2. **Missing Universal Content Interaction Bar**:
   - No unified module exists that takes `(content_type, content_id)` and renders the standardized bar: `[ Like ] [ Dislike ] [ Comments ] [ Reviews ] [ Save ] [ Share ]`.
3. **Database Schema Gaps**:
   - `saves` table does not exist in SQLite schema.
   - `messages.client_message_id` does not exist.
   - Indexes for content reactions, comments by content and time, and reviews by content and time are incomplete.

---

## 6. Realtime Architecture & WebSocket Duplication Risk

### Observed Symptoms
- Multiple independent WebSocket connections opened by the same browser session (`auth-ui.js` + `chat-ui.js`).
- Event listeners bound multiple times across page loads, route switches, and reconnect cycles without cleanup.
- Reconnecting sockets trigger full re-fetches without reconciliation cursors.

### Concrete Source Files & Functions Involved
1. **`assets/js/auth-ui.js` Line 347** & **`assets/js/chat-ui.js` Line 203**:
   - Both call `new WebSocket(...)`, creating 2 concurrent connections per tab.
   - `auth-ui.js` handles unread counts, while `chat-ui.js` handles chat events. They should be unified into a single managed client connection (`window.NVRealtime` or shared socket).
2. **Missing Idempotent Event Handlers**:
   - WebSocket events do not carry unique event IDs or entity IDs checked against a received event set, leading to repeated DOM updates if the server or network resends a frame.

---

## Conclusion
Every single observed issue stems from specific architectural flaws in REST/WebSocket handling, missing CSS layout constraints, missing database idempotency columns/indexes, and decoupled UI state.
Phase 11 will eliminate all of these root causes permanently.

