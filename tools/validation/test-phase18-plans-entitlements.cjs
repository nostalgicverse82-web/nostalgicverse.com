#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 18 Test Suite 3: Membership Plans & Server Entitlements
 */

'use strict';

const monetizationService = require('../../server/services/monetizationService.cjs');
const entitlementService = require('../../server/services/entitlementService.cjs');
const { dbAsync } = require('../../server/db/connection.cjs');

let passed = 0;
let failed = 0;

function assert(condition, message) {
    if (condition) {
        console.log(`  [PASS] ${message}`);
        passed++;
    } else {
        console.error(`  [FAIL] ${message}`);
        failed++;
    }
}

async function run() {
    console.log('======================================================================');
    console.log('TEST SUITE 3: Phase 18 Plans & Server Entitlements');
    console.log('======================================================================\n');

    // 1. Querying Active Membership Plans
    console.log('--- Test 1: Active Plans Querying ---');
    const activePlans = await monetizationService.getActivePlans();
    assert(Array.isArray(activePlans) && activePlans.length >= 3, `Found ${activePlans.length} active plans`);
    const patronPlan = activePlans.find(p => p.id === 'plan-patron' || p.slug === 'patron');
    assert(patronPlan !== undefined, 'Patron plan present');
    const ents = patronPlan.entitlementKeys || patronPlan.entitlements || [];
    assert(Array.isArray(ents), 'Plan entitlements parsed as Array');
    assert(ents.includes('ad_free'), "Patron plan includes 'ad_free' entitlement key");

    // 2. Upsert Custom Plan
    console.log('\n--- Test 2: Upsert Custom Plan ---');
    const customPlanId = 'plan-test-custom-' + Date.now();
    const createdPlan = await monetizationService.upsertPlan({
        id: customPlanId,
        name: 'Curator Test Tier',
        slug: 'curator-test-' + Date.now(),
        displayOrder: 99,
        priceMinorUnits: 4999,
        currency: 'USD',
        isActive: 1,
        entitlementKeys: ['curator', 'ad_free', 'supporter']
    });
    assert(createdPlan && createdPlan.id === customPlanId, 'Custom plan created successfully');
    const allPlansList = await monetizationService.getAllPlans();
    const fetchedPlan = allPlansList.find(p => p.id === customPlanId);
    const createdEnts = fetchedPlan ? fetchedPlan.entitlementKeys : [];
    assert(createdEnts.includes('curator'), 'Custom plan saved with curator entitlement');

    // 3. Server-Authoritative Entitlement Grants
    console.log('\n--- Test 3: Authoritative Server Entitlement Grants ---');
    const testUserId = 'test-user-ent-' + Date.now();
    await dbAsync.run(`
        INSERT INTO users (id, username, username_normalized, email, password_hash, role)
        VALUES (?, ?, ?, ?, 'hash', 'USER')
    `, [testUserId, testUserId, testUserId.toLowerCase(), `${testUserId}@example.com`]);

    // Grant supporter entitlement for 30 days
    const granted = await entitlementService.grantEntitlement(testUserId, 'supporter', 'MANUAL_TEST', 30);
    assert(granted && granted.user_id === testUserId, 'Supporter entitlement granted');
    assert(granted.is_active === 1, 'Granted entitlement is active');
    assert(granted.expires_at !== null, 'Expiration timestamp computed for durationDays=30');

    // Grant permanent ad_free entitlement
    const grantedAdFree = await entitlementService.grantEntitlement(testUserId, 'ad_free', 'MANUAL_TEST', null);
    assert(grantedAdFree.expires_at === null, 'Permanent entitlement has null expiration date');

    // 4. Checking User Entitlements
    console.log('\n--- Test 4: Verification of Active Entitlements ---');
    const userEntitlements = await entitlementService.getUserEntitlements(testUserId);
    const entitlementKeys = userEntitlements.map(e => typeof e === 'string' ? e : e.key);
    assert(entitlementKeys.includes('supporter'), "getUserEntitlements includes 'supporter'");
    assert(entitlementKeys.includes('ad_free'), "getUserEntitlements includes 'ad_free'");
    assert(!entitlementKeys.includes('champion'), "getUserEntitlements does NOT include ungranted 'champion'");

    const hasAdFree = await entitlementService.hasEntitlement(testUserId, 'ad_free');
    assert(hasAdFree === true, "hasEntitlement(testUserId, 'ad_free') returns true");

    const hasChampion = await entitlementService.hasEntitlement(testUserId, 'champion');
    assert(hasChampion === false, "hasEntitlement(testUserId, 'champion') returns false");

    // 5. Expiration & Revocation Logic
    console.log('\n--- Test 5: Revocation and Expiration Handling ---');
    // Artificially expire the supporter entitlement by modifying expires_at in DB
    await dbAsync.run(
        "UPDATE entitlements SET expires_at = datetime('now', '-1 day') WHERE user_id = ? AND entitlement_key = ?",
        [testUserId, 'supporter']
    );
    const hasExpiredSupporter = await entitlementService.hasEntitlement(testUserId, 'supporter');
    assert(hasExpiredSupporter === false, 'Expired entitlement is automatically rejected (returns false)');

    // Revoke ad_free entitlement
    const revokeCount = await entitlementService.revokeEntitlement(testUserId, 'ad_free', 'Test cleanup');
    assert(revokeCount >= 1, `Revoked ${revokeCount} ad_free entitlement(s)`);
    const hasRevokedAdFree = await entitlementService.hasEntitlement(testUserId, 'ad_free');
    assert(hasRevokedAdFree === false, 'Revoked entitlement returns false');

    // 6. Subscription Entitlement Sync
    console.log('\n--- Test 6: Subscription Entitlement Synchronization ---');
    const subId = 'sub-test-' + Date.now();
    await dbAsync.run(`
        INSERT INTO subscriptions (id, user_id, plan_id, status, provider, current_period_end)
        VALUES (?, ?, ?, 'ACTIVE', 'mock', datetime('now', '+30 days'))
    `, [subId, testUserId, 'plan-patron']);

    await entitlementService.syncSubscriptionEntitlements(testUserId, 'plan-patron', 'ACTIVE', subId);
    const syncedEntsRaw = await entitlementService.getUserEntitlements(testUserId);
    const syncedEnts = syncedEntsRaw.map(e => typeof e === 'string' ? e : e.key);
    assert(syncedEnts.includes('supporter_badge') || syncedEnts.includes('ad_free'), 'Subscription sync granted plan entitlement');
    assert(syncedEnts.includes('ad_free'), 'Subscription sync granted ad_free entitlement');

    // Simulate subscription cancellation
    await entitlementService.syncSubscriptionEntitlements(testUserId, 'plan-patron', 'CANCELLED', subId);
    const postCancelEntsRaw = await entitlementService.getUserEntitlements(testUserId);
    const postCancelEnts = postCancelEntsRaw.map(e => typeof e === 'string' ? e : e.key);
    assert(!postCancelEnts.includes('supporter_badge'), 'Cancelled subscription revoked plan entitlement');

    // Cleanup
    await dbAsync.run('DELETE FROM plans WHERE id = ?', [customPlanId]);
    await dbAsync.run('DELETE FROM subscriptions WHERE id = ?', [subId]);
    await dbAsync.run('DELETE FROM entitlements WHERE user_id = ?', [testUserId]);
    await dbAsync.run('DELETE FROM users WHERE id = ?', [testUserId]);

    console.log(`\nPlans & Entitlements Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
