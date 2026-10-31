# NostalgicVerse — Known Issues & Architectural Context Log

**Audit Version:** 2026.1.0 (Production Release / Section 310 Audit)  
**Date:** September 27, 2026  
**Canonical Domain:** `https://nostalgicverse.com/`  
**Root Path:** `D:\nostalgicverse1.com`  

---

## 1. Input Package Context & Media Asset Status
- **Archive Size Optimization:** The project owner intentionally removed portions of `assets/images/` prior to generating the project ZIP archive to keep distribution lightweight.
- **Architectural Handling:** The system does not treat missing local media as product defects. The Central Media Resolver (`server/services/mediaService.cjs`) enforces strict canonical precedence:
  1. `VERIFIED_LOCAL` (297 games with local files on disk)
  2. `VERIFIED_REMOTE` (230 games backed by verified direct CDN URLs from Wikimedia Commons, Giant Bomb, Steam CDN)
  3. `APPROVED_FALLBACK` (1 game, `minecraft`, cleanly rendering the museum accession fallback plate)
  - **Zero Broken Image Links:** 0 broken images or unhandled 404 responses.

---

## 2. Catalogue Inventory Scale
- **Current Canonical Dataset:** 528 verified, published game records with 100% 4-way parity across:
  - SQLite Database (`games` table): 528 records
  - Individual JSON files (`data/games/*.json`): 528 records
  - Consolidated index (`data/games.json`): 528 records
  - Dedicated exhibit HTML pages (`games/*/index.html`): 528 pages
- **Hardware Platforms:** 65 verified hardware platforms in `consoles/` with 100% dedicated exhibits.
- **3D / Modern Classification:** 439 games (83.1%) classified as Modern 3D; 89 games (16.9%) classified as Classic 2D.
- **Future Mega-Catalogue Expansion:** Target 1,000+ game dataset ready for ingestion upon provisioning full high-resolution asset storage.

---

## 3. Client UX & Performance Optimizations
- **`games/index.html` Payload:** Reduced embedded payload by ~650KB (down from 785KB) through JSON compaction and verified canonical media resolution.
- **Client DOM Pagination:** Replaced bulk 528-card DOM injection with responsive 36-card pagination + "Load More" controls, eliminating initial page-load thrashing.
- **Terminology Normalization:** Replaced internal technical jargon ("Query Engine: Local Historical Silicon", "Historical Silicon", "Uncurated Discovery") with museum-grade curation terminology ("Catalogue Index: 528 Verified Exhibits", "Platforms", "Random Discovery").

---

## 4. Operational & Deployment Considerations
- **Node.js Environment:** Fully tested and certified on Node.js v25.2.1 / Express 5.2.1.
- **Ephemeral Port Binding:** Development tests fork background processes using isolated ports (`3000`, `3099`, `3456`) with automatic socket cleanup on `SIGINT`/`SIGTERM`.
- **Database Concurrency:** SQLite WAL mode with 5000ms busy timeout ensures safe multi-connection read/write concurrency during burst traffic.
