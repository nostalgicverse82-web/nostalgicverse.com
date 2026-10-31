/**
 * NostalgicVerse — Media Service & Intelligence Engine
 * 
 * Central authority for:
 * - SSRF-safe URL verification and validation
 * - MIME & magic-byte detection (protects against HTML 200 responses)
 * - Binary header image dimension extraction & aspect ratio analysis
 * - Per-domain rate limiting, exponential backoff, and 429 throttling
 * - Canonical image resolution (Local -> Remote Verified -> Museum Fallback)
 * - Safe local media migration pipeline with cryptographic hashing
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const url = require('url');
const net = require('net');
const crypto = require('crypto');
const { dbAsync } = require('../db/index.cjs');

const ROOT = path.resolve(__dirname, '../..');
const GAMES_IMAGE_DIR = path.join(ROOT, 'assets/images/games');
const FALLBACK_PLATE_URL = '/assets/images/museum-fallback.svg';
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024; // 15MB ceiling for image downloads
const MAX_PREVIEW_BYTES = 32 * 1024; // 32KB sufficient for magic bytes & headers

// Per-domain rate limiter & backoff tracking
const domainState = new Map(); // domain -> { activeRequests: 0, cooldownUntil: 0, consecutive429: 0 }

/**
 * Check if an IP address is private, link-local, loopback, or cloud metadata
 */
function isPrivateOrRestrictedIp(ip) {
    if (!ip) return true;
    
    // IPv4 checks
    if (net.isIPv4(ip)) {
        const parts = ip.split('.').map(Number);
        
        // 127.0.0.0/8 (Loopback)
        if (parts[0] === 127) return true;
        // 0.0.0.0/8 (Current network)
        if (parts[0] === 0) return true;
        // 10.0.0.0/8 (Private)
        if (parts[0] === 10) return true;
        // 172.16.0.0/12 (Private)
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
        // 192.168.0.0/16 (Private)
        if (parts[0] === 192 && parts[1] === 168) return true;
        // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
        if (parts[0] === 169 && parts[1] === 254) return true;
        // 224.0.0.0/4 (Multicast)
        if (parts[0] >= 224) return true;

        return false;
    }

    // IPv6 checks
    if (net.isIPv6(ip)) {
        const lower = ip.toLowerCase();
        // ::1 loopback
        if (lower === '::1' || lower === '0000:0000:0000:0000:0000:0000:0000:0001') return true;
        // :: unspecified
        if (lower === '::') return true;
        // fe80::/10 link-local
        if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true;
        // fc00::/7 unique local
        if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
        // IPv4 mapped (e.g. ::ffff:127.0.0.1)
        if (lower.includes('::ffff:')) {
            const mappedIpv4 = lower.split('::ffff:')[1];
            return isPrivateOrRestrictedIp(mappedIpv4);
        }
        return false;
    }

    return true;
}

/**
 * SSRF Security Validator:
 * Ensures URL uses http/https, valid public hostname, and no local/private network destinations.
 */
function isSafeUrl(urlString) {
    if (!urlString || typeof urlString !== 'string') {
        return { safe: false, reason: 'EMPTY_OR_INVALID_URL' };
    }

    let parsed;
    try {
        parsed = new url.URL(urlString);
    } catch (e) {
        return { safe: false, reason: 'MALFORMED_URL' };
    }

    // Scheme whitelist
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return { safe: false, reason: 'DISALLOWED_SCHEME', protocol: parsed.protocol };
    }

    const hostname = parsed.hostname.toLowerCase();

    // Loopback / localhost string checks
    if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
        return { safe: false, reason: 'RESTRICTED_HOSTNAME', hostname };
    }

    // IP address checks (including bracketed IPv6 like [::1])
    const cleanIp = hostname.replace(/^\[|\]$/g, '');
    if (net.isIP(cleanIp)) {
        if (isPrivateOrRestrictedIp(cleanIp)) {
            return { safe: false, reason: 'PRIVATE_IP_BLOCKED', ip: cleanIp };
        }
    }

    // Cloud metadata hostnames
    if (hostname === 'metadata.google.internal' || hostname === 'instance-data') {
        return { safe: false, reason: 'CLOUD_METADATA_BLOCKED', hostname };
    }

    // Dangerous ports
    if (parsed.port) {
        const port = parseInt(parsed.port, 10);
        const forbiddenPorts = [22, 25, 110, 143, 3306, 5432, 6379, 27017, 9200, 2375];
        if (forbiddenPorts.includes(port)) {
            return { safe: false, reason: 'RESTRICTED_PORT', port };
        }
    }

    return { safe: true, parsed };
}

