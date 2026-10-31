#!/usr/bin/env node
/**
 * NostalgicVerse — Master Derived Data Rebuilder (Phase 15)
 * 
 * Rebuilds all derived artifacts from canonical SQLite:
 * 1. Search Index (data/search-index.json)
 * 2. Sitemap (sitemap.xml)
 * 3. Media Registry (data/media/game-images.json)
 */

const { rebuildSearchIndex } = require('./rebuild-search-index.cjs');
const { rebuildSitemap } = require('./rebuild-sitemap.cjs');
const { runAudit } = require('./audit-game-media.cjs');
const { db } = require('../../server/db/connection.cjs');

async function rebuildAll() {
    console.log('======================================================================');
    console.log('NOSTALGICVERSE — MASTER CONTENT DERIVED DATA REBUILD');
    console.log('======================================================================');
    console.log(`Started: ${new Date().toISOString()}\n`);

    console.log('>>> [1/3] Rebuilding Canonical Search Index...');
    const searchRes = await rebuildSearchIndex();

    console.log('>>> [2/3] Rebuilding Public XML Sitemap...');
    const sitemapRes = await rebuildSitemap();

    console.log('>>> [3/3] Synchronizing Game Media Registry...');
    const mediaRes = await runAudit();

    console.log('======================================================================');
    console.log('ALL DERIVED CONTENT ARTIFACTS REBUILT SUCCESSFULLY');
    console.log(`- Search Records: ${searchRes.total}`);
    console.log(`- Sitemap URLs: ${sitemapRes.totalUrls}`);
    console.log(`- Media Items: ${mediaRes.total} (${mediaRes.verifiedLocal} local, ${mediaRes.verifiedRemote} remote, ${mediaRes.fallback} fallback)`);
    console.log('======================================================================\n');
}

if (require.main === module) {
    rebuildAll().then(() => {
        db.close();
        process.exit(0);
    }).catch(err => {
        console.error('Master rebuild error:', err);
        db.close();
        process.exit(1);
    });
}

module.exports = { rebuildAll };

