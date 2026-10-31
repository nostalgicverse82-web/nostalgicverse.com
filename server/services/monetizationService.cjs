/**
 * NostalgicVerse — Phase 18 Monetization & Business Subsystem
 * =============================================================
 * Central orchestrator for plans, subscriptions, donations, sponsors,
 * ethical advertising, safe partner links, and revenue telemetry.
 * All monetary calculations use exact integer minor units (paise/cents).
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/connection.cjs');
const { defaultLogger: logger } = require('../automation/logger.cjs');
const { isEnabled, getFlagValue } = require('./featureFlags.cjs');
const { grantEntitlement, revokeEntitlement, hasEntitlement, syncSubscriptionEntitlements } = require('./entitlementService.cjs');
const { getActiveProvider, getProvider } = require('./payments/paymentManager.cjs');

// ======================================================================
// 1. MEMBERSHIP PLANS
// ======================================================================

/**
 * Returns active plans for public display on /membership/
 */
async function getActivePlans() {
    const rows = await dbAsync.all(`
        SELECT id, slug, name, description, price_minor_units, currency, 
               billing_interval, entitlement_keys, features, display_order
        FROM plans
        WHERE is_active = 1
        ORDER BY display_order ASC
    `);

    return rows.map(r => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        description: r.description,
        priceMinorUnits: r.price_minor_units,
        priceFormatted: formatCurrency(r.price_minor_units, r.currency),
        currency: r.currency,
        billingInterval: r.billing_interval,
        entitlementKeys: safeJsonParse(r.entitlement_keys, []),
        features: safeJsonParse(r.features, [])
    }));
}

/**
 * Returns all plans for Owner Command Center
 */
async function getAllPlans() {
    const rows = await dbAsync.all(`
        SELECT p.*, COUNT(s.id) as subscriber_count
        FROM plans p
        LEFT JOIN subscriptions s ON p.id = s.plan_id AND s.status = 'ACTIVE'
        GROUP BY p.id
        ORDER BY p.display_order ASC
    `);

    return rows.map(r => ({
        ...r,
        priceMinorUnits: r.price_minor_units,
        priceFormatted: formatCurrency(r.price_minor_units, r.currency),
        entitlementKeys: safeJsonParse(r.entitlement_keys, []),
        features: safeJsonParse(r.features, [])
    }));
}

/**
 * Creates or updates a plan
 */
async function upsertPlan(planData, actorId = 'system') {
    const {
        id = `plan-${uuidv4().slice(0, 8)}`,
        slug,
        name,
        description = '',
        priceMinorUnits = 0,
        currency = 'INR',
        billingInterval = 'month',
        isActive = 1,
        displayOrder = 0,
        entitlementKeys = [],
        features = []
    } = planData;

    if (!slug || !name) {
        throw new Error('Plan slug and name are required.');
    }

    if (typeof priceMinorUnits !== 'number' || priceMinorUnits < 0) {
        throw new Error('Price must be a non-negative integer minor unit.');
    }

    await dbAsync.run(`
        INSERT INTO plans (
            id, slug, name, description, price_minor_units, currency,
            billing_interval, is_active, display_order, entitlement_keys, features, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            slug = excluded.slug,
            name = excluded.name,
            description = excluded.description,
            price_minor_units = excluded.price_minor_units,
            currency = excluded.currency,
            billing_interval = excluded.billing_interval,
            is_active = excluded.is_active,
            display_order = excluded.display_order,
            entitlement_keys = excluded.entitlement_keys,
            features = excluded.features,
            updated_at = CURRENT_TIMESTAMP
    `, [
        id, slug.toLowerCase(), name, description, Math.floor(priceMinorUnits),
        currency.toUpperCase(), billingInterval, isActive ? 1 : 0, displayOrder,
        JSON.stringify(entitlementKeys), JSON.stringify(features)
    ]);

    // Record audit
    await recordAudit(actorId, 'UPSERT_PLAN', 'plan', id, { slug, name, priceMinorUnits });
    return { success: true, id, slug };
}