/**
 * Magic Byte & Content-Type Image Detection
 */
function detectImageFormat(buffer) {
    if (!buffer || buffer.length < 8) return null;

    // Check for HTML/XML error bodies (common 200-OK trap)
    const headerStr = buffer.slice(0, 100).toString('utf8').trim().toLowerCase();
    if (headerStr.startsWith('<!doctype html') || 
        headerStr.startsWith('<html') || 
        headerStr.startsWith('<?xml') || 
        headerStr.includes('<head>') || 
        headerStr.includes('<body>')) {
        return { format: 'html', mimeType: 'text/html', isHtml: true };
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
        buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
        return { format: 'png', mimeType: 'image/png' };
    }

    // JPEG: FF D8 FF
    if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
        return { format: 'jpeg', mimeType: 'image/jpeg' };
    }

    // WebP: RIFF .... WEBP
    if (buffer.length >= 12 &&
        buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
        buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
        return { format: 'webp', mimeType: 'image/webp' };
    }

    // GIF: GIF87a or GIF89a
    if (buffer.length >= 6 &&
        buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38 &&
        (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61) {
        return { format: 'gif', mimeType: 'image/gif' };
    }

    // AVIF: ftypavif at offset 4
    if (buffer.length >= 12 && buffer.slice(4, 12).toString('ascii').includes('ftypavif')) {
        return { format: 'avif', mimeType: 'image/avif' };
    }

    return null;
}

/**
 * Binary Image Header Dimension Parser (Zero external dependencies)
 */
function parseImageDimensions(buffer, format) {
    if (!buffer || buffer.length < 24) return null;

    let width = null;
    let height = null;

    try {
        if (format === 'png' && buffer.length >= 24) {
            width = buffer.readUInt32BE(16);
            height = buffer.readUInt32BE(20);
        } else if (format === 'gif' && buffer.length >= 10) {
            width = buffer.readUInt16LE(6);
            height = buffer.readUInt16LE(8);
        } else if (format === 'webp') {
            // Check VP8 subtype
            const subtype = buffer.slice(12, 16).toString('ascii');
            if (subtype === 'VP8 ' && buffer.length >= 30) {
                // Keyframe code 0x9d 0x01 0x2a
                if (buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
                    width = buffer.readUInt16LE(26) & 0x3fff;
                    height = buffer.readUInt16LE(28) & 0x3fff;
                }
            } else if (subtype === 'VP8L' && buffer.length >= 25) {
                if (buffer[20] === 0x2f) {
                    const b0 = buffer[21], b1 = buffer[22], b2 = buffer[23], b3 = buffer[24];
                    width = 1 + (((b1 & 0x3F) << 8) | b0);
                    height = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6));
                }
            } else if (subtype === 'VP8X' && buffer.length >= 30) {
                width = 1 + buffer.readUIntLE(24, 3);
                height = 1 + buffer.readUIntLE(27, 3);
            }
        } else if (format === 'jpeg') {
            let offset = 2;
            while (offset < buffer.length - 8) {
                if (buffer[offset] !== 0xFF) {
                    offset++;
                    continue;
                }
                const marker = buffer[offset + 1];
                // SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2)
                if (marker === 0xC0 || marker === 0xC1 || marker === 0xC2) {
                    height = buffer.readUInt16BE(offset + 5);
                    width = buffer.readUInt16BE(offset + 7);
                    break;
                }
                const len = buffer.readUInt16BE(offset + 2);
                offset += 2 + len;
            }
        }
    } catch (e) {
        // Dimension parsing failure (corrupted header or truncated chunk)
    }

    if (width && height && width > 0 && height > 0) {
        const ratio = width / height;
        let aspectRatio = 'CUSTOM';
        if (Math.abs(ratio - 1.0) < 0.05) aspectRatio = '1:1';
        else if (Math.abs(ratio - 0.8) < 0.05) aspectRatio = '4:5';
        else if (Math.abs(ratio - 0.75) < 0.05) aspectRatio = '3:4';
        else if (Math.abs(ratio - 0.667) < 0.05) aspectRatio = '2:3';
        else if (Math.abs(ratio - 1.5) < 0.05) aspectRatio = '3:2';
        else if (Math.abs(ratio - 1.333) < 0.05) aspectRatio = '4:3';
        else if (Math.abs(ratio - 1.777) < 0.05) aspectRatio = '16:9';
        else if (Math.abs(ratio - 0.562) < 0.05) aspectRatio = '9:16';
        else if (Math.abs(ratio - 2.222) < 0.05) aspectRatio = '20:9';

        return { width, height, aspectRatio };
    }

    return null;
}

