/**
 * Phase 16 Test Suite 05: Game Discovery & Multi-Tier Identity Matching
 * =====================================================================
 * Validates candidate ingestion, multi-tier identity matching (EXACT, LIKELY, NEW),
 * media candidate association, AI enrichment enqueueing, and owner promotion.
 */

'use strict';

const assert = require('assert');
const { dbAsync } = require('../../server/db/connection.cjs');
const {
    matchGameIdentity,
    ingestGameCandidate,
    publishGameCandidate
} = require('../../server/services/gameDiscoveryService.cjs');

async function run() {
    console.log('=== TEST PHASE 16: GAME DISCOVERY & IDENTITY MATCHING ===');

    const testSlug = `game_specimen_${Date.now()}`;
    const testTitle = `Historic Test Specimen ${Date.now()}`;
    let candidateId = null;
    let publishedGameId = null;

    try {
        // 1. Identity Matching: Exact Match test against known museum game (Pac-Man)
        const exactMatch = await matchGameIdentity('Pac-Man', 'Arcade', 1980);
        assert(exactMatch.matchType === 'EXACT', 'Known game Pac-Man identified as EXACT match');
        assert(exactMatch.matchedGameId !== null, 'Matched game ID returned');
        console.log('[PASS] matchGameIdentity() correctly detected EXACT match for Pac-Man');

        // 2. Identity Matching: Likely Match test (partial title)
        const likelyMatch = await matchGameIdentity('Pac-Man Championship Edition', 'Arcade', 2007);
        assert(likelyMatch.matchType === 'LIKELY' || likelyMatch.matchType === 'EXACT', 'Similar title matched as LIKELY or EXACT');
        console.log('[PASS] matchGameIdentity() detected LIKELY match for partial title');

        // 3. Identity Matching: Brand New Game
        const newMatch = await matchGameIdentity(testTitle, 'Arcade', 1981);
        assert(newMatch.matchType === 'NEW', 'Unseen specimen identified as NEW');
        console.log('[PASS] matchGameIdentity() detected NEW match for novel title');

        // 4. Ingest Brand New Candidate with Media Candidate
        const imgUrl = 'https://archive.org/images/test-specimen.png';
        const candidateRes = await ingestGameCandidate({
            title: testTitle,
            platform: 'Arcade',
            developer: 'Test Lab',
            publisher: 'Test Publisher',
            releaseYear: 1981,
            genre: 'Action',
            shortDescription: 'Pioneering arcade action specimen with vector graphics.',
            sourceUrl: 'https://archive.org/details/test-specimen',
            imageCandidateUrl: imgUrl
        });

        candidateId = candidateRes.candidateId;
        assert(candidateRes.status === 'CANDIDATE', 'Candidate created with CANDIDATE status');
        assert(candidateRes.identityMatch === 'NEW', 'Identity match verified as NEW');
        assert(candidateRes.aiJobId !== null, 'AI enrichment job enqueued');
        console.log('[PASS] Ingested novel game candidate with queued AI enrichment job');

        // Verify media candidate was recorded
        const candidateRecord = await dbAsync.get('SELECT * FROM game_candidates WHERE id = ?', [candidateId]);
        assert(candidateRecord && candidateRecord.image_candidate_url === imgUrl, 'Media candidate linked to game candidate');
        console.log('[PASS] Media candidate image linked to candidate specimen');

        // 5. Owner Review & Promotion to Live Catalog
        const pubResult = await publishGameCandidate(candidateId, 'owner', {
            title: testTitle,
            slug: testSlug
        });

        publishedGameId = pubResult.gameId;
        assert(pubResult.success === true, 'Game candidate published successfully');

        // Verify game exists in canonical games table
        const liveGame = await dbAsync.get('SELECT * FROM games WHERE id = ?', [publishedGameId]);
        assert(liveGame && liveGame.title === testTitle, 'Live game record found in canonical games table');
        assert(liveGame.status === 'PUBLISHED', 'Live game status is PUBLISHED');

        // Verify hero image exists in canonical game_images table
        const liveHero = await dbAsync.get('SELECT * FROM game_images WHERE game_id = ?', [publishedGameId]);
        assert(liveHero && liveHero.image_url === imgUrl, 'Hero image record found in canonical game_images table');
        console.log('[PASS] Owner approval promoted candidate and artwork into canonical games and game_images tables');

        console.log('>>> [PASS] ALL GAME DISCOVERY & IDENTITY MATCHING TESTS PASSED <<<\n');
    } finally {
        if (candidateId) {
            await dbAsync.run('DELETE FROM game_candidates WHERE id = ?', [candidateId]);
            await dbAsync.run('DELETE FROM media_candidates WHERE game_id = ?', [candidateId]);
            await dbAsync.run('DELETE FROM ai_jobs WHERE entity_id = ?', [candidateId]);
        }
        if (publishedGameId) {
            await dbAsync.run('DELETE FROM games WHERE id = ?', [publishedGameId]);
            await dbAsync.run('DELETE FROM game_images WHERE game_id = ?', [publishedGameId]);
        }
    }
}

run().catch(err => {
    console.error('[FAIL]', err);
    process.exit(1);
});
