#!/usr/bin/env node
/**
 * NostalgicVerse — Local Media Migration Pipeline
 * 
 * Safely migrates verified remote imagery to local storage:
 * REMOTE VERIFIED IMAGE -> DOWNLOAD -> VALIDATE -> STORE -> VERIFY -> SWITCH REGISTRY -> PROVENANCE
 * 
 * Invocation:
 *   node tools/content/migrate-game-media.cjs [--dry-run] [--limit <n>] [--slug <slug>]
 *   npm run media:migrate-games
 */

const fs = require('fs');
const path = require('path');
const { dbAsync, db } = require('../../server/db/connection.cjs');
const mediaService = require('../../server/services/mediaService.cjs');

const ROOT = path.resolve(__dirname, '../..');
const REGISTRY_JSON = path.join(ROOT, 'data/media/game-images.json');

async function runMigration() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const limitIdx = args.indexOf('--limit');
    const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : null;
    const slugIdx = args.indexOf('--slug');
    const targetSlug = slugIdx !== -1 ? args[slugIdx + 1] : null;

    console.log('======================================================================');
    console.log('NOSTALGICVERSE — LOCAL MEDIA MIGRATION PIPELINE');
    console.log('======================================================================');
    console.log(`Execution Mode: ${dryRun ? 'DRY-RUN (Preview Only)' : 'ACTIVE MIGRATION'}`);
    if (limit) console.log(`Batch Limit: ${limit}`);
    if (targetSlug) console.log(`Target Slug: ${targetSlug}`);
    console.log(`Timestamp: ${new Date().toISOString()}\n`);

    // Query candidate games with remote images
    let sql = `
        SELECT gi.id as image_id, gi.game_id, g.slug, g.title, gi.image_url, gi.source_domain, gi.verification_status 
        FROM game_images gi 
        JOIN games g ON gi.game_id = g.id 
        WHERE gi.image_type = 'remote'
    `;
    const params = [];

    if (targetSlug) {
        sql += ' AND g.slug = ?';
        params.push(targetSlug);
    }

    sql += ' ORDER BY g.release_year ASC, g.title ASC';
    if (limit) {
        sql += ' LIMIT ?';
        params.push(limit);
    }

    const candidates = await dbAsync.all(sql, params);
    console.log(`Identified ${candidates.length} remote candidates eligible for local migration.\n`);

    if (candidates.length === 0) {
        console.log('No eligible candidates found. All games are either local or fallback.');
        return { migrated: 0, skipped: 0, failed: 0 };
    }

    let migrated = 0;
    let failed = 0;
    let skipped = 0;

    for (let i = 0; i < candidates.length; i++) {
        const item = candidates[i];
        const num = String(i + 1).padStart(2, ' ');

        // Check if local file already exists
        const localDestWebp = path.join(mediaService.GAMES_IMAGE_DIR, `${item.slug}.webp`);
        const localDestJpg = path.join(mediaService.GAMES_IMAGE_DIR, `${item.slug}.jpg`);

        if (fs.existsSync(localDestWebp) || fs.existsSync(localDestJpg)) {
            console.log(`[${num}/${candidates.length}] [SKIP] ${item.title} (${item.slug}) — Local asset already present.`);
            skipped++;
            continue;
        }

        if (dryRun) {
            console.log(`[${num}/${candidates.length}] [DRY-RUN] ${item.title} (${item.slug}) -> ${item.image_url}`);
            continue;
        }

        console.log(`[${num}/${candidates.length}] [MIGRATING] ${item.title}...`);
        try {
            const res = await mediaService.migrateRemoteToLocal(item.game_id, item.slug, item.image_url);
            if (res.success) {
                console.log(`  └─> [SUCCESS] Stored at ${res.localPath} (${(res.fileSize / 1024).toFixed(1)} KB, SHA-256: ${res.hash.slice(0, 12)}...)`);
                migrated++;
            } else {
                console.log(`  └─> [FAILED] ${res.reason} (Status: ${res.status})`);
                failed++;
            }
        } catch (err) {
            console.log(`  └─> [ERROR] ${err.message}`);
            failed++;
        }
    }

    // Refresh canonical JSON registry if mutations occurred
    if (migrated > 0 && fs.existsSync(REGISTRY_JSON)) {
        try {
            const auditTool = require('./audit-game-media.cjs');
            console.log('\nRefreshing canonical game-images.json registry...');
            await auditTool.runAudit();
        } catch (e) {
            console.warn('Could not refresh registry automatically:', e.message);
        }
    }

    console.log('\n======================================================================');
    console.log(`MIGRATION SUMMARY: ${migrated} Migrated, ${skipped} Skipped, ${failed} Failed.`);
    console.log('======================================================================\n');

    return { migrated, skipped, failed };
}

if (require.main === module) {
    runMigration().then(() => {
        db.close();
        process.exit(0);
    }).catch(err => {
        console.error('Fatal migration failure:', err);
        db.close();
        process.exit(1);
    });
}

module.exports = { runMigration };

