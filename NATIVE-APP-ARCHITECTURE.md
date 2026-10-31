# NostalgicVerse — Future Native App Architecture & Platform Blueprint
**macOS, iOS & Cross-Platform Client Application Specification**
*Document Version: 2026.1.0 — Architecture Status: Official Technical Blueprint*

---

## Executive Architectural Summary

NostalgicVerse is designed with a **Headless Museum Architecture**: the canonical catalog data, curatorial relationships, and metadata schemas reside in pure JSON datasets served by the zero-dependency Node.js REST API layer (`server/index.cjs`).

A future native client for Apple platforms (**macOS**, **iOS**, **iPadOS**, and **visionOS**) or other desktop platforms does **not** duplicate the 611 static HTML exhibition pages. Instead, the native client acts as a high-performance interactive shell that consumes the standard NostalgicVerse REST APIs, rendering exhibits using native SwiftUI components, GPU-accelerated Metal pipelines, and low-latency audio subsystems.

```
+-------------------------------------------------------------------------------+
|                      NOSTALGICVERSE NATIVE CLIENT APP                        |
|                                                                               |
|  +---------------------------+  +------------------------------------------+  |
|  |   SwiftUI Presentation    |  |     Metal GPU Graphics Pipeline          |  |
|  |   - 528 Game Grid & Hero  |  |     - CRT Scanline & Aperture Shaders    |  |
|  |   - Multi-Select Filter   |  |     - 60/120 FPS Aspect Ratio Preservation|  |
|  |   - Hardware Specs HUD    |  |     - DualSense / MFi Haptic Engine      |  |
|  +-------------+-------------+  +--------------------+---------------------+  |
|                |                                     |                        |
|  +-------------v-------------------------------------v---------------------+  |
|  |           Local Storage & Offline Synchronization Engine                 |  |
|  |           - SQLite / SwiftData Catalog Cache (528 Games, 65 Consoles)    |  |
|  |           - CoreImage Asynchronous Image Downloader & Memory Cache       |  |
|  |           - Local Collection & Favorites Store (nostalgicverse_favs)     |  |
|  +-----------------------------------+-------------------------------------+  |
|                                      |                                        |
+--------------------------------------|----------------------------------------+
                                       |
                   HTTP/2 & HTTPS JSON | (Zero External SDKs)
                                       v
+-------------------------------------------------------------------------------+
|                      CANONICAL REST API SERVER LAYER                          |
|                                                                               |
|  - GET /api/health              (Server status, catalog item counts)          |
|  - GET /api/content/games       (Paginated, era/platform/genre filtered)      |
|  - GET /api/content/consoles    (Hardware generation & specs)                 |
|  - GET /api/search?q=           (Full-text indexed museum queries)            |
|  - GET /api/news                (Curated anniversary retrospectives)          |
+-------------------------------------------------------------------------------+
```

---

## 1. REST API Consumption Model

The native application consumes public JSON endpoints from either the local preview server (`http://localhost:3000`) or the production CDN (`https://nostalgicverse.com`):

### 1.1 Catalog Ingestion & Synchronization
- **Endpoint**: `GET /api/content/games?limit=100&offset=0`
- **Model Mapping**: Decodes directly into native Swift `Decodable` structs matching `data/schemas/game.schema.json`.
- **Filtering**: Query parameters `era`, `platform`, `genre`, and `sort` map directly to server-side filtering rules:
  ```swift
  struct GameSpecimen: Identifiable, Codable {
      let slug: String
      let title: String
      let originalReleaseYear: Int
      let developer: String
      let publisher: String
      let originalLaunchPlatform: String
      let platforms: [String]
      let genre: String
      let era: String
      let shortDescription: String
      let historicalSignificance: String
      let featured: Bool?
      
      var id: String { slug }
  }
  ```

### 1.2 Hardware Generation Index
- **Endpoint**: `GET /api/content/consoles`
- **Model Mapping**: Decodes 65 hardware platforms categorized by generation (`First Generation (1972–1977)` through `Ninth Generation (2020–Present)`), CPU architecture, and media formats.

### 1.3 Instant Museum Search
- **Endpoint**: `GET /api/search?q={query}`
- **Latency Target**: `< 15ms` response time via in-memory search index on the server. The native client debounces input by 150ms before dispatching requests.

---

## 2. Image Pipeline & Caching Strategy

In alignment with NostalgicVerse's **Exams Mode** and remote media architecture:

