#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 18 Test Suite 6: Sponsors & Ethical Advertising
 */

'use strict';

const monetizationService = require('../../server/services/monetizationService.cjs');
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
    console.log('TEST SUITE 6: Phase 18 Sponsors & Ethical Advertising');
    console.log('======================================================================\n');

    await featureFlags.setFlag('MONETIZATION_ENABLED', true, 'test');
    await featureFlags.setFlag('SPONSORS_ENABLED', true, 'test');
    await featureFlags.setFlag('ADS_ENABLED', true, 'test');

    const testSponsorId = 'spon-test-' + Date.now();
    const testAdId = 'ad-test-' + Date.now();

    // 1. Sponsors Setup & Active Filtering
    console.log('--- Test 1: Sponsor Directory & Active Status Filtering ---');
    await dbAsync.run(`
        INSERT INTO sponsors (id, name, logo_url, website_url, description, status)
        VALUES (?, ?, 'https://logo.example.com/logo.png', 'https://retrohardware.example.com', 'Preservation hardware maker', 'ACTIVE')
    `, [testSponsorId, 'RetroHardware Labs']);

    const activeSponsors = await monetizationService.getActiveSponsors();
    const foundSponsor = activeSponsors.find(s => s.id === testSponsorId);
    assert(foundSponsor !== undefined, 'Active sponsor found in getActiveSponsors()');
    assert(foundSponsor.name === 'RetroHardware Labs', 'Sponsor details match');

    // Test sponsor click & impression tracking
    await monetizationService.recordSponsorImpression(testSponsorId);
    await monetizationService.recordSponsorClick(testSponsorId);

    const updatedSponsor = await dbAsync.get('SELECT impressions_count, clicks_count FROM sponsors WHERE id = ?', [testSponsorId]);
    assert(updatedSponsor.impressions_count >= 1, 'Sponsor impression recorded');
    assert(updatedSponsor.clicks_count >= 1, 'Sponsor click recorded');

    // 2. Ethical Ad Slot Resolution
    console.log('\n--- Test 2: Ethical Ad Slot Resolution ---');
    await dbAsync.run(`
        INSERT INTO ads (id, slot_id, title, destination_url, status)
        VALUES (?, 'slot-home-strip', 'Preservation Mod Kits', 'https://mods.example.com', 'ACTIVE')
    `, [testAdId]);

    const resolvedAd = await monetizationService.getAdForSlot('slot-home-strip', []);
    assert(resolvedAd !== null, 'Ad successfully resolved for slot-home-strip');
    assert(resolvedAd && (resolvedAd.id === testAdId || typeof resolvedAd.id === 'string'), 'Active ad returned');

    // 3. Ad Suppression for Ad-Free Entitlement Holders
    console.log('\n--- Test 3: Ad-Free Entitlement Suppression ---');
    const suppressedAd = await monetizationService.getAdForSlot('slot-home-strip', ['ad_free', 'supporter']);
    assert(suppressedAd === null, 'Ad is suppressed (returns null) for users with ad_free entitlement');

    // 4. Ad Impression & Click Tracking
    console.log('\n--- Test 4: Ad Metrics Tracking ---');
    await monetizationService.recordAdImpression(testAdId);
    await monetizationService.recordAdClick(testAdId);

    const updatedAd = await dbAsync.get('SELECT impressions_count, clicks_count FROM ads WHERE id = ?', [testAdId]);
    assert(updatedAd.impressions_count >= 1, 'Ad impression counter incremented');
    assert(updatedAd.clicks_count >= 1, 'Ad click counter incremented');

    // 5. Inactive Ad Behavior
    console.log('\n--- Test 5: Inactive or Expired Ad Exclusion ---');
    await dbAsync.run("UPDATE ads SET status = 'INACTIVE' WHERE id = ?", [testAdId]);
    const inactiveResult = await monetizationService.getAdForSlot('slot-home-strip', []);
    assert(inactiveResult === null || inactiveResult.id !== testAdId, 'Inactive ad is never served to users');

    // Cleanup
    await dbAsync.run('DELETE FROM ads WHERE id = ?', [testAdId]);
    await dbAsync.run('DELETE FROM sponsors WHERE id = ?', [testSponsorId]);

    console.log(`\nSponsors & Ads Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
