const https = require('https');
const http = require('http');

const candidateImages = {
  // PS4 Landmarks
  'the-last-of-us-part-ii': 'https://upload.wikimedia.org/wikipedia/en/4/4f/TLOU_P2_Box_Art_2.png',
  'god-of-war-2018': 'https://upload.wikimedia.org/wikipedia/en/a/a7/God_of_War_4_cover.jpg',
  'horizon-zero-dawn': 'https://upload.wikimedia.org/wikipedia/en/9/93/Horizon_Zero_Dawn.jpg',
  'marvel-s-spider-man': 'https://upload.wikimedia.org/wikipedia/en/e/e1/Spider-Man_PS4_cover.jpg',
  'ghost-of-tsushima': 'https://upload.wikimedia.org/wikipedia/en/b/b6/Ghost_of_Tsushima.jpg',
  'uncharted-4-a-thief-s-end': 'https://upload.wikimedia.org/wikipedia/en/1/1a/Uncharted_4_box_artwork.png',
  'persona-5': 'https://upload.wikimedia.org/wikipedia/en/b/b0/Persona_5_cover_art.jpg',
  'death-stranding': 'https://upload.wikimedia.org/wikipedia/en/2/22/Death_Stranding.jpg',
  'detroit-become-human': 'https://upload.wikimedia.org/wikipedia/en/b/ba/Detroit_Become_Human_cover.jpg',
  'monster-hunter-world': 'https://upload.wikimedia.org/wikipedia/en/1/1b/Monster_Hunter_World_cover_art.jpg',
  'sekiro-shadows-die-twice': 'https://upload.wikimedia.org/wikipedia/en/6/6e/Sekiro_art.jpg',
  'final-fantasy-vii-remake': 'https://upload.wikimedia.org/wikipedia/en/c/ce/FFVIIR_ELL_Box_Art.png',
  'nier-automata': 'https://upload.wikimedia.org/wikipedia/en/2/21/Nier_Automata_cover_art.jpg',
  'until-dawn': 'https://upload.wikimedia.org/wikipedia/en/1/17/Until_Dawn_cover_art.jpg',

  // PS5 Landmarks
  'astro-bot': 'https://upload.wikimedia.org/wikipedia/en/8/87/Astro_Bot_cover_art.jpg',
  'astro-s-playroom': 'https://upload.wikimedia.org/wikipedia/en/c/c5/Astro%27s_Playroom_cover_art.png',
  'ratchet-clank-rift-apart': 'https://upload.wikimedia.org/wikipedia/en/f/fe/Ratchet_%26_Clank_-_Rift_Apart_cover_art.png',
  'returnal': 'https://upload.wikimedia.org/wikipedia/en/b/bf/Returnal_cover_art.jpg',
  'god-of-war-ragnarok': 'https://upload.wikimedia.org/wikipedia/en/e/ee/God_of_War_Ragnar%C3%B6k_cover.jpg',
  'horizon-forbidden-west': 'https://upload.wikimedia.org/wikipedia/en/6/69/Horizon_Forbidden_West_cover_art.jpg',
  'marvel-s-spider-man-2': 'https://upload.wikimedia.org/wikipedia/en/0/0f/Spider-Man_2_PS5_cover_art.jpeg',
  'gran-turismo-7': 'https://upload.wikimedia.org/wikipedia/en/1/14/Gran_Turismo_7_cover_art.jpg',
  'final-fantasy-xvi': 'https://upload.wikimedia.org/wikipedia/en/0/02/Final_Fantasy_XVI_cover_art.png',
  'final-fantasy-vii-rebirth': 'https://upload.wikimedia.org/wikipedia/en/a/a6/Final_Fantasy_VII_Rebirth_cover.png',
  'helldivers-2': 'https://upload.wikimedia.org/wikipedia/en/7/7b/Helldivers_2_cover_art.jpg',
  'stellar-blade': 'https://upload.wikimedia.org/wikipedia/en/0/0a/Stellar_Blade_cover_art.jpg',

  // 1970s
  'space-race': 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Space_Race_flyer.jpg',
  'gun-fight': 'https://upload.wikimedia.org/wikipedia/en/a/ae/Gun_Fight_Flyer.png',
  'night-driver': 'https://upload.wikimedia.org/wikipedia/en/e/e0/Night_Driver_Flyer.png',
  'space-wars': 'https://upload.wikimedia.org/wikipedia/en/e/e8/Space_Wars_flyer.jpg',

  // 1980s
  'defender-of-the-crown': 'https://upload.wikimedia.org/wikipedia/en/5/5e/Defender_of_the_crown_cover.jpg',
  'the-great-giana-sisters': 'https://upload.wikimedia.org/wikipedia/en/f/f6/The_Great_Giana_Sisters_Cover.jpg',
  'wasteland': 'https://upload.wikimedia.org/wikipedia/en/8/87/Wasteland_Cover.jpg',
  'populous': 'https://upload.wikimedia.org/wikipedia/en/f/fd/Populous_Cover.jpg',
  'wonder-boy-iii-the-dragon-s-trap': 'https://upload.wikimedia.org/wikipedia/en/f/f3/Wonder_Boy_III_The_Dragon%27s_Trap_Cover.jpg',
  'bonk-s-adventure': 'https://upload.wikimedia.org/wikipedia/en/5/53/BonksAdventure_box.jpg',

  // 1990s
  'star-fox': 'https://upload.wikimedia.org/wikipedia/en/5/52/Star_Fox_SNES.jpg',
  'daytona-usa': 'https://upload.wikimedia.org/wikipedia/en/7/7c/Daytona_USA_arcade_flyer.jpg',
  'panzer-dragoon': 'https://upload.wikimedia.org/wikipedia/en/9/91/Panzer_Dragoon_1_Cover.jpg',
  'sega-rally-championship': 'https://upload.wikimedia.org/wikipedia/en/b/b5/Sega_Rally_Championship_Flyer.jpg',
  'nights-into-dreams': 'https://upload.wikimedia.org/wikipedia/en/e/e1/Nights_into_dreams_cover.jpg',
  'the-curse-of-monkey-island': 'https://upload.wikimedia.org/wikipedia/en/e/e0/Curse_of_Monkey_Island_box.jpg',
  'unreal': 'https://upload.wikimedia.org/wikipedia/en/8/80/Unreal1cover.jpg',
  'everquest': 'https://upload.wikimedia.org/wikipedia/en/5/57/EverQuest_Box.jpg',
  'soulcalibur': 'https://upload.wikimedia.org/wikipedia/en/5/51/Soulcalibur_cover.jpg',

  // 2000s
  'max-payne': 'https://upload.wikimedia.org/wikipedia/en/b/b4/Max_Payne_Box_Art1.jpg',
  'burnout-3-takedown': 'https://upload.wikimedia.org/wikipedia/en/e/ed/Burnout_3_Takedown.jpg',
  'ninja-gaiden-2004': 'https://upload.wikimedia.org/wikipedia/en/9/99/NinjaGaidenXbox.jpg',
  'okami': 'https://upload.wikimedia.org/wikipedia/en/e/ed/Okami_cover.png',
  'gears-of-war': 'https://upload.wikimedia.org/wikipedia/en/8/82/Gears_of_War_box_artwork.png',
  'crysis': 'https://upload.wikimedia.org/wikipedia/en/1/1e/Crysis_boxart.JPG',
  'left-4-dead': 'https://upload.wikimedia.org/wikipedia/en/5/5b/Left4Dead_Windows_motr.jpg',
  'dead-space': 'https://upload.wikimedia.org/wikipedia/en/2/23/Dead_Space_Box_Art.jpg',
  'bayonetta': 'https://upload.wikimedia.org/wikipedia/en/8/84/Bayonetta_box_artwork.png',

  // 2010s
  'xenoblade-chronicles': 'https://upload.wikimedia.org/wikipedia/en/0/07/Xenoblade_box_art.png',
  'dishonored': 'https://upload.wikimedia.org/wikipedia/en/a/a2/Dishonored_box_art.jpg',
  'titanfall-2': 'https://upload.wikimedia.org/wikipedia/en/4/4b/Titanfall_2_box_art.jpg',
  'inside': 'https://upload.wikimedia.org/wikipedia/en/e/ec/Inside_poster.png',
  'celeste': 'https://upload.wikimedia.org/wikipedia/commons/0/0f/Celeste_box_art_full.png',
  'disco-elysium': 'https://upload.wikimedia.org/wikipedia/en/8/84/Disco_Elysium_poster.png',

  // 2020s
  'hades': 'https://upload.wikimedia.org/wikipedia/en/c/cc/Hades_cover_art.jpg',
  'half-life-alyx': 'https://upload.wikimedia.org/wikipedia/en/4/49/Half-Life_Alyx_Cover_Art.jpg',
  'hi-fi-rush': 'https://upload.wikimedia.org/wikipedia/en/c/c7/Hi-Fi_Rush_cover_art.jpg',
  'alan-wake-2': 'https://upload.wikimedia.org/wikipedia/en/e/ed/Alan_Wake_2_box_art.jpg',
  'baldur-s-gate-3': 'https://upload.wikimedia.org/wikipedia/en/1/12/Baldur%27s_Gate_3_cover_art.jpg'
};

