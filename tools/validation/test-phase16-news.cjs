/**
 * Phase 16 Test Suite 04: News Intelligence, Duplication & Contradiction Detection
 * =================================================================================
 * Validates candidate ingestion, duplicate suppression, multi-source contradiction
 * detection (conflicting claims -> CONFLICT status), and owner publication to live museum.
 */

'use strict';

const assert = require('assert');
const { dbAsync } = require('../../server/db/connection.cjs');
const {
    ingestNewsCandidate,
    checkNewsDuplicate,
    publishNewsCandidate
} = require('../../server/services/newsIntelligenceService.cjs');

async function run() {
    console.log('=== TEST PHASE 16: NEWS INTELLIGENCE & CONTRADICTION DETECTION ===');

    const testPrefix = `test_news_${Date.now()}`;
    const testTitleA = `Milestone Arcade Synthesis: ${testPrefix}`;
    const sourceA = `https://archive.org/specimen/${testPrefix}-a`;
    const sourceB = `https://archive.org/specimen/${testPrefix}-b`;

    let candidateIdA = null;
    let candidateIdB = null;
    let articleId = null;

    try {
        // 1. Ingest Initial Candidate with Claim 1 (Release Year = 1978)
        const resA = await ingestNewsCandidate({
            title: testTitleA,
            sourceUrl: sourceA,
            customText: 'Initial historical documentation establishing milestone release in 1978.',
            factualStatus: 'CONFIRMED',
            claims: [
                { fieldName: 'release_year', value: '1978', sourceUrl: sourceA }
            ]
        });

        candidateIdA = resA.candidateId;
        assert(resA.status === 'DRAFTED', 'Initial candidate ingested with DRAFTED status');
        assert(resA.factualStatus === 'CONFIRMED', 'Initial factual status is CONFIRMED');
        assert(!resA.isDuplicate, 'Initial candidate is not a duplicate');
        console.log('[PASS] Initial news candidate successfully ingested and claims recorded');

        // 2. Duplicate Detection: Attempt to ingest same title
        const dupCheck = await checkNewsDuplicate(testTitleA, sourceA, 'some_hash');
        assert(dupCheck.isDuplicate === true, 'Duplicate candidate detected by title');
        console.log('[PASS] checkNewsDuplicate() correctly flagged identical story title');

        // 3. Contradiction Detection: Ingest differing claim for same entity (Release Year = 1982)
        const resB = await ingestNewsCandidate({
            title: `Contradicting Claim: ${testPrefix}`,
            sourceUrl: sourceB,
            customText: 'Second source claiming alternative launch year of 1982.',
            factualStatus: 'REPORTED',
            claims: [
                { fieldName: 'release_year', value: '1982', sourceUrl: sourceB }
            ]
        });

        candidateIdB = resB.candidateId;

        // Force cross-entity contradiction check against Candidate A's claim
        const { detectNewsContradictions } = require('../../server/services/newsIntelligenceService.cjs');
        const conflicts = await detectNewsContradictions(candidateIdA, [
            { fieldName: 'release_year', value: '1982', sourceUrl: sourceB }
        ]);

        assert(conflicts.length > 0, 'Cross-source contradiction detected between 1978 and 1982');
        console.log('[PASS] Contradicting factual claims detected across sources:', conflicts[0]);

        // Verify conflict recorded in content_conflicts table
        const conflictRow = await dbAsync.get('SELECT * FROM content_conflicts WHERE entity_id = ? AND field_name = "release_year"', [candidateIdA]);
        assert(conflictRow && conflictRow.status === 'OPEN', 'Conflict persisted with OPEN status in content_conflicts');
        assert(conflictRow.source_a_value === '1978' && conflictRow.source_b_value === '1982', 'Both conflicting values recorded for owner review');
        console.log('[PASS] content_conflicts table holds conflicting values for owner adjudication');

        // 4. Owner Review & Publication
        const pubResult = await publishNewsCandidate(candidateIdA, 'owner', {
            title: `Published Retrospective: ${testPrefix}`,
            resolveConflict: true
        });

        articleId = pubResult.articleId;
        assert(pubResult.success === true, 'Owner publication succeeded');

        // Verify canonical news_articles entry
        const article = await dbAsync.get('SELECT * FROM news_articles WHERE id = ?', [articleId]);
        assert(article && article.title.includes(testPrefix), 'Article saved to canonical news_articles');

        // Verify conflict resolved
        const resolvedConflict = await dbAsync.get('SELECT status FROM content_conflicts WHERE entity_id = ?', [candidateIdA]);
        assert(resolvedConflict.status === 'RESOLVED', 'Associated contradiction resolved on owner approval');
        console.log('[PASS] Owner approval published article and atomically resolved conflict');

        console.log('>>> [PASS] ALL NEWS INTELLIGENCE & CONTRADICTION TESTS PASSED <<<\n');
    } finally {
        // Clean up ephemeral test records
        if (candidateIdA) {
            await dbAsync.run('DELETE FROM news_candidates WHERE id = ?', [candidateIdA]);
            await dbAsync.run('DELETE FROM content_claims WHERE entity_id = ?', [candidateIdA]);
            await dbAsync.run('DELETE FROM content_conflicts WHERE entity_id = ?', [candidateIdA]);
            await dbAsync.run('DELETE FROM ai_jobs WHERE entity_id = ?', [candidateIdA]);
        }
        if (candidateIdB) {
            await dbAsync.run('DELETE FROM news_candidates WHERE id = ?', [candidateIdB]);
            await dbAsync.run('DELETE FROM content_claims WHERE entity_id = ?', [candidateIdB]);
            await dbAsync.run('DELETE FROM ai_jobs WHERE entity_id = ?', [candidateIdB]);
        }
        if (articleId) {
            await dbAsync.run('DELETE FROM news_articles WHERE id = ?', [articleId]);
        }
    }
}

run().catch(err => {
    console.error('[FAIL]', err);
    process.exit(1);
});
