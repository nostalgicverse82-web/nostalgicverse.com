/**
 * Phase 14 Test Suite 7: Media Registry & Protected Core Assets Guard
 * Validates media listing, URL replacement with metadata provenance, and
 * enforces absolute protection for the 50 official profile icons,
 * approved console PNGs, and creator QR asset.
 */

const { spawn } = require('child_process');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { dbAsync } = require('../../server/db/connection.cjs');

const PORT = 3020;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let serverProcess = null;

function assert(condition, message) {
    if (!condition) {
        console.error(`[FAIL] ${message}`);
        throw new Error(message);
    }
    console.log(`[PASS] ${message}`);
}

async function startServer() {
    return new Promise((resolve, reject) => {
        serverProcess = spawn('node', ['server/index.cjs'], {
            cwd: path.resolve(__dirname, '../../'),
            env: { ...process.env, PORT: String(PORT) }
        });

        let started = false;
        serverProcess.stdout.on('data', d => {
            const out = d.toString();
            if (out.includes('listening on')) {
                started = true;
                resolve();
            }
        });

        serverProcess.stderr.on('data', d => {
            const errStr = d.toString().trim();
            if (errStr && !errStr.includes('ExperimentalWarning')) {
                console.error('[SERVER_LOG]', errStr);
            }
        });

        serverProcess.on('error', reject);
        setTimeout(() => { if (!started) reject(new Error('Server startup timed out')); }, 10000);
    });
}

function stopServer() {
    if (serverProcess) {
        serverProcess.kill();
        serverProcess = null;
    }
}

async function loginAsOwner() {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'owner', password: 'changeme123' })
    });
    const cookie = res.headers.get('set-cookie');
    return cookie ? cookie.split(';')[0] : '';
}

async function run() {
    console.log('=== TEST PHASE 14: MEDIA REGISTRY & PROTECTED ASSETS GUARD ===');
    await startServer();

    const imageId = uuidv4();
    const game = await dbAsync.get("SELECT id FROM games LIMIT 1");

    try {
        const sessionCookie = await loginAsOwner();
        assert(sessionCookie.length > 0, 'Owner authenticated');

        // Create disposable media record
        await dbAsync.run(`
            INSERT INTO game_images (id, game_id, image_url, image_type, verification_status, created_at)
            VALUES (?, ?, 'https://example.com/old-screenshot.webp', 'screenshot', 'UNVERIFIED', CURRENT_TIMESTAMP)
        `, [imageId, game.id]);

        // 1. Fetch Media Registry List
        const listRes = await fetch(`${BASE_URL}/api/owner/media?limit=10`, {
            headers: { Cookie: sessionCookie }
        });
        assert(listRes.status === 200, 'GET /api/owner/media returns 200');
        const listData = await listRes.json();
        assert(Array.isArray(listData.images), 'Media list returns array');
        assert(listData.total >= 500, 'Total media assets reflects authentic catalog (>= 500)');

        // 2. Test Legitimate Image Replacement with Provenance Recording
        const replaceRes = await fetch(`${BASE_URL}/api/owner/media/replace`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({
                imageId,
                newUrl: 'https://example.com/verified-screenshot.webp',
                sourceUrl: 'https://archive.org/details/game-exhibit',
                attribution: 'Internet Archive Retro Preservation'
            })
        });
        assert(replaceRes.status === 200, 'Legitimate media replacement returns 200');
        const updatedImg = await dbAsync.get('SELECT * FROM game_images WHERE id = ?', [imageId]);
        assert(updatedImg.image_url === 'https://example.com/verified-screenshot.webp', 'Image URL updated in game_images');
        assert(updatedImg.verification_status === 'VERIFIED', 'Verification status transitioned to VERIFIED');

        // Verify provenance recorded in media_metadata
        const meta = await dbAsync.get('SELECT * FROM media_metadata WHERE content_id = ?', [game.id]);
        assert(meta !== undefined, 'Provenance metadata entry created in media_metadata');
        assert(meta.verification_status === 'VERIFIED', 'Metadata record marked as VERIFIED');

        // 3. Test Protected Core Asset Guard: Profile Icon Protection
        const attackProfileIconRes = await fetch(`${BASE_URL}/api/owner/media/replace`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({
                imageId,
                newUrl: '/assets/images/profile-icons/icon-01.png'
            })
        });
        assert(attackProfileIconRes.status === 403, 'Attempt to overwrite/tamper official profile icon rejected with 403 Forbidden');

        // 4. Test Protected Core Asset Guard: Console Transparent PNG Protection
        const attackConsolePngRes = await fetch(`${BASE_URL}/api/owner/media/replace`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({
                imageId,
                newUrl: '/assets/images/consoles/snes-trans.png'
            })
        });
        assert(attackConsolePngRes.status === 403, 'Attempt to tamper console PNG asset rejected with 403 Forbidden');

        // 5. Test Protected Core Asset Guard: Creator Support QR Protection
        const attackQrRes = await fetch(`${BASE_URL}/api/owner/media/replace`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Cookie: sessionCookie },
            body: JSON.stringify({
                imageId,
                newUrl: '/assets/images/support/qr-support.png'
            })
        });
        assert(attackQrRes.status === 403, 'Attempt to tamper creator QR asset rejected with 403 Forbidden');

        console.log('>>> [PASS] MEDIA REGISTRY & CORE ASSET GUARD AUDIT COMPLETED CLEANLY <<<\n');
    } finally {
        await dbAsync.run('DELETE FROM game_images WHERE id = ?', [imageId]);
        await dbAsync.run('DELETE FROM media_metadata WHERE content_id = ?', [game.id]);
        await dbAsync.run("DELETE FROM audit_logs WHERE entity_id = ?", [imageId]);
        stopServer();
    }
}

run().catch(err => {
    console.error('[FATAL]', err);
    stopServer();
    process.exit(1);
});

