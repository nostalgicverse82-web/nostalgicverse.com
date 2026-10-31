# NostalgicVerse — Phase 12 Product Surface Map

This document establishes the authoritative, end-to-end mapping of all backend capabilities to public entry points, authenticated entry points, owner controls, APIs, database tables, realtime WebSocket events, and frontend UI templates.

---

## 1. Global Navigation & Header Account Control

| Capability | Public Entry Point | Authenticated Entry Point | Owner Entry Point | Primary API | Authoritative Database Tables | Realtime Events | Frontend Implementation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Account Identity** | Header button: `Account` (Dropdown: Log In, Sign Up) | Header pill: `[Avatar] Display Name` with chevron | Header pill: `[Avatar] Display Name [OWNER]` | `GET /api/auth/me` | `users`, `user_profiles`, `sessions` | `auth.session_invalidated` | `assets/js/auth-ui.js`, `assets/css/auth-ui.css` |
| **Header Notification Badges** | Hidden (no badges for guests) | Dynamic badge cluster: Messages, Friend Requests, Notifications | Dynamic badge cluster + Owner dashboard quick link | `GET /api/users/counts` | `messages`, `friend_requests`, `notifications` | `message.created`, `friend_request.created`, `notification.created` | `assets/js/auth-ui.js`, `assets/js/realtime-client.js` |
| **Global Account Menu** | Log In (`/login/`), Sign Up (`/signup/`) | 11 canonical routes: Account, Profile, Friends, Messages, Notifications, Favorites, Collections, Support, Submissions, Settings, Log Out | 11 canonical routes + highlighted `Owner Dashboard` (`/owner/`) | `POST /api/auth/logout` | `sessions` | N/A | `assets/js/auth-ui.js`, `tools/generation/support-brand-snippets.cjs` |

---

## 2. User Account Dashboard & Profile Surface

| Capability | Public Entry Point | Authenticated Entry Point | Owner Entry Point | Primary API | Authoritative Database Tables | Realtime Events | Frontend Implementation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Account Overview & Metrics** | N/A (Redirects to `/login/`) | `/account/` (Overview Tab) | `/account/` + link to `/owner/` | `GET /api/account/summary` | Aggregated count queries on `friends`, `favorites`, `collections`, `submissions`, `support_tickets`, `reviews`, `comments`, `notifications`, `messages` | Realtime state listener | `account/index.html`, `assets/js/account-ui.js` |
| **Profile & Bio Management** | N/A | `/account/#profile` (Edit bio, display name, avatar) | `/account/#profile` | `PATCH /api/account/profile` | `users.display_name`, `users.bio`, `user_profiles` | N/A | `assets/js/account-ui.js` |
| **Public User Profile** | `/u/:username` (View avatar, bio, collections, reviews, joined date) | `/u/:username` (+ contextual Friend/Message buttons) | `/u/:username` (+ administrative actions) | `GET /api/users/profile/:username` | `users`, `user_profiles`, `collections`, `reviews` | `friend_request.accepted` | `assets/js/public-profile-ui.js`, `profile/index.html` (auto-redirect) |
| **Curated Collections** | `/u/:username` (Public collections) | `/collections/` (Create, edit, toggle visibility) | `/collections/` | `GET/POST /api/users/collections` | `collections`, `collection_items` | N/A | `collections/index.html`, `assets/js/collections-ui.js` |
| **Favorites / Saves** | N/A | `/favorites/` | `/favorites/` | `GET /api/users/favorites` | `favorites`, `saves` | N/A | `favorites/index.html`, `assets/js/favorites-ui.js` |

---

## 3. Social Engine & Realtime Communications

| Capability | Public Entry Point | Authenticated Entry Point | Owner Entry Point | Primary API | Authoritative Database Tables | Realtime Events | Frontend Implementation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Member Discovery** | N/A (Redirects to `/login/`) | `/friends/` (Discover tab: auto-loaded real members with pagination & sorting) | `/friends/` | `GET /api/users/discover` | `users`, `friends`, `friend_requests`, `user_blocks` | Presence updates | `friends/index.html`, `assets/js/friends-ui.js` |
| **Friend Requests** | N/A | `/friends/` (Pending tab), `/u/:username` | `/friends/` | `POST /api/users/friends/request`, `POST /api/users/friends/request/:id/accept` | `friend_requests`, `friends` | `friend_request.created`, `friend_request.accepted` | `assets/js/friends-ui.js`, `assets/js/public-profile-ui.js` |
| **Actionable Notifications** | N/A | `/notifications/` (Categorized tabs: All, Friends, Messages, Support, Submissions, System with inline action buttons) | `/notifications/` | `GET /api/users/notifications`, `POST /api/users/notifications/mark-read` | `notifications` | `notification.created` | `notifications/index.html`, `assets/js/notifications-ui.js` |
| **Realtime Chat & Messaging** | N/A | `/messages/` (Active conversation list + message thread + composer) | `/messages/` | `GET /api/chat/conversations`, `POST /api/chat/conversations/:id/messages` | `conversations`, `conversation_members`, `messages` | `message.created`, `typing.started` | `messages/index.html`, `assets/js/chat-ui.js` |

