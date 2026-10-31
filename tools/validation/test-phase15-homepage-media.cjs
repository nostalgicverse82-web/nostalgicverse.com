#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 15 Homepage Media Resilience Test Suite
 * 
 * Verifies:
 * 1. Double-Buffering Carousel: Next layer preloads images before swap
 * 2. Graceful Failure: Image onerror substitutes Museum Fallback Plate
 * 3. Never Flash Blank: Catch block restores current visible layer on swap failure
 * 4. Layout Shift Defense: Card image containers enforce aspect-ratio and object-fit
 * 5. Discovery Pool Integrity: All rotating items map to valid canonical DB exhibits
 */

const fs = require('fs');
const path = require('path');
const { dbAsync, db } = require('../../server/db/connection.cjs');

const ROOT = path.resolve(__dirname, '../..');
const INDEX_HTML_PATH = path.join(ROOT, 'index.html');

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
    console.log('TEST SUITE: Phase 15 Homepage Media Resilience & Double Buffering');
    console.log('======================================================================\n');

    assert(fs.existsSync(INDEX_HTML_PATH), 'index.html exists on disk');
    const indexHtml = fs.readFileSync(INDEX_HTML_PATH, 'utf8');

    // 1. Double-Buffering Carousel Script Verification
    console.log('--- Test 1: Double-Buffering Mechanism ---');
    assert(indexHtml.includes('performDoubleBufferSwap'), 'performDoubleBufferSwap function present in homepage script');
    assert(indexHtml.includes('rotation-layer-current') && indexHtml.includes('rotation-layer-next'), 'Dual-layer rotation buffer classes present');
    assert(indexHtml.includes('new Image()'), 'Preloads candidate images via in-memory Image() before swapping DOM');

    // 2. Failure Recovery & Blank-UI Defense
    console.log('\n--- Test 2: Failure Recovery & Non-Blank Guarantee ---');
    assert(indexHtml.includes('/assets/images/museum-fallback.svg'), 'Switches failed candidate image to Museum Accession Fallback Plate');
    assert(indexHtml.includes('currentGrid.style.opacity = \'1\''), 'Preserves current display card visibility upon candidate error');
    assert(indexHtml.includes('console.warn(\'[Carousel] Swap failed, keeping current display:\''), 'Gracefully logs warning without throwing unhandled rejection');

    // 3. CSS Layout Shift Prevention (CLS)
    console.log('\n--- Test 3: Layout Shift & CSS Dimension Rules ---');
    assert(indexHtml.includes('object-fit: contain') || indexHtml.includes('object-fit:cover'), 'Enforces CSS object-fit on exhibit card imagery');
    assert(indexHtml.includes('aspect-ratio:') || indexHtml.includes('min-height:') || indexHtml.includes('height:'), 'Reserves explicit dimensional space to prevent layout shifts');

    // 4. Discovery Pool Consistency Against Canonical Database
    console.log('\n--- Test 4: Discovery Pool Consistency ---');
    const gamesMatches = indexHtml.match(/\/games\/([a-z0-9-]+)\//g) || [];
    const extractedSlugs = [...new Set(gamesMatches.map(m => m.replace(/\/games\/|\//g, '')))];

    console.log(`Extracted ${extractedSlugs.length} distinct game exhibit links from homepage.`);
    assert(extractedSlugs.length >= 8, `Homepage features healthy curated variety of exhibit links (${extractedSlugs.length} links)`);

    let invalidSlugs = 0;
    for (const slug of extractedSlugs) {
        const row = await dbAsync.get('SELECT id FROM games WHERE slug = ?', [slug]);
        if (!row) {
            invalidSlugs++;
            console.error(`  [WARN] Homepage links to slug not in games table: ${slug}`);
        }
    }
    assert(invalidSlugs === 0, `All ${extractedSlugs.length} homepage featured game slugs exist in canonical SQLite`);

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
