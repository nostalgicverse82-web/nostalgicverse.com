# Phase 13 — Frontend Failure Recovery & UI Micro-Interaction Quality

## Executive Summary

Phase 13 elevates the user experience of NostalgicVerse by guaranteeing that the user interface never crashes, blanks, or discards user-generated content during network instability, asset 404s, tab switching, or device orientation changes.

---

## 1. Defensive Double-Buffering & Carousel Rotation

### 1.1 The Double-Buffering Contract
On the homepage (`index.html`), featured game exhibits and console highlights automatically rotate periodically.
In naive implementations, clearing the DOM container before new images load causes jarring layout shifts (CLS) and white flashes.

Phase 13 enforces **defensive double-buffering**:
1. Incoming cards are rendered into a hidden, off-screen layer (`rotation-layer-next`).
2. All exhibit images are preloaded in memory with a hard $2.5\text{s}$ safety timeout.
3. If an image fails to load, `img.onerror` substitutes `/assets/images/museum-fallback.svg`.
4. Only when all assets are confirmed ready is the opacity crossfade executed ($500\text{ms}$ ease-in-out).
5. If the new batch generation fails or throws an exception, the current view **remains untouched and visible**.

```
[ Current Layer: Visible ]  -------- (Opacity 1 -> 0) -------->  [ Retired & Cleared ]
                                                                          ^
[ Next Layer: Hidden DOM ]  --- (Preload OK -> Opacity 0 -> 1) ---+ (Promoted to Visible)
```

### 1.2 Tab Visibility & Navigation Lifecycle
- **`visibilitychange` Hook**: When a user switches tabs, `document.hidden` pauses all rotation intervals immediately, conserving CPU and battery. When the user refocuses the tab, rotation resumes smoothly.
- **`pagehide` & `beforeunload` Cleanups**: Prevents orphaned background timers when navigating between exhibits.

---

## 2. Universal Content Interactions Hardening

Implemented in `assets/js/content-interactions.js`:

### 2.1 In-Flight Double-Click Locking
Rapid or accidental double-clicking on interactive buttons (Like, Dislike, Save, Favorite) previously fired competing asynchronous requests.
- Each button sets an in-flight guard flag (`isReactionInFlight`, `isSaveInFlight`, `isFavInFlight`).
- Subsequent clicks are ignored until the authoritative server response resolves.
- Server state reconciles optimistically with authoritative rollback on error.

### 2.2 Client-Side Draft Persistence
When composing a thoughtful retrospective review or exhibit comment:
- User keystrokes are automatically mirrored to `sessionStorage` under `nv_draft_comment_<type>_<id>` and `nv_draft_review_<type>_<id>`.
- If the network drops or the server returns an error, the form retains the user's text and notifies the user with a non-destructive toast:
  > *"Network error posting comment. Your draft was saved."*
- Draft keys are only expunged upon confirmed HTTP 200/201 success from the server.

### 2.3 Universal Clipboard Fallback
The Exhibit Share button uses `navigator.share` on mobile devices. For desktop browsers:
1. Tries modern `navigator.clipboard.writeText(url)`.
2. If permissions fail or the page is in an insecure context, seamlessly falls back to a hidden DOM `textarea` with `document.execCommand('copy')`.
3. Displays a persistent toast: *"Link copied to clipboard"*.

---

## 3. Realtime Chat & Mobile Micro-Interactions

Implemented in `assets/js/chat-ui.js` and `assets/css/chat-ui.css`:

### 3.1 Reverse Infinite Scroll with Scroll Position Anchor
For conversations with deep message histories:
- Loads the 50 most recent messages on opening.
- If more messages exist, renders a *"Load earlier messages"* button at the top of the history viewport.
- Clicking fetches `/api/chat/conversations/:id/messages?before=:oldestId&limit=50`.
- Earlier messages are prepended to the top of the DOM while the scroll position is dynamically adjusted by the height difference:
  $$\text{scrollTop}_{\text{new}} = \text{scrollTop}_{\text{old}} + (\text{scrollHeight}_{\text{new}} - \text{scrollHeight}_{\text{old}})$$
  This guarantees the user's reading position never jumps or loses context.

### 3.2 Mobile Composer Permanence (`visualViewport`)
On mobile devices (iOS Safari, Android Chrome), opening the virtual software keyboard can push or clip the input box off-screen.
- Listens to `window.visualViewport.addEventListener('resize')`.
- When the virtual keyboard appears, automatically recalculates visible container height and scrolls the latest messages into view.
- Composer styling incorporates `env(safe-area-inset-bottom)` to prevent home bar overlap.

### 3.3 Reconnection Stampede Prevention (Full Jitter)
Implemented in `assets/js/realtime-client.js`:
- Base backoff: $\text{delay} = \min(1000 \times 1.5^{\text{attempts}}, 15000\text{ms})$.
- Full randomized jitter: multiplied by $(0.75 + \text{random} \times 0.5)$.
- Prevents thousands of clients from hammering the server at the exact same millisecond after a temporary disconnect.
- Disables reconnect attempts when tab is hidden (`document.hidden = true`).

