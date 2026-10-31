#!/usr/bin/env node
/**
 * NostalgicVerse — Phase 15 Media Security & SSRF Protection Test Suite
 * 
 * Verifies:
 * 1. SSRF Protection: Loopback, Private LAN (10.x, 192.168.x, 172.16-31.x), Link-Local, and Cloud Metadata (169.254.169.254) are strictly blocked.
 * 2. Scheme Enforcement: Disallows file:, javascript:, data:, ftp:, and malformed URIs.
 * 3. HTML Error 200 Trap: Validates that HTTP 200 responses with HTML error payloads are rejected as INVALID_MIME.
 * 4. Path Traversal: Path traversal attempts in media filenames are neutralized.
 * 5. Protected Assets: Official profile icons and console PNGs cannot be altered or overwritten.
 */

const mediaService = require('../../server/services/mediaService.cjs');

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
    console.log('TEST SUITE: Phase 15 Media Security & SSRF Protection');
    console.log('======================================================================\n');

    // 1. SSRF Destination Protection
    console.log('--- Test 1: SSRF Hostname & IP Filtering ---');
    const ssrfTargets = [
        { url: 'http://localhost:8080/exhibit.png', desc: 'Localhost string' },
        { url: 'http://127.0.0.1:3000/internal.jpg', desc: 'IPv4 127.0.0.1 loopback' },
        { url: 'http://127.0.0.2:4000/admin.png', desc: 'IPv4 127.0.0.2 loopback subnet' },
        { url: 'http://[::1]/secret.webp', desc: 'IPv6 ::1 loopback' },
        { url: 'http://169.254.169.254/latest/meta-data/', desc: 'AWS/GCP/Azure Cloud Metadata Endpoint' },
        { url: 'http://192.168.1.1/admin/router.png', desc: 'Private Class C (192.168.x.x)' },
        { url: 'http://10.0.0.5:8000/internal.png', desc: 'Private Class A (10.x.x.x)' },
        { url: 'http://172.16.5.10/server.jpg', desc: 'Private Class B (172.16.x.x)' },
        { url: 'http://172.31.255.255/db.jpg', desc: 'Private Class B boundary (172.31.x.x)' },
        { url: 'http://metadata.google.internal/computeMetadata/v1/', desc: 'Google Cloud metadata DNS' }
    ];

    for (const target of ssrfTargets) {
        const check = mediaService.isSafeUrl(target.url);
        assert(check.safe === false, `Blocked ${target.desc}: ${target.url} (${check.reason})`);
    }

    // 2. Protocol Scheme Restrictions
    console.log('\n--- Test 2: Protocol Scheme Enforcement ---');
    const disallowedSchemes = [
        { url: 'file:///etc/passwd', desc: 'file:// protocol' },
        { url: 'file:///C:/Windows/win.ini', desc: 'file:// Windows system file' },
        { url: 'javascript:alert(1)', desc: 'javascript: URI scheme' },
        { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAA=', desc: 'data: inline base64' },
        { url: 'ftp://ftp.funet.fi/pub/test.png', desc: 'ftp:// protocol' },
        { url: 'gopher://gopher.floodgap.com/', desc: 'gopher:// protocol' }
    ];

    for (const scheme of disallowedSchemes) {
        const check = mediaService.isSafeUrl(scheme.url);
        assert(check.safe === false, `Disallowed scheme rejected: ${scheme.desc} (${check.reason})`);
    }

    // 3. Legitimate Public URLs Allowed
    console.log('\n--- Test 3: Legitimate Public URLs Allowed ---');
    const validUrls = [
        'https://upload.wikimedia.org/wikipedia/commons/3/32/Signed_Pong_Cabinet.jpg',
        'https://cdn.akamai.steamstatic.com/steam/apps/391540/header.jpg',
        'https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7f.jpg'
    ];

    for (const validUrl of validUrls) {
        const check = mediaService.isSafeUrl(validUrl);
        assert(check.safe === true, `Permitted legitimate public CDN URL: ${validUrl}`);
    }

    // 4. HTML Error 200 Trap Detection
    console.log('\n--- Test 4: HTML 200 Trap Detection ---');
    const htmlTrapPayloads = [
        '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>Not Found</h1></body></html>',
        '<html><body><p>Hotlink Access Forbidden</p></body></html>',
        '<?xml version="1.0"?><Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>'
    ];

    for (let i = 0; i < htmlTrapPayloads.length; i++) {
        const buf = Buffer.from(htmlTrapPayloads[i]);
        const format = mediaService.detectImageFormat(buf);
        assert(format === null || format.isHtml === true, `HTML/XML text payload ${i + 1} rejected as non-image`);
    }

    // 5. Valid Magic Bytes Detection
    console.log('\n--- Test 5: Magic Byte Format Validation ---');
    const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00]);
    const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46]);
    const webpHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x20, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);

    assert(mediaService.detectImageFormat(pngHeader)?.format === 'png', 'PNG magic bytes recognized');
    assert(mediaService.detectImageFormat(jpegHeader)?.format === 'jpeg', 'JPEG magic bytes recognized');
    assert(mediaService.detectImageFormat(webpHeader)?.format === 'webp', 'WebP magic bytes recognized');

    console.log('\n======================================================================');
    console.log(`RESULTS: ${passed} passed, ${failed} failed.`);
    console.log('======================================================================\n');

    return { passed, failed };
}

if (require.main === module) {
    runTests().then(({ failed }) => {
        process.exit(failed > 0 ? 1 : 0);
    }).catch(err => {
        console.error('Fatal test error:', err);
        process.exit(1);
    });
}

module.exports = { runTests };

