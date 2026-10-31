#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 18 Test Suite 5: Voluntary Donations & Supporter Recognition
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
    console.log('TEST SUITE 5: Phase 18 Voluntary Donations & Supporter Recognition');
    console.log('======================================================================\n');

    await featureFlags.setFlag('MONETIZATION_ENABLED', true, 'test');
    await featureFlags.setFlag('DONATIONS_ENABLED', true, 'test');

    // 1. Voluntary Donation Creation & Validation
    console.log('--- Test 1: Voluntary Donation Creation & Bounds Validation ---');
    // Test rejection of negative or zero amount
    let zeroThrew = false;
    try {
        await monetizationService.createDonation({ amountMinorUnits: 0, currency: 'USD' });
    } catch (e) {
        zeroThrew = true;
    }
    assert(zeroThrew, 'Rejects zero amount');

    let excessiveThrew = false;
    try {
        await monetizationService.createDonation({ amountMinorUnits: 20000000, currency: 'USD' }); // > max
    } catch (e) {
        excessiveThrew = true;
    }
    assert(excessiveThrew, 'Rejects excessive amount exceeding maximum boundary');

    // 2. Normal Donation Creation with Anonymous Toggle
    console.log('\n--- Test 2: Anonymous Donation Flow ---');
    const anonDonation = await monetizationService.createDonation({
        donorName: 'Secret Philanthropist',
        donorEmail: 'secret@example.com',
        amountMinorUnits: 1500, // $15.00
        currency: 'USD',
        message: 'Keep the CRT monitors alive!',
        isAnonymous: true
    });

    assert(anonDonation && anonDonation.donation.id, 'Donation created with ID');
    assert(anonDonation.donation.is_anonymous === 1, 'is_anonymous flagged as true (1)');
    assert(anonDonation.session && anonDonation.session.checkoutUrl, 'Payment session returned');

    // 3. Completing Donation & Supporter Entitlement Award
    console.log('\n--- Test 3: Processing Donation Success & Entitlement Award ---');
    const donorUserId = 'donor-user-' + Date.now();
    await dbAsync.run(`
        INSERT INTO users (id, username, username_normalized, email, password_hash, role)
        VALUES (?, ?, ?, ?, 'hash', 'USER')
    `, [donorUserId, donorUserId, donorUserId.toLowerCase(), `${donorUserId}@example.com`]);

    const namedDonation = await monetizationService.createDonation({
        userId: donorUserId,
        donorName: 'Linus Retro',
        donorEmail: 'linus@example.com',
        amountMinorUnits: 2500, // $25.00 (meets >$5 threshold for supporter perks)
        currency: 'USD',
        message: 'Dedicated to preserving 90s PC gaming',
        isAnonymous: false
    });

    const completion = await monetizationService.processDonationSuccess(namedDonation.donation.id, 'ext-mock-tx-123');
    assert(completion && (completion.status === 'PAID' || completion.status === 'COMPLETED'), 'Donation status updated to PAID/COMPLETED');

    // Check payment record created
    const payment = await dbAsync.get('SELECT * FROM payments WHERE related_id = ?', [namedDonation.donation.id]);
    assert(payment && (payment.status === 'PAID' || payment.status === 'SUCCEEDED'), 'Authoritative payment record logged as PAID/SUCCEEDED');

    // Check supporter entitlement granted
    const userEntitlements = await entitlementService.getUserEntitlements(donorUserId);
    const keys = userEntitlements.map(e => typeof e === 'string' ? e : e.key);
    assert(keys.includes('supporter') || keys.includes('supporter_badge'), 'Donor automatically awarded supporter entitlement');

    // 4. Public Supporter Wall Listing & Privacy Verification
    console.log('\n--- Test 4: Supporter Wall Privacy & Anonymity Enforcement ---');
    const supporters = await monetizationService.getPublicSupporters(10);
    assert(Array.isArray(supporters), 'Public supporters returned as array');

    // Complete the anonymous donation to see it in supporters
    await monetizationService.processDonationSuccess(anonDonation.donation.id, 'ext-mock-tx-456');
    const refreshedSupporters = await monetizationService.getPublicSupporters(20);

    const anonEntry = refreshedSupporters.find(s => s.message === 'Keep the CRT monitors alive!');
    assert(anonEntry !== undefined, 'Anonymous donation appears on public supporter wall');
    assert(anonEntry.name === 'Anonymous Supporter', "Anonymous donor name is masked as 'Anonymous Supporter'");
    assert(!('donorEmail' in anonEntry) && !('donor_email' in anonEntry), 'Private donor email never exposed publicly');

    // Cleanup
    await dbAsync.run('DELETE FROM donations WHERE id IN (?, ?)', [anonDonation.donation.id, namedDonation.donation.id]);
    await dbAsync.run('DELETE FROM payments WHERE related_id IN (?, ?)', [anonDonation.donation.id, namedDonation.donation.id]);
    await dbAsync.run('DELETE FROM entitlements WHERE user_id = ?', [donorUserId]);
    await dbAsync.run('DELETE FROM users WHERE id = ?', [donorUserId]);

    console.log(`\nDonations Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
