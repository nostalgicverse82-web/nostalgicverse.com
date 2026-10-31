# NOSTALGICVERSE — PHASE 14 OWNER COMMAND CENTER ARCHITECTURE

## 1. Architectural Principle & Authorization Flow

Privilege is enforced exclusively on the server side:

```
[ OWNER UI ]
      ↓  (HTTP REST / WebSocket over TLS)
[ OWNER API GATEWAY: /api/owner/* ]
      ↓  (requireAuth + requireOwner Session RBAC)
[ PRIVILEGED SERVICES & REPOSITORIES ]
      ↓  (SQL Prepared Statements / Transactions)
[ CANONICAL DATABASE: data/nostalgicverse.db ]
      ↓  (Atomic Builders & Background Jobs)
[ DERIVED PUBLIC ARTIFACTS: Search, Sitemap, Static HTML ]
```

- **Zero Client-Side Authorization:** Frontend menu visibility or button presence never bestows access.
- **Session Protection:** HTTP-only cookies, SameSite policy, secure session token hashing in DB.
- **Zero Exposed Credentials:** Passwords, password hashes, and session secrets are stripped before JSON serialization.

---

## 2. Command Center Layout & Information Architecture

The Owner Command Center route `/owner/` uses a grouped responsive sidebar:

1. **Overview & Intelligence:**
   - `overview`: Real-time system health, actionable queue alerts, platform and content metric cards.
   - `analytics`: Measured engagement, registration cohorts, and search volume without simulated numbers.
2. **Community & Operations:**
   - `users`: User directory, suspension, restore, role audit, activity tracking.
   - `submissions`: User submissions triage (Approve, Request Enhancement, Reject).
   - `support`: Helpdesk ticket threading, customer communication, and private internal notes.
   - `moderation`: Unified report queue, comment & review soft-deletion and restoration.
3. **Content Management:**
   - `games`: Full game exhibits CMS (Draft, Preview, Publish, Unpublish, Versioning).
   - `consoles`: Hardware CMS with protection for transparent console PNG assets.
   - `editorial`: Stories, guides, and news articles management.
   - `timeline-genres`: Chronological events and historical genre taxonomy.
   - `releases-compat`: Game release tracking and platform compatibility matrices.
4. **Digital Assets & Search:**
   - `media`: Digital Media Manager, provenance, and core asset safeguards.
   - `search-seo`: Search index rebuild trigger, sitemap builder, and SEO metadata auditing.
   - `content-health`: Automated diagnostic scanner, issue triage, and curatorial exceptions.
5. **Automation & Infrastructure:**
   - `jobs`: Background worker queue, job retry, and cancellation without arbitrary shell access.
   - `ai`: Private server-side AI drafting queue with strict owner gatekeeping.
   - `backups`: Database snapshot creation, verification, and isolated restore drills.
   - `security`: Security event log, suspicious IP/session auditing, and maintenance toggles.
6. **Platform Administration:**
   - `business`: Sponsor inquiries and non-fake AdSense slot configuration.
   - `audit`: Immutable historical audit trail for all state mutations.
   - `settings`: Owner display name and platform configuration.

---

## 3. High-Resilience & Fault Isolation

- **Search Index Degradation:** A corrupted search index or failed build does not corrupt the canonical SQLite catalogue.
- **Media Unavailability:** Failed remote image fetches fall back to the vector Museum Accession plate (`/assets/images/museum-fallback.svg`), preventing broken card layouts.
- **Realtime WebSocket Drop:** If the WebSocket connection drops, the UI displays an offline indicator and gracefully continues servicing operations through standard HTTP REST endpoints.
- **Job Engine Recovery:** Any background job interrupted by a server restart is recovered cleanly or retried with idempotent safeguards.

