-- Phase 18: Business & Monetization Architecture Migration
-- ==========================================================

-- 1. Membership & Subscription Plans
CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price_minor_units INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'INR',
    billing_interval TEXT NOT NULL DEFAULT 'month',
    is_active INTEGER NOT NULL DEFAULT 1,
    display_order INTEGER NOT NULL DEFAULT 0,
    entitlement_keys TEXT NOT NULL DEFAULT '[]',
    features TEXT NOT NULL DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_plans_active_order ON plans(is_active, display_order);

-- 2. User Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL REFERENCES plans(id),
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, ACTIVE, CANCELLED, EXPIRED, GRACE_PERIOD, REVOKED
    current_period_start DATETIME,
    current_period_end DATETIME,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    cancelled_at DATETIME,
    provider TEXT NOT NULL DEFAULT 'mock',
    provider_subscription_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- 3. Entitlement Engine
CREATE TABLE IF NOT EXISTS entitlements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entitlement_key TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, EXPIRED, REVOKED
    source_type TEXT NOT NULL, -- SUBSCRIPTION, DONATION, MANUAL_GRANT, PROMO
    source_id TEXT,
    expires_at DATETIME,
    granted_by TEXT,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, entitlement_key)
);
CREATE INDEX IF NOT EXISTS idx_entitlements_lookup ON entitlements(user_id, entitlement_key, status);

-- 4. Financial Payments (Zero floating-point arithmetic; minor units only)
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    idempotency_key TEXT UNIQUE,
    type TEXT NOT NULL, -- SUBSCRIPTION, DONATION, ONE_TIME
    related_id TEXT,
    amount_minor_units INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'CREATED', -- CREATED, PENDING, PAID, FAILED, CANCELLED, REFUNDED, DISPUTED
    provider TEXT NOT NULL DEFAULT 'mock',
    provider_payment_id TEXT,
    provider_order_id TEXT,
    error_message TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);

