#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 15 Game Media & Resolver Validation Suite
 * 
 * Verifies:
 * 1. Every active game in canonical database has a registered media record
 * 2. Exact breakdown consistency between SQLite and data/media/game-images.json
 * 3. Unified media resolver (resolveGameImage) behavior across local, remote, and fallback
 * 4. Fallback asset exists and renders without 404
 * 5. Dimensions and aspect ratios properly calculated from binary headers
 */

const fs = require('fs');
const path = require('path');
const { dbAsync, db } = require('../../server/db/connection.cjs');
const mediaService = require('../../server/services/mediaService.cjs');

const ROOT = path.resolve(__dirname, '../..');
const REGISTRY_PATH = path.join(ROOT, 'data/media/game-images.json');
const REPORT_PATH = path.join(ROOT, 'docs/PHASE-15-GAME-MEDIA-REPORT.md');

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
    console.log('TEST SUITE: Phase 15 Game Media & Resolver');
    console.log('======================================================================\n');

    // Test 1: Full Catalogue Registered in Database
    console.log('--- Test 1: Database Media Completeness ---');
    const totalGames = (await dbAsync.get('SELECT COUNT(*) as c FROM games')).c;
    const totalImages = (await dbAsync.get('SELECT COUNT(*) as c FROM game_images')).c;
    assert(totalImages >= totalGames, `All ${totalGames} games have a corresponding game_images row (found ${totalImages})`);

    const missingRows = await dbAsync.all(`
        SELECT g.id, g.title, g.slug 
        FROM games g 
        LEFT JOIN game_images gi ON g.id = gi.game_id 
        WHERE gi.id IS NULL
    `);
    assert(missingRows.length === 0, `Zero orphaned games missing game_images entries (found ${missingRows.length})`);

    // Test 2: Canonical Registry JSON Integrity
    console.log('\n--- Test 2: Canonical Media Registry JSON ---');
    assert(fs.existsSync(REGISTRY_PATH), 'data/media/game-images.json exists on disk');
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    assert(registry.totalGames === totalGames, `Registry tracks all ${totalGames} games`);
    assert(registry.counts.verifiedLocal >= 290, `Verified local count is >= 290 (actual: ${registry.counts.verifiedLocal})`);
    assert(registry.counts.missing === 0, 'Registry confirms exactly 0 missing image states');
    assert(fs.existsSync(REPORT_PATH), 'docs/PHASE-15-GAME-MEDIA-REPORT.md exists');

    // Test 3: Media Resolver Verification
    console.log('\n--- Test 3: Unified Media Resolver Hierarchy ---');
    // 3a. Local game resolution
    const localRes = mediaService.resolveGameImage({ slug: 'pac-man' });
    assert(localRes.type === 'LOCAL', `pac-man resolved as LOCAL (got ${localRes.type})`);
    assert(localRes.status === 'VERIFIED_LOCAL', `pac-man status is VERIFIED_LOCAL (got ${localRes.status})`);
    assert(localRes.isFallback === false, 'pac-man is not marked as fallback');
    assert(fs.existsSync(path.join(ROOT, localRes.url.replace(/^\//, ''))), `Local file exists at ${localRes.url}`);

    // 3b. Remote verified resolution
    const remoteGame = await dbAsync.get("SELECT g.*, gi.verification_status, gi.source_domain FROM games g JOIN game_images gi ON g.id = gi.game_id WHERE gi.image_type = 'remote' LIMIT 1");
    if (remoteGame) {
        const remoteRes = mediaService.resolveGameImage(remoteGame);
        assert(remoteRes.type === 'REMOTE', `${remoteGame.title} resolved as REMOTE`);
        assert(remoteRes.status === 'VERIFIED_REMOTE', `${remoteGame.title} status is VERIFIED_REMOTE`);
        assert(remoteRes.isFallback === false, `${remoteGame.title} is not fallback`);
        assert(remoteRes.url.startsWith('http'), `Remote URL is HTTP/HTTPS: ${remoteRes.url}`);
    }

    // 3c. Fallback resolution for game without artwork
    const fallbackRes = mediaService.resolveGameImage({ slug: 'nonexistent-retro-title-9999' });
    assert(fallbackRes.type === 'FALLBACK', 'Unmatched game resolves to FALLBACK');
    assert(fallbackRes.status === 'FALLBACK', 'Unmatched game status is FALLBACK');
    assert(fallbackRes.isFallback === true, 'Unmatched game flagged as isFallback');
    assert(fallbackRes.url.includes('fallback'), `Fallback URL points to fallback asset: ${fallbackRes.url}`);
    assert(fs.existsSync(path.join(ROOT, fallbackRes.url.replace(/^\//, ''))), `Fallback plate asset exists on disk (${fallbackRes.url})`);

    // 3d. Null input handling
    const nullRes = mediaService.resolveGameImage(null);
    assert(nullRes.isFallback === true && nullRes.type === 'FALLBACK', 'Null game input safely returns fallback');

    // Test 4: Binary Header Parsing
    console.log('\n--- Test 4: Binary Header Dimension Extraction ---');
    const pacmanPath = path.join(ROOT, 'assets/images/games/pac-man.jpg');
    if (fs.existsSync(pacmanPath)) {
        const pacBuf = fs.readFileSync(pacmanPath);
        const format = mediaService.detectImageFormat(pacBuf);
        assert(format && (format.format === 'png' || format.format === 'jpeg'), `pac-man.jpg binary magic bytes validated (detected: ${format?.format})`);
        const dim = mediaService.parseImageDimensions(pacBuf, format.format);
        assert(dim && dim.width > 0 && dim.height > 0, `Dimensions parsed successfully: ${dim?.width}x${dim?.height}`);
        assert(dim.aspectRatio !== 'UNKNOWN', `Aspect ratio classified: ${dim?.aspectRatio}`);
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
