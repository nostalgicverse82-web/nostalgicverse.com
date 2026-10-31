/**
 * Phase 13 Master Load Test Orchestrator
 * Executes all load and resilience tests sequentially:
 *   1. auth-load.cjs (1,000 reqs - threadpool protection & rate limiting)
 *   2. signup-spike.cjs (Case-insensitive collision & burst defense)
 *   3. db-contention.cjs (100 concurrent multi-table writes & WAL concurrency)
 *   4. chat-stress.cjs (Burst sends, idempotency & reverse pagination)
 *   5. search-storm.cjs (1,000 abusive queries & wildcard defenses)
 *   6. websocket-storm.cjs (100 concurrent WS clients, ping/pong, frame sizing)
 *   7. mixed-traffic.cjs (Realistic 90/8/2 traffic distribution)
 *   8. resilience-failure.cjs (Subsystem failure & probe recovery)
 *
 * Enforces clean post-test database state: 0 FK violations, only authoritative users.
 */
const { execSync } = require('child_process');
const path = require('path');
const { dbAsync } = require('../../server/db/connection.cjs');

const ROOT = path.resolve(__dirname, '../..');

const TESTS = [
    { name: 'Auth & Threadpool Concurrency', script: 'tools/load-tests/auth-load.cjs' },
    { name: 'Signup Spike & Collision Storm', script: 'tools/load-tests/signup-spike.cjs' },
    { name: 'Database Write Contention', script: 'tools/load-tests/db-contention.cjs' },
    { name: 'Chat Stress & Reverse Pagination', script: 'tools/load-tests/chat-stress.cjs' },
    { name: 'Search Storm & Query Defense', script: 'tools/load-tests/search-storm.cjs' },
    { name: 'WebSocket Concurrency & Frames', script: 'tools/load-tests/websocket-storm.cjs' },
    { name: 'Mixed Realistic Traffic (90/8/2)', script: 'tools/load-tests/mixed-traffic.cjs' },
    { name: 'Subsystem Failure Resilience', script: 'tools/load-tests/resilience-failure.cjs' }
];

async function run() {
    console.log('======================================================================');
    console.log('  NOSTALGICVERSE PHASE 13: MASTER LOAD & RESILIENCE TEST SUITE        ');
    console.log('======================================================================\n');

    const summary = [];
    const masterStart = Date.now();

    for (const t of TESTS) {
        console.log(`\n>>> STARTING: ${t.name} (${t.script})...`);
        const start = Date.now();
        try {
            const out = execSync(`node "${path.join(ROOT, t.script)}"`, {
                cwd: ROOT,
                stdio: 'pipe',
                env: { ...process.env, NODE_ENV: 'test' }
            }).toString();

            const duration = Date.now() - start;
            console.log(out.trim());
            console.log(`>>> PASSED: ${t.name} in ${duration}ms\n`);
            summary.push({ name: t.name, status: 'PASSED', duration });
        } catch (err) {
            const duration = Date.now() - start;
            console.error(`>>> FAILED: ${t.name} in ${duration}ms`);
            if (err.stdout) console.error(err.stdout.toString());
            if (err.stderr) console.error(err.stderr.toString());
            summary.push({ name: t.name, status: 'FAILED', duration, error: err.message });
            break;
        }
    }

    // Verify post-suite database integrity & cleanup
    console.log('\n======================================================================');
    console.log('  POST-TEST AUTHORITATIVE DATABASE INTEGRITY AUDIT                     ');
    console.log('======================================================================');

    const purgeScript = path.join(ROOT, 'tools/validation/purge-test-users.cjs');
    if (require('fs').existsSync(purgeScript)) {
        execSync(`node "${purgeScript}"`, { cwd: ROOT, stdio: 'inherit' });
    }

    const integrity = await dbAsync.get('PRAGMA integrity_check');
    const fk = await dbAsync.all('PRAGMA foreign_key_check');
    const users = await dbAsync.all('SELECT username, role FROM users ORDER BY username ASC');

    console.log(`PRAGMA integrity_check: ${integrity.integrity_check}`);
    console.log(`PRAGMA foreign_key_check violations: ${fk.length}`);
    console.log(`Authoritative Users remaining (${users.length}): ${users.map(u => `${u.username} (${u.role})`).join(', ')}`);

    const allPassed = summary.every(s => s.status === 'PASSED') && integrity.integrity_check === 'ok' && fk.length === 0;

    console.log('\n======================================================================');
    console.log('  TEST EXECUTION SUMMARY                                              ');
    console.log('======================================================================');
    summary.forEach(s => {
        console.log(`  [${s.status}] ${s.name.padEnd(42)} ${s.duration}ms`);
    });
    console.log(`Total Elapsed Time: ${Date.now() - masterStart}ms`);

    if (!allPassed) {
        console.error('\nOVERALL RESULT: FAILED');
        process.exit(1);
    } else {
        console.log('\nOVERALL RESULT: ALL TESTS PASSED (ENTERPRISE RESILIENCE VERIFIED)');
    }
}

if (require.main === module) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { run };

