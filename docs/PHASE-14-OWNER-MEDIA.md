# NOSTALGICVERSE — PHASE 14 MEDIA REGISTRY & CORE ASSET GUARD

## 1. Digital Media Architecture & Registry
- All game and exhibit images are registered in the `game_images` table with:
  - Canonical URL and local disk path
  - License status (`FAIR_USE`, `PUBLIC_DOMAIN`, `PROMOTIONAL`)
  - Curatorial attribution & provenance
  - Verification state (`VERIFIED_LOCAL`, `VERIFIED_REMOTE`, `FALLBACK`, `BROKEN`)
  - Width, height, aspect ratio, and verified MIME type.

---

## 2. Core Asset Safeguard Active
To prevent catastrophic accidental deletion of irreplaceable brand assets, the media manager enforces strict immutability on core files:
1. **Official User Avatars:** `/assets/images/profile-icons/icon-01.png` through `icon-50.png` cannot be mutated or purged by generic media maintenance actions.
2. **Approved Console Hardware PNGs:** Transparent console illustrations in `/assets/images/consoles/*.png` are guarded against automated overwrite.
3. **Creator QR Support Plate:** `/assets/images/support/qr-support.png` is permanently protected.

---

## 3. Image Replacement & Provenance Preservation
When an owner replaces an asset via `POST /api/owner/media/replace`:
- The previous image record is archived into historical provenance.
- The new URL is validated for SSRF safety and magic-byte validity.
- The active exhibit record is updated atomically.

