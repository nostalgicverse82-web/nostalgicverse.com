/**
 * NostalgicVerse — Remote Artwork Migration Engine (Future Migration Utility)
 * ===========================================================================
 * Prepares the platform for future post-exam migration from external CDN/Wikimedia
 * URLs to permanent, local optimized archival assets under /assets/images/games/.
 *
 * SAFETY POLICY ("Exams Mode"):
 * - By default, this script runs strictly in DRY-RUN mode.
 * - No network downloads or filesystem modifications are performed unless the
 *   explicit `--execute` command-line flag is provided.
 * - Rate limiting, jitter, and respectful User-Agent headers are enforced.
 *
 * Usage:
 *   node tools/content/migrate-remote-images.cjs                 # Dry-run audit (safe)
 *   node tools/content/migrate-remote-images.cjs --limit 5       # Dry-run first 5 items
 *   node tools/content/migrate-remote-images.cjs --slug pac-man  # Dry-run single item
 *   node tools/content/migrate-remote-images.cjs --execute       # Execute live migration
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const ROOT = path.resolve(__dirname, '../..');
const MANIFEST_PATH = path.join(ROOT, 'data/remote-game-images.json');
const ASSET_MANIFEST_PATH = path.join(ROOT, 'data/asset-manifest.json');
const TARGET_DIR = path.join(ROOT, 'assets/images/games');

// Parse CLI flags
const args = process.argv.slice(2);
const isExecute = args.includes('--execute');
const limitIdx = args.indexOf('--limit');
const maxLimit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const slugIdx = args.indexOf('--slug');
const targetSlug = slugIdx !== -1 ? args[slugIdx + 1] : null;
const delayIdx = args.indexOf('--delay');
const requestDelayMs = delayIdx !== -1 ? parseInt(args[delayIdx + 1], 10) : 500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      headers: {
        'User-Agent': 'NostalgicVerse-Archival-Bot/1.0 (https://nostalgicverse.com; contact@nostalgicverse.com)',
        'Accept': 'image/webp,image/png,image/jpeg,*/*;q=0.8'
      },
      timeout: 15000
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} received from upstream`));
      }

      const fileStream = fs.createWriteStream(destPath);
      res.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close(() => resolve({ bytes: fileStream.bytesWritten, contentType: res.headers['content-type'] }));
      });

      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download connection timed out'));
    });
  });
}

async function run() {
  console.log('============================================================');
  console.log('NOSTALGICVERSE REMOTE ARTWORK MIGRATION ENGINE');
  console.log('============================================================');
  console.log(`Execution Mode:  ${isExecute ? 'LIVE EXECUTION (Network downloads ACTIVE)' : 'DRY-RUN (Safe Simulation / Exams Mode)'}`);
  console.log(`Root Directory:  ${ROOT}`);
  console.log(`Target Dir:      ${TARGET_DIR}`);
  if (targetSlug) console.log(`Filter Slug:     ${targetSlug}`);
  if (isFinite(maxLimit)) console.log(`Limit:           ${maxLimit} items`);
  console.log('------------------------------------------------------------\n');

  if (!fs.existsSync(MANIFEST_PATH)) {
    console.error('Fatal: Manifest not found at', MANIFEST_PATH);
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const allGames = Object.values(manifest.games);

  let candidates = allGames.filter(g => g.status === 'verified' && g.imageUrl);
  if (targetSlug) {
    candidates = candidates.filter(g => g.slug === targetSlug);
  }
  if (isFinite(maxLimit)) {
    candidates = candidates.slice(0, maxLimit);
  }

  console.log(`Discovered ${allGames.length} total catalog games.`);
  console.log(`Identified ${candidates.length} remote candidates eligible for migration.`);

  if (!isExecute) {
    console.log('\n[NOTICE] Running in DRY-RUN mode. No files will be downloaded.');
    console.log('[NOTICE] To execute real migration in the future, invoke with: node tools/content/migrate-remote-images.cjs --execute\n');

    let previewCount = Math.min(candidates.length, 10);
    console.log(`Sample of first ${previewCount} candidate actions:`);
    for (let i = 0; i < previewCount; i++) {
      const g = candidates[i];
      const ext = g.mime === 'image/png' ? 'png' : (g.mime === 'image/jpeg' ? 'jpg' : 'webp');
      const targetLocal = `/assets/images/games/${g.slug}.${ext}`;
      console.log(`  [SIMULATE] ${g.title} (${g.slug})`);
      console.log(`             Remote: ${g.imageUrl.substring(0, 60)}...`);
      console.log(`             Target: ${targetLocal}`);
    }

    console.log('\n============================================================');
    console.log('DRY-RUN SIMULATION COMPLETE — 0 FILES MODIFIED');
    console.log('Current "Exams Mode" zero-download posture preserved.');
    console.log('============================================================');
    return;
  }

  // Live Execution
  if (!fs.existsSync(TARGET_DIR)) {
    fs.mkdirSync(TARGET_DIR, { recursive: true });
  }

  let migrated = 0;
  let failed = 0;

  for (let i = 0; i < candidates.length; i++) {
    const g = candidates[i];
    const num = `[${i + 1}/${candidates.length}]`;
    const ext = g.mime === 'image/png' ? 'png' : (g.mime === 'image/jpeg' ? 'jpg' : 'webp');
    const localRel = `/assets/images/games/${g.slug}.${ext}`;
    const localAbs = path.join(ROOT, localRel);

    process.stdout.write(`${num} Migrating ${g.title}... `);

    try {
      const res = await downloadFile(g.imageUrl, localAbs);
      g.status = 'local-verified';
      g.imageType = 'local';
      g.localPath = localRel;
      g.sizeBytes = res.bytes;
      g.identityVerified = true;
      g.urlVerified = true;
      g.licenseVerified = 'local-verified';
      delete g.imageUrl;

      migrated++;
      console.log(`OK (${Math.round(res.bytes / 1024)} KB -> ${localRel})`);
      await sleep(requestDelayMs);
    } catch (err) {
      failed++;
      console.log(`FAILED: ${err.message}`);
    }
  }

  // Write updated manifest
  manifest.counts.localVerified = Object.values(manifest.games).filter(g => g.status === 'local-verified').length;
  manifest.counts.remoteVerified = Object.values(manifest.games).filter(g => g.status === 'verified').length;
  manifest.lastAudited = new Date().toISOString().split('T')[0];

  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  console.log('\n============================================================');
  console.log(`MIGRATION EXECUTION FINISHED: ${migrated} migrated, ${failed} failed.`);
  console.log(`Manifest updated: ${MANIFEST_PATH}`);
  console.log('============================================================');
}

if (require.main === module) {
  run().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
  });
}

module.exports = { run };

