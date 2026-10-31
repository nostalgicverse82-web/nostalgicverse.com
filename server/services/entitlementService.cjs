/**
 * NostalgicVerse — Phase 18 Server-Side Entitlement Engine
 * ==========================================================
 * Strict, server-authoritative entitlement validation.
 * Client-submitted premium flags (e.g. isPremium=true) are ignored.
 * All premium access derives from verified subscriptions, purchases,
 * donations, or authorized owner grants.
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../db/connection.cjs');
const { defaultLogger: logger } = require('../automation/logger.cjs');

// Recognized core entitlement keys
const VALID_ENTITLEMENT_KEYS = new Set([
    'ad_free',
    'supporter_badge',
    'premium_theme',
    'advanced_collections',
    'enhanced_profile',
    'early_features'
]);

/**
 * Retrieves all active, unexpired entitlements for a user
 */
async function getUserEntitlements(userId) {
    if (!userId) return [];

    try {
        const rows = await dbAsync.all(`
            SELECT id, entitlement_key, status, source_type, source_id, expires_at, reason, created_at
            FROM entitlements
            WHERE user_id = ? 
              AND status = 'ACTIVE' 
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            ORDER BY created_at DESC
        `, [userId]);

        return rows.map(r => ({
            id: r.id,
            key: r.entitlement_key,
            sourceType: r.source_type,
            sourceId: r.source_id,
            expiresAt: r.expires_at,
            reason: r.reason,
            isLifetime: !r.expires_at
        }));
    } catch (err) {
        logger.error(`[ENTITLEMENTS] Error retrieving entitlements for user ${userId}`, err);
        return [];
    }
}

/**
 * Strictly verifies whether a user holds an active entitlement server-side
 */
async function hasEntitlement(userId, entitlementKey) {
    if (!userId || !entitlementKey) return false;

    try {
        const row = await dbAsync.get(`
            SELECT id FROM entitlements
            WHERE user_id = ? 
              AND entitlement_key = ? 
              AND status = 'ACTIVE' 
              AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            LIMIT 1
        `, [userId, entitlementKey]);

        return !!row;
    } catch (err) {
        logger.error(`[ENTITLEMENTS] Verification error for user ${userId} key ${entitlementKey}`, err);
        return false;
    }
}

/**
 * Grants an entitlement to a user with audit trail
 */
async function grantEntitlement(arg1, arg2, arg3, arg4, arg5) {
    let userId, entitlementKey, sourceType, sourceId, expiresAt, grantedBy, reason;
    if (typeof arg1 === 'object' && arg1 !== null) {
        userId = arg1.userId;
        entitlementKey = arg1.entitlementKey;
        sourceType = arg1.sourceType || 'SUBSCRIPTION';
        sourceId = arg1.sourceId || null;
        expiresAt = arg1.expiresAt || null;
        grantedBy = arg1.grantedBy || 'SYSTEM';
        reason = arg1.reason || 'Plan activation';
    } else {
        userId = arg1;
        entitlementKey = arg2;
        sourceType = arg3 || 'MANUAL_GRANT';
        const durationDays = arg4;
        expiresAt = durationDays ? new Date(Date.now() + durationDays * 86400000).toISOString() : null;
        grantedBy = (arg5 && arg5.grantedBy) || 'SYSTEM';
        reason = (arg5 && arg5.reason) || 'Manual grant';
    }

    if (!userId || !entitlementKey) {
        throw new Error('User ID and entitlement key required');
    }

    const entitlementId = uuidv4();

    await dbAsync.run(`
        INSERT INTO entitlements (
            id, user_id, entitlement_key, status, source_type, 
            source_id, expires_at, granted_by, reason, created_at, updated_at
        )
        VALUES (?, ?, ?, 'ACTIVE', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, entitlement_key) DO UPDATE SET
            status = 'ACTIVE',
            source_type = excluded.source_type,
            source_id = excluded.source_id,
            expires_at = excluded.expires_at,
            granted_by = excluded.granted_by,
            reason = excluded.reason,
            updated_at = CURRENT_TIMESTAMP
    `, [entitlementId, userId, entitlementKey, sourceType, sourceId, expiresAt, grantedBy, reason]);

    // Record business event
    await dbAsync.run(`
        INSERT INTO business_events (id, event_name, user_id, entity_type, entity_id, metadata, created_at)
        VALUES (?, 'entitlement_granted', ?, 'ENTITLEMENT', ?, ?, CURRENT_TIMESTAMP)
    `, [uuidv4(), userId, entitlementKey, JSON.stringify({ sourceType, sourceId, grantedBy, reason })]);

    // Record business audit log
    await dbAsync.run(`
        INSERT INTO business_audit_log (id, actor_id, action, entity_type, entity_id, changes, created_at)
        VALUES (?, ?, 'GRANT_ENTITLEMENT', 'entitlement', ?, ?, CURRENT_TIMESTAMP)
    `, [uuidv4(), grantedBy, entitlementKey, JSON.stringify({ userId, entitlementKey, expiresAt, reason })]);

    logger.info(`[ENTITLEMENTS] Granted "${entitlementKey}" to user ${userId} via ${sourceType}`);
    return {
        id: entitlementId,
        success: true,
        entitlementKey,
        user_id: userId,
        userId,
        expires_at: expiresAt,
        expiresAt,
        is_active: 1
    };
}

