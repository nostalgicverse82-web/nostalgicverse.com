# Homepage Discovery Animation — Root Cause & Fix Report

## Root Cause

The homepage discovery engine (9-second auto-rotation of Games, Consoles, Stories, Guides, and Timeline content) was **never executing** despite all code being correctly implemented.

### The Bug

In `index.html`, the main IIFE `<script>` block starts at line ~3606, positioned **after** `</footer>` near `</body>`. By the time the browser encounters and executes this script:

1. The DOM has already been fully parsed
2. The `DOMContentLoaded` event has **already fired**
3. The listener registration at `window.addEventListener('DOMContentLoaded', ...)` attaches a callback that will **never be invoked**
4. `rotateDiscoveryGrid()` and `startAutoRotation()` are therefore **never called**
5. The 6 static placeholder cards in the HTML remain forever

### Why Automated Tests Didn't Catch It

Previous test suites verified:
- ✅ Timer variable exists → *yes, but never started*
- ✅ `setInterval` call exists → *yes, but inside `startAutoRotation()` which was never called*
- ✅ DISCOVERY_POOL has 712 items → *yes, but never read*
- ✅ Pause listeners exist → *yes, but attached to a timer that was never created*

None of these tests verified **actual runtime behavior** — whether content visibly changes in the DOM.

## The Fix

### 1. Bootstrap Timing (Critical)

Replaced:
```javascript
// BROKEN: DOMContentLoaded has already fired by the time this runs
window.addEventListener('DOMContentLoaded', function () {
  updateAllFavoriteButtons();
  updateFavoritesHeaderBadge();
  startAutoRotation();
});
```

With:
```javascript
function bootstrapDiscoveryEngine() {
  updateAllFavoriteButtons();
  updateFavoritesHeaderBadge();
  rotateDiscoveryGrid();  // First rotation immediately
  startAutoRotation();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapDiscoveryEngine);
} else {
  // DOM is already ready — run immediately
  bootstrapDiscoveryEngine();
}
```

### 2. Museum-Quality Fade Transitions

The original `rotateDiscoveryGrid()` did an instant swap (`grid.innerHTML = ''`) with no visual transition. Refactored into a 4-phase animation:

| Phase | Duration | Effect |
|-------|----------|--------|
| **Fade Out** | 250ms | Grid opacity → 0 (ease-out) |
| **Content Swap** | 0ms | Clear grid, render new cards (invisible) |
| **Grid Restore** | 100ms | Grid opacity → 1 |
| **Staggered Entrance** | 300ms × 6 cards | Each card fades in + slides up from 12px offset, staggered by 60ms |

**Accessibility**: If `prefers-reduced-motion: reduce` is active, transitions are skipped entirely — instant swap only.

**Guard**: `isRotating` flag prevents overlapping transitions if the interval fires while an animation is still in progress.

### 3. Corruption Repair

The initial edit tool introduced ~220 lines of duplicated code (the entire engine was pasted twice). A surgical Node.js repair script:
1. Identified the corruption boundary (line 4050, where `shuffled[j] = tmp;` appeared mid-filter-handler)
2. Removed lines 4050–4269 (duplicate block)
3. Inserted the correct filter handler closure + bootstrap code
4. Verified all functions exist exactly once

## Architecture After Fix

```
<script> IIFE (line ~3606)
├── Favorites System (lines 3613-3660)
├── DISCOVERY_POOL (712 items, line ~3817)
├── pickDiverseSubarray() — diversity-aware random selection
├── renderDiscoveryCards() — DOM fragment builder (NEW)
├── rotateDiscoveryGrid() — 4-phase fade transition (REFACTORED)
├── startAutoRotation() — 9s setInterval
├── stopAutoRotation() — clearInterval
├── Pause listeners (hover, focus, touch, visibility)
├── Reroll button handler
├── Filter button handler
└── bootstrapDiscoveryEngine() — readyState-aware bootstrap (NEW)
```

## Verification

| Test Suite | Result |
|-----------|--------|
| `test-homepage-rotation.cjs` (NEW) | **49/49 passed** |
| `test-discovery-engine.cjs` | **36/36 passed** |
| `test-browser-qa.cjs` | **69/69 passed** |
| `master-audit.cjs` | **10,873/10,873 passed** |
| `audit-data-consistency.cjs` | **4,760/4,760 passed** |
| `audit-link-integrity.cjs` | **27,938/27,938 passed** |
| `audit-global-branding.cjs` | All branding verified |
| `audit-console-pages.cjs` | **1,300/1,300 passed** |
| `test-filter-matrix.cjs` | **26/26 passed** |
| `verify-remote-images.cjs` | **528/528 passed** |
| `test-favorites-images.cjs` | **9/9 passed** |

