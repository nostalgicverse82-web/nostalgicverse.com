/**
 * NostalgicVerse — Monetization & Business Public API (Phase 18)
 * =============================================================
 * Handles plans, memberships, voluntary donations, public sponsors,
 * ethical ads, verified partner links, and user membership status.
 */

'use strict';

const express = require('express');
const monetizationService = require('../services/monetizationService.cjs');
const entitlementService = require('../services/entitlementService.cjs');
const featureFlags = require('../services/featureFlags.cjs');
const { paymentManager } = require('../services/payments/paymentManager.cjs');
const { requireAuth } = require('../middleware/authMiddleware.cjs');
const { dbAsync } = require('../db/index.cjs');

const router = express.Router();

// ======================================================================
// 1. PLANS & MEMBERSHIPS
// ======================================================================

// GET /api/business/plans — List active membership tiers
router.get('/plans', async (req, res) => {
    try {
        const enabled = await featureFlags.isMembershipsEnabled();
        if (!enabled) {
            return res.json({ plans: [], enabled: false, message: 'Memberships are currently paused.' });
        }
        const plans = await monetizationService.getActivePlans();
        res.json({ plans, enabled: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch membership plans', details: err.message });
    }
});

// POST /api/business/checkout — Initiate subscription or one-time checkout
router.post('/checkout', async (req, res) => {
    try {
        const checkoutEnabled = await featureFlags.isCheckoutEnabled();
        if (!checkoutEnabled) {
            return res.status(403).json({ error: 'Checkout is currently disabled by site owner.' });
        }

        const { planId, interval, returnUrl, cancelUrl, couponCode, provider } = req.body;
        if (!planId) {
            return res.status(400).json({ error: 'planId is required.' });
        }

        // Authenticated user check: membership subscriptions must be linked to an account
        const userId = req.user ? req.user.id : null;
        const userEmail = req.user ? req.user.email : req.body.email;

        if (!userId && !userEmail) {
            return res.status(401).json({ error: 'Authentication or valid email is required to start checkout.' });
        }

        const session = await monetizationService.startCheckout({
            planId,
            userId,
            interval: interval || 'MONTHLY',
            returnUrl,
            cancelUrl,
            couponCode,
            userEmail,
            clientIp: req.ip,
            provider
        });

        res.json({ success: true, session });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ======================================================================
// 2. VOLUNTARY DONATIONS
// ======================================================================

// POST /api/business/donations — Create a voluntary donation
router.post('/donations', async (req, res) => {
    try {
        const donationsEnabled = await featureFlags.isDonationsEnabled();
        if (!donationsEnabled) {
            return res.status(403).json({ error: 'Donations are currently disabled.' });
        }

        const { amountMinorUnits, currency, donorName, donorEmail, message, isAnonymous, returnUrl, cancelUrl, provider } = req.body;

        const userId = req.user ? req.user.id : null;
        const resolvedName = donorName || (req.user ? (req.user.display_name || req.user.username) : 'Anonymous Supporter');
        const resolvedEmail = donorEmail || (req.user ? req.user.email : null);

        const result = await monetizationService.createDonation({
            userId,
            donorName: resolvedName,
            donorEmail: resolvedEmail,
            amountMinorUnits,
            currency,
            message,
            isAnonymous: !!isAnonymous,
            returnUrl,
            cancelUrl,
            clientIp: req.ip,
            provider
        });

        res.json({ success: true, donation: result.donation, session: result.session });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/business/supporters — Public supporter list (honoring anonymity)
router.get('/supporters', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 20;
        const supporters = await monetizationService.getPublicSupporters(limit);
        res.json({ supporters });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch supporters', details: err.message });
    }
});

// ======================================================================
// 3. SPONSORS
// ======================================================================

// GET /api/business/sponsors — Active verified sponsors
router.get('/sponsors', async (req, res) => {
    try {
        const enabled = await featureFlags.isSponsorsEnabled();
        if (!enabled) {
            return res.json({ sponsors: [], enabled: false });
        }
        const sponsors = await monetizationService.getActiveSponsors();
        res.json({ sponsors, enabled: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch sponsors', details: err.message });
    }
});

// POST /api/business/sponsors/impression — Record sponsor impression
router.post('/sponsors/impression', async (req, res) => {
    try {
        const { sponsorId } = req.body;
        if (!sponsorId) return res.status(400).json({ error: 'sponsorId is required' });
        await monetizationService.recordSponsorImpression(sponsorId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/business/sponsors/click — Record sponsor click
router.post('/sponsors/click', async (req, res) => {
    try {
        const { sponsorId } = req.body;
        if (!sponsorId) return res.status(400).json({ error: 'sponsorId is required' });
        await monetizationService.recordSponsorClick(sponsorId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 4. ETHICAL ADVERTISING
// ======================================================================

// GET /api/business/ads — Fetch an ad for a specific slot with ad_free entitlement suppression
router.get('/ads', async (req, res) => {
    try {
        const adsEnabled = await featureFlags.isAdsEnabled();
        if (!adsEnabled) {
            return res.json({ ad: null, suppressed: true, reason: 'ADS_DISABLED' });
        }

        const slotId = req.query.slot || 'slot-home-strip';

        // Check if current user has ad_free entitlement
        let userEntitlements = [];
        if (req.user) {
            userEntitlements = await entitlementService.getUserEntitlements(req.user.id);
            if (userEntitlements.includes('ad_free')) {
                return res.json({ ad: null, suppressed: true, reason: 'SUPPORTER_AD_FREE' });
            }
        }

        const ad = await monetizationService.getAdForSlot(slotId, userEntitlements);
        res.json({ ad: ad || null, suppressed: !ad });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load ad slot', details: err.message });
    }
});

// POST /api/business/ads/impression — Record ad impression
router.post('/ads/impression', async (req, res) => {
    try {
        const { adId } = req.body;
        if (!adId) return res.status(400).json({ error: 'adId is required' });
        await monetizationService.recordAdImpression(adId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/business/ads/click — Record ad click
router.post('/ads/click', async (req, res) => {
    try {
        const { adId } = req.body;
        if (!adId) return res.status(400).json({ error: 'adId is required' });
        await monetizationService.recordAdClick(adId);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ======================================================================
// 5. PARTNERS & AFFILIATES
// ======================================================================

// GET /api/business/partners — Public directory of verified partners
router.get('/partners', async (req, res) => {
    try {
        const enabled = await featureFlags.isPartnerLinksEnabled();
        if (!enabled) {
            return res.json({ partners: [], enabled: false });
        }
        const category = req.query.category || null;
        const partners = await monetizationService.getPublicPartners(category);
        res.json({ partners, enabled: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load partners', details: err.message });
    }
});

// ======================================================================
// 6. USER MEMBERSHIP & ENTITLEMENTS (ACCOUNT)
// ======================================================================

// GET /api/business/membership — Current user's subscription and entitlements
router.get('/membership', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const entitlements = await entitlementService.getUserEntitlements(userId);

        const sub = await dbAsync.get(`
            SELECT s.*, p.name as plan_name, p.badge_text, p.entitlements as plan_entitlements
            FROM subscriptions s
            JOIN plans p ON s.plan_id = p.id
            WHERE s.user_id = ? AND s.status IN ('ACTIVE', 'PENDING_CANCEL')
            ORDER BY s.created_at DESC
            LIMIT 1
        `, [userId]);

        const totalDonated = await dbAsync.get(`
            SELECT SUM(amount_minor_units) as total, COUNT(*) as count
            FROM donations
            WHERE user_id = ? AND status = 'COMPLETED'
        `, [userId]);

        res.json({
            isSupporter: entitlements.length > 0 || (sub && sub.status === 'ACTIVE'),
            subscription: sub || null,
            entitlements,
            donations: {
                totalMinorUnits: totalDonated ? (totalDonated.total || 0) : 0,
                count: totalDonated ? (totalDonated.count || 0) : 0
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to load membership details', details: err.message });
    }
});

// POST /api/business/membership/cancel — Cancel active subscription at end of period
router.post('/membership/cancel', requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const sub = await dbAsync.get(`
            SELECT id FROM subscriptions
            WHERE user_id = ? AND status = 'ACTIVE'
            ORDER BY created_at DESC
            LIMIT 1
        `, [userId]);

        if (!sub) {
            return res.status(404).json({ error: 'No active subscription found to cancel.' });
        }

        const updated = await monetizationService.cancelSubscription(sub.id, userId);
        res.json({ success: true, subscription: updated });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

module.exports = router;