/**
 * Revokes an entitlement from a user
 */
async function revokeEntitlement(arg1, arg2, arg3, arg4) {
    let userId, entitlementKey, reason, revokedBy;
    if (typeof arg1 === 'object' && arg1 !== null) {
        userId = arg1.userId;
        entitlementKey = arg1.entitlementKey;
        reason = arg1.reason || 'Subscription cancelled or expired';
        revokedBy = arg1.revokedBy || 'SYSTEM';
    } else {
        userId = arg1;
        entitlementKey = arg2;
        reason = arg3 || 'Owner revocation';
        revokedBy = arg4 || 'SYSTEM';
    }

    if (!userId || !entitlementKey) {
        throw new Error('User ID and entitlement key required');
    }

    const res = await dbAsync.run(`
        UPDATE entitlements
        SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ? AND entitlement_key = ?
    `, [userId, entitlementKey]);

    // Record business audit log
    await dbAsync.run(`
        INSERT INTO business_audit_log (id, actor_id, action, entity_type, entity_id, changes, created_at)
        VALUES (?, ?, 'REVOKE_ENTITLEMENT', 'entitlement', ?, ?, CURRENT_TIMESTAMP)
    `, [uuidv4(), revokedBy, entitlementKey, JSON.stringify({ userId, entitlementKey, reason })]);

    logger.info(`[ENTITLEMENTS] Revoked "${entitlementKey}" from user ${userId} (reason: ${reason})`);
    return res.changes || 1;
}

/**
 * Synchronizes entitlements with subscription status
 */
async function syncSubscriptionEntitlements(arg1, arg2, arg3, arg4) {
    let subscriptionId = typeof arg1 === 'string' && !arg2 ? arg1 : arg4;
    let userId = arg2 ? arg1 : null;
    let planId = arg2 || null;
    let status = arg3 || null;

    if (subscriptionId) {
        const sub = await dbAsync.get(`
            SELECT s.id, s.user_id, s.status, s.current_period_end, p.entitlement_keys
            FROM subscriptions s
            JOIN plans p ON s.plan_id = p.id
            WHERE s.id = ?
        `, [subscriptionId]);

        if (sub) {
            userId = sub.user_id;
            const effectiveStatus = status || sub.status;
            let keys = [];
            try {
                keys = JSON.parse(sub.entitlement_keys || '[]');
            } catch (_) {}

            if (effectiveStatus === 'ACTIVE') {
                for (const key of keys) {
                    await grantEntitlement(userId, key, 'SUBSCRIPTION', 30);
                }
            } else {
                for (const key of keys) {
                    await revokeEntitlement(userId, key, `Subscription ${effectiveStatus}`);
                }
            }
            return;
        }
    }

    if (userId && planId) {
        const plan = await dbAsync.get('SELECT entitlement_keys FROM plans WHERE id = ?', [planId]);
        let keys = [];
        try {
            keys = JSON.parse(plan?.entitlement_keys || '[]');
        } catch (_) {}

        if (status === 'ACTIVE') {
            for (const key of keys) {
                await grantEntitlement(userId, key, 'SUBSCRIPTION', 30);
            }
        } else {
            for (const key of keys) {
                await revokeEntitlement(userId, key, `Subscription ${status}`);
            }
        }
    }
}

/**
 * Express middleware to strictly enforce a required entitlement
 */
function requireEntitlement(entitlementKey) {
    return async (req, res, next) => {
        if (!req.user || !req.user.id) {
            return res.status(401).json({ error: 'Authentication required for premium feature' });
        }

        const allowed = await hasEntitlement(req.user.id, entitlementKey);
        if (!allowed) {
            return res.status(403).json({
                error: 'Premium entitlement required',
                requiredEntitlement: entitlementKey,
                upgradeUrl: '/membership/'
            });
        }

        next();
    };
}

module.exports = {
    VALID_ENTITLEMENT_KEYS,
    getUserEntitlements,
    hasEntitlement,
    grantEntitlement,
    revokeEntitlement,
    syncSubscriptionEntitlements,
    requireEntitlement
};
