# PHASE 03 ACCOUNT UI

## Overview
Phase 03 establishes the frontend shell and user-facing entry points for the NostalgicVerse platform authentication. It introduces the account dropdown menu, login/signup forms, and future-ready state handling without relying on insecure client-side mock authentication.

## Header Account Control
- **Location:** Injected directly into the `.brand-group` on the LEFT side of the global header, preserving existing layout (`IMPLEMENTED`).
- **Logged-Out State:** Displays "ACCOUNT" header in the dropdown with links for `Log In` and `Sign Up` (`IMPLEMENTED`).
- **Logged-In State:** Displays the user's display name or username, `Account`, `Profile`, and `Log Out` (`IMPLEMENTED`).
- **Owner State:** If the role is `OWNER`, a premium `Owner Dashboard` link is dynamically added in gold (`IMPLEMENTED`).
- **Mobile Behavior:** Preserved seamlessly as the menu acts as an absolute dropdown beneath the brand group; fully functional across all viewports (`IMPLEMENTED`).

## Routes
- `/login/`: Form with Username/Email and Password, password visibility toggle (`IMPLEMENTED`).
- `/signup/`: Email, Username, Display Name, Password, Confirm Password (`IMPLEMENTED`).
- `/forgot-password/`: Shell endpoint for sending reset instructions (`IMPLEMENTED`).
- `/account/`: Authorized user dashboard shell (`IMPLEMENTED`).
- `/profile/`: Public-facing user profile shell (`IMPLEMENTED`).

## Auth State Architecture
- **Centralized Auth State:** `auth-ui.js` handles state globally by fetching `/api/auth/me` on load. If it fails, falls back safely to Logged-Out UI (`IMPLEMENTED`).
- **Username Normalization UX:** Frontend displays exact casing entered, respects backend case-insensitivity seamlessly (`DESIGNED`).
- **Password Handling:** Strict `type="password"`, no lowercase mutation, no local caching (`IMPLEMENTED`).
- **Error States:** Graceful handling of network unavailability or 401s via `auth-error-msg` overlays (`IMPLEMENTED`).
- **Loading States:** Forms disable inputs and reflect "LOGGING IN..." or "CREATING ACCOUNT..." to prevent duplicates (`IMPLEMENTED`).

## Security
- **Secrets Exposed:** Zero secrets, keys, or Owner passwords reside in the frontend codebase (`VERIFIED`).
- **Fake Authentication:** `localStorage` is explicitly avoided for state validation. Purely relies on backend API (`VERIFIED`).
- **Accessibility:** Keyboard navigable with Escape-to-close behavior, accessible focus states, and ARIA attributes (`IMPLEMENTED`).

