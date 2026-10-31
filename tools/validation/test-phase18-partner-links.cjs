#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 18 Test Suite 7: Verified Partner Links & Safe Outbound Redirects
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
    console.log('TEST SUITE 7: Phase 18 Partner Links & Safe Redirects');
    console.log('======================================================================\n');

    // Ensure feature flags are enabled for test execution
    await featureFlags.updateFlag('monetization_enabled', 'true', 'test');
    await featureFlags.updateFlag('partner_links_enabled', 'true', 'test');

    const testSlug = 'test-retro-hardware-' + Date.now();
    const testPartnerId = 'part-test-' + Date.now();

    // 1. Creating Partner Link & Public Discovery
    console.log('--- Test 1: Partner Link Creation & Public Listing ---');
    await dbAsync.run(`
        INSERT INTO partner_links (id, partner_name, slug, category, destination_url, is_active)
        VALUES (?, 'Retro Hardware Guild', ?, 'HARDWARE', 'https://guild.example.com/shop', 1)
    `, [testPartnerId, testSlug]);

    const publicPartners = await monetizationService.getPublicPartners('HARDWARE');
    const partner = publicPartners.find(p => p.slug === testSlug);
    assert(partner !== undefined, 'Partner link listed under HARDWARE category');
    assert(partner && partner.partner_name === 'Retro Hardware Guild', 'Partner name matches');

    // 2. Safe Outbound Redirect Resolution & Click Tracking
    console.log('\n--- Test 2: Safe Redirect Resolution & Click Counting ---');
    const redirectUrl = await monetizationService.resolvePartnerRedirect(testSlug, '127.0.0.1', 'Mozilla/Test');
    assert(redirectUrl === 'https://guild.example.com/shop', 'Redirect URL resolved to verified destination');

    const updatedRecord = await dbAsync.get('SELECT clicks_count FROM partner_links WHERE id = ?', [testPartnerId]);
    assert(updatedRecord.clicks_count >= 1, 'Partner clicks count incremented');

    // 3. Security: Blocking Malicious URLs
    console.log('\n--- Test 3: Security - Blocking XSS, JavaScript & Insecure Protocols ---');
    const maliciousSlug = 'malicious-partner-' + Date.now();
    const maliciousPartnerId = 'part-mal-' + Date.now();

    // Insert partner with javascript: injection attempt
    await dbAsync.run(`
        INSERT INTO partner_links (id, partner_name, slug, category, destination_url, is_active)
        VALUES (?, 'Hacker Corp', ?, 'HARDWARE', 'javascript:alert(document.cookie)', 1)
    `, [maliciousPartnerId, maliciousSlug]);

    const blockedResult = await monetizationService.resolvePartnerRedirect(maliciousSlug);
    assert(blockedResult === null, 'Malicious javascript: URL blocked by resolvePartnerRedirect()');

    // Insert partner with data: URI scheme
    const dataUriSlug = 'data-uri-partner-' + Date.now();
    const dataPartnerId = 'part-data-' + Date.now();
    await dbAsync.run(`
        INSERT INTO partner_links (id, partner_name, slug, category, destination_url, is_active)
        VALUES (?, 'Phish Corp', ?, 'HARDWARE', 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==', 1)
    `, [dataPartnerId, dataUriSlug]);

    const blockedDataResult = await monetizationService.resolvePartnerRedirect(dataUriSlug);
    assert(blockedDataResult === null, 'Malicious data: URI blocked by resolvePartnerRedirect()');

    // 4. Inactive or Unknown Partner Handling
    console.log('\n--- Test 4: Inactive and Non-existent Slug Handling ---');
    await dbAsync.run("UPDATE partner_links SET is_active = 0 WHERE id = ?", [testPartnerId]);
    const inactiveResult = await monetizationService.resolvePartnerRedirect(testSlug);
    assert(inactiveResult === null, 'Inactive partner link returns null (no redirect)');

    const nonExistentResult = await monetizationService.resolvePartnerRedirect('definitely-not-a-partner-slug-xyz');
    assert(nonExistentResult === null, 'Unknown slug safely returns null');

    // Cleanup
    await dbAsync.run('DELETE FROM partner_links WHERE id IN (?, ?, ?)', [testPartnerId, maliciousPartnerId, dataPartnerId]);

    console.log(`\nPartner Links Results: ${passed} passed, ${failed} failed.`);
    if (failed > 0) process.exit(1);
}

run().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
