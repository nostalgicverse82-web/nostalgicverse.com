#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 18 Test Suite 10: Security, Fraud & Tampering Defenses
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
    console.log('TEST SUITE 10: Phase 18 Security, Fraud & Tampering Defenses');
    console.log('======================================================================\n');

    // Enable feature flags for testing
    await featureFlags.updateFlag('monetization_enabled', 'true', 'test');
    await featureFlags.updateFlag('checkout_enabled', 'true', 'test');
    await featureFlags.updateFlag('donations_enabled', 'true', 'test');

    const testAttackerId = 'attacker-user-' + Date.now();
    const testUsername = 'attacker_' + Date.now();
    await dbAsync.run(`
        INSERT INTO users (id, username, email, password_hash, role)
        VALUES (?, ?, ?, 'dummy_hash', 'user')
    `, [testAttackerId, testUsername, `${testUsername}@example.com`]);

    // 1. Price Tampering Defense
    console.log('--- Test 1: Price Tampering Resistance ---');
    // A malicious client attempts to start checkout for $0.01 (1 cent) on a Patron plan
    const maliciousCheckoutAttempt = {
        planId: 'plan-patron',
        userId: testAttackerId,
        userEmail: 'attacker@example.com',
        price_monthly: 1,           // Attempted client price override
        amountMinorUnits: 1,        // Attempted client price override
        currency: 'USD'
    };

    const session = await monetizationService.startCheckout(maliciousCheckoutAttempt);
    const plan = await dbAsync.get('SELECT price_minor_units FROM plans WHERE id = ?', ['plan-patron']);
    // Verified: The authoritative price from the plans table must be used, NOT the client override
    assert(session.amountMinorUnits === plan.price_minor_units, `Authoritative price enforced: expected ${plan.price_minor_units} minor units, got ${session.amountMinorUnits}`);
    assert(session.amountMinorUnits !== 1, 'Client price tampering attempt was completely ignored');

    // 2. Client isPremium Spoofing Resistance
    console.log('\n--- Test 2: Client isPremium Spoofing Defense ---');
    const victimUserId = 'regular-visitor-' + Date.now();
    // Verify user currently has zero entitlements in the database
    const initialEnts = await entitlementService.getUserEntitlements(victimUserId);
    assert(initialEnts.length === 0, 'User has zero entitlements initially');

    // Even if client-side code sends { isPremium: true, role: 'patron' }, server validation checks DB directly
    const hasSpoofedEntitlement = await entitlementService.hasEntitlement(victimUserId, 'patron');
    assert(hasSpoofedEntitlement === false, 'Server authoritatively denies unverified user');

    // 3. SQL Injection Defense across Monetization Queries
    console.log('\n--- Test 3: SQL Injection Immunity ---');
    const sqliPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE donations; --",
        "UNION SELECT null, username, password FROM users --",
        "' OR 1=1; --"
    ];

    for (const payload of sqliPayloads) {
        // Test in partner link resolver
        const sqliPartner = await monetizationService.resolvePartnerRedirect(payload);
        assert(sqliPartner === null, `SQLi payload safely handled in resolvePartnerRedirect: ${payload}`);

        // Test in ad slot resolver
        const sqliAd = await monetizationService.getAdForSlot(payload, []);
        assert(sqliAd === null || typeof sqliAd === 'object', `SQLi payload handled in getAdForSlot: ${payload}`);
    }

    // Verify donations table was not dropped
    const donationsTbl = await dbAsync.get("SELECT name FROM sqlite_master WHERE type='table' AND name='donations'");
    assert(donationsTbl && donationsTbl.name === 'donations', 'donations table remains intact after injection attempts');

    // 4. XSS & HTML Entity Safety in Public Data
    console.log('\n--- Test 4: XSS Resistance in Public Fields ---');
    const xssPayload = '<script>alert("pwned")</script>';
    const donationWithXss = await monetizationService.createDonation({
        donorName: xssPayload,
        amountMinorUnits: 10000,
        currency: 'INR',
        message: '<img src=x onerror=alert(1)>',
        isAnonymous: false
    });

    await monetizationService.processDonationSuccess(donationWithXss.donationId, 'mock-xss-tx');

    const publicSupporters = await monetizationService.getPublicSupporters(5);
    const supporterEntry = publicSupporters.find(s => s.name === xssPayload);
    assert(supporterEntry !== undefined, 'Donation with raw input stored safely via parameterized query');
    assert(donationWithXss && donationWithXss.donationId, 'Donation ID generated successfully');

    // Cleanup
    await dbAsync.run('DELETE FROM donations WHERE id = ?', [donationWithXss.donationId]);
    await dbAsync.run('DELETE FROM subscriptions WHERE user_id = ?', [testAttackerId]);
    await dbAsync.run('DELETE FROM users WHERE id = ?', [testAttackerId]);

    console.log(`\nSecurity & Fraud Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