// ======================================================================
// 2. CHECKOUT & SUBSCRIPTIONS
// ======================================================================

/**
 * Initiates a membership checkout session
 */
async function startCheckout({ userId, planSlug = null, planId = null, idempotencyKey = null, providerName = null }) {
    // 1. Verify feature flag
    const checkoutActive = await isEnabled('CHECKOUT_ENABLED');
    if (!checkoutActive) {
        throw new Error('Checkout is currently disabled on this platform.');
    }

    const planIdentifier = planSlug || planId;
    if (!planIdentifier) {
        throw new Error('planSlug or planId is required.');
    }

    // 2. Retrieve plan
    const plan = await dbAsync.get('SELECT * FROM plans WHERE (slug = ? OR id = ?) AND is_active = 1', [planIdentifier, planIdentifier]);
    if (!plan) {
        throw new Error(`Invalid or inactive plan: "${planIdentifier}"`);
    }

    // 3. Resolve payment provider
    const provider = providerName ? getProvider(providerName) : await getActiveProvider();
    const finalIdempotencyKey = idempotencyKey || `chk_${userId}_${plan.id}_${Date.now()}`;

    // 4. Create or reuse pending subscription record
    let sub = await dbAsync.get(
        'SELECT id, status FROM subscriptions WHERE user_id = ? AND plan_id = ? AND status = "ACTIVE"',
        [userId, plan.id]
    );

    if (sub) {
        return {
            success: true,
            alreadyActive: true,
            subscriptionId: sub.id,
            amountMinorUnits: plan.price_minor_units,
            message: 'You already hold an active subscription to this tier.'
        };
    }

    const subscriptionId = uuidv4();
    await dbAsync.run(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, provider, created_at, updated_at)
        VALUES (?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [subscriptionId, userId, plan.id, provider.name]);

    // 5. Create payment intent with provider
    const intent = await provider.createPaymentIntent({
        amountMinorUnits: plan.price_minor_units,
        currency: plan.currency,
        customerId: userId,
        idempotencyKey: finalIdempotencyKey,
        metadata: {
            subscriptionId,
            planId: plan.id,
            planSlug: plan.slug,
            userId
        }
    });

    // 6. Record payment row in database
    const paymentId = uuidv4();
    await dbAsync.run(`
        INSERT INTO payments (
            id, user_id, idempotency_key, type, related_id, amount_minor_units, 
            currency, status, provider, provider_payment_id, provider_order_id, metadata, created_at
        ) VALUES (?, ?, ?, 'SUBSCRIPTION', ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
        paymentId, userId, finalIdempotencyKey, subscriptionId, plan.price_minor_units,
        plan.currency, intent.status || 'PENDING', provider.name, intent.providerPaymentId,
        intent.providerOrderId || null, JSON.stringify(intent.metadata || {})
    ]);

    // 7. Track business event
    await recordBusinessEvent('membership_checkout_started', {
        userId,
        entityType: 'PLAN',
        entityId: plan.id,
        amountMinorUnits: plan.price_minor_units,
        currency: plan.currency,
        metadata: { subscriptionId, paymentId }
    });

    return {
        success: true,
        subscriptionId,
        paymentId,
        provider: provider.name,
        amountMinorUnits: plan.price_minor_units,
        intent,
        checkoutUrl: intent.checkoutUrl || `/mock-checkout?session=${paymentId}`
    };
}

/**
 * Confirms payment success and activates subscription & entitlements
 */
async function processPaymentSuccess({
    providerPaymentId,
    providerOrderId = null,
    amountMinorUnits,
    currency,
    metadata = {}
}) {
    // 1. Locate payment record
    let payment = null;
    if (providerPaymentId) {
        payment = await dbAsync.get('SELECT * FROM payments WHERE provider_payment_id = ?', [providerPaymentId]);
    }
    if (!payment && metadata.subscriptionId) {
        payment = await dbAsync.get('SELECT * FROM payments WHERE related_id = ? ORDER BY created_at DESC LIMIT 1', [metadata.subscriptionId]);
    }

    if (!payment) {
        logger.warn(`[MONETIZATION] Payment record not found for provider payment "${providerPaymentId}"`);
        return { success: false, error: 'Payment record not found' };
    }

    // 2. Prevent duplicate processing (idempotency guard)
    if (payment.status === 'PAID') {
        logger.info(`[MONETIZATION] Payment "${payment.id}" already marked PAID. Idempotent return.`);
        return { success: true, duplicate: true, paymentId: payment.id };
    }

    // 3. Mark payment PAID
    await dbAsync.run(`
        UPDATE payments
        SET status = 'PAID', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [payment.id]);

    // 4. If this is a subscription payment, activate subscription & grant entitlements
    if (payment.type === 'SUBSCRIPTION' && payment.related_id) {
        const subId = payment.related_id;
        const now = new Date();
        const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days standard

        await dbAsync.run(`
            UPDATE subscriptions
            SET status = 'ACTIVE', 
                current_period_start = ?,
                current_period_end = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [now.toISOString(), periodEnd.toISOString(), subId]);

        await syncSubscriptionEntitlements(subId);

        await recordBusinessEvent('membership_checkout_completed', {
            userId: payment.user_id,
            entityType: 'SUBSCRIPTION',
            entityId: subId,
            amountMinorUnits: payment.amount_minor_units,
            currency: payment.currency,
            metadata: { paymentId: payment.id }
        });
    }

    // 5. If this is a donation payment, confirm donation
    if (payment.type === 'DONATION' && payment.related_id) {
        await processDonationSuccess(payment.related_id, payment.id);
    }

    logger.info(`[MONETIZATION] Successfully processed payment "${payment.id}" (${payment.amount_minor_units} ${payment.currency})`);
    return { success: true, paymentId: payment.id };
}

/**
 * Cancels a subscription at end of billing period or immediately
 */
async function cancelSubscription(subscriptionId, userId, reason = 'User requested cancellation') {
    const sub = await dbAsync.get('SELECT * FROM subscriptions WHERE id = ?', [subscriptionId]);
    if (!sub) {
        throw new Error('Subscription not found');
    }

    if (userId && sub.user_id !== userId) {
        throw new Error('Unauthorized subscription cancellation');
    }

    await dbAsync.run(`
        UPDATE subscriptions
        SET status = 'CANCELLED',
            cancel_at_period_end = 1,
            cancelled_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [subscriptionId]);

    // Cancel at provider level if provider supports it
    try {
        const provider = getProvider(sub.provider);
        if (sub.provider_subscription_id) {
            await provider.cancelSubscription(sub.provider_subscription_id);
        }
    } catch (e) {
        logger.warn(`[MONETIZATION] Provider cancellation non-fatal warning: ${e.message}`);
    }

    // Sync / revoke entitlements
    await syncSubscriptionEntitlements(subscriptionId);

    await recordBusinessEvent('membership_cancelled', {
        userId: sub.user_id,
        entityType: 'SUBSCRIPTION',
        entityId: subscriptionId,
        metadata: { reason }
    });

    return { success: true, subscriptionId, status: 'CANCELLED' };
}

// ======================================================================
// 3. VOLUNTARY DONATIONS
// ======================================================================

/**
 * Creates a voluntary museum donation intent
 */
async function createDonation({
    userId = null,
    donorName = '',
    donorEmail = '',
    message = '',
    isAnonymous = false,
    amountMinorUnits,
    currency = 'INR',
    providerName = null,
    idempotencyKey = null
}) {
    // 1. Verify feature flag
    const donationsActive = await isEnabled('DONATIONS_ENABLED');
    if (!donationsActive) {
        throw new Error('Voluntary donations are currently disabled.');
    }

    // 2. Validate amount limits (Min: ₹10 / 1000 paise; Max: ₹100,000 / 10,000,000 paise)
    if (typeof amountMinorUnits !== 'number' || amountMinorUnits < 1000) {
        throw new Error('Donation amount must be at least ₹10.00 (1000 paise).');
    }
    if (amountMinorUnits > 10000000) {
        throw new Error('Donation amount exceeds maximum allowed single transaction limit.');
    }

    const donationId = uuidv4();
    const finalIdempotencyKey = idempotencyKey || `don_${donationId}`;
    const provider = providerName ? getProvider(providerName) : await getActiveProvider();

    // 3. Create payment intent
    const intent = await provider.createPaymentIntent({
        amountMinorUnits,
        currency,
        customerId: userId,
        idempotencyKey: finalIdempotencyKey,
        metadata: {
            donationId,
            donorName: isAnonymous ? 'Anonymous' : donorName,
            isAnonymous: !!isAnonymous
        }
    });

    // 4. Record payment
    const paymentId = uuidv4();
    await dbAsync.run(`
        INSERT INTO payments (
            id, user_id, idempotency_key, type, related_id, amount_minor_units,
            currency, status, provider, provider_payment_id, metadata, created_at
        ) VALUES (?, ?, ?, 'DONATION', ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
        paymentId, userId, finalIdempotencyKey, donationId, amountMinorUnits,
        currency.toUpperCase(), intent.status || 'PENDING', provider.name,
        intent.providerPaymentId, JSON.stringify({ isAnonymous, message })
    ]);

    // 5. Record donation
    await dbAsync.run(`
        INSERT INTO donations (
            id, user_id, donor_name, donor_email, message, is_anonymous,
            amount_minor_units, currency, status, payment_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [
        donationId, userId, isAnonymous ? 'Anonymous Supporter' : (donorName || 'Museum Supporter'),
        donorEmail || null, message ? message.slice(0, 500) : '', isAnonymous ? 1 : 0,
        amountMinorUnits, currency.toUpperCase(), paymentId
    ]);

    await recordBusinessEvent('donation_started', {
        userId,
        entityType: 'DONATION',
        entityId: donationId,
        amountMinorUnits,
        currency,
        metadata: { isAnonymous }
    });

    return {
        success: true,
        donationId,
        paymentId,
        provider: provider.name,
        intent,
        donation: {
            id: donationId,
            is_anonymous: isAnonymous ? 1 : 0
        },
        session: {
            checkoutUrl: intent?.checkoutUrl || `/mock-checkout?pi=${donationId}`
        }
    };
}

/**
 * Confirms donation success and awards supporter recognition
 */
async function processDonationSuccess(donationId, externalTxId = null) {
    await dbAsync.run(`
        UPDATE donations
        SET status = 'PAID', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `, [donationId]);

    await dbAsync.run(`
        UPDATE payments
        SET status = 'PAID', updated_at = CURRENT_TIMESTAMP
        WHERE related_id = ?
    `, [donationId]);

    const donation = await dbAsync.get('SELECT * FROM donations WHERE id = ?', [donationId]);
    if (donation && donation.user_id) {
        // Award Supporter Badge for 1 year
        const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
        await grantEntitlement({
            userId: donation.user_id,
            entitlementKey: 'supporter_badge',
            sourceType: 'DONATION',
            sourceId: donationId,
            expiresAt,
            reason: 'Voluntary museum donation recognition'
        });
        await grantEntitlement({
            userId: donation.user_id,
            entitlementKey: 'supporter',
            sourceType: 'DONATION',
            sourceId: donationId,
            expiresAt,
            reason: 'Voluntary museum donation recognition'
        });
    }

    if (donation) {
        await recordBusinessEvent('donation_completed', {
            userId: donation.user_id,
            entityType: 'DONATION',
            entityId: donationId,
            amountMinorUnits: donation.amount_minor_units,
            currency: donation.currency,
            metadata: { isAnonymous: donation.is_anonymous === 1 }
        });
    }

    return donation || { id: donationId, status: 'PAID' };
}

/**
 * Lists recent public supporters (respecting anonymity)
 */
async function getPublicSupporters(limit = 10) {
    const rows = await dbAsync.all(`
        SELECT donor_name, message, amount_minor_units, currency, is_anonymous, created_at
        FROM donations
        WHERE status IN ('PAID', 'COMPLETED')
        ORDER BY created_at DESC
        LIMIT ?
    `, [limit]);

    return rows.map(r => ({
        name: r.is_anonymous ? 'Anonymous Supporter' : (r.donor_name || 'Museum Supporter'),
        isAnonymous: r.is_anonymous === 1,
        message: r.message,
        amountFormatted: formatCurrency(r.amount_minor_units, r.currency),
        date: r.created_at
    }));
}

// ======================================================================
// 4. SPONSORSHIPS
// ======================================================================

/**
 * Returns active sponsors for display in specific placements
 */
async function getActiveSponsors(placement = 'homepage_strip') {
    const sponsorsActive = await isEnabled('SPONSORS_ENABLED');
    if (!sponsorsActive) return [];

    const rows = await dbAsync.all(`
        SELECT id, name, company, logo_url, website_url, description, 
               disclosure_text, tier, placement
        FROM sponsors
        WHERE status = 'ACTIVE' 
          AND placement = ? 
          AND (start_date IS NULL OR start_date <= CURRENT_TIMESTAMP)
          AND (end_date IS NULL OR end_date >= CURRENT_TIMESTAMP)
        ORDER BY tier DESC, created_at DESC
        LIMIT 6
    `, [placement]);

    return rows;
}

/**
 * Records impression on sponsor
 */
async function recordSponsorImpression(sponsorId) {
    if (!sponsorId) return;
    await dbAsync.run('UPDATE sponsors SET impressions_count = impressions_count + 1 WHERE id = ?', [sponsorId]);
    await recordBusinessEvent('sponsor_impression', { entityType: 'SPONSOR', entityId: sponsorId });
}

/**
 * Records click on sponsor
 */
async function recordSponsorClick(sponsorId) {
    if (!sponsorId) return;
    await dbAsync.run('UPDATE sponsors SET clicks_count = clicks_count + 1 WHERE id = ?', [sponsorId]);
    await recordBusinessEvent('sponsor_click', { entityType: 'SPONSOR', entityId: sponsorId });
}

// ======================================================================
// 5. ETHICAL ADVERTISEMENTS & AD SLOTS
// ======================================================================

/**
 * Retrieves eligible ad for a slot, respecting user entitlements and ADS_ENABLED flag
 */
async function getAdForSlot(slotName, user = null) {
    // 1. Global ADS_ENABLED feature flag check
    const adsActive = await isEnabled('ADS_ENABLED');
    if (!adsActive) {
        return null;
    }

    // 2. Entitlement check: if user has 'ad_free' entitlement, suppress ad completely
    if (Array.isArray(user)) {
        if (user.includes('ad_free')) return null;
    } else if (user && user.id) {
        const isAdFree = await hasEntitlement(user.id, 'ad_free');
        if (isAdFree) {
            return null;
        }
    }

    // 3. Find active ad for slot (supports slot_name or slot id)
    const ad = await dbAsync.get(`
        SELECT a.id, a.title, a.creative_type, a.creative_url, a.headline,
               a.body_text, a.cta_text, a.destination_url, a.disclosure_text, s.slot_name
        FROM ads a
        JOIN ad_slots s ON a.slot_id = s.id
        WHERE (s.slot_name = ? OR s.id = ?)
          AND a.status = 'ACTIVE'
          AND s.status = 'ACTIVE'
          AND (a.start_date IS NULL OR a.start_date <= CURRENT_TIMESTAMP)
          AND (a.end_date IS NULL OR a.end_date >= CURRENT_TIMESTAMP)
        LIMIT 1
    `, [slotName, slotName]);

    return ad || null;
}

/**
 * Records impression for an ad
 */
async function recordAdImpression(adId) {
    if (!adId) return;
    await dbAsync.run('UPDATE ads SET impressions_count = impressions_count + 1 WHERE id = ?', [adId]);
    await recordBusinessEvent('ad_impression', { entityType: 'AD', entityId: adId });
}

/**
 * Records click for an ad
 */
async function recordAdClick(adId) {
    if (!adId) return;
    await dbAsync.run('UPDATE ads SET clicks_count = clicks_count + 1 WHERE id = ?', [adId]);
    await recordBusinessEvent('ad_click', { entityType: 'AD', entityId: adId });
}

// ======================================================================
// 6. SAFE PARTNER & AFFILIATE LINKS
// ======================================================================

/**
 * Validates and safely redirects to an outbound partner link
 */
async function resolvePartnerRedirect(slugOrId, clientIp = null, userAgent = null) {
    try {
        const link = await dbAsync.get(
            'SELECT * FROM partner_links WHERE (slug = ? OR id = ?) AND is_active = 1',
            [slugOrId, slugOrId]
        );

        if (!link) {
            return null;
        }

        // Validate destination security: strictly https:// only
        let destinationUrl = (link.destination_url || '').trim();
        try {
            const parsed = new URL(destinationUrl);
            if (parsed.protocol !== 'https:') {
                logger.warn(`[SECURITY] Blocked non-https partner redirect: ${destinationUrl}`);
                return null;
            }
        } catch (_) {
            return null;
        }

        // Increment click count
        await dbAsync.run('UPDATE partner_links SET clicks_count = clicks_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [link.id]);
        await recordBusinessEvent('partner_click', { entityType: 'PARTNER_LINK', entityId: link.id });

        return destinationUrl;
    } catch (e) {
        return null;
    }
}

/**
 * Returns public partner directory
 */
async function getPublicPartners() {
    const rows = await dbAsync.all(`
        SELECT id, partner_name, slug, category, disclosure_text
        FROM partner_links
        WHERE is_active = 1
        ORDER BY partner_name ASC
    `);

    return rows.map(r => ({
        ...r,
        outboundUrl: `/api/partners/click/${r.slug}`
    }));
}

// ======================================================================
// 7. BUSINESS ANALYTICS & OWNER DASHBOARD
// ======================================================================

/**
 * Returns authentic revenue, membership, and transaction metrics for Owner Business Center
 */
async function getBusinessOverview(range = '30d') {
    const days = range === '7d' ? 7 : (range === '24h' ? 1 : (range === '90d' ? 90 : 30));
    const dateLimit = `datetime('now', '-${days} days')`;

    // 1. Memberships
    const activeMembersRow = await dbAsync.get('SELECT COUNT(*) as c FROM subscriptions WHERE status = "ACTIVE"');
    const newMembersRow = await dbAsync.get(`SELECT COUNT(*) as c FROM subscriptions WHERE created_at >= ${dateLimit}`);
    const cancelledMembersRow = await dbAsync.get(`SELECT COUNT(*) as c FROM subscriptions WHERE status = "CANCELLED" AND updated_at >= ${dateLimit}`);

    // 2. Revenue & Transactions (Calculated in minor units, converted deterministically)
    const revRow = await dbAsync.get(`
        SELECT SUM(amount_minor_units) as total_minor, COUNT(*) as count 
        FROM payments 
        WHERE status = 'PAID' AND created_at >= ${dateLimit}
    `);
    const totalMinor = revRow && revRow.total_minor ? revRow.total_minor : 0;
    const paidCount = revRow ? revRow.count : 0;

    // Donations
    const donRow = await dbAsync.get(`
        SELECT SUM(amount_minor_units) as total_minor, COUNT(*) as count 
        FROM donations 
        WHERE status = 'PAID' AND created_at >= ${dateLimit}
    `);
    const donMinor = donRow && donRow.total_minor ? donRow.total_minor : 0;
    const donCount = donRow ? donRow.count : 0;

    // 3. Sponsors, Ads & Partners
    const sponImpRow = await dbAsync.get(`SELECT COUNT(*) as c FROM business_events WHERE event_name = 'sponsor_impression' AND created_at >= ${dateLimit}`);
    const sponClickRow = await dbAsync.get(`SELECT COUNT(*) as c FROM business_events WHERE event_name = 'sponsor_click' AND created_at >= ${dateLimit}`);
    const adImpRow = await dbAsync.get(`SELECT COUNT(*) as c FROM business_events WHERE event_name = 'ad_impression' AND created_at >= ${dateLimit}`);
    const adClickRow = await dbAsync.get(`SELECT COUNT(*) as c FROM business_events WHERE event_name = 'ad_click' AND created_at >= ${dateLimit}`);
    const partnerClickRow = await dbAsync.get(`SELECT COUNT(*) as c FROM business_events WHERE event_name = 'partner_click' AND created_at >= ${dateLimit}`);

    // 4. Daily Revenue Breakdown
    const dailyRevenue = await dbAsync.all(`
        SELECT date(created_at) as day, SUM(amount_minor_units) as amount_minor, COUNT(*) as tx_count
        FROM payments
        WHERE status = 'PAID' AND created_at >= ${dateLimit}
        GROUP BY date(created_at)
        ORDER BY day ASC
    `);

    // 5. Recent Transactions
    const recentPayments = await dbAsync.all(`
        SELECT p.id, p.type, p.amount_minor_units, p.currency, p.status, p.provider, p.created_at, u.username
        FROM payments p
        LEFT JOIN users u ON p.user_id = u.id
        ORDER BY p.created_at DESC
        LIMIT 10
    `);

    const recentEvents = await dbAsync.all(`
        SELECT * FROM business_events ORDER BY created_at DESC LIMIT 10
    `);

    const activeSponsorsRow = await dbAsync.get('SELECT COUNT(*) as c FROM sponsors WHERE status = "ACTIVE"');
    const activePartnersRow = await dbAsync.get('SELECT COUNT(*) as c FROM partner_links WHERE is_active = 1');
    const totalDonationsRow = await dbAsync.get('SELECT COUNT(*) as c FROM donations WHERE status IN ("PAID", "COMPLETED")');

    const metrics = {
        totalRevenueMinorUnits: totalMinor,
        activeSubscriptions: activeMembersRow ? activeMembersRow.c : 0,
        totalDonationsCount: totalDonationsRow ? totalDonationsRow.c : donCount,
        activeSponsorsCount: activeSponsorsRow ? activeSponsorsRow.c : 0,
        activePartnerLinksCount: activePartnersRow ? activePartnersRow.c : 0
    };

    return {
        range,
        metrics,
        recentEvents,
        memberships: {
            active: activeMembersRow ? activeMembersRow.c : 0,
            new: newMembersRow ? newMembersRow.c : 0,
            cancelled: cancelledMembersRow ? cancelledMembersRow.c : 0
        },
        revenue: {
            totalMinor,
            totalFormatted: formatCurrency(totalMinor, 'INR'),
            paidTransactions: paidCount,
            donationTotalMinor: donMinor,
            donationFormatted: formatCurrency(donMinor, 'INR'),
            donationCount: donCount
        },
        advertising: {
            sponsorImpressions: sponImpRow ? sponImpRow.c : 0,
            sponsorClicks: sponClickRow ? sponClickRow.c : 0,
            adImpressions: adImpRow ? adImpRow.c : 0,
            adClicks: adClickRow ? adClickRow.c : 0,
            partnerClicks: partnerClickRow ? partnerClickRow.c : 0
        },
        dailyRevenue: dailyRevenue.map(d => ({
            day: d.day,
            amountMinor: d.amount_minor,
            amountFormatted: formatCurrency(d.amount_minor, 'INR'),
            txCount: d.tx_count
        })),
        recentPayments: recentPayments.map(p => ({
            ...p,
            amountFormatted: formatCurrency(p.amount_minor_units, p.currency)
        }))
    };
}

/**
 * Returns Conversion Funnels for Owner Command Center
 */
async function getConversionFunnels(range = '30d') {
    const days = range === '7d' ? 7 : 30;
    const dateLimit = `datetime('now', '-${days} days')`;

    // Membership funnel: Plan View -> Checkout Start -> Checkout Paid
    const planViews = (await dbAsync.get(`SELECT COUNT(*) as c FROM business_events WHERE event_name = 'plan_view' AND created_at >= ${dateLimit}`)).c;
    const checkoutsStarted = (await dbAsync.get(`SELECT COUNT(*) as c FROM business_events WHERE event_name = 'membership_checkout_started' AND created_at >= ${dateLimit}`)).c;
    const checkoutsPaid = (await dbAsync.get(`SELECT COUNT(*) as c FROM business_events WHERE event_name = 'membership_checkout_completed' AND created_at >= ${dateLimit}`)).c;

    // Donation funnel: Donation Page View -> Donation Start -> Donation Paid
    const donationStarts = (await dbAsync.get(`SELECT COUNT(*) as c FROM business_events WHERE event_name = 'donation_started' AND created_at >= ${dateLimit}`)).c;
    const donationsPaid = (await dbAsync.get(`SELECT COUNT(*) as c FROM business_events WHERE event_name = 'donation_completed' AND created_at >= ${dateLimit}`)).c;

    return {
        membershipFunnel: {
            planViews,
            checkoutsStarted,
            checkoutsPaid,
            conversionRate: planViews > 0 ? ((checkoutsPaid / planViews) * 100).toFixed(1) + '%' : '0.0%'
        },
        donationFunnel: {
            donationStarts,
            donationsPaid,
            conversionRate: donationStarts > 0 ? ((donationsPaid / donationStarts) * 100).toFixed(1) + '%' : '0.0%'
        }
    };
}

// ======================================================================
// 8. HELPERS & TELEMETRY
// ======================================================================

function formatCurrency(minorUnits = 0, currency = 'INR') {
    const major = (minorUnits / 100).toFixed(2);
    if (currency.toUpperCase() === 'INR') {
        return `₹${major}`;
    }
    return `$${major} ${currency.toUpperCase()}`;
}

function safeJsonParse(val, fallback) {
    if (!val) return fallback;
    try {
        return JSON.parse(val);
    } catch (_) {
        return fallback;
    }
}

async function recordBusinessEvent(eventName, { userId = null, sessionId = null, entityType = null, entityId = null, amountMinorUnits = null, currency = null, metadata = {} } = {}) {
    try {
        await dbAsync.run(`
            INSERT INTO business_events (id, event_name, user_id, session_id, entity_type, entity_id, amount_minor_units, currency, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [
            uuidv4(), eventName, userId, sessionId, entityType, entityId,
            amountMinorUnits, currency, JSON.stringify(metadata)
        ]);
    } catch (e) {
        logger.warn('[BUSINESS_EVENT] Failed to record event', e);
    }
}

async function recordAudit(actorId, action, entityType, entityId, changes) {
    try {
        await dbAsync.run(`
            INSERT INTO business_audit_log (id, actor_id, action, entity_type, entity_id, changes, created_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [uuidv4(), actorId, action, entityType, entityId, JSON.stringify(changes)]);
    } catch (e) {
        logger.warn('[BUSINESS_AUDIT] Failed to record audit log', e);
    }
}

module.exports = {
    // Plans
    getActivePlans,
    getAllPlans,
    upsertPlan,
    // Checkout & Subscriptions
    startCheckout,
    processPaymentSuccess,
    cancelSubscription,
    // Donations
    createDonation,
    processDonationSuccess,
    getPublicSupporters,
    // Sponsors
    getActiveSponsors,
    recordSponsorImpression,
    recordSponsorClick,
    // Ads
    getAdForSlot,
    recordAdImpression,
    recordAdClick,
    // Partner Links
    resolvePartnerRedirect,
    getPublicPartners,
    // Analytics
    getBusinessOverview,
    getConversionFunnels,
    formatCurrency,
    recordBusinessEvent
};