1. **Resolution Hierarchy**:
   - `LOCAL`: Checks application sandbox cache (`Library/Caches/Artwork/{slug}.webp`).
   - `REMOTE`: Fetches verified direct image URLs (`data/remote-game-images.json`) using `URLSession` with background task persistence.
   - `FALLBACK`: Graceful procedural fallback plate rendered dynamically with museum accession typography and metadata if network is unavailable.
2. **Aspect Ratio Preservation**:
   - Images are rendered with `.aspectRatio(contentMode: .fit)` inside structured museum frames.
   - Zero cropping, zero stretch distortion, and no blurred background padding that interferes with historical box art legibility.
3. **Bandwidth Optimization**:
   - Requests include HTTP headers: `Accept: image/webp,image/png,*/*`.
   - Native caching adheres strictly to `Cache-Control: public, max-age=604800, immutable`.

---

## 3. Emulation Core Architecture & Apple App Store Guidelines

For native interactive gameplay features:

### 3.1 JIT-Free Emulation Compliance (iOS & iPadOS)
- Standard App Store guidelines prohibit arbitrary dynamic code generation (JIT) without specific developer entitlements.
- The NostalgicVerse native architecture specifies **pure interpreter-based cores** (e.g. optimized C/C++ cores compiled with Clang `-O3` and SIMD Neon vectorization) for systems up to 32-bit:
  - Atari 2600 / 7800 (Stella core)
  - NES / Famicom (FCEUmm / Mesen core)
  - Super Nintendo (Snes9x core)
  - Sega Genesis / Mega Drive (Genesis Plus GX core)
  - Game Boy / GBC / GBA (mGBA core)
  - Sony PlayStation (Beetle PSX interpreter core)
- On macOS, where JIT is permitted under standard security profiles, dynamic recompilation cores are enabled for enhanced PS2/GameCube performance.

### 3.2 GPU Presentation & CRT Shaders (Metal 3)
- Rendered using Apple **Metal 3** compute and render pipelines.
- Standard museum shaders:
  - **Clean Pixel (1:1 Integer Scaling)**: Crisp nearest-neighbor interpolation.
  - **Phosphor CRT Simulation**: Trinitron-style aperture grille, scanline weight modulation, and bloom.
  - **Curvature & Glass Reflection**: Subtle spherical barrel distortion replicating vintage curved glass monitors.

### 3.3 Game Controller & Audio Low-Latency Pipeline
- **Game Controller Framework**: Full plug-and-play support for Sony DualSense (with adaptive triggers and haptics), Xbox Wireless Controllers, and Nintendo Switch Pro Controllers via `GCController`.
- **Audio Pipeline**: `AVAudioEngine` with circular audio buffer running at 48 kHz / 16-bit stereo, maintaining end-to-end audio latency below 12 milliseconds.

---

## 4. Cross-Platform Parity & Storage Synchronization

### 4.1 Favorites Synchronization
- The native client implements bidirectional sync with the web archive's `nostalgicverse_favs` storage format:
  ```json
  [
    {
      "id": "game-pac-man",
      "type": "game",
      "title": "Pac-Man",
      "meta": "1980 · Arcade",
      "addedAt": 1740000000000
    }
  ]
  ```
- Stored locally via `UserDefaults` or synchronized across devices using private **iCloud Key-Value Storage (KVS)** with zero external login requirements.

### 4.2 Offline Museum Mode
- Users can toggle **"Download Entire Museum Metadata"** (~1.2 MB total uncompressed JSON).
- Enables 100% offline exploration of all 528 game histories, hardware specifications, eras, and timeline events even in airplane mode.

---

## 5. Development Roadmap & Phased Delivery

| Phase | Target Deliverable | Technology Stack | Status |
| :--- | :--- | :--- | :---: |
| **Phase 1** | Native Museum Reader (macOS/iOS) | SwiftUI, Combine, URLSession | **IN PROGRESS** |
| **Phase 2** | Metal Shader & Hardware Display HUD | Metal 3, MSL Shaders | **IN PROGRESS** |
| **Phase 3** | JIT-Free Emulation Shell | Clang C++20, Libretro API | **PLANNED** |
| **Phase 4** | Universal Controller & iCloud Sync | GameController.framework, CloudKit | **PLANNED** |
| **Phase 5** | visionOS Spatial Museum Exhibition | RealityKit, visionOS 2.0 | **RESEARCH** |

---

## Architectural Sign-Off

This native app architecture preserves NostalgicVerse’s uncompromising commitment to historical integrity, zero commercial tracking, and permanent digital preservation.

