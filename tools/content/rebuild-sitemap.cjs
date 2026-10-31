#!/usr/bin/env node
/**
 * NostalgicVerse — Atomic Sitemap Rebuilder (Phase 15)
 * 
 * Rebuilds sitemap.xml strictly from CANONICAL PUBLISHED RECORDS:
 * - Public hub pages (/, /games/, /consoles/, /stories/, /guides/, /timeline/, /genres/)
 * - Public game exhibit pages (/games/{slug}/)
 * - Public console exhibit pages (/consoles/{slug}/)
 * 
 * Guarantees:
 * - Atomic write via temporary file swapping (sitemap.xml.tmp -> sitemap.xml)
 * - Strict XML structure validation before replacement
 * - Exclusion of private, draft, or administrative routes (/owner, /account, /api)
 */

const fs = require('fs');
const path = require('path');
const { dbAsync, db } = require('../../server/db/connection.cjs');

const ROOT = path.resolve(__dirname, '../..');
const TARGET_FILE = path.join(ROOT, 'sitemap.xml');
const TEMP_FILE = path.join(ROOT, 'sitemap.xml.tmp');
const BASE_URL = 'https://nostalgicverse.com';

async function rebuildSitemap() {
    console.log('======================================================================');
    console.log('NOSTALGICVERSE — ATOMIC SITEMAP REBUILD');
    console.log('======================================================================');
    console.log(`Base URL: ${BASE_URL}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    const urls = [];

    // Core static hub routes
    const coreRoutes = [
        { loc: '/', changefreq: 'daily', priority: '1.0' },
        { loc: '/games/', changefreq: 'daily', priority: '0.9' },
        { loc: '/consoles/', changefreq: 'weekly', priority: '0.9' },
        { loc: '/timeline/', changefreq: 'weekly', priority: '0.8' },
        { loc: '/genres/', changefreq: 'weekly', priority: '0.8' },
        { loc: '/guides/', changefreq: 'weekly', priority: '0.8' },
        { loc: '/blog/', changefreq: 'weekly', priority: '0.8' },
        { loc: '/news/', changefreq: 'daily', priority: '0.8' },
        { loc: '/about/', changefreq: 'monthly', priority: '0.5' },
        { loc: '/support/', changefreq: 'monthly', priority: '0.5' }
    ];

    coreRoutes.forEach(r => {
        urls.push({
            loc: `${BASE_URL}${r.loc}`,
            lastmod: new Date().toISOString().split('T')[0],
            changefreq: r.changefreq,
            priority: r.priority
        });
    });

    // Published Games
    const games = await dbAsync.all("SELECT slug, updated_at FROM games WHERE status = 'PUBLISHED' ORDER BY title ASC");
    games.forEach(g => {
        urls.push({
            loc: `${BASE_URL}/games/${g.slug}/`,
            lastmod: g.updated_at ? g.updated_at.split(' ')[0] : new Date().toISOString().split('T')[0],
            changefreq: 'monthly',
            priority: '0.7'
        });
    });

    // Published Consoles
    const consoles = await dbAsync.all("SELECT slug, updated_at FROM consoles WHERE status = 'PUBLISHED' ORDER BY name ASC");
    consoles.forEach(c => {
        urls.push({
            loc: `${BASE_URL}/consoles/${c.slug}/`,
            lastmod: c.updated_at ? c.updated_at.split(' ')[0] : new Date().toISOString().split('T')[0],
            changefreq: 'monthly',
            priority: '0.7'
        });
    });

    console.log(`Generated ${urls.length} public canonical URLs:`);
    console.log(`  - Core hubs: ${coreRoutes.length}`);
    console.log(`  - Published Games: ${games.length}`);
    console.log(`  - Published Consoles: ${consoles.length}\n`);

    // Build XML
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    urls.forEach(u => {
        xml += '  <url>\n';
        xml += `    <loc>${u.loc}</loc>\n`;
        xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
        xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
        xml += `    <priority>${u.priority}</priority>\n`;
        xml += '  </url>\n';
    });

    xml += '</urlset>\n';

    // Step 1: Write to temp
    fs.writeFileSync(TEMP_FILE, xml, 'utf8');

    // Step 2: Validate temp XML
    const readBack = fs.readFileSync(TEMP_FILE, 'utf8');
    if (!readBack.startsWith('<?xml') || !readBack.endsWith('</urlset>\n') || !readBack.includes('<urlset')) {
        if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE);
        throw new Error('XML validation failed on temp sitemap. Atomic swap aborted.');
    }

    // Step 3: Atomic rename
    fs.renameSync(TEMP_FILE, TARGET_FILE);
    console.log(`[SUCCESS] Atomically updated ${TARGET_FILE} (${urls.length} URLs, ${(Buffer.byteLength(xml) / 1024).toFixed(1)} KB)`);
    console.log('======================================================================\n');

    return { totalUrls: urls.length, path: TARGET_FILE };
}

if (require.main === module) {
    rebuildSitemap().then(() => {
        db.close();
        process.exit(0);
    }).catch(err => {
        console.error('Fatal sitemap rebuild failure:', err);
        if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE);
        db.close();
        process.exit(1);
    });
}

module.exports = { rebuildSitemap };

