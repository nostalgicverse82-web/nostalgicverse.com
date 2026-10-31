#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 15 Master Validation Runner
 * 
 * Runs all 10 dedicated Phase 15 automated test suites:
 * 1. test-phase15-media.cjs
 * 2. test-phase15-media-security.cjs
 * 3. test-phase15-content-health.cjs
 * 4. test-phase15-news.cjs
 * 5. test-phase15-releases.cjs
 * 6. test-phase15-search.cjs
 * 7. test-phase15-seo.cjs
 * 8. test-phase15-homepage-media.cjs
 * 9. test-phase15-imports.cjs
 * 10. test-phase15-recovery.cjs
 */

const { spawnSync } = require('child_process');
const path = require('path');

const suites = [
    'test-phase15-media.cjs',
    'test-phase15-media-security.cjs',
    'test-phase15-content-health.cjs',
    'test-phase15-news.cjs',
    'test-phase15-releases.cjs',
    'test-phase15-search.cjs',
    'test-phase15-seo.cjs',
    'test-phase15-homepage-media.cjs',
    'test-phase15-imports.cjs',
    'test-phase15-recovery.cjs',
    'test-phase15-scale-benchmarks.cjs'
];

console.log('======================================================================');
console.log('NOSTALGICVERSE — RUNNING ALL PHASE 15 VALIDATION SUITES');
console.log('======================================================================\n');

let totalPassed = 0;
let totalFailed = 0;
const results = [];

for (const suite of suites) {
    const suitePath = path.join(__dirname, suite);
    process.stdout.write(`Executing ${suite}... `);
    const proc = spawnSync(process.execPath, [suitePath], { encoding: 'utf8', cwd: path.resolve(__dirname, '../..') });

    if (proc.status === 0) {
        console.log('PASSED');
        results.push({ suite, status: 'PASSED' });
        totalPassed++;
    } else {
        console.log('FAILED');
        console.error(proc.stdout || proc.stderr);
        results.push({ suite, status: 'FAILED', output: proc.stdout || proc.stderr });
        totalFailed++;
    }
}

console.log('\n======================================================================');
console.log('PHASE 15 MASTER TEST SUITE SUMMARY');
console.log('======================================================================');
results.forEach(r => {
    console.log(`  [${r.status === 'PASSED' ? 'PASS' : 'FAIL'}] ${r.suite}`);
});
console.log(`\nTotals: ${totalPassed} suites passed, ${totalFailed} suites failed.`);
console.log('======================================================================\n');

process.exit(totalFailed > 0 ? 1 : 0);