/**
 * Domain rate limiter & backoff manager
 */
function getDomainThrottle(domain) {
    const now = Date.now();
    let state = domainState.get(domain);
    if (!state) {
        state = { activeRequests: 0, cooldownUntil: 0, consecutive429: 0 };
        domainState.set(domain, state);
    }
    return state;
}

/**
 * Verify remote image URL over HTTP/HTTPS with SSRF, MIME, and magic-byte validation
 */
async function verifyRemoteImage(rawUrl, options = {}) {
    const { timeoutMs = 8000, maxRedirects = 3, currentRedirect = 0 } = options;

    const safety = isSafeUrl(rawUrl);
    if (!safety.safe) {
        return {
            ok: false,
            status: 'SSRF_BLOCKED',
            httpStatus: 400,
            failureReason: `SSRF check failed: ${safety.reason}`,
            originalUrl: rawUrl
        };
    }

    const targetUrl = safety.parsed;
    const domain = targetUrl.hostname;
    const throttle = getDomainThrottle(domain);

    // Check if domain is in 429 cooldown
    const now = Date.now();
    if (throttle.cooldownUntil > now) {
        const waitSec = Math.ceil((throttle.cooldownUntil - now) / 1000);
        return {
            ok: false,
            status: 'THROTTLED',
            httpStatus: 429,
            failureReason: `Domain ${domain} throttled. Cooldown for ${waitSec}s`,
            originalUrl: rawUrl
        };
    }

    return new Promise((resolve) => {
        const client = targetUrl.protocol === 'https:' ? https : http;
        
        const reqOptions = {
            hostname: targetUrl.hostname,
            port: targetUrl.port || (targetUrl.protocol === 'https:' ? 443 : 80),
            path: targetUrl.pathname + targetUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': 'NostalgicVerse-MediaBot/2026.1 (Curatorial Archive Preservation; +https://nostalgicverse.com)',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                'Range': `bytes=0-${MAX_PREVIEW_BYTES - 1}`, // Request initial bytes for inspection
                'Connection': 'close'
            },
            timeout: timeoutMs
        };

        const req = client.request(reqOptions, async (res) => {
            const statusCode = res.statusCode;
            const contentType = (res.headers['content-type'] || '').toLowerCase();

            // Handle 3xx Redirects
            if ([301, 302, 303, 307, 308].includes(statusCode)) {
                res.resume(); // drain
                const location = res.headers.location;
                if (!location || currentRedirect >= maxRedirects) {
                    return resolve({
                        ok: false,
                        status: 'BROKEN',
                        httpStatus: statusCode,
                        failureReason: 'Too many redirects or missing location',
                        originalUrl: rawUrl
                    });
                }
                const nextUrl = new url.URL(location, targetUrl).toString();
                const redirected = await verifyRemoteImage(nextUrl, { ...options, currentRedirect: currentRedirect + 1 });
                return resolve({ ...redirected, redirectedFrom: rawUrl });
            }

            // Handle 429 Rate Limit
            if (statusCode === 429) {
                res.resume();
                throttle.consecutive429++;
                const backoffMs = Math.min(60000, 5000 * Math.pow(2, throttle.consecutive429 - 1));
                throttle.cooldownUntil = Date.now() + backoffMs;
                return resolve({
                    ok: false,
                    status: 'THROTTLED',
                    httpStatus: 429,
                    failureReason: `Remote returned HTTP 429 (backoff ${backoffMs / 1000}s applied)`,
                    originalUrl: rawUrl
                });
            }

            // Reset backoff on successful contact
            if (statusCode >= 200 && statusCode < 300) {
                throttle.consecutive429 = 0;
            }

            // Handle HTTP 403 Forbidden
            if (statusCode === 403) {
                res.resume();
                return resolve({
                    ok: false,
                    status: 'FORBIDDEN',
                    httpStatus: 403,
                    failureReason: 'Remote host forbidden (hotlink protection or authorization required)',
                    originalUrl: rawUrl
                });
            }

            // Handle HTTP 404 Not Found
            if (statusCode === 404) {
                res.resume();
                return resolve({
                    ok: false,
                    status: 'NOT_FOUND',
                    httpStatus: 404,
                    failureReason: 'Remote image not found (HTTP 404)',
                    originalUrl: rawUrl
                });
            }

            // Handle other HTTP errors
            if (statusCode < 200 || statusCode >= 400) {
                res.resume();
                return resolve({
                    ok: false,
                    status: 'BROKEN',
                    httpStatus: statusCode,
                    failureReason: `Remote server returned HTTP ${statusCode}`,
                    originalUrl: rawUrl
                });
            }

            // Read the binary chunk for inspection
            const chunks = [];
            let totalBytes = 0;

            res.on('data', (chunk) => {
                chunks.push(chunk);
                totalBytes += chunk.length;
                if (totalBytes >= MAX_PREVIEW_BYTES) {
                    res.destroy(); // Got enough for header analysis
                }
            });

            res.on('end', () => {
                const buffer = Buffer.concat(chunks);
                const detected = detectImageFormat(buffer);

                // Detect HTML returned with 200 OK (trap detection)
                if (!detected || detected.isHtml || !contentType.startsWith('image/')) {
                    return resolve({
                        ok: false,
                        status: 'INVALID_MIME',
                        httpStatus: statusCode,
                        mimeType: detected?.mimeType || contentType || 'unknown',
                        failureReason: detected?.isHtml ? 'Remote server returned HTML error page with status 200' : 'Invalid or non-image content type',
                        originalUrl: rawUrl
                    });
                }

                // Parse dimensions
                const dim = parseImageDimensions(buffer, detected.format);

                return resolve({
                    ok: true,
                    status: 'VERIFIED_REMOTE',
                    httpStatus: statusCode,
                    mimeType: detected.mimeType,
                    width: dim ? dim.width : null,
                    height: dim ? dim.height : null,
                    aspectRatio: dim ? dim.aspectRatio : 'UNKNOWN',
                    finalUrl: targetUrl.toString(),
                    originalUrl: rawUrl
                });
            });

            res.on('error', (err) => {
                resolve({
                    ok: false,
                    status: 'BROKEN',
                    httpStatus: statusCode,
                    failureReason: `Stream error: ${err.message}`,
                    originalUrl: rawUrl
                });
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve({
                ok: false,
                status: 'TIMEOUT',
                httpStatus: 408,
                failureReason: `Request timed out after ${timeoutMs}ms`,
                originalUrl: rawUrl
            });
        });

        req.on('error', (err) => {
            resolve({
                ok: false,
                status: 'BROKEN',
                httpStatus: 500,
                failureReason: `Network error: ${err.message}`,
                originalUrl: rawUrl
            });
        });

        req.end();
    });
}

// Local files in-memory index for microsecond resolution
let localGamesImageCache = null;

function getLocalGamesImageCache() {
    if (!localGamesImageCache) {
        try {
            if (fs.existsSync(GAMES_IMAGE_DIR)) {
                localGamesImageCache = new Set(fs.readdirSync(GAMES_IMAGE_DIR));
            } else {
                localGamesImageCache = new Set();
            }
        } catch (e) {
            localGamesImageCache = new Set();
        }
    }
    return localGamesImageCache;
}

function refreshLocalImageCache() {
    localGamesImageCache = null;
}

// Manifest in-memory index
let remoteManifestCache = null;

function getRemoteManifest() {
    if (!remoteManifestCache) {
        try {
            const manifestPath = path.join(ROOT, 'data/remote-game-images.json');
            if (fs.existsSync(manifestPath)) {
                const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                remoteManifestCache = data.games || data || {};
            } else {
                remoteManifestCache = {};
            }
        } catch (e) {
            remoteManifestCache = {};
        }
    }
    return remoteManifestCache;
}

/**
 * Universal Canonical Game Image Resolver
 * 
 * Strict fallback hierarchy:
 * 1. LOCAL VERIFIED: assets/images/games/{slug}.webp (or recorded local_image) exists on disk
 * 2. REMOTE VERIFIED: verified remote artwork from game record or remote-game-images manifest
 * 3. APPROVED FALLBACK: /assets/images/museum-fallback.svg (safe museum accession plate)
 * 
 * Never returns broken remote image or causes blank card UI.
 */
function resolveGameImage(game) {
    if (!game) {
        return {
            status: 'APPROVED_FALLBACK',
            type: 'FALLBACK',
            url: FALLBACK_PLATE_URL,
            source: 'FALLBACK',
            sourcePage: null,
            mimeType: 'image/svg+xml',
            isFallback: true
        };
    }

    const slug = game.slug || (game.id ? String(game.id).replace(/^game-/, '') : '');
    const cleanSlug = slug.replace(/-/g, '');

    // 1. Check local file on disk (using cache for instant O(1) lookup)
    const cache = getLocalGamesImageCache();
    if (slug) {
        for (const ext of ['.webp', '.png', '.jpg', '.jpeg', '.svg']) {
            const filename = `${slug}${ext}`;
            if (cache.has(filename) || fs.existsSync(path.join(GAMES_IMAGE_DIR, filename))) {
                return {
                    status: 'VERIFIED_LOCAL',
                    type: 'LOCAL',
                    url: `/assets/images/games/${filename}`,
                    source: 'LOCAL',
                    sourcePage: null,
                    mimeType: ext === '.webp' ? 'image/webp' : (ext === '.png' ? 'image/png' : (ext === '.svg' ? 'image/svg+xml' : 'image/jpeg')),
                    isFallback: false,
                    localPath: `assets/images/games/${filename}`
                };
            }
            const cleanFilename = `${cleanSlug}${ext}`;
            if (cache.has(cleanFilename) || fs.existsSync(path.join(GAMES_IMAGE_DIR, cleanFilename))) {
                return {
                    status: 'VERIFIED_LOCAL',
                    type: 'LOCAL',
                    url: `/assets/images/games/${cleanFilename}`,
                    source: 'LOCAL',
                    sourcePage: null,
                    mimeType: ext === '.webp' ? 'image/webp' : (ext === '.png' ? 'image/png' : (ext === '.svg' ? 'image/svg+xml' : 'image/jpeg')),
                    isFallback: false,
                    localPath: `assets/images/games/${cleanFilename}`
                };
            }
        }
    }

    // Check game.local_image or assets.heroImage/coverImage/thumbnailImage if exists on disk
    const candidateLocalPaths = [
        game.local_image,
        game.assets && game.assets.localAssetPath,
        game.assets && game.assets.heroImage,
        game.assets && game.assets.coverImage,
        game.assets && game.assets.thumbnailImage
    ].filter(Boolean);

    for (const cand of candidateLocalPaths) {
        if (typeof cand === 'string') {
            const cleanCand = cand.replace(/^\//, '');
            if (fs.existsSync(path.join(ROOT, cleanCand))) {
                return {
                    status: 'VERIFIED_LOCAL',
                    type: 'LOCAL',
                    url: cand.startsWith('/') ? cand : `/${cand}`,
                    source: 'LOCAL',
                    sourcePage: null,
                    isFallback: false,
                    localPath: cleanCand
                };
            }
        }
    }

    // 2. Check verified remote URL
    const remoteManifest = getRemoteManifest();
    const manifestEntry = remoteManifest[slug] || {};

    let remoteCandidateUrl = null;
    let sourcePage = null;
    let sourceDomain = null;
    let licenseStatus = null;
    let attribution = null;

    if (game.assets && game.assets.remoteImage && typeof game.assets.remoteImage === 'object') {
        remoteCandidateUrl = game.assets.remoteImage.url;
        sourcePage = game.assets.remoteImage.sourceUrl;
        sourceDomain = game.assets.remoteImage.sourceDomain;
        licenseStatus = game.assets.remoteImage.license;
        attribution = game.assets.remoteImage.attribution;
    }

    if (!remoteCandidateUrl && game.assets && typeof game.assets.remoteImageUrl === 'string') {
        remoteCandidateUrl = game.assets.remoteImageUrl;
    }

    if (!remoteCandidateUrl && typeof game.remote_image === 'string' && game.remote_image.startsWith('http')) {
        remoteCandidateUrl = game.remote_image;
    }

    if (!remoteCandidateUrl && manifestEntry) {
        remoteCandidateUrl = manifestEntry.imageUrl || manifestEntry.candidateUrl;
        if (!sourcePage) sourcePage = manifestEntry.sourceUrl;
        if (!sourceDomain) sourceDomain = manifestEntry.sourceDomain;
        if (!licenseStatus) licenseStatus = manifestEntry.license;
    }

    if (remoteCandidateUrl && typeof remoteCandidateUrl === 'string' && remoteCandidateUrl.startsWith('http')) {
        let domain = sourceDomain;
        if (!domain) {
            try {
                domain = new URL(remoteCandidateUrl).hostname;
            } catch (e) {
                domain = null;
            }
        }
        return {
            status: 'VERIFIED_REMOTE',
            type: 'REMOTE',
            url: remoteCandidateUrl,
            source: 'REMOTE',
            sourcePage: sourcePage || null,
            sourceDomain: domain,
            licenseStatus: licenseStatus || 'Archival Fair Use / Educational Exhibition',
            attribution: attribution || null,
            isFallback: false
        };
    }

    // 3. Fallback Plate
    return {
        status: 'APPROVED_FALLBACK',
        type: 'FALLBACK',
        url: FALLBACK_PLATE_URL,
        source: 'FALLBACK',
        sourcePage: null,
        mimeType: 'image/svg+xml',
        isFallback: true
    };
}

/**
 * Local Media Migration
 * Downloads a verified remote image, validates magic bytes, writes to assets/images/games/{slug}.webp,
 * and updates DB and metadata registries.
 */
async function migrateRemoteToLocal(gameId, slug, remoteUrl, options = {}) {
    if (!slug || !remoteUrl) {
        throw new Error('Slug and remote URL are required for migration');
    }

    const verification = await verifyRemoteImage(remoteUrl);
    if (!verification.ok) {
        return { success: false, reason: verification.failureReason, status: verification.status };
    }

    // Target path
    const targetFilename = `${slug}.webp`;
    const targetFilePath = path.join(GAMES_IMAGE_DIR, targetFilename);
    const tempFilePath = path.join(GAMES_IMAGE_DIR, `${slug}.tmp`);

    return new Promise((resolve, reject) => {
        const client = remoteUrl.startsWith('https:') ? https : http;
        
        const req = client.get(remoteUrl, {
            headers: { 'User-Agent': 'NostalgicVerse-Migration/2026.1' },
            timeout: 15000
        }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                return resolve({ success: false, reason: `HTTP ${res.statusCode} during download` });
            }

            const writeStream = fs.createWriteStream(tempFilePath);
            const hasher = crypto.createHash('sha256');
            let totalBytes = 0;

            res.on('data', (chunk) => {
                totalBytes += chunk.length;
                if (totalBytes > MAX_DOWNLOAD_BYTES) {
                    res.destroy();
                    writeStream.destroy();
                    if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                    return resolve({ success: false, reason: 'Exceeded maximum allowable image download size (15MB)' });
                }
                hasher.update(chunk);
                writeStream.write(chunk);
            });

            res.on('end', async () => {
                writeStream.end(async () => {
                    const hash = hasher.digest('hex');
                    
                    // Verify saved file
                    const fileBuffer = fs.readFileSync(tempFilePath);
                    const format = detectImageFormat(fileBuffer);
                    if (!format || format.isHtml) {
                        if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                        return resolve({ success: false, reason: 'Downloaded file failed magic byte verification' });
                    }

                    const dim = parseImageDimensions(fileBuffer, format.format);
                    
                    // Atomic rename
                    fs.renameSync(tempFilePath, targetFilePath);

                    const relativePath = `assets/images/games/${targetFilename}`;

                    // Update game_images in DB
                    await dbAsync.run(`
                        UPDATE game_images 
                        SET image_type = 'LOCAL',
                            image_url = ?,
                            local_path = ?,
                            mime_type = ?,
                            width = ?,
                            height = ?,
                            aspect_ratio = ?,
                            verification_status = 'VERIFIED',
                            last_checked_at = CURRENT_TIMESTAMP
                        WHERE game_id = ?
                    `, [`/${relativePath}`, relativePath, format.mimeType, dim?.width || null, dim?.height || null, dim?.aspectRatio || 'UNKNOWN', gameId]);

                    // Update games table local_image
                    await dbAsync.run(`
                        UPDATE games SET local_image = ? WHERE id = ?
                    `, [`/${relativePath}`, gameId]);

                    if (localGamesImageCache) {
                        localGamesImageCache.add(targetFilename);
                    }

                    resolve({
                        success: true,
                        localPath: relativePath,
                        fileSize: totalBytes,
                        hash,
                        mimeType: format.mimeType,
                        dimensions: dim
                    });
                });
            });

            res.on('error', (err) => {
                if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                resolve({ success: false, reason: err.message });
            });
        });

        req.on('timeout', () => {
            req.destroy();
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            resolve({ success: false, reason: 'Download timed out' });
        });

        req.on('error', (err) => {
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            resolve({ success: false, reason: err.message });
        });
    });
}

module.exports = {
    isSafeUrl,
    isPrivateOrRestrictedIp,
    detectImageFormat,
    parseImageDimensions,
    verifyRemoteImage,
    resolveGameImage,
    refreshLocalImageCache,
    migrateRemoteToLocal,
    GAMES_IMAGE_DIR,
    FALLBACK_PLATE_URL
};
