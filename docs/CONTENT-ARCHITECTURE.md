# CONTENT ARCHITECTURE

## Universal Content Model
Content types include: `GAME`, `CONSOLE`, `STORY`, `GUIDE`, `NEWS`, `TIMELINE`, `GENRE`, `RELEASE`, `IDEA`, `CORRECTION`.

Every content object supports:
- `id`, `type`, `slug`, `title`, `status`
- `author/creator`
- `created_at`, `updated_at`, `published_at`
- `sources`, `images`, `SEO`, `relationships`, `versions`

## Submission States
Content progresses through strict states:
`DRAFT` -> `PENDING_REVIEW` -> `ENHANCEMENT_REQUESTED` -> `APPROVED` -> `PUBLISHED` -> `HELD` / `REJECTED` / `ARCHIVED`.

No user submission can bypass the Owner Review phase to become official public content.

## AI Enrichment Pipeline
AI enrichment operates exclusively on the backend AFTER owner approval:
`SOURCE` -> `FETCH` -> `VERIFY` -> `EXTRACT` -> `DUPLICATE CHECK` -> `CONTRADICTION CHECK` -> `OWNER APPROVAL` -> `AI ENRICHMENT` -> `VALIDATE` -> `PUBLISH`.

## Page URL Architecture
Canonical routes (publicly mapped to published content):
- `/games/{slug}/`
- `/consoles/{slug}/`
- `/stories/{slug}/`
- `/guides/{slug}/`
- `/news/{slug}/`
- `/timeline/{slug}/`
- `/genres/{slug}/`
- `/releases/{slug}/`
- `/ideas/{slug}/`

## Image Architecture
Images strictly resolve in this fallback chain:
`LOCAL VERIFIED` -> `REMOTE VERIFIED` -> `APPROVED FALLBACK` (museum fallback SVGs).
A singular image resolver powers the entire stack.

