#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 15 Release Intelligence Test Suite
 * 
 * Verifies:
 * 1. Release validation & allowable factual statuses
 * 2. Date precision validation (EXACT, MONTH_YEAR, YEAR, TBA)
 * 3. Game reference integrity (foreign key validation against canonical games)
 * 4. Change history audit trail recording field-level deltas
 * 5. Clean teardown of test fixtures
 */

const { dbAsync, db } = require('../../server/db/connection.cjs');
const releaseService = require('../../server/services/releaseService.cjs');

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
    console.log('TEST SUITE: Phase 15 Release Intelligence Engine');
    console.log('======================================================================\n');

    let testReleaseId = null;

    try {
        // 1. Validation & Constraint Enforcement
        console.log('--- Test 1: Release Data Validation ---');
        
        let invalidStatusBlocked = false;
        try {
            await releaseService.createRelease({
                title: 'Invalid Status Release',
                status: 'RELEASED_SOMETIME_MAYBE'
            });
        } catch (e) {
            invalidStatusBlocked = e.message.includes('Invalid release status');
        }
        assert(invalidStatusBlocked, 'Strictly blocked release with fabricated or invalid status');

        let invalidPrecisionBlocked = false;
        try {
            await releaseService.createRelease({
                title: 'Invalid Precision Release',
                status: 'COMING_SOON',
                date_precision: 'GUESSWORK'
            });
        } catch (e) {
            invalidPrecisionBlocked = e.message.includes('Invalid date precision');
        }
        assert(invalidPrecisionBlocked, 'Strictly blocked invalid date precision');

        let invalidGameRefBlocked = false;
        try {
            await releaseService.createRelease({
                title: 'Ghost Game Release',
                game_id: 'nonexistent-game-uuid-99999',
                status: 'ANNOUNCED'
            });
        } catch (e) {
            invalidGameRefBlocked = e.message.includes('does not exist');
        }
        assert(invalidGameRefBlocked, 'Blocked release referencing nonexistent canonical game');

        // 2. Canonical Release Creation
        console.log('\n--- Test 2: Release Creation with Precision & History ---');
        // Find a real canonical game to reference
        const sampleGame = await dbAsync.get("SELECT id, title FROM games WHERE slug = 'pac-man'");
        assert(sampleGame && sampleGame.id, `Loaded canonical game reference: ${sampleGame?.title}`);

        const ownerUser = await dbAsync.get("SELECT id FROM users WHERE role = 'OWNER' LIMIT 1");
        const ownerId = ownerUser ? ownerUser.id : null;

        const created = await releaseService.createRelease({
            title: 'Pac-Man Museum+ Regional Remaster',
            game_id: sampleGame.id,
            platform: 'Nintendo Switch',
            region: 'North America',
            edition: 'Physical Collector Archive',
            status: 'COMING_SOON',
            date_precision: 'MONTH_YEAR',
            release_date: '2026-11',
            source: 'https://press.bandainamcoent.com/pac-man-announcement',
            notes: 'Curatorial archive verification of physical cartridge release.'
        }, ownerId);

        testReleaseId = created.id;
        assert(created && created.id, `Created release record successfully with ID: ${created.id}`);
        assert(created.status === 'COMING_SOON', 'Status recorded as COMING_SOON');
        assert(created.date_precision === 'MONTH_YEAR', 'Date precision recorded as MONTH_YEAR');
        assert(Array.isArray(created.change_history) && created.change_history.length === 1, 'Initial creation logged in change_history');

        // 3. Status Transition & Audit Trail Verification
        console.log('\n--- Test 3: Status Transition & Audit Trail Verification ---');
        const updated = await releaseService.updateRelease(testReleaseId, {
            status: 'RELEASED',
            date_precision: 'EXACT',
            release_date: '2026-11-15',
            notes: 'Street date confirmed and archival copy accessioned.'
        }, ownerId);

        assert(updated.status === 'RELEASED', 'Status successfully transitioned to RELEASED');
        assert(updated.date_precision === 'EXACT', 'Date precision updated to EXACT');
        assert(updated.release_date === '2026-11-15', 'Full release date recorded');
        assert(updated.change_history.length === 2, `Audit trail recorded 2 versions (got ${updated.change_history.length})`);

        const delta = updated.change_history[1].changes;
        assert(delta.status && delta.status.old === 'COMING_SOON' && delta.status.new === 'RELEASED', 'Audit log records old -> new status transition');

    } finally {
        // Cleanup test fixtures
        if (testReleaseId) {
            await dbAsync.run('DELETE FROM releases WHERE id = ?', [testReleaseId]);
        }
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

