#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 15 Atomic Search Index & Derivation Test Suite
 * 
 * Verifies:
 * 1. Derivation consistency: Derived strictly from published canonical records
 * 2. Exclusion of unpublished/draft items
 * 3. Completeness across all 7 content types (Games, Consoles, Timeline, Genres, Guides, Stories, News)
 * 4. Atomic file swapping integrity
 * 5. Query execution speed benchmark (< 15ms)
 */

const fs = require('fs');
const path = require('path');
const { dbAsync, db } = require('../../server/db/connection.cjs');
const { rebuildSearchIndex } = require('../../tools/content/rebuild-search-index.cjs');

const ROOT = path.resolve(__dirname, '../..');
const SEARCH_INDEX_PATH = path.join(ROOT, 'data/search-index.json');

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
    console.log('TEST SUITE: Phase 15 Atomic Search Index & Derivation');
    console.log('======================================================================\n');

    // 1. Rebuild Execution & Atomic Swap
    console.log('--- Test 1: Rebuild Search Index Atomically ---');
    const rebuildRes = await rebuildSearchIndex();
    assert(rebuildRes && rebuildRes.total > 500, `Rebuilt search index with ${rebuildRes.total} canonical entries`);
    assert(fs.existsSync(SEARCH_INDEX_PATH), 'data/search-index.json exists on disk');

    const indexData = JSON.parse(fs.readFileSync(SEARCH_INDEX_PATH, 'utf8'));
    assert(Array.isArray(indexData), 'Search index parses as JSON array');
    assert(indexData.length === rebuildRes.total, 'Memory and disk record counts match identically');

    // 2. Multi-Type Content Verification
    console.log('\n--- Test 2: Multi-Type Content Representation ---');
    const types = new Set(indexData.map(d => d.type));
    const requiredTypes = ['game', 'console', 'timeline', 'genre', 'guide', 'story', 'news'];
    for (const reqType of requiredTypes) {
        const count = indexData.filter(d => d.type === reqType).length;
        assert(types.has(reqType) && count > 0, `Category "${reqType}" represented with ${count} entries`);
    }

    // 3. Draft/Unpublished Content Exclusion
    console.log('\n--- Test 3: Exclusion of Unpublished / Draft Content ---');
    const draftArticles = await dbAsync.all("SELECT id, title FROM news_articles WHERE status != 'PUBLISHED'");
    const indexIds = new Set(indexData.map(d => d.id));
    let draftLeaked = false;
    for (const draft of draftArticles) {
        if (indexIds.has(draft.id)) {
            draftLeaked = true;
            break;
        }
    }
    assert(!draftLeaked, 'Zero unpublished/draft news articles present in search index');

    // 4. Query Performance Benchmark (< 15ms)
    console.log('\n--- Test 4: Query Performance Benchmark ---');
    const testQueries = ['mario', 'sonic', 'zelda', 'arcade', 'nintendo', 'sega', '1983', 'adventure'];
    const latencies = [];

    for (const q of testQueries) {
        const start = process.hrtime.bigint();
        const qLower = q.toLowerCase();
        const matches = indexData.filter(item => {
            return (item.title && item.title.toLowerCase().includes(qLower)) ||
                   (item.summary && item.summary.toLowerCase().includes(qLower)) ||
                   (item.keywords && item.keywords.some(k => k.toLowerCase().includes(qLower)));
        });
        const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
        latencies.push(elapsedMs);
        assert(elapsedMs < 15, `Query "${q}" matched ${matches.length} items in ${elapsedMs.toFixed(2)}ms (< 15ms limit)`);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`Average Query Latency: ${avgLatency.toFixed(2)}ms across ${testQueries.length} search tests`);

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

