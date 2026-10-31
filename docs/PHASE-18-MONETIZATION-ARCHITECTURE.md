# Phase 18: Monetization & Business Architecture

## 1. Executive Summary & Museum Philosophy

NostalgicVerse is a digital gaming museum dedicated to the preservation of interactive digital entertainment history. The monetization engine introduced in Phase 18 is built strictly upon the **Ethical Digital Museum Philosophy**:
1. **Preservation First**: Historical games, consoles, articles, guides, exhibits, and timeline events are never paywalled. The core public archive remains 100% free, accessible, and unobstructed.
2. **Voluntary Patronage**: Revenue is driven by voluntary museum memberships, preservation donations, curated institutional sponsors, and transparent ethical affiliate partnerships.
3. **Zero Dark Patterns**: No deceptive countdown timers, no fake scarcity, no forced recurring traps, no deceptive download buttons, and no audio/video auto-play ads.
4. **Server-Authoritative Security**: All entitlement evaluation, payment reconciliation, and pricing lookups occur on the backend with zero client-side privilege escalation.
5. **Integer Minor-Unit Accounting**: All monetary transactions use integer minor units (paise/cents) to prevent floating-point calculation errors.

---

## 2. Core Architecture Subsystems

```
+-----------------------------------------------------------------------------------+
|                            NOSTALGICVERSE PUBLIC FRONTEND                          |
|  /membership (Tiers)   |   /donate (Preservation Fund)   |   /partners (Directory)|
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                               EXPRESS API ROUTERS                                 |
|  /api/business/*   |   /api/user/membership   |   /api/partners/click/:slug       |
|  /api/payments/webhook/:provider              |   /api/owner/business/*           |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                            BUSINESS LOGIC & ENGINE                                |
|  - featureFlags.cjs (TTL Cache, Kill Switch, SAFE/OFF Defaults)                   |
|  - monetizationService.cjs (Plans, Checkout, Donations, Sponsors, Ads, Partners)  |
|  - entitlementService.cjs (User Entitlements, Sync, Verification Middleware)      |
|  - paymentManager.cjs (Provider Abstraction: Mock Sandbox, Stripe, Razorpay)      |
+-----------------------------------------------------------------------------------+
                                         |
                                         v
+-----------------------------------------------------------------------------------+
|                         SQLITE NORMALIZED BUSINESS STORE                          |
|  plans              subscriptions        entitlements          payments           |
|  payment_events     donations            sponsors              ad_slots & ads     |
|  partner_links      campaigns            coupons               business_audit_log |
|  business_events (Telemetry)             site_settings (Flags)                    |
+-----------------------------------------------------------------------------------+
```

---

## 3. Database Schema Overview (Migration 016)

The business engine is powered by normalized SQLite tables created in migration `016_phase18_monetization_business.sql`:

1. **`plans`**:
   - Stores membership tiers (`supporter`, `patron`, `champion`).
   - Fields: `id`, `slug`, `name`, `description`, `price_minor_units`, `currency`, `billing_interval`, `is_active`, `display_order`, `entitlement_keys`, `features`.
2. **`subscriptions`**:
   - Manages active user memberships.
   - Fields: `id`, `user_id`, `plan_id`, `status` (`ACTIVE`, `CANCELLED`, `EXPIRED`, `PAST_DUE`), `current_period_start`, `current_period_end`, `provider`, `provider_subscription_id`, `cancel_at_period_end`.
3. **`entitlements`**:
   - Server-authoritative capability and perk grant ledger.
   - Fields: `id`, `user_id`, `entitlement_key`, `status` (`ACTIVE`, `REVOKED`, `EXPIRED`), `source_type` (`SUBSCRIPTION`, `DONATION`, `MANUAL_OWNER`), `source_id`, `expires_at`, `granted_by`, `reason`.
   - Unique index: `(user_id, entitlement_key)`.
4. **`payments`**:
   - Immutable audit trail of every financial transaction attempt and fulfillment.
   - Fields: `id`, `user_id`, `idempotency_key`, `type` (`MEMBERSHIP`, `DONATION`), `related_id`, `amount_minor_units`, `currency`, `status` (`PENDING`, `PAID`, `FAILED`, `REFUNDED`), `provider`, `provider_payment_id`, `metadata`.
5. **`payment_events`**:
   - Idempotency and webhook replay protection log for external gateways.
   - Fields: `id`, `provider`, `provider_event_id`, `event_type`, `processed_at`, `status`, `payload`.
