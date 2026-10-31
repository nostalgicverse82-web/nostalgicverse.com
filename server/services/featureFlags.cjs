/**
 * NostalgicVerse — Phase 18 Feature Flags Manager
 * ==================================================
 * Controls global rollout states for monetization, donations,
 * memberships, advertisements, sponsorships, and partner links.
 * Default state: SAFE / OFF.
 */

'use strict';

const { dbAsync } = require('../db/connection.cjs');
const { defaultLogger: logger } = require('../automation/logger.cjs');

// In-memory cache for fast lookups
let flagsCache = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds

const KNOWN_FLAGS = {
    MONETIZATION_ENABLED: 'monetization_enabled',
    MONETIZATION_GLOBAL_DISABLE: 'monetization_global_disable',
    DONATIONS_ENABLED: 'donations_enabled',
    MEMBERSHIPS_ENABLED: 'memberships_enabled',
    PREMIUM_FEATURES_ENABLED: 'premium_features_enabled',
    ADS_ENABLED: 'ads_enabled',
    SPONSORS_ENABLED: 'sponsors_enabled',
    PARTNER_LINKS_ENABLED: 'partner_links_enabled',
    AFFILIATE_LINKS_ENABLED: 'affiliate_links_enabled',
    CHECKOUT_ENABLED: 'checkout_enabled',
    PAYMENTS_MODE: 'payments_mode',
    BUSINESS_CURRENCY: 'business_currency'
};

/**
 * Loads all feature flags from site_settings into cache
 */
async function loadFlags() {
    try {
        const rows = await dbAsync.all('SELECT key, value FROM site_settings');
        const flags = {};
        for (const r of rows) {
            flags[r.key] = r.value;
        }
        flagsCache = flags;
        lastCacheTime = Date.now();
        return flags;
    } catch (err) {
        logger.error('[FEATURE_FLAGS] Error loading flags from database', err);
        return flagsCache || {};
    }
}

/**
 * Checks whether a specific feature flag is enabled
 */
async function isEnabled(flagKey) {
    const canonicalKey = (KNOWN_FLAGS[flagKey] || flagKey).toLowerCase();

    // Check emergency kill switch first
    if (canonicalKey !== 'monetization_global_disable') {
        const globalDisable = await getFlagValue('monetization_global_disable');
        if (globalDisable === 'true') {
            return false;
        }
    }

    // Check master monetization switch
    if (canonicalKey !== 'monetization_enabled' && canonicalKey !== 'monetization_global_disable') {
        const monetizationEnabled = await getFlagValue('monetization_enabled');
        if (monetizationEnabled !== 'true') {
            return false;
        }
    }

    const val = await getFlagValue(canonicalKey);
    return val === 'true';
}

/**
 * Gets raw string value of a flag or setting
 */
async function getFlagValue(key) {
    const canonicalKey = (KNOWN_FLAGS[key] || key).toLowerCase();
    const now = Date.now();
    if (!flagsCache || (now - lastCacheTime > CACHE_TTL_MS)) {
        await loadFlags();
    }
    return flagsCache[canonicalKey] !== undefined ? flagsCache[canonicalKey] : null;
}

/**
 * Returns all active monetization feature flags for owner review
 */
async function getAllFlags() {
    await loadFlags();
    const res = {};
    for (const [prop, dbKey] of Object.entries(KNOWN_FLAGS)) {
        res[prop] = flagsCache[dbKey] !== undefined ? flagsCache[dbKey] : 'false';
    }
    return res;
}

/**
 * Updates a feature flag and records in audit log
 */
async function updateFlag(key, value, actorId = 'system') {
    const canonicalKey = (KNOWN_FLAGS[key] || key).toLowerCase();
    const stringVal = String(value).trim().toLowerCase();

    const oldVal = await getFlagValue(canonicalKey);

    await dbAsync.run(`
        INSERT INTO site_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `, [canonicalKey, stringVal]);

    // Record audit log
    await dbAsync.run(`
        INSERT INTO business_audit_log (id, actor_id, action, entity_type, entity_id, changes, created_at)
        VALUES (lower(hex(randomblob(16))), ?, 'UPDATE_FEATURE_FLAG', 'feature_flag', ?, ?, CURRENT_TIMESTAMP)
    `, [actorId, canonicalKey, JSON.stringify({ old: oldVal, new: stringVal })]);

    // Invalidate cache immediately
    flagsCache = null;
    logger.info(`[FEATURE_FLAGS] Flag "${canonicalKey}" updated to "${stringVal}" by actor "${actorId}"`);
    return { success: true, key: canonicalKey, value: stringVal };
}

/**
 * Checks if emergency kill switch is currently active
 */
async function isEmergencyKillSwitchActive() {
    const val = await getFlagValue('monetization_global_disable');
    return val === 'true';
}

async function emergencyGlobalDisable(actorId = 'system') {
    const res = await updateFlag('monetization_global_disable', 'true', actorId);
    await dbAsync.run(`
        INSERT INTO business_audit_log (id, actor_id, action, entity_type, entity_id, changes, created_at)
        VALUES (lower(hex(randomblob(16))), ?, 'EMERGENCY_GLOBAL_DISABLE', 'monetization', 'GLOBAL', ?, CURRENT_TIMESTAMP)
    `, [actorId, JSON.stringify({ action: 'MONETIZATION_GLOBAL_DISABLE' })]);
    return res;
}

const isMonetizationGloballyDisabled = isEmergencyKillSwitchActive;
const isAdsEnabled = () => isEnabled('ADS_ENABLED');
const isDonationsEnabled = () => isEnabled('DONATIONS_ENABLED');
const isMembershipsEnabled = () => isEnabled('MEMBERSHIPS_ENABLED');
const isCheckoutEnabled = () => isEnabled('CHECKOUT_ENABLED');
const isSponsorsEnabled = () => isEnabled('SPONSORS_ENABLED');
const isPartnerLinksEnabled = () => isEnabled('PARTNER_LINKS_ENABLED');

module.exports = {
    KNOWN_FLAGS,
    isEnabled,
    getFlagValue,
    getAllFlags,
    updateFlag,
    setFlag: updateFlag,
    emergencyGlobalDisable,
    isEmergencyKillSwitchActive,
    isMonetizationGloballyDisabled,
    isAdsEnabled,
    isDonationsEnabled,
    isMembershipsEnabled,
    isCheckoutEnabled,
    isSponsorsEnabled,
    isPartnerLinksEnabled,
    loadFlags
};
