# Phase 05: Persistent Platform & Chat

## Objective
Evolve NostalgicVerse from a static web shell into a durable, persistent application where accounts, avatars, and direct messages survive browser and server restarts safely.

## Architecture

- **Database as Source of Truth**: SQLite is used for all persistence (Accounts, Conversations, Messages). The browser's `localStorage` is completely circumvented for sensitive or transactional data.
- **REST for Mutations/History**: Conversation creation and message sending are performed over REST API (`POST /api/chat/...`) ensuring standard HTTP transaction lifecycles and idempotency.
- **WebSockets for Realtime Delivery**: Once a REST call successfully commits a message to the database, the server emits a `NEW_MESSAGE` event over WebSockets to any connected clients in the room, guaranteeing that all visible messages are permanently stored.

## Highlights
1. **Accounts**: Sign up flows perfectly through `/api/auth/register`, normalizing email and username strings, hashing the password (PBKDF2), and returning a robust HTTP-only session cookie.
2. **Chat Persistence**: Schema migrated (`004_phase05_chat.sql`) to track `message_type`, `created_by`, and `last_read_at`. 
3. **Cross-browser Stability**: Tests verified that messages do not disappear on refresh. Sessions persist gracefully across browser reloads, driven natively by standard browser cookie policies.
4. **Security**: XSS vectors are mitigated by treating message bodies as raw text on the backend and explicitly HTML-escaping (`escapeHtml`) on the frontend `chat-ui.js` before DOM insertion. Impersonation is blocked via rigorous `req.user.id` checks inside the backend routes, rather than trusting client-provided payloads.

## Next Steps
Future iterations can layer on Social (Friends/Followers), read receipts in the UI, Groups, or Moderation tooling, relying securely on the Phase 05 Chat foundation.

