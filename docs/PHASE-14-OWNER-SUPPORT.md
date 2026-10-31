# NOSTALGICVERSE — PHASE 14 SUPPORT HELPDESK & COMMUNICATION

## 1. Ticket Lifecycle & Data Model
- **Entity:** `support_tickets`
- **Statuses:** `OPEN`, `WAITING_ON_USER`, `WAITING_ON_ADMIN`, `RESOLVED`, `CLOSED`
- **Priorities:** `LOW`, `NORMAL`, `HIGH`, `URGENT`
- **Messages:** `support_messages` stores conversation threads with user ID, body, attachment links, and private metadata flags.

---

## 2. Private Internal Notes
- Owners can submit private internal notes on tickets via `POST /api/owner/support/:id/notes`.
- **Privacy Enforcement:** Messages marked with `is_internal = 1` are stripped from all public/user-facing support endpoints. They are never rendered in the user helpdesk, never indexed by search engines, and only accessible by verified owners.

---

## 3. Security & Anti-IDOR Enforcement
- Normal users can only fetch or query tickets matching their own `user_id`.
- The owner helpdesk route `/api/owner/support` verifies that the requesting user possesses `role = 'OWNER'` before exposing cross-user ticket queues.

