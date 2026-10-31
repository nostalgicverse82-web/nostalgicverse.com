#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 15 News Intelligence Engine Test Suite
 * 
 * Verifies:
 * 1. Factual statuses (CONFIRMED, OFFICIAL, REPORTED, RUMOR, UNVERIFIED)
 * 2. Source requirement strictly enforced for publication
 * 3. Duplicate headline / story detection
 * 4. Slug collision prevention & slug change history logging
 * 5. Article version audit trail (change_history)
 * 6. Non-destructive cleanup: Test fixtures deleted cleanly
 */

const { dbAsync, db } = require('../../server/db/connection.cjs');
const newsService = require('../../server/services/newsService.cjs');

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
    console.log('TEST SUITE: Phase 15 News Intelligence Engine');
    console.log('======================================================================\n');

    let testArticleId = null;

    try {
        // 1. Validation & Source Requirement Enforcement
        console.log('--- Test 1: News Validation & Publication Source Rules ---');
        
        // 1a. Publishing without a source citation must fail
        let missingSourceBlocked = false;
        try {
            await newsService.createArticle({
                title: 'Unverified Rumor Without Source Test',
                summary: 'Editorial summary of the test article.',
                body: 'Detailed body text for the test article describing archival restoration findings in depth.',
                status: 'PUBLISHED',
                factual_status: 'RUMOR',
                primary_source: null
            });
        } catch (e) {
            missingSourceBlocked = e.message.includes('source');
        }
        assert(missingSourceBlocked, 'Strictly blocked publishing article without verified source citation');

        // 1b. Invalid factual status must fail
        let invalidFactualBlocked = false;
        try {
            await newsService.createArticle({
                title: 'Invalid Factual Status Article',
                status: 'DRAFT',
                factual_status: 'COMPLETELY_FABRICATED'
            });
        } catch (e) {
            invalidFactualBlocked = e.message.includes('factual status');
        }
        assert(invalidFactualBlocked, 'Rejected invalid factual status');

        // 2. Article Creation with Source & Factual Status
        console.log('\n--- Test 2: Article Creation & Versioning ---');
        const article = await newsService.createArticle({
            title: 'Preservation Society Recovers Lost 1974 Arcade Prototype',
            summary: 'Archivists have successfully catalogued an unreleased prototype arcade cabinet.',
            body: 'Detailed curatorial breakdown of the recovered hardware architecture, ROM dump verification, and historical provenance.',
            status: 'PUBLISHED',
            factual_status: 'CONFIRMED',
            primary_source: 'https://archive.org/details/lost-arcade-prototype',
            sources: [{ title: 'Internet Archive Digest', url: 'https://archive.org/details/lost-arcade-prototype', verified: true }],
            related_games: ['game-pong', 'game-breakout']
        });

        testArticleId = article.id;
        assert(article && article.id, `Created article successfully with ID: ${article.id}`);
        assert(article.factual_status === 'CONFIRMED', 'Factual status stored as CONFIRMED');
        assert(article.source_domain === 'archive.org', `Extracted source domain: ${article.source_domain}`);
        assert(Array.isArray(article.sources) && article.sources.length === 1, 'Sources parsed as structured JSON array');
        assert(Array.isArray(article.related_games) && article.related_games.includes('game-pong'), 'Related game references preserved');

        // 3. Duplicate Detection
        console.log('\n--- Test 3: Duplicate Story Detection ---');
        let duplicateBlocked = false;
        try {
            await newsService.createArticle({
                title: 'Preservation Society Recovers Lost 1974 Arcade Prototype',
                status: 'DRAFT'
            });
        } catch (e) {
            duplicateBlocked = e.message.includes('Duplicate article detected');
        }
        assert(duplicateBlocked, 'Detected duplicate article title and blocked creation');

        // 4. Update, Slug Change, and Change History Audit
        console.log('\n--- Test 4: Article Updates & Slug History ---');
        const oldSlug = article.slug;
        const newSlug = `${oldSlug}-expanded-edition`;

        const ownerUser = await dbAsync.get("SELECT id FROM users WHERE role = 'OWNER' LIMIT 1");
        const updated = await newsService.updateArticle(testArticleId, {
            title: 'Preservation Society Recovers Lost 1974 Arcade Prototype (Official Update)',
            slug: newSlug,
            editorial_notes: 'Updated with high-resolution photography'
        }, ownerUser ? ownerUser.id : null);

        assert(updated.slug === newSlug, `Updated slug to: ${updated.slug}`);
        assert(updated.change_history.length >= 2, `Audit trail recorded ${updated.change_history.length} versions`);

        // Verify slug_history entry
        const slugHistoryRow = await dbAsync.get('SELECT * FROM slug_history WHERE entity_id = ? AND old_slug = ?', [testArticleId, oldSlug]);
        assert(slugHistoryRow && slugHistoryRow.new_slug === newSlug, `Recorded URL redirect record in slug_history (${oldSlug} -> ${newSlug})`);

    } finally {
        // Non-destructive cleanup: remove test fixtures
        if (testArticleId) {
            await dbAsync.run('DELETE FROM news_articles WHERE id = ?', [testArticleId]);
            await dbAsync.run('DELETE FROM slug_history WHERE entity_id = ?', [testArticleId]);
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

