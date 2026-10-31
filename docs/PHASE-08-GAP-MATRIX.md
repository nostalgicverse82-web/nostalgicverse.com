# NostalgicVerse Phase 08 - Gap Matrix

## Current Assessment

### Core Platform (Working/Verified)
- **authentication**: VERIFIED (PBKDF2, cookies, registration)
- **sessions**: VERIFIED (DB backed, persistent)
- **avatars**: VERIFIED (50 static avatars)
- **owner**: VERIFIED (RBAC, dashboard exists)
- **friends**: VERIFIED (API and DB logic works, realtime works in E2E)
- **friend requests**: VERIFIED (API/DB/WS)
- **chat**: VERIFIED (API/DB/WS verified)
- **messages**: VERIFIED
- **realtime**: VERIFIED (WebSocket architecture active)

### Frontend Integration / UI Gaps
- **profiles (public viewing)**: MISSING (No `/u/:username` route or UI for public profiles)
- **add friend button**: MISSING (No UI component on public profiles yet)
- **friend requests UI**: PARTIAL (friends-ui.js exists but needs rigorous tying to WS and state)
- **chat UI**: PARTIAL (chat-ui.js exists but needs UX polish for realtime append and history pagination)
- **notifications UI**: PARTIAL (dropdown and badge counts)
- **comments / reviews / reactions UI**: MISSING (No UI on public game pages)
- **blocks**: MISSING (No UI or API for blocking)

### Content & CMS Integration
- **search**: PARTIAL (JSON based static search exists, needs integration with DB or dynamic rendering)
- **SEO**: PARTIAL (Basic generation exists, needs robust injection)
- **games/consoles/stories/guides/news/timeline/genres/releases**: PARTIAL (CMS API exists, generator exists, needs integration into the frontend display, and UI for comments/reviews)
- **moderation**: PARTIAL (Owner can reject submissions, but comment/review moderation is missing)
- **reports**: PARTIAL (API exists, Owner UI missing)
- **business/ads**: MISSING

## Strategy for Phase 08
1. **Public Profiles & Social Discovery**: Build `/u/:username` Express route and UI. Integrate the "Add Friend" button with real state.
2. **Community Features on Content**: Inject Comments, Reactions, and Reviews UI into the game/console public pages.
3. **Chat UX**: Solidify `chat-ui.js` to handle WS events smoothly without reload, and support multi-tab/reconnect.
4. **Owner Moderation**: Add Reports and Comments tabs to Owner Dashboard.
5. **Real Browser E2E**: Write `tools/validation/test-phase08-social-e2e.cjs` using Puppeteer.