async function testUrl(slug, url) {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = https.request({
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) NostalgicVerse/2.0 MuseumArchive',
          'Range': 'bytes=0-100'
        }
      }, (res) => {
        const status = res.statusCode;
        const contentType = res.headers['content-type'] || '';
        resolve({ slug, url, status, contentType });
      });
      req.on('error', (err) => resolve({ slug, url, status: 0, error: err.message }));
      req.setTimeout(8000, () => {
        req.destroy();
        resolve({ slug, url, status: 408, error: 'Timeout' });
      });
      req.end();
    } catch (e) {
      resolve({ slug, url, status: 0, error: e.message });
    }
  });
}

async function run() {
  const entries = Object.entries(candidateImages);
  console.log(`Testing ${entries.length} candidate URLs...`);
  const results = [];
  for (let i = 0; i < entries.length; i++) {
    const [slug, url] = entries[i];
    const res = await testUrl(slug, url);
    results.push(res);
    const pass = (res.status === 200 || res.status === 206) && res.contentType.startsWith('image/');
    console.log(`[${i+1}/${entries.length}] [${pass ? 'PASS' : 'FAIL ' + res.status + ' ' + res.contentType}] ${slug}`);
    await new Promise(r => setTimeout(r, 600));
  }
  const passed = results.filter(r => (r.status === 200 || r.status === 206) && (r.contentType || '').startsWith('image/'));
  console.log(`Passed: ${passed.length}/${entries.length}`);
  const failed = results.filter(r => !((r.status === 200 || r.status === 206) && (r.contentType || '').startsWith('image/')));
  if (failed.length > 0) {
    console.log('Failed entries:');
    failed.forEach(f => console.log(` - ${f.slug}: ${f.url} (status: ${f.status}, type: ${f.contentType})`));
  }
}

run();

