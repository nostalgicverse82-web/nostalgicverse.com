#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 18 Test Suite 8: Owner Business Center & Audited Management
 */

'use strict';

const monetizationService = require('../../server/services/monetizationService.cjs');
const entitlementService = require('../../server/services/entitlementService.cjs');
const featureFlags = require('../../server/services/featureFlags.cjs');
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
    console.log('TEST SUITE 8: Phase 18 Owner Business Center & Audited Controls');
    console.log('======================================================================\n');

    // 1. Business Overview Data Structure
    console.log('--- Test 1: Business Overview Aggregations ---');
    const overview = await monetizationService.getBusinessOverview();
    assert(overview && typeof overview.metrics === 'object', 'Business overview contains metrics object');
    assert('totalRevenueMinorUnits' in overview.metrics, 'Metrics include totalRevenueMinorUnits');
    assert('activeSubscriptions' in overview.metrics, 'Metrics include activeSubscriptions');
    assert('totalDonationsCount' in overview.metrics, 'Metrics include totalDonationsCount');
    assert('activeSponsorsCount' in overview.metrics, 'Metrics include activeSponsorsCount');
    assert('activePartnerLinksCount' in overview.metrics, 'Metrics include activePartnerLinksCount');
    assert(Array.isArray(overview.recentEvents), 'Overview includes recentEvents list');

    // 2. Comprehensive Plan Management
    console.log('\n--- Test 2: Owner Plan Upsert & Status Control ---');
    const testPlanId = 'plan-owner-test-' + Date.now();
    const planInput = {
        id: testPlanId,
        name: 'VIP Historical Benefactor',
        slug: 'vip-benefactor-' + Date.now(),
        priceMinorUnits: 9900,
        currency: 'USD',
        billingInterval: 'month',
        isActive: 1,
        displayOrder: 5,
        entitlementKeys: ['champion', 'ad_free', 'benefactor'],
        features: ['VIP Benefactor Badge', 'Direct curatorial access']
    };

    const created = await monetizationService.upsertPlan(planInput);
    assert(created && created.id === testPlanId, 'Owner successfully upserted plan');
    const allPlans = await monetizationService.getAllPlans();
    const found = allPlans.find(p => p.id === testPlanId);
    assert(found !== undefined, 'New plan present in getAllPlans()');

    // Deactivate plan
    await monetizationService.upsertPlan({ ...planInput, isActive: 0 });
    const activePlans = await monetizationService.getActivePlans();
    const activeCheck = activePlans.find(p => p.id === testPlanId);
    assert(activeCheck === undefined, 'Deactivated plan hidden from public getActivePlans()');

    // 3. Owner Manual Entitlement Actions & Business Audit Trail
    console.log('\n--- Test 3: Owner Manual Entitlement Grant & Revoke Audit ---');
    const targetUserId = 'target-user-audit-' + Date.now();

    // Ensure user exists in users table for foreign key constraint
    await dbAsync.run(`
        INSERT INTO users (id, username, email, password_hash, role)
        VALUES (?, 'audituser', 'audit@example.com', 'dummy_hash', 'user')
    `, [targetUserId]);

    // Owner manual grant
    const grantRecord = await entitlementService.grantEntitlement(
        targetUserId,
        'supporter',
        'MANUAL_OWNER',
        60,
        { grantedBy: 'owner-admin', reason: 'Historical preservation contribution' }
    );
    assert(grantRecord && grantRecord.user_id === targetUserId, 'Entitlement granted manually');

    // Verify business audit log
    const grantAudit = await dbAsync.get(
        "SELECT * FROM business_audit_log WHERE action = 'GRANT_ENTITLEMENT' AND entity_id = 'supporter' ORDER BY created_at DESC LIMIT 1"
    );
    assert(grantAudit !== undefined, 'Manual grant logged to business_audit_log');

    // Owner manual revoke
    const revokedCount = await entitlementService.revokeEntitlement(targetUserId, 'supporter', 'Owner discretion');
    assert(revokedCount >= 1, 'Entitlement revoked');

    const revokeAudit = await dbAsync.get(
        "SELECT * FROM business_audit_log WHERE action = 'REVOKE_ENTITLEMENT' AND entity_id = 'supporter' ORDER BY created_at DESC LIMIT 1"
    );
    assert(revokeAudit !== undefined, 'Revocation logged to business_audit_log');

    // 4. Feature Flag Setting via Owner Control
    console.log('\n--- Test 4: Feature Flag Adjustment & Audit ---');
    await featureFlags.setFlag('SPONSORS_ENABLED', false, 'owner-admin');
    const isSponsorsOff = await featureFlags.isSponsorsEnabled();
    assert(isSponsorsOff === false, 'Owner disabled sponsors flag');

    const flagAudit = await dbAsync.get(
        "SELECT * FROM business_audit_log WHERE action = 'UPDATE_FEATURE_FLAG' AND lower(entity_id) = 'sponsors_enabled' ORDER BY created_at DESC LIMIT 1"
    );
    assert(flagAudit !== undefined, 'Flag update logged to business_audit_log');

    // Restore sponsors
    await featureFlags.setFlag('SPONSORS_ENABLED', true, 'owner-admin');

    // Cleanup
    await dbAsync.run('DELETE FROM plans WHERE id = ?', [testPlanId]);
    await dbAsync.run('DELETE FROM entitlements WHERE user_id = ?', [targetUserId]);
    await dbAsync.run('DELETE FROM users WHERE id = ?', [targetUserId]);

    console.log(`\nOwner Business Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