-- 5. Webhook Events & Idempotency
CREATE TABLE IF NOT EXISTS payment_events (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    provider_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PROCESSED', -- PROCESSED, FAILED, IGNORED
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_payment_events_provider_event ON payment_events(provider, provider_event_id);

-- 6. Voluntary Donations
CREATE TABLE IF NOT EXISTS donations (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    donor_name TEXT,
    donor_email TEXT,
    message TEXT,
    is_anonymous INTEGER NOT NULL DEFAULT 0,
    amount_minor_units INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'PENDING', -- PENDING, PAID, FAILED, REFUNDED
    payment_id TEXT REFERENCES payments(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_donations_user ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);

-- 7. Curatorial Sponsorships
CREATE TABLE IF NOT EXISTS sponsors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    logo_url TEXT NOT NULL,
    website_url TEXT NOT NULL,
    description TEXT,
    disclosure_text TEXT NOT NULL DEFAULT 'Preservation Sponsor',
    tier TEXT NOT NULL DEFAULT 'STANDARD', -- EXHIBIT, STANDARD, PREMIER
    placement TEXT NOT NULL DEFAULT 'homepage_strip',
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, SCHEDULED
    start_date DATETIME,
    end_date DATETIME,
    impressions_count INTEGER NOT NULL DEFAULT 0,
    clicks_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sponsors_status_placement ON sponsors(status, placement);

-- 8. Ethical Advertisements
CREATE TABLE IF NOT EXISTS ads (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    slot_id TEXT NOT NULL REFERENCES ad_slots(id),
    creative_type TEXT NOT NULL DEFAULT 'IMAGE', -- IMAGE, TEXT, HTML_STATIC
    creative_url TEXT,
    headline TEXT,
    body_text TEXT,
    cta_text TEXT DEFAULT 'Learn More',
    destination_url TEXT NOT NULL,
    disclosure_text TEXT NOT NULL DEFAULT 'Museum Sponsor',
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, EXPIRED
    impressions_count INTEGER NOT NULL DEFAULT 0,
    clicks_count INTEGER NOT NULL DEFAULT 0,
    start_date DATETIME,
    end_date DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ads_slot_status ON ads(slot_id, status);

-- 9. Safe Outbound Partner & Affiliate Links
CREATE TABLE IF NOT EXISTS partner_links (
    id TEXT PRIMARY KEY,
    partner_name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    destination_url TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'HARDWARE', -- HARDWARE, PRESERVATION, BOOKS, COMMUNITY
    disclosure_text TEXT NOT NULL DEFAULT 'Partner Link',
    is_active INTEGER NOT NULL DEFAULT 1,
    clicks_count INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_partner_links_slug ON partner_links(slug);
CREATE INDEX IF NOT EXISTS idx_partner_links_active ON partner_links(is_active);

-- 10. Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'SPONSOR', -- SPONSOR, AFFILIATE, PROMOTION
    status TEXT NOT NULL DEFAULT 'DRAFT', -- DRAFT, ACTIVE, PAUSED, COMPLETED
    start_date DATETIME,
    end_date DATETIME,
    budget_minor_units INTEGER DEFAULT 0,
    currency TEXT DEFAULT 'INR',
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);

-- 11. Promotions & Promo Codes
CREATE TABLE IF NOT EXISTS coupons (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    discount_type TEXT NOT NULL DEFAULT 'PERCENTAGE', -- PERCENTAGE, FIXED
    discount_value INTEGER NOT NULL, -- e.g. 20 for 20%, or 10000 for ₹100.00
    currency TEXT DEFAULT 'INR',
    max_redemptions INTEGER DEFAULT 100,
    times_redeemed INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1,
    expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

-- 12. Business Telemetry Events
CREATE TABLE IF NOT EXISTS business_events (
    id TEXT PRIMARY KEY,
    event_name TEXT NOT NULL,
    user_id TEXT,
    session_id TEXT,
    entity_type TEXT,
    entity_id TEXT,
    amount_minor_units INTEGER,
    currency TEXT,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_business_events_name ON business_events(event_name);
CREATE INDEX IF NOT EXISTS idx_business_events_created ON business_events(created_at);

-- 13. Business Operations Audit Log
CREATE TABLE IF NOT EXISTS business_audit_log (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    changes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_business_audit_actor ON business_audit_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_business_audit_created ON business_audit_log(created_at);

-- 14. Initial Seeds
-- Seed default membership plans
INSERT OR IGNORE INTO plans (id, slug, name, description, price_minor_units, currency, billing_interval, is_active, display_order, entitlement_keys, features)
VALUES 
('plan-supporter', 'supporter', 'Museum Supporter', 'Support independent video game preservation with ad-free exploration and public supporter badge.', 19900, 'INR', 'month', 1, 1, '["ad_free","supporter_badge"]', '["Ad-free museum reading experience","Permanent Supporter profile badge","Community recognition in supporter listings"]'),
('plan-patron', 'patron', 'Archival Patron', 'Deeper support for digitizing rare hardware manuals, emulation research, and museum monographs.', 49900, 'INR', 'month', 1, 2, '["ad_free","supporter_badge","premium_theme","advanced_collections","enhanced_profile"]', '["Everything in Supporter tier","CRT Retro Display Filter theme toggle","Unlimited custom exhibit collections","Enhanced profile showcase styling"]'),
('plan-champion', 'champion', 'Preservation Champion', 'Highest level institutional benefactor supporting physical artifact storage and historical monographs.', 99900, 'INR', 'month', 1, 3, '["ad_free","supporter_badge","premium_theme","advanced_collections","enhanced_profile","early_features"]', '["Everything in Patron tier","Champion Gold profile badge","Early access to unreleased historical monographs","Direct input on future preservation priorities"]');

-- Seed default ad slots if not present
INSERT OR IGNORE INTO ad_slots (id, slot_name, provider, status, device_visibility)
VALUES 
('slot-home-strip', 'homepage_strip', 'FIRST_PARTY', 'ACTIVE', 'ALL'),
('slot-sidebar-curatorial', 'sidebar_curatorial', 'FIRST_PARTY', 'ACTIVE', 'DESKTOP'),
('slot-footer-sponsor', 'footer_sponsor', 'FIRST_PARTY', 'ACTIVE', 'ALL');

-- Seed default safe feature flags into site_settings (SAFE / OFF by default)
INSERT OR IGNORE INTO site_settings (key, value) VALUES
('monetization_enabled', 'false'),
('monetization_global_disable', 'false'),
('donations_enabled', 'false'),
('memberships_enabled', 'false'),
('premium_features_enabled', 'false'),
('ads_enabled', 'false'),
('sponsors_enabled', 'false'),
('partner_links_enabled', 'false'),
('affiliate_links_enabled', 'false'),
('checkout_enabled', 'false'),
('payments_mode', 'test'),
('business_currency', 'INR');
