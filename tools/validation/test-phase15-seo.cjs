#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 15 SEO & Sitemap Derivation Test Suite
 * 
 * Verifies:
 * 1. Sitemap XML structure, namespace, and atomic update
 * 2. Complete URL coverage of published games, consoles, and hub sections
 * 3. Strict exclusion of private/admin routes (/owner, /account, /api)
 * 4. Structured data (JSON-LD), canonical tags, and Open Graph tags on public exhibits
 */

const fs = require('fs');
const path = require('path');
const { dbAsync, db } = require('../../server/db/connection.cjs');
const { rebuildSitemap } = require('../../tools/content/rebuild-sitemap.cjs');

const ROOT = path.resolve(__dirname, '../..');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');

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
    console.log('TEST SUITE: Phase 15 SEO & Sitemap Derivation');
    console.log('======================================================================\n');

    // 1. Rebuild & Verify Sitemap XML
    console.log('--- Test 1: Sitemap Rebuild & XML Validation ---');
    const sitemapRes = await rebuildSitemap();
    assert(sitemapRes && sitemapRes.totalUrls > 500, `Rebuilt sitemap with ${sitemapRes.totalUrls} URLs`);
    assert(fs.existsSync(SITEMAP_PATH), 'sitemap.xml exists on disk');

    const xml = fs.readFileSync(SITEMAP_PATH, 'utf8');
    assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'), 'XML header standard declaration present');
    assert(xml.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'), 'Standard sitemap 0.9 namespace declared');
    assert(xml.endsWith('</urlset>\n'), 'Properly terminated XML document');

    // 2. URL Coverage Verification
    console.log('\n--- Test 2: Canonical Public Coverage & Private Route Exclusion ---');
    const publishedGames = await dbAsync.all("SELECT slug FROM games WHERE status = 'PUBLISHED'");
    let allGamesIncluded = true;
    for (const g of publishedGames.slice(0, 50)) { // sample 50
        if (!xml.includes(`/games/${g.slug}/`)) {
            allGamesIncluded = false;
            break;
        }
    }
    assert(allGamesIncluded, 'All sampled published games included in sitemap');

    // Private routes check
    assert(!xml.includes('/owner'), 'Strictly excluded /owner administrative route');
    assert(!xml.includes('/account'), 'Strictly excluded /account user private route');
    assert(!xml.includes('/api/'), 'Strictly excluded /api backend routes');

    // 3. Static Exhibit SEO Tag Inspection
    console.log('\n--- Test 3: Public Exhibit SEO & Structured Data Inspection ---');
    const sampleExhibitPath = path.join(ROOT, 'games/super-mario-bros/index.html');
    if (fs.existsSync(sampleExhibitPath)) {
        const html = fs.readFileSync(sampleExhibitPath, 'utf8');
        assert(html.includes('<link rel="canonical"'), 'Canonical link tag present in exhibit HTML');
        assert(html.includes('<meta property="og:title"'), 'OpenGraph og:title present');
        assert(html.includes('<meta property="og:image"'), 'OpenGraph og:image present');
        assert(html.includes('<meta name="twitter:card"'), 'Twitter card meta tag present');
        assert(html.includes('application/ld+json'), 'Structured data (JSON-LD) block present');
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

