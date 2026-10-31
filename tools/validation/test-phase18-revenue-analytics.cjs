#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 18 Test Suite 9: Revenue Analytics, Funnels & Zero Fake Data
 */

'use strict';

const monetizationService = require('../../server/services/monetizationService.cjs');
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
    console.log('TEST SUITE 9: Phase 18 Revenue Analytics, Funnels & Zero Fake Data');
    console.log('======================================================================\n');

    // 1. Zero Fake Metrics Principle Verification
    console.log('--- Test 1: Zero Fake Data Verification ---');
    // Ensure all metrics are derived strictly from database queries without hardcoded values
    const overview = await monetizationService.getBusinessOverview();
    const actualSubCount = (await dbAsync.get("SELECT COUNT(*) as c FROM subscriptions WHERE status = 'ACTIVE'")).c;
    const actualDonCount = (await dbAsync.get("SELECT COUNT(*) as c FROM donations WHERE status IN ('PAID', 'COMPLETED')")).c;
    const actualSponCount = (await dbAsync.get("SELECT COUNT(*) as c FROM sponsors WHERE status = 'ACTIVE'")).c;
    const actualPartnerCount = (await dbAsync.get("SELECT COUNT(*) as c FROM partner_links WHERE is_active = 1")).c;

    assert(overview.metrics.activeSubscriptions === actualSubCount, 'Subscriptions count matches real DB query exactly');
    assert(overview.metrics.totalDonationsCount === actualDonCount, 'Donations count matches real DB query exactly');
    assert(overview.metrics.activeSponsorsCount === actualSponCount, 'Sponsors count matches real DB query exactly');
    assert(overview.metrics.activePartnerLinksCount === actualPartnerCount, 'Partner links count matches real DB query exactly');

    // 2. Conversion Funnels Calculation
    console.log('\n--- Test 2: Conversion Funnels Structure & Conversion Math ---');
    // Log sample checkout start and completion events
    const testSessionId = 'funnel-sess-' + Date.now();
    await monetizationService.recordBusinessEvent('plan_view', { sessionId: testSessionId });
    await monetizationService.recordBusinessEvent('membership_checkout_started', { sessionId: testSessionId });
    await monetizationService.recordBusinessEvent('membership_checkout_completed', { sessionId: testSessionId });

    const funnels = await monetizationService.getConversionFunnels();
    assert(typeof funnels === 'object' && funnels !== null, 'Funnels returned as object');
    assert('membershipFunnel' in funnels, 'Funnels include membershipFunnel');
    assert('donationFunnel' in funnels, 'Funnels include donationFunnel');
    assert(funnels.membershipFunnel.planViews >= 1, 'Plan views counted in membership funnel');
    assert(funnels.membershipFunnel.checkoutsStarted >= 1, 'Checkout starts counted in membership funnel');
    assert(funnels.membershipFunnel.checkoutsPaid >= 1, 'Checkouts paid counted in membership funnel');
    assert(typeof funnels.membershipFunnel.conversionRate === 'string', 'Conversion rate formatted as percentage string');

    // 3. Integer Minor Unit Sums
    console.log('\n--- Test 3: Revenue Calculation using Minor Units ---');
    const dbRevenue = (await dbAsync.get("SELECT SUM(amount_minor_units) as total FROM payments WHERE status = 'PAID'")).total || 0;
    assert(overview.metrics.totalRevenueMinorUnits === dbRevenue, 'totalRevenueMinorUnits equals exact integer sum from payments table');
    assert(Number.isInteger(overview.metrics.totalRevenueMinorUnits), 'Revenue amount is strictly an integer');

    // Cleanup test events
    await dbAsync.run("DELETE FROM business_events WHERE session_id = ?", [testSessionId]);

    console.log(`\nRevenue Analytics Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
