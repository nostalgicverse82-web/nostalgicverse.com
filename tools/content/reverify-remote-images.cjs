/**
 * NostalgicVerse — Re-verify Remote Game Images Pipeline
 * Re-validates remote URLs using Range GET to avoid CDN 429 rate limits,
 * updates resolved URLs, and finalizes data/remote-game-images.json.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '../..');
const manifestPath = path.join(ROOT, 'data', 'remote-game-images.json');

// Explicitly discovered verified assets for specific games
const SPECIFIC_OVERRIDES = {
  'pong': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/32/Signed_Pong_Cabinet.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Signed_Pong_Cabinet.jpg',
    sourceDomain: 'upload.wikimedia.org',
    license: 'CC BY-SA 4.0 / Archival Preservation Asset',
    dimensions: { width: 2990, height: 4912 }
  },
  'colossal-cave-adventure': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/2/25/ADVENT_--_Crowther_Woods.png',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:ADVENT_--_Crowther_Woods.png',
    sourceDomain: 'upload.wikimedia.org',
    license: 'Public Domain / Historic Source Artifact',
    dimensions: { width: 668, height: 501 }
  },
  'sonic-the-hedgehog': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/b/ba/Sonic_the_Hedgehog_1_Genesis_box_art.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/File:Sonic_the_Hedgehog_1_Genesis_box_art.jpg',
    sourceDomain: 'upload.wikimedia.org',
    license: 'Fair Use / Archival Historical Cover Art',
    dimensions: { width: 256, height: 358 }
  },
  'final-fantasy-vii': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/c/c2/Final_Fantasy_VII_Box_Art.jpg',
    sourceUrl: 'https://en.wikipedia.org/wiki/File:Final_Fantasy_VII_Box_Art.jpg',
    sourceDomain: 'upload.wikimedia.org',
    license: 'Fair Use / Archival Historical Cover Art',
    dimensions: { width: 256, height: 256 }
  },
  'banjo-kazooie': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/1/12/Banjo_Kazooie_Cover.png',
    sourceUrl: 'https://en.wikipedia.org/wiki/File:Banjo_Kazooie_Cover.png',
    sourceDomain: 'upload.wikimedia.org',
    license: 'Fair Use / Archival Historical Cover Art',
    dimensions: { width: 250, height: 177 }
  },
  'castlevania': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/5/51/Castlevania_1_cover.png',
    sourceUrl: 'https://en.wikipedia.org/wiki/File:Castlevania_1_cover.png',
    sourceDomain: 'upload.wikimedia.org',
    license: 'Fair Use / Archival Historical Cover Art',
    dimensions: { width: 250, height: 346 }
  },
  'frogger': {
    imageUrl: 'https://upload.wikimedia.org/wikipedia/en/c/cd/Frogger_game_arcade.png',
    sourceUrl: 'https://en.wikipedia.org/wiki/File:Frogger_game_arcade.png',
    sourceDomain: 'upload.wikimedia.org',
    license: 'Fair Use / Archival Arcade Flyer Artwork',
    dimensions: { width: 256, height: 345 }
  },
  'undertale': {
    imageUrl: 'https://cdn.akamai.steamstatic.com/steam/apps/391540/header.jpg',
    sourceUrl: 'https://store.steampowered.com/app/391540/Undertale/',
    sourceDomain: 'cdn.akamai.steamstatic.com',
    license: 'Promotional Storefront Asset / Official Key Art',
    dimensions: { width: 460, height: 215 }
  }
};

function verifyRangeGet(url) {
  return new Promise(resolve => {
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Range': 'bytes=0-1024'
      },
      timeout: 10000
    };
    https.get(url, options, res => {
      const status = res.statusCode;
      const contentType = (res.headers['content-type'] || '').toLowerCase();
      const isOk = (status === 200 || status === 206) && contentType.startsWith('image/');
      resolve({
        ok: isOk,
        statusCode: status,
        contentType: contentType,
        contentLength: parseInt(res.headers['content-length'] || '0', 10)
      });
    }).on('error', err => {
      resolve({ ok: false, error: err.message });
    }).on('timeout', () => {
      resolve({ ok: false, error: 'Timed out' });
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('============================================================');
  console.log('RE-VERIFYING REMOTE GAME IMAGE ASSETS');
  console.log('============================================================\n');

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const domainSet = new Set(manifest.domainsUsed || []);

  const entries = Object.entries(manifest.games);
  let updatedCount = 0;

  for (let i = 0; i < entries.length; i++) {
    const [slug, item] = entries[i];

    // Apply specific override if present
    if (SPECIFIC_OVERRIDES[slug]) {
      const ov = SPECIFIC_OVERRIDES[slug];
      item.imageUrl = ov.imageUrl;
      item.sourceUrl = ov.sourceUrl;
      item.sourceDomain = ov.sourceDomain;
      item.license = ov.license;
      if (ov.dimensions) item.dimensions = ov.dimensions;
    }

    // If already local-verified, keep
    if (item.status === 'local-verified') continue;

    // If verified, verify again only if previously errored or newly set
    if (item.status === 'verified' && !SPECIFIC_OVERRIDES[slug]) continue;

    if (!item.imageUrl) {
      item.status = 'review-required';
      item.fallbackAvailable = true;
      continue;
    }

    process.stdout.write(`Testing [${slug}] -> ${item.imageUrl.substring(0, 60)}... `);

    const check = await verifyRangeGet(item.imageUrl);
    if (check.ok) {
      item.status = 'verified';
      item.imageType = 'remote';
      item.mime = check.contentType;
      item.verificationNotes = `Verified direct HTTP ${check.statusCode} [${check.contentType}] from ${new URL(item.imageUrl).hostname}`;
      item.fallbackAvailable = true;
      domainSet.add(new URL(item.imageUrl).hostname);
      console.log(`[PASS: ${check.statusCode} ${check.contentType}]`);
      updatedCount++;
    } else {
      item.status = 'review-required';
      item.verificationNotes = `HTTP check failed: ${check.statusCode || check.error}`;
      item.fallbackAvailable = true;
      console.log(`[FAIL: ${check.statusCode || check.error}]`);
    }

    await sleep(400); // 400ms courteous rate limit
  }

  // Recalculate totals
  manifest.counts = {
    localVerified: 0,
    remoteVerified: 0,
    reviewRequired: 0,
    missing: 0
  };

  for (const game of Object.values(manifest.games)) {
    if (game.status === 'local-verified') manifest.counts.localVerified++;
    else if (game.status === 'verified') manifest.counts.remoteVerified++;
    else if (game.status === 'review-required') manifest.counts.reviewRequired++;
    else manifest.counts.missing++;
  }

  manifest.domainsUsed = Array.from(domainSet);
  manifest.lastAudited = new Date().toISOString().split('T')[0];

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n============================================================');
  console.log('RE-VERIFICATION RESULTS');
  console.log('============================================================');
  console.log(`Total Games:       ${manifest.totalGames}`);
  console.log(`Local Verified:    ${manifest.counts.localVerified}`);
  console.log(`Remote Verified:   ${manifest.counts.remoteVerified}`);
  console.log(`Review Required:   ${manifest.counts.reviewRequired}`);
  console.log(`Missing:           ${manifest.counts.missing}`);
  console.log(`Domains Used:      ${manifest.domainsUsed.join(', ')}`);
  console.log(`Manifest File:     ${manifestPath}`);
  console.log('============================================================\n');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});

