/**
 * Phase 16 Test Suite 03: Source Fetch & SSRF Protection
 * ========================================================
 * Validates SSRF defense against localhost, private RFC1918, link-local,
 * and cloud metadata IPs, protocol enforcement, URL normalization,
 * SHA256 hashing, and structured HTML extraction.
 */

'use strict';

const assert = require('assert');
const {
    safeFetchSource,
    normalizeUrl,
    computeContentHash,
    extractHtmlContent,
    isPrivateOrReservedIP
} = require('../../server/services/sourceFetchService.cjs');

async function run() {
    console.log('=== TEST PHASE 16: SOURCE FETCH & SSRF PROTECTION ===');

    // 1. SSRF IP Classifier Tests
    assert(isPrivateOrReservedIP('127.0.0.1'), '127.0.0.1 detected as private');
    assert(isPrivateOrReservedIP('localhost'), 'localhost detected as private');
    assert(isPrivateOrReservedIP('::1'), '::1 detected as private');
    assert(isPrivateOrReservedIP('10.0.0.1'), '10.0.0.0/8 detected as private');
    assert(isPrivateOrReservedIP('172.16.5.10'), '172.16.0.0/12 detected as private');
    assert(isPrivateOrReservedIP('192.168.1.254'), '192.168.0.0/16 detected as private');
    assert(isPrivateOrReservedIP('169.254.169.254'), 'Cloud metadata address (169.254.169.254) blocked');
    assert(!isPrivateOrReservedIP('8.8.8.8'), 'Public IP (8.8.8.8) allowed');
    assert(!isPrivateOrReservedIP('140.82.121.3'), 'Public IP (GitHub) allowed');
    console.log('[PASS] SSRF IP detection correctly classifies loopback, RFC1918, and cloud metadata ranges');

    // 2. safeFetchSource() SSRF Block Verification
    let loopbackBlocked = false;
    try {
        await safeFetchSource('http://127.0.0.1:8080/admin/secrets');
    } catch (err) {
        loopbackBlocked = err.message.includes('SSRF Violation');
    }
    assert(loopbackBlocked, 'safeFetchSource rejected 127.0.0.1 SSRF attempt');

    let metadataBlocked = false;
    try {
        await safeFetchSource('http://169.254.169.254/latest/meta-data/');
    } catch (err) {
        metadataBlocked = err.message.includes('SSRF Violation');
    }
    assert(metadataBlocked, 'safeFetchSource rejected cloud metadata 169.254.169.254 SSRF attempt');

    let protocolBlocked = false;
    try {
        await safeFetchSource('file:///etc/passwd');
    } catch (err) {
        protocolBlocked = err.message.includes('Forbidden protocol');
    }
    assert(protocolBlocked, 'safeFetchSource rejected non-HTTP protocol');
    console.log('[PASS] safeFetchSource rejects loopback, metadata, and file:// protocol targets');

    // 3. URL Normalization
    const dirtyUrl = 'HTTPS://Archive.org/details/pacman-specimen/?utm_source=twitter&utm_medium=social#overview';
    const cleanUrl = normalizeUrl(dirtyUrl);
    assert(cleanUrl === 'https://archive.org/details/pacman-specimen', 'URL normalized: lowercased, tracking stripped, hash removed');
    console.log('[PASS] normalizeUrl() canonicalized URL and stripped tracking parameters');

    // 4. Content Hashing
    const sampleBody = 'Museum Archival Fact Record 1980';
    const hash1 = computeContentHash(sampleBody);
    const hash2 = computeContentHash(sampleBody);
    assert(hash1 === hash2, 'Content hash is deterministic');
    assert(hash1.length === 64, 'SHA-256 produced 64-character hex digest');
    console.log('[PASS] computeContentHash() generated consistent SHA-256 fingerprint');

    // 5. Clean HTML Extraction
    const sampleHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Space Invaders (1978) — Taito Museum Record</title>
            <meta name="author" content="Tomohiro Nishikado">
            <meta property="article:published_time" content="1978-06-01T00:00:00Z">
            <style>.banner { color: red; }</style>
            <script>console.log('strip me');</script>
        </head>
        <body>
            <nav><a href="/">Home</a></nav>
            <main>
                <h1>Space Invaders</h1>
                <p>Space Invaders was developed using an Intel 8080 CPU and discrete sound synthesis.</p>
            </main>
            <footer>Copyright 1978</footer>
        </body>
        </html>
    `;
    const extracted = extractHtmlContent(sampleHtml);
    assert(extracted.title.includes('Space Invaders'), 'Title correctly extracted');
    assert(extracted.author === 'Tomohiro Nishikado', 'Author meta extracted');
    assert(extracted.publishedDate.startsWith('1978-06-01'), 'Published date extracted');
    assert(!extracted.text.includes('strip me'), 'Script tags stripped from body text');
    assert(!extracted.text.includes('.banner'), 'Style tags stripped from body text');
    assert(extracted.text.includes('Intel 8080 CPU'), 'Core body text preserved cleanly');
    console.log('[PASS] extractHtmlContent() cleanly isolated title, author, date, and clean body text');

    console.log('>>> [PASS] ALL SOURCE FETCH & SSRF TESTS PASSED <<<\n');
}

run().catch(err => {
    console.error('[FAIL]', err);
    process.exit(1);
});