---

## 4. Content Exhibits & Interactive Engagement

| Capability | Public Entry Point | Authenticated Entry Point | Owner Entry Point | Primary API | Authoritative Database Tables | Realtime Events | Frontend Implementation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Reactions (Like/Dislike)** | Exhibit pages (`/games/:slug/`, `/consoles/:slug/`) read-only counts | Exhibit pages (Interactive Like/Dislike toggle) | Exhibit pages | `GET/POST /api/community/reactions` | `reactions` | N/A | `assets/js/content-interactions.js` |
| **Threaded Comments & Replies** | Exhibit pages (Browse public comments thread) | Exhibit pages (Post top-level comment, reply, edit, delete own comment) | Exhibit pages (Delete/hide any comment) | `GET/POST/PATCH/DELETE /api/community/comments` | `comments` | `comment.created` | `assets/js/content-interactions.js` |
| **Reviews & Ratings** | Exhibit pages (View average score & retrospective reviews) | Exhibit pages (Write 1–10 review with pros, cons, spoilers) | Exhibit pages (Moderate reviews) | `GET/POST/DELETE /api/community/reviews` | `reviews` | N/A | `assets/js/content-interactions.js` |
| **Content Bookmarking** | Exhibit pages (Prompt to login) | Exhibit pages (Save/Bookmark toggle button) | Exhibit pages | `GET/POST /api/community/saves` | `saves` | N/A | `assets/js/content-interactions.js` |
| **Community Submissions** | N/A | `/ideas/` (Submit new game/console for catalog inclusion) | `/owner/#owner-submissions` (Review, approve, or reject) | `POST /api/submissions`, `POST /api/owner/submissions/:id/review` | `submissions`, `games`, `consoles` | `submission.reviewed` | `ideas/index.html`, `assets/js/ideas-ui.js`, `assets/js/owner-ui.js` |
| **Support Help Desk** | `/support/` (FAQ / Knowledgebase) | `/support/` (Create ticket, reply to existing tickets) | `/owner/#owner-support` (Inspect, reply, close tickets) | `GET/POST /api/support/tickets`, `POST /api/support/tickets/:id/messages` | `support_tickets`, `ticket_messages` | `ticket.replied` | `support/index.html`, `assets/js/support-ui.js`, `assets/js/owner-ui.js` |

---

## 5. Owner Administration & Curatorial Control

| Capability | Public Entry Point | Authenticated Entry Point | Owner Entry Point | Primary API | Authoritative Database Tables | Realtime Events | Frontend Implementation |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **4 Metric Clusters** | N/A | 403 Forbidden | `/owner/` (Platform, Content, Community, System) | `GET /api/owner/stats` | Authoritative SQLite aggregate queries | Realtime socket metrics | `owner/index.html`, `assets/js/owner-ui.js` |
| **User Directory Search** | N/A | 403 Forbidden | `/owner/#owner-users` | `GET /api/owner/users` | `users`, `user_profiles` | N/A | `assets/js/owner-ui.js` |
| **Review Moderation** | N/A | 403 Forbidden | `/owner/#owner-reviews` | `GET /api/owner/reviews`, `POST /api/owner/reviews/:id/delete` | `reviews`, `audit_logs` | N/A | `assets/js/owner-ui.js` |
| **Comment Moderation** | N/A | 403 Forbidden | `/owner/#owner-comments` | `GET /api/owner/comments`, `POST /api/owner/comments/:id/delete` | `comments`, `audit_logs` | N/A | `assets/js/owner-ui.js` |
| **Audit Log Trail** | N/A | 403 Forbidden | `/owner/#owner-audit` | `GET /api/owner/audit-logs` | `audit_logs` | N/A | `assets/js/owner-ui.js` |
| **Site Generators** | N/A | 403 Forbidden | `/owner/#owner-content` | `POST /api/owner/generators/run` | File system builds + `audit_logs` | N/A | `assets/js/owner-ui.js` |

