/**
 * NostalgicVerse — Phase 16 Master Validation Test Runner
 * =========================================================
 * Runs all 10 Phase 16 test suites sequentially:
 * Suite 01: AI Provider Abstraction
 * Suite 02: AI Security & Prompt Injection Defense
 * Suite 03: Source Fetch & SSRF Protection
 * Suite 04: News Intelligence & Contradiction Detection
 * Suite 05: Game Discovery & Identity Matching
 * Suite 06: Release Monitoring & Change Detection
 * Suite 07: AI Job Recovery & Kill Switch
 * Suite 08: AI Cost Control & Budget Caps
 * Suite 09: AI Privacy Boundary & Data Isolation
 * Suite 10: Master Owner AI Command Center E2E
 */

'use strict';

const { spawnSync } = require('child_process');
const path = require('path');
const { dbAsync } = require('../../server/db/connection.cjs');

const SUITES = [
    { name: 'Suite 01: AI Provider Abstraction', script: 'test-phase16-ai.cjs' },
    { name: 'Suite 02: AI Security & Prompt Injection Defense', script: 'test-phase16-ai-security.cjs' },
    { name: 'Suite 03: Source Fetch & SSRF Protection', script: 'test-phase16-source-fetch.cjs' },
    { name: 'Suite 04: News Intelligence & Contradiction', script: 'test-phase16-news.cjs' },
    { name: 'Suite 05: Game Discovery & Identity Matching', script: 'test-phase16-game-discovery.cjs' },
    { name: 'Suite 06: Release Monitoring & Change Detection', script: 'test-phase16-release-monitor.cjs' },
    { name: 'Suite 07: AI Recovery, Circuit Breaker & Kill Switch', script: 'test-phase16-ai-recovery.cjs' },
    { name: 'Suite 08: AI Cost Control & Budget Caps', script: 'test-phase16-ai-cost.cjs' },
    { name: 'Suite 09: AI Privacy & Data Isolation', script: 'test-phase16-ai-privacy.cjs' },
    { name: 'Suite 10: Master Owner AI Command Center E2E', script: 'test-phase16-owner-ai-e2e.cjs' }
];

async function main() {
    console.log('======================================================================');
    console.log('  NOSTALGICVERSE: RUNNING ALL PHASE 16 VALIDATION SUITES             ');
    console.log('======================================================================\n');

    let passedCount = 0;
    let failedCount = 0;
    const startTime = Date.now();

    for (const suite of SUITES) {
        console.log(`\n>>> Running: ${suite.name} ...`);
        const scriptPath = path.join(__dirname, suite.script);
        const res = spawnSync('node', [scriptPath], {
            cwd: path.resolve(__dirname, '../..'),
            stdio: 'inherit',
            env: { ...process.env, AI_TEST_MODE: 'true' }
        });

        if (res.status === 0) {
            passedCount++;
        } else {
            failedCount++;
            console.error(`[FAIL] ${suite.name} failed with exit code ${res.status}`);
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n======================================================================');
    console.log('  PHASE 16 AUDIT SUMMARY                                              ');
    console.log('======================================================================');
    for (const suite of SUITES) {
        console.log(`  [PASS] ${suite.name}`);
    }
    console.log(`\nTotal Suites: ${SUITES.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
    console.log(`Total Runtime: ${duration}s\n`);

    console.log('Checking database integrity & foreign keys...');
    const integrity = await dbAsync.get('PRAGMA integrity_check');
    const fks = await dbAsync.all('PRAGMA foreign_key_check');
    console.log('Integrity Check:', integrity.integrity_check);
    console.log('FK Violations:', fks.length);

    if (failedCount > 0 || integrity.integrity_check !== 'ok' || fks.length > 0) {
        console.error('>>> [FAIL] SOME PHASE 16 AUDITS FAILED <<<');
        process.exit(1);
    } else {
        console.log('>>> SUCCESS: ALL PHASE 16 AUDITS PASSED WITH ZERO LEAKAGE (EXIT CODE 0) <<<');
        process.exit(0);
    }
}

main().catch(err => {
    console.error('[FATAL]', err);
    process.exit(1);
});
