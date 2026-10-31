# NostalgicVerse — Phase 12 User Experience (UX) Architecture

This document details the interface standards, component designs, responsive behavior, and deterministic state handling across the NostalgicVerse application.

---

## 1. Global Header Account Control

The global header provides a persistent, unified account control anchor on every public, authenticated, and owner page.

### 1.1 Unauthenticated / Guest State
- **Trigger**: `[ Account ▾ ]` pill button.
- **Dropdown Options**:
  - `Log In` (`/login/`)
  - `Sign Up` (`/signup/`)
- Badges: Entirely hidden.

### 1.2 Authenticated User State
- **Trigger**: Compact pill showing user avatar thumbnail, display name (or username), and chevron indicator.
- **Header Badges**: Quick-access cluster with dynamic numeric badges:
  - 💬 **Messages**: Leads to `/messages/` (hidden when count = 0)
  - 👥 **Friend Requests**: Leads to `/friends/` (hidden when count = 0)
  - 🔔 **Notifications**: Leads to `/notifications/` (hidden when count = 0)
- **Dropdown Menu (11 canonical routes)**:
  1. `Account` (`/account/`)
  2. `Profile` (`/u/:username`)
  3. `Friends` (`/friends/`)
  4. `Messages` (`/messages/`)
  5. `Notifications` (`/notifications/`)
  6. `Favorites` (`/favorites/`)
  7. `Collections` (`/collections/`)
  8. `Support` (`/support/`)
  9. `Submissions` (`/ideas/`)
  10. `Settings` (`/account/#settings`)
  11. `Log Out` (Server-side session invalidation)

### 1.3 Owner State
- **Trigger**: Shows user avatar, display name, and a distinct cyan `[OWNER]` badge.
- **Dropdown Menu**: Displays all 11 user routes plus a highlighted, top-priority `Owner Dashboard` (`/owner/`) option with distinct visual emphasis.

---

## 2. Mobile Responsive Architecture

Mobile ergonomics are strictly enforced across small screens:
- **320px (e.g. iPhone SE, small Androids)**:
  - Text truncated cleanly with ellipsis; badges shrink and wrap flexibly.
  - Dropdown menu automatically aligns to `right: 0` with maximum width `calc(100vw - 20px)` to prevent viewport clipping.
  - Zero horizontal overflow (`overflow-x: hidden`).
- **375px (Standard Mobile)**:
  - Header actions stack or align without collision.
  - Badges clearly readable with sufficient tap targets (minimum 36px touch area).
- **430px (Large Mobile / Phablet)**:
  - Full avatar + display name rendered with proportional font scaling.
- **768px (Tablet Portrait)**:
  - Badges expand with hover tooltips; full menu transitions smoothly.

---

## 3. Four-State UI Pattern

To prevent broken or confusing layouts, every data-driven view adheres strictly to a deterministic 4-state lifecycle:

```
[ LOADING ] --------> [ SUCCESS ] (Render real data)
     |
     +--------------> [ EMPTY ]   (Purposeful empty state + Call to Action)
     |
     +--------------> [ ERROR ]   (Clear error explanation + In-Place Retry button)
```

### 3.1 Loading State
- Clean, CSS-based pulsing retro spinner or skeleton placeholder.
- Disables interaction buttons to prevent duplicate submission or double-click anomalies.

### 3.2 Success State
- Authoritative content rendered using safe DOM construction or sanitized HTML.

### 3.3 Empty State
Never renders a blank container. Always provides guidance and an actionable button:
- **Notifications**:
  - `Friend Requests`: *"No pending friend requests. [ Discover People ]"*
  - `Messages`: *"No unread messages. [ Open Chat ]"*
  - `Support`: *"No active support tickets. [ Create Ticket ]"*
  - `Submissions`: *"You have not submitted any games or consoles yet. [ Submit Exhibit ]"*
  - `System`: *"All systems running smoothly."*
- **Support Tickets**:
  - *"No support requests yet. Have a question or encountered a bug? [ Create Support Request ]"*
- **Ideas & Submissions**:
  - *"No submissions yet. Have a classic game or hardware piece to recommend? [ Submit an Exhibit ]"*
- **Friends Discovery**:
  - *"No other registered retro archivists found yet."*

### 3.4 Error State with In-Place Retry
- Clear, respectful error message explaining what failed (e.g. *"Unable to load notifications. Please check your connection."*).
- An interactive `[ ↻ Retry ]` button that re-executes the fetch function in place without requiring a full browser page reload.

