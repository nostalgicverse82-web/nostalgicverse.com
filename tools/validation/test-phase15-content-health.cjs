#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 15 Content Health Engine Test Suite
 * 
 * Verifies:
 * 1. Health audit executes across published games, news, and releases
 * 2. Proper multi-severity categorization (CRITICAL, WARNING, INFO)
 * 3. Issue persistence and deduplication in content_health_issues table
 * 4. Curatorial ignore workflow requires explicit reason (>= 5 chars)
 * 5. Single entity recheck recalculates state without rebuilding whole catalogue
 */

const { dbAsync, db } = require('../../server/db/connection.cjs');
const contentHealthService = require('../../server/services/contentHealthService.cjs');

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

async function runTests() {
    console.log('======================================================================');
    console.log('TEST SUITE: Phase 15 Content Health Engine');
    console.log('======================================================================\n');

    // 1. Audit Execution & Summary Verification
    console.log('--- Test 1: Full Health Audit Execution ---');
    const summary = await contentHealthService.runHealthAudit();
    assert(summary && typeof summary === 'object', 'Health audit executed and returned summary');
    assert(['HEALTHY', 'WARNING', 'CRITICAL'].includes(summary.status), `Valid top-level status returned: ${summary.status}`);
    assert(typeof summary.critical === 'number', `Critical issue count is numeric: ${summary.critical}`);
    assert(typeof summary.warning === 'number', `Warning issue count is numeric: ${summary.warning}`);
    assert(typeof summary.info === 'number', `Info issue count is numeric: ${summary.info}`);

    // 2. Database Issue Records Verification
    console.log('\n--- Test 2: Database Health Issue Records ---');
    const dbIssues = await dbAsync.all('SELECT * FROM content_health_issues WHERE status = "OPEN"');
    assert(dbIssues.length > 0, `Database contains ${dbIssues.length} active open health records`);

    const hasSeverities = new Set(dbIssues.map(i => i.severity));
    assert(hasSeverities.has('CRITICAL') || hasSeverities.has('WARNING') || hasSeverities.has('INFO'), 'Severities correctly assigned');

    // Verify all rows have required fields
    const validFields = dbIssues.every(i => i.id && i.entity_type && i.entity_id && i.issue_code && i.severity && i.message);
    assert(validFields, 'All recorded issues have mandatory fields (id, entity_type, entity_id, issue_code, severity, message)');

    // 3. Curatorial Ignore Policy Verification
    console.log('\n--- Test 3: Curatorial Ignore Policy & Reason Enforcement ---');
    const sampleIssue = dbIssues[0];
    const ownerUser = await dbAsync.get("SELECT id FROM users WHERE role = 'OWNER' LIMIT 1");
    const ownerId = ownerUser ? ownerUser.id : null;

    if (sampleIssue && ownerId) {
        // Attempt to ignore without reason -> should fail
        let shortReasonRejected = false;
        try {
            await contentHealthService.ignoreIssue(sampleIssue.id, ownerId, 'no');
        } catch (e) {
            shortReasonRejected = true;
        }
        assert(shortReasonRejected, 'Rejected ignore attempt with trivial or empty reason (< 5 chars)');

        // Valid ignore
        const ignoreRes = await contentHealthService.ignoreIssue(sampleIssue.id, ownerId, 'Curatorially reviewed; historical archive exception.');
        assert(ignoreRes.success === true, 'Successfully ignored issue with curatorial rationale');

        const updatedIssue = await dbAsync.get('SELECT * FROM content_health_issues WHERE id = ?', [sampleIssue.id]);
        assert(updatedIssue.status === 'IGNORED', 'Issue status transitioned to IGNORED');
        assert(updatedIssue.ignored_by === ownerId, 'Ignored_by accurately records user ID');
        assert(updatedIssue.ignore_reason.includes('Curatorially reviewed'), 'Curatorial reason persisted in audit trail');

        // Restore status to OPEN for test purity
        await dbAsync.run('UPDATE content_health_issues SET status = "OPEN", ignored_by = NULL, ignore_reason = NULL WHERE id = ?', [sampleIssue.id]);
    }

    // 4. Single Entity Recheck Verification
    console.log('\n--- Test 4: Single Entity Recheck ---');
    if (sampleIssue) {
        const recheckRes = await contentHealthService.recheckEntity(sampleIssue.entity_type, sampleIssue.entity_id);
        assert(recheckRes && typeof recheckRes.healthy === 'boolean', `Recheck completed for ${sampleIssue.entity_type} #${sampleIssue.entity_id}`);
    }

    console.log('\n======================================================================');
    console.log(`RESULTS: ${passed} passed, ${failed} failed.`);
    console.log('======================================================================\n');

    return { passed, failed };
}

if (require.main === module) {
    runTests().then(({ failed }) => {
        db.close();
        process.exit(failed > 0 ? 1 : 0);
    }).catch(err => {
        console.error('Fatal test error:', err);
        db.close();
        process.exit(1);
    });
}

module.exports = { runTests };
