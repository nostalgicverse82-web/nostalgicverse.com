/**
 * Phase 14 Master Test Orchestrator
 * Sequentially executes all 12 Phase 14 Owner Command Center validation suites,
 * tracks pass/fail status, ensures zero database leakage, and asserts zero foreign key violations.
 */

const { execSync } = require('child_process');
const path = require('path');
const { dbAsync } = require('../../server/db/connection.cjs');

const SUITES = [
    { name: 'Suite 01: Owner Dashboard & Overview', file: 'test-phase14-owner-dashboard.cjs' },
    { name: 'Suite 02: User Management & Profiles', file: 'test-phase14-owner-users.cjs' },
    { name: 'Suite 03: Content CMS & Versioning', file: 'test-phase14-owner-content.cjs' },
    { name: 'Suite 04: Submissions & Promotion', file: 'test-phase14-owner-submissions.cjs' },
    { name: 'Suite 05: Support Helpdesk & Threading', file: 'test-phase14-owner-support.cjs' },
    { name: 'Suite 06: Community Moderation', file: 'test-phase14-owner-moderation.cjs' },
    { name: 'Suite 07: Media Registry & Core Asset Guard', file: 'test-phase14-owner-media.cjs' },
    { name: 'Suite 08: Search & SEO Health Center', file: 'test-phase14-owner-search-seo.cjs' },
    { name: 'Suite 09: Job Engine & Allowlist Safety', file: 'test-phase14-owner-jobs.cjs' },
    { name: 'Suite 10: Owner Security & RBAC', file: 'test-phase14-owner-security.cjs' },
    { name: 'Suite 11: Backups & Disaster Recovery', file: 'test-phase14-owner-backup.cjs' },
    { name: 'Suite 12: Master Owner Journey E2E', file: 'test-phase14-owner-e2e.cjs' }
];

async function run() {
    console.log('======================================================================');
    console.log('  PHASE 14 MASTER VALIDATION RUNNER — NOSTALGICVERSE COMMAND CENTER   ');
    console.log('======================================================================\n');

    const startTime = Date.now();
    let passedCount = 0;
    const results = [];

    for (const suite of SUITES) {
        console.log(`>>> Running: ${suite.name} ...`);
        const suitePath = path.join(__dirname, suite.file);
        try {
            execSync(`node "${suitePath}"`, {
                cwd: path.resolve(__dirname, '../../'),
                stdio: 'inherit'
            });
            passedCount++;
            results.push({ name: suite.name, status: 'PASSED' });
        } catch (err) {
            console.error(`[FAILED] ${suite.name} exited with error`);
            results.push({ name: suite.name, status: 'FAILED' });
        }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n======================================================================');
    console.log('  PHASE 14 AUDIT SUMMARY                                              ');
    console.log('======================================================================');
    results.forEach(r => {
        console.log(`  [${r.status === 'PASSED' ? 'PASS' : 'FAIL'}] ${r.name}`);
    });
    console.log(`\nTotal Suites: ${SUITES.length} | Passed: ${passedCount} | Failed: ${SUITES.length - passedCount}`);
    console.log(`Total Runtime: ${duration}s\n`);

    // Verify database integrity post-test
    console.log('Checking database integrity & foreign keys...');
    const integrity = await dbAsync.get('PRAGMA integrity_check');
    const fks = await dbAsync.all('PRAGMA foreign_key_check');
    const users = await dbAsync.all('SELECT username, role FROM users');

    console.log(`Integrity Check: ${integrity.integrity_check}`);
    console.log(`FK Violations: ${fks.length}`);
    console.log(`Remaining Users in DB: ${users.map(u => u.username).join(', ')} (${users.length} total)`);

    if (passedCount === SUITES.length && integrity.integrity_check === 'ok' && fks.length === 0 && users.length === 3) {
        console.log('\n>>> SUCCESS: ALL PHASE 14 AUDITS PASSED WITH ZERO LEAKAGE (EXIT CODE 0) <<<\n');
        process.exit(0);
    } else {
        console.error('\n>>> ERROR: ONE OR MORE AUDITS OR INTEGRITY CHECKS FAILED <<<\n');
        process.exit(1);
    }
}

run().catch(err => {
    console.error('[FATAL RUNNER ERROR]', err);
    process.exit(1);
});

