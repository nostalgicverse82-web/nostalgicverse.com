# SECURITY ARCHITECTURE

## Defense in Depth Principles
- **Authentication:** UUID-based opaque session tokens, HTTP-Only cookies, and strict PBKDF2 hashing. (IMPLEMENTED)
- **Authorization:** Server-side RBAC (`VISITOR`, `USER`, `OWNER`). Frontend UI-hiding is merely cosmetic; backend APIs enforce access. (IMPLEMENTED)
- **Secrets Management:** `INTERNAL_API_SECRET` and AI keys are strictly server-side. No credential leaks to the client bundle. (DESIGNED)
- **Output Encoding & Validation:** All user inputs are sanitized. (DESIGNED)
- **Data Protection:** `OWNER_INITIAL_PASSWORD` is used for single-use provisioning. (IMPLEMENTED)
- **Audit Logging:** Destructive or high-risk actions (bans, edits) are logged immutably. (IMPLEMENTED)
- **Data Source of Truth:** `DATABASE` is authoritative. No dual-brain sync risks. (IMPLEMENTED)

## Owner Dashboard Architecture
The `/owner/` namespace is rigorously protected by the `requireOwner` middleware.
Planned sections: Dashboard, Games, Consoles, Ideas, Submissions, News, Stories, Guides, Timeline, Releases, Compatibility, Users, Comments, Reviews, Reports, Media, AI, Analytics, Sponsors, Ads, System, Audit Logs, Settings.

## Backup / Migration Safety
Before structural changes:
1. Static data and sources are backed up.
2. Existing routes and slugs are preserved.
3. Rollback contingencies are maintained.
Legacy museum content is NEVER deleted.

