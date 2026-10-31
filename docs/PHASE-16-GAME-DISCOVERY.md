# NostalgicVerse — Phase 16 Game Discovery & Identity Resolution

## 1. Game Discovery Overview

The Game Discovery Service (`server/services/gameDiscoveryService.cjs`) catalogs new video game exhibits, unreleased prototypes, obscure regional variants, and homebrew releases. It prevents duplicate exhibits through multi-tier identity matching and automates media candidate proposals.

---

## 2. Multi-Tier Identity Matching Hierarchy

To determine whether an incoming specimen represents a novel exhibit or an existing game in the museum catalog, the system executes a 5-tier evaluation:

| Tier | Evaluation Criteria | Resulting State | Description |
| :--- | :--- | :--- | :--- |
| **1. EXACT** | Exact match on slug OR case-insensitive title match | `EXACT` | Identical game already exists in museum database. |
| **2. LIKELY** | High title substring or prefix match (e.g. *"Pac-Man"* vs *"Pac-Man Championship Edition"*) | `LIKELY` | Strong candidate for a revision, port, or sequel. Flagged for curator review. |
| **3. POSSIBLE** | Title token overlap (>=4 chars) combined with matching platform or release year | `POSSIBLE` | Moderate similarity. Requires curator disambiguation. |
| **4. NEW** | Zero title, token, platform, or year correlation with existing database entries | `NEW` | Brand-new museum exhibit candidate. |
| **5. CONFLICT** | Conflicting canonical claims across sources | `CONFLICT` | Divergent historical data requiring adjudication. |

---

## 3. Media Candidate Integration

When game discovery ingests a candidate with an associated image URL:
1. `image_candidate_url` is stored on `game_candidates`.
2. If an existing canonical game was matched, a candidate record is added to `media_candidates`.
3. When the owner approves and publishes the new game candidate via `/api/owner/game-candidates/:id/publish`:
   - Game record is inserted into canonical `games` table with status `PUBLISHED`.
   - Hero artwork is inserted into canonical `game_images` table with `image_type = 'HERO'` and `verification_status = 'VERIFIED'`.
