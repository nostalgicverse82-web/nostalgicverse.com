# Phase 18: Entitlements & Access Control Specification

## 1. Core Principles

1. **Server-Authoritative Enforcement**: Entitlements are never evaluated based on user-supplied parameters, cookies, or client-side JavaScript flags. All permission checks query the SQLite `entitlements` table directly.
2. **Deterministic Lifecycle**: Every entitlement has a recorded `source_type` (`SUBSCRIPTION`, `DONATION`, `MANUAL_OWNER`), optional `expires_at` timestamp, and audit trail.
3. **Graceful Degradation**: When a subscription lapses or is cancelled, entitlements transition cleanly to `REVOKED` or `EXPIRED` without breaking existing public user contributions or saved data.

---

## 2. Standard Entitlement Keys

| Entitlement Key | Name | Granted By | Description & User Experience |
| :--- | :--- | :--- | :--- |
| `ad_free` | Ad Suppression | Supporter, Patron, Champion | Suppresses all first-party sponsor banners and ad slots across all museum pages. |
| `supporter_badge` | Supporter Badge | All Tiers & Donors | Displays verified museum supporter icon on member profiles, forum posts, and user submissions. |
| `champion_badge` | Champion Benefactor | Champion Tier | Prestigious gold insignia denoting major historical preservation benefactors. |
| `premium_theme` | CRT Museum Filter | Patron, Champion | Unlocks CRT scanline toggle, phosphor bloom, and retro arcade aesthetic controls. |
| `advanced_collections` | Archival Collections | Patron, Champion | Unlocks ability to create unlimited custom curated museum exhibits and public anthologies. |
| `enhanced_profile` | Enhanced Profile | Patron, Champion | Unlocks custom museum badges, custom header banners, and hardware spec showcase. |
| `early_features` | Archival Previews | Champion Tier | Early curatorial previews of upcoming monographs, unreleased scans, and historical deep dives. |

---

## 3. Entitlement Lifecycle Management

### 1. Granting Entitlements
Entitlements are granted automatically upon receipt of verified payment events or manually by the site owner:
```javascript
await entitlementService.grantEntitlement({
    userId: 'user_123',
    entitlementKey: 'ad_free',
    sourceType: 'SUBSCRIPTION',
    sourceId: 'sub_456',
    expiresAt: '2026-10-27T00:00:00Z',
    grantedBy: 'SYSTEM',
    reason: 'Monthly Patron membership activation'
});
```
On duplicate `(user_id, entitlement_key)`, the existing record is updated in place, renewing `expires_at` and setting `status = 'ACTIVE'`.

### 2. Automatic Synchronization (`syncSubscriptionEntitlements`)
When a subscription status changes (renewed, past due, or cancelled), `syncSubscriptionEntitlements(subscriptionId)` is invoked:
- If subscription is `ACTIVE`: Ensures all keys defined in `plan.entitlement_keys` are `ACTIVE` and validity is aligned with `current_period_end`.
- If subscription is `CANCELLED` or `EXPIRED`: Revokes all entitlements sourced from that subscription.

### 3. Verification & Server Middleware
Backend endpoints enforce entitlements using the `requireEntitlement` Express middleware:
```javascript
const { requireEntitlement } = require('../services/entitlementService.cjs');

// Example protected endpoint
router.post('/api/user/collections/advanced', requireEntitlement('advanced_collections'), (req, res) => {
    // Curate advanced collection
});
```
If the requesting user lacks the active, non-expired entitlement, the server responds with HTTP `403 Forbidden`:
```json
{
  "error": "Forbidden",
  "message": "This feature requires the \"advanced_collections\" entitlement.",
  "requiredEntitlement": "advanced_collections"
}
```