6. **`donations`**:
   - Voluntary museum preservation donations.
   - Fields: `id`, `user_id`, `donor_name`, `donor_email`, `message`, `is_anonymous`, `amount_minor_units`, `currency`, `status` (`PENDING`, `PAID`, `CANCELLED`), `payment_id`.
7. **`sponsors`**:
   - Museum patrons, hardware guilds, and archival sponsors.
   - Fields: `id`, `name`, `company`, `logo_url`, `website_url`, `description`, `disclosure_text`, `tier`, `placement`, `status`, `start_date`, `end_date`, `impressions_count`, `clicks_count`.
8. **`ad_slots` & `ads`**:
   - Non-intrusive ethical display spaces and creatives.
   - Ad slots: `slot-home-strip`, `slot-sidebar-curatorial`, `slot-footer-sponsor`.
   - Fields: `id`, `slot_id`, `title`, `creative_type`, `creative_url`, `headline`, `body_text`, `cta_text`, `destination_url`, `disclosure_text`, `status`, `impressions_count`, `clicks_count`.
9. **`partner_links`**:
   - Curated outbound partner directory with FTC-compliant disclosures.
   - Fields: `id`, `partner_name`, `slug`, `destination_url`, `category`, `disclosure_text`, `is_active`, `clicks_count`.
10. **`campaigns` & `coupons`**:
    - Promotional tracking and discount codes for museum merchandise or memberships.
11. **`business_events`**:
    - First-party telemetry events for conversion funnels and museum reporting (`plan_view`, `checkout_started`, `checkout_completed`, `donation_started`, `donation_completed`, `ad_impression`, `ad_click`, `partner_click`).
12. **`business_audit_log`**:
    - Immutable operational audit trail for all administrative actions (manual grants, plan modifications, flag changes, kill switch activations).

---

## 4. Feature Flag System & Emergency Controls

The platform implements a **Safe-By-Default** strategy. All monetization capabilities default to `SAFE / OFF` until explicitly enabled by the Owner:

| Flag Key | Environment Setting | Purpose | Default State |
| :--- | :--- | :--- | :--- |
| `monetization_enabled` | Master Switch | Gates all public monetization routes | `false` (SAFE) |
| `monetization_global_disable` | Emergency Kill Switch | Immediately halts all monetization logic | `false` |
| `memberships_enabled` | Sub-system | Controls public tier displays and checkout | `false` (SAFE) |
| `donations_enabled` | Sub-system | Controls voluntary donation forms | `false` (SAFE) |
| `checkout_enabled` | Sub-system | Controls payment intent creation | `false` (SAFE) |
| `sponsors_enabled` | Sub-system | Controls museum sponsor strips | `false` (SAFE) |
| `ads_enabled` | Sub-system | Controls ethical ad slot rendering | `false` (SAFE) |
| `partner_links_enabled` | Sub-system | Controls outbound partner directory | `false` (SAFE) |

### Emergency Global Kill Switch
The owner can trigger the Emergency Kill Switch from the Owner Command Center (`POST /api/owner/business/kill-switch`). When `monetization_global_disable = 'true'`:
- Every `featureFlags.isEnabled(flag)` call evaluates to `false` instantly.
- Public ad slots collapse cleanly (`display: none;`).
- Checkout and donation endpoints reject requests with standard `503 Service Unavailable` error responses.
- The action is recorded in `business_audit_log`.

---

## 5. Security & Tampering Protections

1. **Price Tampering Protection**:
   - Clients send `planId` or `planSlug`.
   - The backend resolves `amountMinorUnits` directly from SQLite `plans` table. Any client-sent prices in POST bodies are completely ignored.
2. **Privilege Escalation Protection**:
   - No frontend flag (e.g. `window.user.isPremium`) is trusted.
   - All protected resources check `entitlementService.hasEntitlement(userId, key)` or invoke the Express middleware `requireEntitlement(key)`.
3. **Outbound Link & Protocol Sanitization**:
   - Outbound redirects (`/api/partners/click/:slug`) strictly validate `protocol === 'https:'`.
   - Attempts to redirect to `javascript:`, `data:`, `file:`, or private IP ranges are rejected with `400 Bad Request`.
4. **Idempotency & Replay Defense**:
   - Every payment session and donation carries a unique `idempotencyKey`.
   - Webhook deliveries are logged in `payment_events`; duplicate `provider_event_id` deliveries return cached success without double-processing.
