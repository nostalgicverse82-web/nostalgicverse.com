#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 18 Test Suite 2: Feature Flags & Emergency Kill Switch
 */

'use strict';

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
    console.log('TEST SUITE 2: Phase 18 Feature Flags & Emergency Kill Switch');
    console.log('======================================================================\n');

    // 1. Initial State & Flags Discovery
    console.log('--- Test 1: Feature Flags Reading & Defaults ---');
    const allFlags = await featureFlags.getAllFlags();
    assert(typeof allFlags === 'object' && allFlags !== null, 'Flags returned as key-value map');
    assert('MONETIZATION_ENABLED' in allFlags, 'MONETIZATION_ENABLED flag exists');
    assert('MONETIZATION_GLOBAL_DISABLE' in allFlags, 'MONETIZATION_GLOBAL_DISABLE flag exists');
    assert('PAYMENTS_MODE' in allFlags, 'PAYMENTS_MODE flag exists');

    // 2. Modifying Flag State & Verification
    console.log('\n--- Test 2: Setting and Querying Specific Flags ---');
    await featureFlags.setFlag('MONETIZATION_ENABLED', true, 'test-runner');
    await featureFlags.setFlag('ADS_ENABLED', false, 'test-runner');
    let adsEnabled = await featureFlags.isAdsEnabled();
    assert(adsEnabled === false, 'ADS_ENABLED correctly set to false');

    await featureFlags.setFlag('ADS_ENABLED', true, 'test-runner');
    adsEnabled = await featureFlags.isAdsEnabled();
    assert(adsEnabled === true, 'ADS_ENABLED correctly updated to true');

    // 3. Emergency Kill Switch Execution
    console.log('\n--- Test 3: Emergency Global Disable (Kill Switch) ---');
    await featureFlags.emergencyGlobalDisable('emergency-test-admin');

    const killSwitchEngaged = await featureFlags.isMonetizationGloballyDisabled();
    assert(killSwitchEngaged === true, 'isMonetizationGloballyDisabled() returns true when kill switch is engaged');

    // All subsystem checks must now evaluate to false immediately regardless of individual flags
    const membershipsBlocked = await featureFlags.isMembershipsEnabled();
    assert(membershipsBlocked === false, 'Memberships blocked when global kill switch engaged');

    const donationsBlocked = await featureFlags.isDonationsEnabled();
    assert(donationsBlocked === false, 'Donations blocked when global kill switch engaged');

    const checkoutBlocked = await featureFlags.isCheckoutEnabled();
    assert(checkoutBlocked === false, 'Checkout blocked when global kill switch engaged');

    // Verify audit record was inserted
    const auditRecord = await dbAsync.get(
        "SELECT * FROM business_audit_log WHERE action = 'EMERGENCY_GLOBAL_DISABLE' ORDER BY created_at DESC LIMIT 1"
    );
    assert(auditRecord && auditRecord.actor_id === 'emergency-test-admin', 'Audit record recorded for emergency disable');

    // 4. Recovery / Resuming Normal Operations
    console.log('\n--- Test 4: Resetting Global Kill Switch ---');
    await featureFlags.setFlag('MONETIZATION_GLOBAL_DISABLE', false, 'recovery-admin');
    const killSwitchRecovered = await featureFlags.isMonetizationGloballyDisabled();
    assert(killSwitchRecovered === false, 'Global disable cleared successfully');

    // Re-verify flags can return true again
    await featureFlags.setFlag('MONETIZATION_ENABLED', true, 'test');
    await featureFlags.setFlag('MEMBERSHIPS_ENABLED', true, 'test');
    await featureFlags.setFlag('DONATIONS_ENABLED', true, 'test');
    await featureFlags.setFlag('CHECKOUT_ENABLED', true, 'test');
    await featureFlags.setFlag('PAYMENTS_MODE', 'MOCK_SANDBOX', 'test');

    const membershipsRestored = await featureFlags.isMembershipsEnabled();
    assert(membershipsRestored === true, 'Memberships re-enabled after recovery');

    console.log(`\nFeature Flags Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
