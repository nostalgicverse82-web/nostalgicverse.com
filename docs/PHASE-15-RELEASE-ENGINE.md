# NOSTALGICVERSE — PHASE 15 RELEASE INTELLIGENCE ENGINE

**System:** Game Release, Physical Port, and Reissue Intelligence  
**Version:** 2026.1.0  
**Authority:** NostalgicVerse Curatorial Cataloguing Unit  

---

## 1. Engine Mission

Video game history involves complex release cycles across regions, platforms, editions, and revisions. The Release Intelligence Engine tracks commercial and archival availability without inventing exact dates or fabricating statuses.

---

## 2. Release Statuses

| Status | Definition |
|---|---|
| **ANNOUNCED** | Confirmed project announcement without confirmed release window. |
| **COMING_SOON** | Commercial or digital preservation release scheduled in near term. |
| **TBA** | Officially planned; specific release date to be announced. |
| **DELAYED** | Previously scheduled release postponed; historical date preserved in audit. |
| **RELEASED** | Available for public acquisition or museum accessioning. |
| **CANCELLED** | Officially aborted before production; preserved for historical documentation. |

---

## 3. Date Precision Governance

Historical records frequently lack exact day-level accuracy (e.g., arcade boards released in "Late 1974" or regional European ports known only by year). The engine explicitly models date precision:

| Date Precision | Format Example | Curatorial Application |
|---|---|---|
| **EXACT** | `1985-09-13` | Day-level confirmed launch (e.g., Super Mario Bros. in Japan). |
| **MONTH_YEAR** | `1985-09` | Month and year confirmed, specific day lost or rolling. |
| **YEAR** | `1974` | Historical release known only to the year. |
| **TBA** | `null` | Future or unconfirmed timeframe. |

**Strict Rule:** Operators must never guess an arbitrary first-of-the-month day (e.g., `1974-01-01`) if only the year is historically documented. Date precision preserves truth.

---

## 4. Canonical Game Linkage & Referential Integrity

Every release record optionally links to a parent canonical game (`game_id REFERENCES games(id)`):
- Creating a release for a nonexistent `game_id` is rejected at the service and foreign-key layer.
- When an exhibit is displayed on the public website, all regional, platform, and edition releases for that game are aggregated and presented chronologically.

---

## 5. Field-Level Change Auditing

Whenever a release date or status is updated, the engine appends to `change_history`:
```json
{
  "action": "UPDATED",
  "userId": "168807b4-4c17-46ab-aa2c-2c911040fa24",
  "timestamp": "2026-09-26T12:35:00.000Z",
  "changes": {
    "status": { "old": "COMING_SOON", "new": "RELEASED" },
    "date_precision": { "old": "MONTH_YEAR", "new": "EXACT" },
    "release_date": { "old": "2026-11", "new": "2026-11-15" }
  }
}
```
This enables curatorial rollback, delay tracking, and verifiable historical analysis.

