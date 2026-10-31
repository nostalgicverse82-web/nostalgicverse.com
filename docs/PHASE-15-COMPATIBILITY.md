# NOSTALGICVERSE — PHASE 15 COMPATIBILITY INTELLIGENCE

**Scope:** Website-Side Hardware & Software Compatibility Records  
**Version:** 2026.1.0  
**Project Boundary:** Website and Web-App Curation Only. The standalone native emulator application is strictly OUT OF SCOPE.  

---

## 1. Scope & System Boundary

NostalgicVerse maintains a website-side compatibility matrix allowing visitors to verify historical software compatibility across platforms and emulation cores.
- **In Scope:** Website compatibility schemas, curatorial test reports, hardware profiles, search indexing, and owner management APIs (`/api/owner/compatibility`).
- **Strictly Out of Scope:** The separate emulator application's native binary source code, cores, and drivers.

---

## 2. Compatibility Evidence Standard

The platform enforces honest, evidence-based status designations:
- **No Unsubstantiated Claims:** A title is never marked as `PERFECT` or `PLAYABLE` without an empirical test log, tested software version, and date.
- **Statuses Supported:**
  - `PLAYABLE`: Fully operable from start to finish with acceptable audio/video fidelity.
  - `IN_GAME`: Boots into gameplay; encounters minor rendering or timing anomalies.
  - `INTRO_ONLY`: Boots BIOS or intro screens; crashes before gameplay loop.
  - `LOADS`: Detected and loads ROM/ISO into memory; crashes before visual presentation.
  - `UNTESTED`: Accessioned into archive; pending physical/emulated test run.
  - `BROKEN`: Confirmed incompatible with current baseline.

---

## 3. Compatibility Record Schema

Records in SQLite `compatibility_records` contain:
- `id`: Unique record identifier
- `game_id`: References canonical `games(id)`
- `system`: Target hardware or platform (e.g., NES, Sega Genesis, Sony PlayStation)
- `status`: One of the standardized empirical statuses
- `tested_version`: Core or hardware test version string
- `notes`: Detailed findings, frame pacing observations, or controller mapping caveats
- `created_at` / `updated_at`: Verification timestamps

---

## 4. Owner Compatibility Management

Curatorial operators manage records through the Owner Command Center:
- `GET /api/owner/compatibility`: Filter by system, status, and search query.
- `POST /api/owner/compatibility`: Record new empirical test results with audit logging.
- `PUT /api/owner/compatibility/:id`: Update test results when new emulation passes occur.

