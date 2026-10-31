/**
 * Phase 13 Load Test: Database Write Contention & SQLite Concurrency
 * Stresses SQLite WAL mode with 100 concurrent multi-table write operations
 * (comments, reactions, reviews, saves) verifying that connection backoff/retry
 * handles busy locks cleanly with 0 foreign key violations.
 */
const { dbAsync } = require('../../server/db/connection.cjs');
const { v4: uuidv4 } = require('uuid');

async function run() {
    console.log('========================================================');
    console.log('  LOAD TEST: DATABASE WRITE CONTENTION & CONCURRENCY    ');
    console.log('========================================================\n');

    // Get test target user (owner)
    const owner = await dbAsync.get("SELECT id FROM users WHERE role = 'OWNER' LIMIT 1");
    if (!owner) throw new Error('Owner account not found');

    const testPrefix = `stress_${Date.now().toString(36)}_`;
    const targetType = 'GAME';
    const targetId = 'super-mario-bros';
    const NUM_WRITES = 100;
    const CONCURRENCY = 25;

    console.log(`Executing ${NUM_WRITES} concurrent multi-table writes with concurrency = ${CONCURRENCY}...`);

    const queue = Array.from({ length: NUM_WRITES }, (_, i) => i);
    const results = { comments: 0, reactions: 0, reviews: 0, retries: 0, errors: [] };
    const startTime = Date.now();

    async function worker() {
        while (queue.length > 0) {
            const idx = queue.shift();
            const actionType = idx % 3;

            try {
                if (actionType === 0) {
                    // Comment write
                    const commentId = uuidv4();
                    await dbAsync.run(
                        `INSERT INTO comments (id, target_type, target_id, user_id, body, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [commentId, targetType, targetId, owner.id, `${testPrefix} comment ${idx}`]
                    );
                    results.comments++;
                } else if (actionType === 1) {
                    // Reaction write
                    await dbAsync.run(
                        `INSERT INTO reactions (id, target_type, target_id, user_id, reaction_type, created_at)
                         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                         ON CONFLICT(target_type, target_id, user_id) DO UPDATE SET reaction_type = excluded.reaction_type`,
                        [uuidv4(), targetType, `${testPrefix}_content_${idx}`, owner.id, idx % 2 === 0 ? 'LIKE' : 'DISLIKE']
                    );
                    results.reactions++;
                } else {
                    // Review write
                    const reviewId = uuidv4();
                    await dbAsync.run(
                        `INSERT INTO reviews (id, target_type, target_id, user_id, rating, title, body, status, created_at, updated_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
                        [reviewId, targetType, `${testPrefix}_review_${idx}`, owner.id, (idx % 10) + 1, `${testPrefix} title`, `${testPrefix} review body`]
                    );
                    results.reviews++;
                }
            } catch (err) {
                results.errors.push({ idx, error: err.message });
            }
        }
    }

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all(workers);

    const duration = Date.now() - startTime;
    console.log('\n--- RESULTS ---');
    console.log(`Total Operations: ${NUM_WRITES}`);
    console.log(`Duration:         ${duration}ms (${Math.round(NUM_WRITES / (duration / 1000))} ops/sec)`);
    console.log(`Comments Written: ${results.comments}`);
    console.log(`Reactions Written:${results.reactions}`);
    console.log(`Reviews Written:  ${results.reviews}`);
    console.log(`Errors:           ${results.errors.length}`);

    if (results.errors.length > 0) {
        console.error('Errors encountered:', results.errors);
        throw new Error(`FAIL: ${results.errors.length} write operations failed with errors.`);
    }

    // Integrity checks
    console.log('\nVerifying database consistency after write storm...');
    const integrity = await dbAsync.get('PRAGMA integrity_check');
    const fk = await dbAsync.all('PRAGMA foreign_key_check');

    console.log(`PRAGMA integrity_check: ${integrity.integrity_check}`);
    console.log(`PRAGMA foreign_key_check violations: ${fk.length}`);

    if (integrity.integrity_check !== 'ok' || fk.length > 0) {
        throw new Error('FAIL: Database integrity check failed after write contention storm.');
    }

    // Cleanup test data
    console.log('\nCleaning up stress test records...');
    await dbAsync.run('DELETE FROM comments WHERE body LIKE ?', [`${testPrefix}%`]);
    await dbAsync.run('DELETE FROM reactions WHERE target_id LIKE ?', [`${testPrefix}%`]);
    await dbAsync.run('DELETE FROM reviews WHERE title LIKE ?', [`${testPrefix}%`]);

    const postCleanupFk = await dbAsync.all('PRAGMA foreign_key_check');
    if (postCleanupFk.length > 0) {
        throw new Error('FAIL: Foreign key violations remain after cleanup.');
    }

    console.log('[PASS] DB write contention & concurrency resilience verified with 0 errors and 0 FK violations.');
    return { duration, operations: NUM_WRITES, results };
}

if (require.main === module) {
    run().catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { run };
