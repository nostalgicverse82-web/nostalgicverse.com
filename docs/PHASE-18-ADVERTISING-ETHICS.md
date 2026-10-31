# Phase 18: Ethical Advertising & Sponsorship Charter

## 1. The NostalgicVerse Museum Charter

NostalgicVerse is first and foremost a public digital museum and historical archive. The platform rejects the exploitative advertising practices that permeate modern gaming websites.

### Uncompromising Rules:
1. **No Paywalls on History**: Every game exhibit, console monograph, timeline event, and curation guide is permanently free to the public.
2. **No Intrusive Formats**:
   - Zero pop-ups, modals, or modal overlays.
   - Zero interstitial takeovers.
   - Zero audio or video auto-play ads.
   - Zero sticky banners covering reading content.
   - Zero fake download buttons or deceptive UI lures.
3. **No Third-Party Trackers**:
   - NostalgicVerse does not load external ad networks (Google AdSense, Taboola, Outbrain, etc.).
   - No cross-site tracking cookies, device fingerprinting, or user surveillance scripts.
   - All sponsor assets are served strictly from NostalgicVerse first-party infrastructure.

---

## 2. Ad Slot Architecture & Graceful Degradation

Ad spaces are designated by semantic slots managed in the database (`ad_slots` table):
- `slot-home-strip`: Non-intrusive historical monograph or preservation tool sponsor banner on the homepage.
- `slot-sidebar-curatorial`: Compact desktop sidebar card on research pages.
- `slot-footer-sponsor`: Institutional museum benefactor mention in the footer.

### Ad-Free Suppression for Supporters
When a verified user logs in with an active `ad_free` entitlement (awarded to all membership tiers):
- The API returns `null` for all ad slot queries (`monetizationService.getAdForSlot(...)`).
- The frontend client collapses the ad container cleanly (`display: none;`).
- Zero DOM placeholder text or broken elements remain.

### Ad Blocker Tolerance
NostalgicVerse operates cleanly with uBlock Origin, AdBlock Plus, Brave Browser, and Privacy Badger:
- The site does not use anti-adblock detection walls or scolding banners.
- Core layout and typography remain 100% stable regardless of network-level blocking.

---

## 3. Outbound Partner Links & FTC Transparency

All affiliate and partner relationships are subject to strict transparency standards:

1. **Mandatory Disclosures**: Every outbound partner link or sponsor creative displays unambiguous disclosure badges (`"Museum Sponsor"`, `"Partner Link"`, or `"Curated Affiliate"`).
2. **FTC Compliance**: Contextual disclosures are placed immediately adjacent to referral links, notifying readers that purchases support the NostalgicVerse preservation fund at no extra cost to them.
3. **Safe Outbound Redirects**:
   - Handled via `/api/partners/click/:slug`.
   - The backend validates that destination URLs strictly utilize `https://`.
   - Insecure protocols (`http://`), script injection schemes (`javascript:`, `data:`), and local internal hosts (`localhost`, `127.0.0.1`, `10.x.x.x`) are rejected.
   - Click analytics increment anonymously without recording personally identifiable information.
