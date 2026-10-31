# NOSTALGICVERSE — PHASE 15 LOCAL MEDIA MIGRATION PIPELINE

**System:** Remote Artwork Download, Validation, and Local WebP Storage Pipeline  
**Version:** 2026.1.0  
**Command:** `npm run media:migrate-games`  
**Script:** `tools/content/migrate-game-media.cjs`  

---

## 1. Migration Philosophy & Dormant Operation

To avoid downloading hundreds of files over mobile or bandwidth-constrained development connections, the migration pipeline is **dormant by default**. The platform operates in remote-first mode for games without local artwork until an operator explicitly runs the migration command.

```
VERIFIED REMOTE IMAGE
        ↓
SSRF & SAFETY VALIDATION
        ↓
CONTROLLED DOWNLOAD (Max 15MB ceiling, 15s timeout)
        ↓
MAGIC BYTE & DECODE VALIDATION (Reject HTML 200 responses)
        ↓
SHA-256 HASH COMPUTATION & DIMENSIONS EXTRACTION
        ↓
ATOMIC LOCAL WRITE (`assets/images/games/{slug}.webp`)
        ↓
SQLITE REGISTRY UPDATE (`game_images`, `media_metadata`, `games.local_image`)
        ↓
CANONICAL JSON SYNCHRONIZATION (`data/media/game-images.json`)
```

---

## 2. Invocation Options

```bash
# Preview candidates without downloading or mutating files
node tools/content/migrate-game-media.cjs --dry-run

# Migrate up to N items for testing
node tools/content/migrate-game-media.cjs --limit 5

# Migrate a single specific game by slug
node tools/content/migrate-game-media.cjs --slug pong

# Execute full migration via npm script
npm run media:migrate-games
```

---

## 3. Defense Against Dangerous Downloads

1. **SSRF Guard:** The remote URL is evaluated by `mediaService.isSafeUrl()` before opening a socket. Private IPs, loopbacks, and cloud metadata destinations are rejected.
2. **Download Size Ceiling:** If a remote response exceeds **15 MB**, the download stream is destroyed immediately, and the temporary file is unlinked.
3. **Magic-Byte Inspection:** The downloaded payload must start with valid image magic bytes. HTML error pages returning status 200 are caught and discarded.
4. **Atomic Swapping:** Files are written to `.tmp` paths first and renamed only after SHA-256 hashing and dimension extraction succeed.

---

## 4. Provenance Preservation

When an asset is converted from remote to local:
- The original remote URL and source domain are retained in `game_images.source_url` and `game_images.source_domain`.
- A historical record is logged into `media_metadata` with the SHA-256 hash, dimensions, and curatorial timestamp.
- The public exhibit URL seamlessly switches to `/assets/images/games/{slug}.webp` with zero broken states.

