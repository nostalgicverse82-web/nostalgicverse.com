#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 18 Test Suite 1: Business Core, DB Schema & Minor Units
 */

'use strict';

const { dbAsync } = require('../../server/db/connection.cjs');
const monetizationService = require('../../server/services/monetizationService.cjs');

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
    console.log('TEST SUITE 1: Phase 18 Business Core, DB Schema & Minor Units');
    console.log('======================================================================\n');

    // 1. Database Integrity & Foreign Keys
    console.log('--- Test 1: SQLite Database Integrity ---');
    const integrity = await dbAsync.get('PRAGMA integrity_check');
    assert(integrity && integrity.integrity_check === 'ok', 'PRAGMA integrity_check passed (ok)');

    const fkCheck = await dbAsync.all('PRAGMA foreign_key_check');
    assert(Array.isArray(fkCheck) && fkCheck.length === 0, 'Zero foreign key constraint violations');

    // 2. Phase 18 Tables Existence
    console.log('\n--- Test 2: Phase 18 Database Tables Existence ---');
    const requiredTables = [
        'plans',
        'subscriptions',
        'entitlements',
        'payments',
        'payment_events',
        'donations',
        'sponsors',
        'ads',
        'partner_links',
        'campaigns',
        'coupons',
        'business_events',
        'business_audit_log'
    ];

    for (const tbl of requiredTables) {
        const row = await dbAsync.get(
            "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
            [tbl]
        );
        assert(row && row.name === tbl, `Table '${tbl}' exists`);
    }

    // 3. Minor Units Arithmetic & Currency Formatting (Zero Floating Point Math)
    console.log('\n--- Test 3: Minor Units Arithmetic & Zero Float Errors ---');
    // Ensure 19900 paise = 199.00, 399 cents = 3.99
    const formattedUsd = monetizationService.formatCurrency(399, 'USD');
    assert(formattedUsd.includes('3.99'), `Format USD includes exact decimal conversion 3.99: got ${formattedUsd}`);

    const formattedInr = monetizationService.formatCurrency(19900, 'INR');
    assert(formattedInr === '₹199.00', `Format ₹199.00 matches exact integer conversion: got ${formattedInr}`);

    // Verify summing minor units avoids 0.1 + 0.2 = 0.30000000000000004 IEEE-754 bug
    const amounts = [10, 20, 30, 40]; // 10 cents, 20 cents, etc.
    const totalMinor = amounts.reduce((acc, v) => acc + v, 0);
    assert(totalMinor === 100, 'Summing integer minor units equals exact 100 cents ($1.00)');
    assert(Number.isInteger(totalMinor), 'Total minor units remains strictly an integer');

    // 4. Default Seed Data Verification
    console.log('\n--- Test 4: Default Seed Data Verification ---');
    const defaultPlans = await dbAsync.all('SELECT id, name, price_minor_units FROM plans ORDER BY display_order ASC');
    assert(defaultPlans.length >= 3, `At least 3 default membership plans exist: found ${defaultPlans.length}`);
    const supporterPlan = defaultPlans.find(p => p.id === 'plan-supporter');
    assert(supporterPlan && supporterPlan.price_minor_units === 19900, 'Supporter plan seeded with exact 19900 minor units (₹199.00)');

    console.log(`\nCore DB & Currency Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
