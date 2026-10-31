#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 18 Master Validation Test Runner
 * =======================================================
 * Executes all 10 Phase 18 validation test suites sequentially:
 * 1. Business Core, DB Schema & Minor Units
 * 2. Feature Flags & Emergency Kill Switch
 * 3. Membership Plans & Server Entitlements
 * 4. Payment Provider Abstraction & Webhooks
 * 5. Voluntary Donations & Supporter Recognition
 * 6. Sponsors & Ethical Advertising
 * 7. Verified Partner Links & Safe Outbound Redirects
 * 8. Owner Business Center & Audited Management
 * 9. Revenue Analytics, Funnels & Zero Fake Data
 * 10. Security, Fraud & Tampering Defenses
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
    { name: 'Suite 1: Business Core & Schema', file: 'test-phase18-business-core.cjs' },
    { name: 'Suite 2: Feature Flags & Kill Switch', file: 'test-phase18-feature-flags.cjs' },
    { name: 'Suite 3: Plans & Entitlements', file: 'test-phase18-plans-entitlements.cjs' },
    { name: 'Suite 4: Payment Provider & Webhooks', file: 'test-phase18-payment-provider.cjs' },
    { name: 'Suite 5: Voluntary Donations', file: 'test-phase18-donations.cjs' },
    { name: 'Suite 6: Sponsors & Ethical Ads', file: 'test-phase18-sponsors-ads.cjs' },
    { name: 'Suite 7: Partner Links & Redirects', file: 'test-phase18-partner-links.cjs' },
    { name: 'Suite 8: Owner Business Center', file: 'test-phase18-owner-business.cjs' },
    { name: 'Suite 9: Revenue Analytics & Funnels', file: 'test-phase18-revenue-analytics.cjs' },
    { name: 'Suite 10: Security & Fraud Defenses', file: 'test-phase18-security-fraud.cjs' }
];

console.log('======================================================================');
console.log('NOSTALGICVERSE — PHASE 18 COMPREHENSIVE BUSINESS ENGINE TEST HARNESS');
console.log('======================================================================\n');

let totalPassedSuites = 0;
let totalFailedSuites = 0;
const results = [];

for (const suite of suites) {
    const fullPath = path.join(__dirname, suite.file);
    console.log(`>>> Running ${suite.name} (${suite.file})...`);

    const start = Date.now();
    const result = spawnSync('node', [fullPath], {
        encoding: 'utf8',
        stdio: 'inherit',
        cwd: path.resolve(__dirname, '../..')
    });
    const duration = ((Date.now() - start) / 1000).toFixed(2);

    if (result.status === 0) {
        console.log(`>>> ${suite.name}: PASSED (${duration}s)\n`);
        totalPassedSuites++;
        results.push({ ...suite, status: 'PASS', duration });
    } else {
        console.error(`>>> ${suite.name}: FAILED (code ${result.status}, ${duration}s)\n`);
        totalFailedSuites++;
        results.push({ ...suite, status: 'FAIL', duration });
    }
}

console.log('======================================================================');
console.log('PHASE 18 VALIDATION SUMMARY MATRIX');
console.log('======================================================================');
results.forEach(r => {
    const mark = r.status === 'PASS' ? '✓ PASS' : '✗ FAIL';
    console.log(`  [${mark}] ${r.name.padEnd(42)} (${r.duration}s)`);
});
console.log('----------------------------------------------------------------------');
console.log(`Total Suites: ${suites.length} | Passed: ${totalPassedSuites} | Failed: ${totalFailedSuites}`);
console.log('======================================================================\n');

if (totalFailedSuites > 0) {
    console.error('Phase 18 Validation FAILED. Please review output above.');
    process.exit(1);
} else {
    console.log('All 10 Phase 18 Validation Suites PASSED with 100% SUCCESS.');
    process.exit(0);
}
