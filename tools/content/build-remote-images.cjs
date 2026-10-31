/**
 * NostalgicVerse — Remote Game Artwork Discovery & Validation Pipeline
 * Discovers, resolves, and verifies direct image URLs for all 143 games.
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '../..');

// Exact canonical Wikipedia page mappings for all 143 games
const WIKI_PAGE_MAP = {
  'computer-space': 'Computer Space',
  'pong': 'Pong',
  'breakout': 'Breakout (video game)',
  'colossal-cave-adventure': 'Colossal Cave Adventure',
  'zork': 'Zork',
  'space-invaders': 'Space Invaders',
  'adventure': 'Adventure (1980 video game)',
  'asteroids': 'Asteroids (video game)',
  'lunar-lander': 'Lunar Lander (1979 video game)',
  'battlezone': 'Battlezone (1980 video game)',
  'missile-command': 'Missile Command',
  'pac-man': 'Pac-Man',
  'rogue': 'Rogue (video game)',
  'defender': 'Defender (1981 video game)',
  'donkey-kong': 'Donkey Kong (video game)',
  'frogger': 'Frogger',
  'galaga': 'Galaga',
  'tempest': 'Tempest (video game)',
  'joust': 'Joust (video game)',
  'ms-pac-man': 'Ms. Pac-Man',
  'pitfall': 'Pitfall!',
  'pole-position': 'Pole Position (video game)',
  'yars-revenge': "Yars' Revenge",
  'dragon-s-lair': "Dragon's Lair (1983 video game)",
  'elite': 'Elite (video game)',
  'marble-madness': 'Marble Madness',
  'tetris': 'Tetris',
  'ghosts-n-goblins': "Ghosts 'n Goblins (video game)",
  'gradius': 'Gradius (video game)',
  'super-mario-bros': 'Super Mario Bros.',
  'castlevania': 'Castlevania (video game)',
  'dragon-quest': 'Dragon Quest (video game)',
  'metroid': 'Metroid (video game)',
  'out-run': 'Out Run',
  'the-legend-of-zelda': 'The Legend of Zelda (video game)',
  'contra': 'Contra (video game)',
  'final-fantasy': 'Final Fantasy (video game)',
  'phantasy-star': 'Phantasy Star (video game)',
  'mega-man-2': 'Mega Man 2',
  'ninja-gaiden': 'Ninja Gaiden (NES video game)',
  'super-mario-bros-3': 'Super Mario Bros. 3',
  'prince-of-persia': 'Prince of Persia (1989 video game)',
  'simcity': 'SimCity (1989 video game)',
  'f-zero': 'F-Zero (video game)',
  'super-mario-world': 'Super Mario World',
  'the-secret-of-monkey-island': 'The Secret of Monkey Island',
  'civilization': 'Civilization (video game)',
  'sonic-the-hedgehog': 'Sonic the Hedgehog (1991 video game)',
  'street-fighter-ii': 'Street Fighter II: The World Warrior',
  'the-legend-of-zelda-a-link-to-the-past': 'The Legend of Zelda: A Link to the Past',
  'alone-in-the-dark': 'Alone in the Dark (1992 video game)',
  'dune-ii': 'Dune II',
  'mortal-kombat': 'Mortal Kombat (1992 video game)',
  'sonic-the-hedgehog-2': 'Sonic the Hedgehog 2',
  'super-mario-kart': 'Super Mario Kart',
  'wolfenstein-3d': 'Wolfenstein 3D',
  'castlevania-rondo-of-blood': 'Castlevania: Rondo of Blood',
  'doom': 'Doom (1993 video game)',
  'myst': 'Myst (video game)',
  'secret-of-mana': 'Secret of Mana',
  'virtua-fighter': 'Virtua Fighter (video game)',
  'donkey-kong-country': 'Donkey Kong Country',
  'earthbound': 'EarthBound',
  'final-fantasy-vi': 'Final Fantasy VI',
  'super-metroid': 'Super Metroid',
  'chrono-trigger': 'Chrono Trigger',
  'command-conquer': 'Command & Conquer (1995 video game)',
  'wipeout': 'Wipeout (video game)',
  'crash-bandicoot': 'Crash Bandicoot (video game)',
  'diablo': 'Diablo (video game)',
  'metal-slug': 'Metal Slug (video game)',
  'pokemon-red-blue': 'Pokémon Red, Blue, and Yellow',
  'quake': 'Quake (video game)',
  'resident-evil': 'Resident Evil (1996 video game)',
  'super-mario-64': 'Super Mario 64',
  'tomb-raider': 'Tomb Raider (1996 video game)',
  'castlevania-symphony-of-the-night': 'Castlevania: Symphony of the Night',
  'fallout': 'Fallout (video game)',
  'final-fantasy-vii': 'Final Fantasy VII',
  'goldeneye-007': 'GoldenEye 007 (1997 video game)',
  'gran-turismo': 'Gran Turismo (1997 video game)',
  'baldur-s-gate': "Baldur's Gate (video game)",
  'banjo-kazooie': 'Banjo-Kazooie',
  'half-life': 'Half-Life (video game)',
  'metal-gear-solid': 'Metal Gear Solid (1998 video game)',
  'panzer-dragoon-saga': 'Panzer Dragoon Saga',
  'resident-evil-2': 'Resident Evil 2 (1998 video game)',
  'starcraft': 'StarCraft (video game)',
  'the-legend-of-zelda-ocarina-of-time': 'The Legend of Zelda: Ocarina of Time',
  'thief-the-dark-project': 'Thief: The Dark Project',
  'shenmue': 'Shenmue (video game)',
  'silent-hill': 'Silent Hill (video game)',
  'super-smash-bros': 'Super Smash Bros. (video game)',
  'system-shock-2': 'System Shock 2',
  'deus-ex': 'Deus Ex (video game)',
  'diablo-ii': 'Diablo II',
  'phantasy-star-online': 'Phantasy Star Online',
  'the-sims': 'The Sims (video game)',
  'tony-hawk-s-pro-skater-2': "Tony Hawk's Pro Skater 2",
  'grand-theft-auto-iii': 'Grand Theft Auto III',
  'halo-combat-evolved': 'Halo: Combat Evolved',
  'ico': 'Ico',
  'metal-gear-solid-2-sons-of-liberty': 'Metal Gear Solid 2: Sons of Liberty',
  'silent-hill-2': 'Silent Hill 2 (2001 video game)',
  'super-smash-bros-melee': 'Super Smash Bros. Melee',
  'metroid-prime': 'Metroid Prime',
  'the-elder-scrolls-iii-morrowind': 'The Elder Scrolls III: Morrowind',
  'the-legend-of-zelda-the-wind-waker': 'The Legend of Zelda: The Wind Waker',
  'star-wars-knights-of-the-old-republic': 'Star Wars: Knights of the Old Republic (video game)',
  'grand-theft-auto-san-andreas': 'Grand Theft Auto: San Andreas',
  'half-life-2': 'Half-Life 2',
  'world-of-warcraft': 'World of Warcraft',
  'god-of-war': 'God of War (2005 video game)',
  'resident-evil-4': 'Resident Evil 4 (2005 video game)',
  'shadow-of-the-colossus': 'Shadow of the Colossus',
  'the-elder-scrolls-iv-oblivion': 'The Elder Scrolls IV: Oblivion',
  'wii-sports': 'Wii Sports',
  'bioshock': 'BioShock',
  'call-of-duty-4-modern-warfare': 'Call of Duty 4: Modern Warfare',
  'mass-effect': 'Mass Effect (video game)',
  'portal': 'Portal (video game)',
  'super-mario-galaxy': 'Super Mario Galaxy',
  'braid': 'Braid (video game)',
  'fallout-3': 'Fallout 3',
  'demons-souls': "Demon's Souls",
  'uncharted-2-among-thieves': 'Uncharted 2: Among Thieves',
  'mass-effect-2': 'Mass Effect 2',
  'red-dead-redemption': 'Red Dead Redemption',
  'dark-souls': 'Dark Souls (video game)',
  'minecraft': 'Minecraft',
  'portal-2': 'Portal 2',
  'the-elder-scrolls-v-skyrim': 'The Elder Scrolls V: Skyrim',
  'journey': 'Journey (2012 video game)',
  'grand-theft-auto-v': 'Grand Theft Auto V',
  'the-last-of-us': 'The Last of Us (video game)',
  'bloodborne': 'Bloodborne',
  'the-witcher-3-wild-hunt': 'The Witcher 3: Wild Hunt',
  'undertale': 'Undertale',
  'hollow-knight': 'Hollow Knight',
  'super-mario-odyssey': 'Super Mario Odyssey',
  'the-legend-of-zelda-breath-of-the-wild': 'The Legend of Zelda: Breath of the Wild',
  'red-dead-redemption-2': 'Red Dead Redemption 2',
  'elden-ring': 'Elden Ring'
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { 'User-Agent': 'NostalgicVerseArchivalBot/1.0 (https://nostalgicverse.com; archive@nostalgicverse.com)' }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function getWikiInfoboxImage(pageTitle) {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&section=0&format=json`;
  return fetchJson(url).then(json => {
    if (!json.parse || !json.parse.wikitext) return null;
    const wt = json.parse.wikitext['*'];
    const match = wt.match(/\|\s*image\s*=\s*([^|\n\r}]+)/i);
    if (!match) return null;
    let img = match[1].trim();
    img = img.replace(/^\[\[(File|Image):/i, '').replace(/\|.*$/, '').replace(/\]\]$/, '').trim();
    return img;
  }).catch(() => null);
}

function getWikiFileInfo(fileName) {
  let cleanName = fileName.replace(/^(File|Image):/i, '').trim();
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=File:${encodeURIComponent(cleanName)}&prop=imageinfo&iiprop=url|size|mime&format=json`;
  return fetchJson(url).then(json => {
    if (!json.query || !json.query.pages) return null;
    const pages = json.query.pages;
    const pid = Object.keys(pages)[0];
    if (pid === '-1' || !pages[pid].imageinfo || !pages[pid].imageinfo.length) return null;
    const info = pages[pid].imageinfo[0];
    return {
      url: info.url.split('?')[0],
      sourceUrl: info.descriptionurl || `https://en.wikipedia.org/wiki/File:${encodeURIComponent(cleanName)}`,
      mime: info.mime,
      width: info.width,
      height: info.height,
      size: info.size
    };
  }).catch(() => null);
}

function verifyRemoteUrl(imgUrl) {
  return new Promise((resolve) => {
    const req = https.request(imgUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
      },
      timeout: 10000
    }, res => {
      const status = res.statusCode;
      const contentType = res.headers['content-type'] || '';
      const validStatus = status === 200 || status === 304;
      const isImage = contentType.toLowerCase().startsWith('image/');
      resolve({
        ok: validStatus && isImage,
        statusCode: status,
        contentType: contentType,
        contentLength: parseInt(res.headers['content-length'] || '0', 10)
      });
    });
    req.on('error', err => {
      resolve({ ok: false, error: err.message });
    });
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Request timed out' });
    });
    req.end();
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('============================================================');
  console.log('NOSTALGICVERSE REMOTE GAME IMAGE DISCOVERY & VALIDATION');
  console.log('============================================================\n');

  const gamesDataPath = path.join(ROOT, 'data', 'games.json');
  const games = JSON.parse(fs.readFileSync(gamesDataPath, 'utf8')).games;

  console.log(`Processing all ${games.length} games...\n`);

  const manifest = {
    $schema: "https://nostalgicverse.com/schemas/remote-images.schema.json",
    description: "Verified direct remote image URLs for NostalgicVerse game exhibits.",
    lastAudited: new Date().toISOString().split('T')[0],
    totalGames: games.length,
    counts: {
      localVerified: 0,
      remoteVerified: 0,
      reviewRequired: 0,
      missing: 0
    },
    domainsUsed: [],
    games: {}
  };

  const domainSet = new Set();

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    const slug = game.slug;
    const title = game.title;
    const year = game.originalReleaseYear;
    const num = String(i + 1).padStart(3, ' ');

    process.stdout.write(`[${num}/${games.length}] ${title} (${year})... `);

    // Check for existing local image
    const localWebp = path.join(ROOT, 'assets', 'images', 'games', `${slug}.webp`);
    const localPng = path.join(ROOT, 'assets', 'images', 'games', `${slug}.png`);
    const legacyLocalPng = path.join(ROOT, 'assets', 'images', 'games', `${slug.replace(/-/g, '')}.png`);

    if (fs.existsSync(localWebp)) {
      console.log('LOCAL VERIFIED (webp)');
      manifest.counts.localVerified++;
      manifest.games[slug] = {
        slug,
        title,
        status: 'local-verified',
        imageType: 'local',
        localPath: `/assets/images/games/${slug}.webp`,
        sourceDomain: 'local',
        license: 'Archival Local Asset',
        fallbackAvailable: true
      };
      continue;
    }

    if (fs.existsSync(localPng)) {
      console.log('LOCAL VERIFIED (png)');
      manifest.counts.localVerified++;
      manifest.games[slug] = {
        slug,
        title,
        status: 'local-verified',
        imageType: 'local',
        localPath: `/assets/images/games/${slug}.png`,
        sourceDomain: 'local',
        license: 'Archival Local Asset',
        fallbackAvailable: true
      };
      continue;
    }

    if (fs.existsSync(legacyLocalPng)) {
      console.log('LOCAL VERIFIED (legacy png)');
      manifest.counts.localVerified++;
      manifest.games[slug] = {
        slug,
        title,
        status: 'local-verified',
        imageType: 'local',
        localPath: `/assets/images/games/${path.basename(legacyLocalPng)}`,
        sourceDomain: 'local',
        license: 'Archival Local Asset',
        fallbackAvailable: true
      };
      continue;
    }

    // Remote discovery
    const pageTitle = WIKI_PAGE_MAP[slug] || title;
    let imgName = await getWikiInfoboxImage(pageTitle);

    if (!imgName) {
      // Fallback search with "video game"
      const searchRes = await fetchJson(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(title + ' video game')}&format=json`).catch(() => null);
      if (searchRes && searchRes.query && searchRes.query.search && searchRes.query.search[0]) {
        imgName = await getWikiInfoboxImage(searchRes.query.search[0].title);
      }
    }

    if (!imgName) {
      console.log('REVIEW REQUIRED (no image found in infobox)');
      manifest.counts.reviewRequired++;
      manifest.games[slug] = {
        slug,
        title,
        status: 'review-required',
        imageUrl: null,
        sourceUrl: null,
        sourceDomain: null,
        license: 'review-required',
        verificationNotes: 'No infobox image found on primary source page',
        fallbackAvailable: true
      };
      await sleep(150);
      continue;
    }

    const fileInfo = await getWikiFileInfo(imgName);
    if (!fileInfo || !fileInfo.url) {
      console.log(`REVIEW REQUIRED (could not resolve file: ${imgName})`);
      manifest.counts.reviewRequired++;
      manifest.games[slug] = {
        slug,
        title,
        status: 'review-required',
        imageUrl: null,
        sourceUrl: null,
        sourceDomain: null,
        license: 'review-required',
        verificationNotes: `Failed to resolve File:${imgName}`,
        fallbackAvailable: true
      };
      await sleep(150);
      continue;
    }

    // HTTP verification test
    const check = await verifyRemoteUrl(fileInfo.url);
    if (check.ok) {
      const urlObj = new URL(fileInfo.url);
      domainSet.add(urlObj.hostname);
      console.log(`REMOTE VERIFIED (${check.contentType}, ${fileInfo.width}x${fileInfo.height})`);
      manifest.counts.remoteVerified++;
      manifest.games[slug] = {
        slug,
        title,
        status: 'verified',
        imageType: 'remote',
        imageUrl: fileInfo.url,
        sourceUrl: fileInfo.sourceUrl,
        sourceDomain: urlObj.hostname,
        mime: fileInfo.mime || check.contentType,
        dimensions: {
          width: fileInfo.width,
          height: fileInfo.height
        },
        sizeBytes: fileInfo.size || check.contentLength,
        license: 'Fair Use / Archival Historical Cover Art',
        verificationNotes: `Verified direct HTTP 200 [${check.contentType}] from ${urlObj.hostname}`,
        fallbackAvailable: true
      };
    } else {
      console.log(`REVIEW REQUIRED (HTTP check failed: ${check.statusCode || check.error})`);
      manifest.counts.reviewRequired++;
      manifest.games[slug] = {
        slug,
        title,
        status: 'review-required',
        imageUrl: fileInfo.url,
        sourceUrl: fileInfo.sourceUrl,
        sourceDomain: 'upload.wikimedia.org',
        license: 'review-required',
        verificationNotes: `HTTP validation failed: ${check.statusCode || check.error}`,
        fallbackAvailable: true
      };
    }

    await sleep(200); // Respectful rate limiting for Wikimedia servers
  }

  manifest.domainsUsed = Array.from(domainSet);

  const outPath = path.join(ROOT, 'data', 'remote-game-images.json');
  fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('\n============================================================');
  console.log('DISCOVERY & VALIDATION SUMMARY');
  console.log('============================================================');
  console.log(`Total Games Audited:  ${manifest.totalGames}`);
  console.log(`Local Verified:       ${manifest.counts.localVerified}`);
  console.log(`Remote Verified:      ${manifest.counts.remoteVerified}`);
  console.log(`Review Required:      ${manifest.counts.reviewRequired}`);
  console.log(`Missing:              ${manifest.counts.missing}`);
  console.log(`Domains Used:         ${manifest.domainsUsed.join(', ')}`);
  console.log(`Output Saved:         ${outPath}`);
  console.log('============================================================\n');
}

run().catch(err => {
  console.error('Fatal error in discovery pipeline:', err);
  process.exit(1);
});

