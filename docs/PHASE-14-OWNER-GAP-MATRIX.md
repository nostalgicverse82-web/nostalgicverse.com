# NOSTALGICVERSE — PHASE 14 OWNER GAP MATRIX

**Phase:** 14 — Owner Command Center & Operations  
**Authority:** Single-Node SQLite WAL (`data/nostalgicverse.db`)  
**Scope:** Server-Side Authorized Operations, CMS, Moderation, Infrastructure, and Security  
**Audit Status:** Fully Implemented and Verified  

---

## 1. Subsystem Classification Matrix

| Subsystem | State | Backend API Route | Frontend Surface | Verification Method |
|---|---|---|---|---|
| **Dashboard** | `VERIFIED` | `/api/owner/overview`, `/stats`, `/health` | `/owner/` (Overview Tab) | `test-phase14-owner-dashboard.cjs` (Live metric aggregation) |
| **Users** | `VERIFIED` | `/api/owner/users`, `/users/:id` | `/owner/` (User Directory) | `test-phase14-owner-users.cjs` (Search, pagination, safe view) |
| **Profiles** | `VERIFIED` | `/api/owner/users/:id` | Modal / Expanded Row | `test-phase14-owner-users.cjs` (Hash omission, activity metrics) |
| **Submissions** | `VERIFIED` | `/api/owner/submissions`, `/submissions/:id/*` | `/owner/` (Submissions Tab) | `test-phase14-owner-submissions.cjs` (Approve, Enhance, Reject) |
| **Ideas** | `VERIFIED` | `/api/owner/ideas`, `/submissions` | `/owner/` (Submissions Tab) | Verified via submissions pipeline |
| **Games** | `VERIFIED` | `/api/owner/content/games`, `/:id` | `/owner/` (Games CMS) | `test-phase14-owner-content.cjs` (Create, edit, versioning) |
| **Consoles** | `VERIFIED` | `/api/owner/content/consoles`, `/:id` | `/owner/` (Consoles CMS) | Transparent PNG safeguard & schema validation |
| **Stories** | `VERIFIED` | `/api/owner/content/stories`, `/:id` | `/owner/` (Editorial Tab) | Versioned content updates |
| **Guides** | `VERIFIED` | `/api/owner/content/guides`, `/:id` | `/owner/` (Editorial Tab) | Structured sections & media references |
| **News** | `VERIFIED` | `/api/owner/content/news_articles`, `/:id` | `/owner/` (Editorial Tab) | Factual status & citation enforcement |
| **Timeline** | `VERIFIED` | `/api/owner/content/timeline_events`, `/:id` | `/owner/` (Timeline/Genres Tab) | Date precision & entity relations |
| **Genres** | `VERIFIED` | `/api/owner/content/genres`, `/:id` | `/owner/` (Timeline/Genres Tab) | Slug validation & taxonomy |
| **Releases** | `VERIFIED` | `/api/owner/releases`, `/:id` | `/owner/` (Releases & Compat Tab) | Game FK validation & date precision |
| **Compatibility** | `VERIFIED` | `/api/owner/compatibility`, `/:id`, `/batch` | `/owner/` (Releases & Compat Tab) | System matrix & batch update validation |
| **Media** | `VERIFIED` | `/api/owner/media`, `/replace`, `/audit` | `/owner/` (Media Manager Tab) | `test-phase14-owner-media.cjs` (Protected assets guard) |
| **SEO** | `VERIFIED` | `/api/owner/seo/audit`, `/seo/:type/:id` | `/owner/` (Search & SEO Tab) | `test-phase14-owner-search-seo.cjs` (Metadata checks) |
| **Search** | `VERIFIED` | `/api/owner/search/rebuild`, `/search/validate`| `/owner/` (Search & SEO Tab) | Atomic rebuild & document count validation |
| **Comments** | `VERIFIED` | `/api/owner/comments/:id/hide`, `/restore` | `/owner/` (Moderation Tab) | `test-phase14-owner-moderation.cjs` (Visibility toggle) |
| **Reviews** | `VERIFIED` | `/api/owner/reviews/:id/hide`, `/restore` | `/owner/` (Moderation Tab) | Rating protection & soft deletion |
| **Reports** | `VERIFIED` | `/api/owner/reports`, `/:id/status` | `/owner/` (Moderation Tab) | Triage workflow (OPEN, INVESTIGATING, RESOLVED) |
| **Moderation** | `VERIFIED` | `/api/owner/moderation/stats`, `/action` | `/owner/` (Moderation Tab) | Unified moderation dashboard |
| **Support** | `VERIFIED` | `/api/owner/support`, `/support/:id/reply` | `/owner/` (Support Helpdesk Tab) | `test-phase14-owner-support.cjs` (Private internal notes) |
| **Analytics** | `VERIFIED` | `/api/owner/analytics/overview` | `/owner/` (Analytics Tab) | Zero fake metrics; measured timeframes |
| **Jobs** | `VERIFIED` | `/api/owner/jobs`, `/jobs/:id/retry`, `/cancel` | `/owner/` (Jobs Center Tab) | `test-phase14-owner-jobs.cjs` (Allowlist enforcement) |
| **AI** | `VERIFIED` | `/api/owner/ai/queue`, `/ai/drafts/:id/review` | `/owner/` (AI Control Tab) | Sandboxed server boundary; owner gatekeeping |
| **Backups** | `VERIFIED` | `/api/owner/backups`, `/create`, `/verify` | `/owner/` (Backups & DR Tab) | `test-phase14-owner-backup.cjs` (Isolated restore test) |
| **Security** | `VERIFIED` | `/api/owner/security/events`, `/sessions` | `/owner/` (Security Tab) | `test-phase14-owner-security.cjs` (RBAC, IDOR, token hygiene)|
| **Business** | `VERIFIED` | `/api/owner/business/sponsors`, `/ads` | `/owner/` (Business & Ads Tab) | Sponsor inquiry triage & ad slots configuration |
| **Ads** | `VERIFIED` | `/api/owner/business/ads` | `/owner/` (Business & Ads Tab) | Slot inventory architecture without fake impressions |
| **Settings** | `VERIFIED` | `/api/owner/settings`, `/maintenance` | `/owner/` (Settings Tab) | Maintenance mode toggle & display name configuration |
| **Audit** | `VERIFIED` | `/api/owner/audit` | `/owner/` (Audit Trail Tab) | Immutable logging of all state-changing actions |

---

## 2. Gap Remediation Summary

1. **RBAC & Endpoint Authorization:** Every `/api/owner/*` route is protected by `requireAuth` and `requireOwner` middleware. Unauthenticated visitors receive 401; standard registered users receive 403.
2. **Credential Sanitization:** User passwords, bcrypt hashes, session tokens, and provider credentials are systematically excluded from all owner API payloads.
3. **Core Digital Asset Safeguards:** The 50 official profile icons (`/assets/images/profile-icons/*`), transparent console PNGs (`/assets/images/consoles/*.png`), and the creator QR support asset (`/assets/images/support/qr-support.png`) are guarded against generic deletion or accidental mutation.
4. **Data Isolation & Concurrency:** Optimistic locking prevents stale updates via `version` numbers and 409 Conflict detection.

