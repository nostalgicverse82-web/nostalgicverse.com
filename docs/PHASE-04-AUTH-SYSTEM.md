# Phase 04: Real Authentication + Profile Avatars

## Objective
Convert the Phase 03 static auth UI shell into a fully functional authentication system backed by a SQLite database (`users`, `sessions`). Integrate the 50 predefined avatar icons into a centralized registry and support picking/updating avatars across the platform.

## Architecture Decisions

1. **Authentication Core:**
   - **Endpoints (`server/api/auth.cjs`)**:
     - `POST /api/auth/signup`: Validates uniqueness (case-insensitive) of username/email, hashes passwords, generates a session, sets `avatar_id` to null initially, and sets secure HTTP-only cookies.
     - `POST /api/auth/login`: Verifies credentials, generates session, returns `force_password_change` boolean flag to trigger client-side intercepts.
     - `POST /api/auth/logout`: Invalidates backend session and clears cookies.
     - `GET /api/auth/me`: Returns current user details including `avatar_id` and `display_name` directly from the `users` table.
     - `POST /api/auth/change-password`: Used for handling forced password changes or user-initiated updates.

2. **Account / Profiles (`server/api/account.cjs`)**:
   - Centralizes the avatar registry, returning the `/api/account/avatars` list (50 mappings).
   - Allows users to partially `PATCH /api/account/profile` with `avatar_id` or `display_name` updates.

3. **Avatar System UI (`assets/js/avatar-picker.js`)**:
   - Uses a globally available `window.AvatarPicker` modal.
   - Triggers immediately after login if the user has no `avatar_id` configured.
   - Shows the active avatar in the global header account button.

4. **Owner Provisioning & Security Intercepts**:
   - The UI intercept (`auth-ui.js`) inspects the response from `/api/auth/me`. If `force_password_change` is truthy, an inescapable modal is injected preventing navigation until a new password is submitted via `/api/auth/change-password`.

5. **Database Enhancements (`003_phase04.sql`)**:
   - Re-architected schema to merge `display_name` and `avatar_id` directly into the `users` table to improve lookup speed and session efficiency.

## Next Steps
The backend is now fully authenticating users against real data. Future phases can rely on `req.user` inside `requireAuth` middleware for content submission, commenting, and collections.

