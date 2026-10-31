/**
 * NostalgicVerse — Sitemap & Robots Generator Service (Phase 17)
 * ==============================================================
 * Automatically generates production sitemap.xml strictly from canonical
 * published records with change frequencies and priority tiers.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { dbAsync } = require('../db/index.cjs');

const ROOT = path.resolve(__dirname, '../..');
const SITEMAP_PATH = path.join(ROOT, 'sitemap.xml');
const SITEMAP_TEMP = path.join(ROOT, 'sitemap.xml.tmp');
const BASE_URL = 'https://nostalgicverse.com';

/**
 * Generate XML sitemap
 */
async function generateSitemap() {
    const urls = [];
    const today = new Date().toISOString().split('T')[0];

    // 1. Core Pages (Highest Priority)
    const corePages = [
        { loc: '/', priority: '1.0', changefreq: 'daily' },
        { loc: '/games/', priority: '0.9', changefreq: 'daily' },
        { loc: '/consoles/', priority: '0.9', changefreq: 'weekly' },
        { loc: '/timeline/', priority: '0.8', changefreq: 'weekly' },
        { loc: '/genres/', priority: '0.8', changefreq: 'monthly' },
        { loc: '/stories/', priority: '0.7', changefreq: 'weekly' },
        { loc: '/guides/', priority: '0.7', changefreq: 'weekly' },
        { loc: '/news/', priority: '0.7', changefreq: 'daily' },
        { loc: '/search/', priority: '0.6', changefreq: 'monthly' },
        { loc: '/about/', priority: '0.5', changefreq: 'monthly' },
        { loc: '/support/', priority: '0.5', changefreq: 'monthly' }
    ];

    corePages.forEach(p => urls.push({ ...p, lastmod: today }));

    // 2. Published Games
    const games = await dbAsync.all("SELECT slug FROM games WHERE status = 'PUBLISHED' ORDER BY title ASC");
    games.forEach(g => {
        urls.push({
            loc: `/games/${g.slug}/`,
            priority: '0.8',
            changefreq: 'monthly',
            lastmod: today
        });
    });

    // 3. Published Consoles
    const consoles = await dbAsync.all("SELECT slug FROM consoles WHERE status = 'PUBLISHED' ORDER BY name ASC");
    consoles.forEach(c => {
        urls.push({
            loc: `/consoles/${c.slug}/`,
            priority: '0.8',
            changefreq: 'monthly',
            lastmod: today
        });
    });

    // 4. Published Stories & Guides
    try {
        const stories = await dbAsync.all("SELECT slug FROM stories WHERE status = 'PUBLISHED'");
        stories.forEach(s => urls.push({ loc: `/stories/${s.slug}/`, priority: '0.7', changefreq: 'monthly', lastmod: today }));
    } catch (e) {}

    try {
        const guides = await dbAsync.all("SELECT slug FROM guides WHERE status = 'PUBLISHED'");
        guides.forEach(g => urls.push({ loc: `/guides/${g.slug}/`, priority: '0.7', changefreq: 'monthly', lastmod: today }));
    } catch (e) {}

    // 5. Published Genres
    try {
        const genres = await dbAsync.all("SELECT slug FROM genres ORDER BY name ASC");
        genres.forEach(gn => urls.push({ loc: `/genres/${gn.slug}/`, priority: '0.7', changefreq: 'monthly', lastmod: today }));
    } catch (e) {}

    // 6. Published News
    try {
        const news = await dbAsync.all("SELECT id FROM news_articles WHERE status = 'PUBLISHED' ORDER BY published_date DESC");
        news.forEach(n => urls.push({ loc: `/news/${n.id}/`, priority: '0.6', changefreq: 'monthly', lastmod: today }));
    } catch (e) {}

    // 7. Build XML
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    urls.forEach(u => {
        xml += `  <url>\n`;
        xml += `    <loc>${BASE_URL}${u.loc}</loc>\n`;
        xml += `    <lastmod>${u.lastmod}</lastmod>\n`;
        xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
        xml += `    <priority>${u.priority}</priority>\n`;
        xml += `  </url>\n`;
    });

    xml += `</urlset>\n`;

    // Atomic write
    fs.writeFileSync(SITEMAP_TEMP, xml, 'utf8');
    fs.renameSync(SITEMAP_TEMP, SITEMAP_PATH);

    return {
        success: true,
        totalUrls: urls.length,
        writtenPath: 'sitemap.xml',
        generatedAt: new Date().toISOString()
    };
}

/**
 * Validate existing sitemap file
 */
function validateSitemap() {
    if (!fs.existsSync(SITEMAP_PATH)) {
        return { exists: false, totalUrls: 0, sizeBytes: 0 };
    }
    const stat = fs.statSync(SITEMAP_PATH);
    const content = fs.readFileSync(SITEMAP_PATH, 'utf8');
    const urlMatches = content.match(/<url>/g);

    return {
        exists: true,
        totalUrls: urlMatches ? urlMatches.length : 0,
        sizeBytes: stat.size,
        lastModified: stat.mtime.toISOString()
    };
}

const sitemapGen = {
    generateSitemap,
    validateSitemap
};

module.exports = {
    ...sitemapGen,
    sitemapService: sitemapGen
};
