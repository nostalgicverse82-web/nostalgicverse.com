const path = require('path');
const puppeteerPath = path.resolve(__dirname, '../../scratch/browser-test/node_modules/puppeteer');
let puppeteer;
try {
  puppeteer = require(puppeteerPath);
} catch (e) {
  console.error("Puppeteer not found.");
  process.exit(1);
}

const http = require('http');

async function checkServer() {
  return new Promise((resolve) => {
    http.get('http://localhost:3000/', (res) => resolve(res.statusCode === 200))
        .on('error', () => resolve(false));
  });
}

(async () => {
  console.log('Starting 60s Homepage Main Sections QA...');
  if (!(await checkServer())) {
    console.error('FAIL: Server not running.');
    process.exit(1);
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  let pageErrors = [];
  let imageErrors = [];
  page.on('pageerror', err => pageErrors.push(err));
  page.on('response', res => {
    if (res.status() >= 400 && res.request().resourceType() === 'image') {
      // It's okay if it's falling back, but we track it.
      imageErrors.push(res.url());
    }
  });

  await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2' });

  async function getGridState(selector, titleSel, imgSel) {
    return await page.evaluate((s, ts, is) => {
      const grid = document.querySelector(s);
      if (!grid) return null;
      
      const cards = Array.from(grid.querySelectorAll('article'));
      return {
        visible: grid.offsetHeight > 50 && window.getComputedStyle(grid).display !== 'none',
        opacity: window.getComputedStyle(grid).opacity,
        cards: cards.map(c => {
          const t = c.querySelector(ts);
          const i = c.querySelector(is);
          const a = c.querySelector('a');
          return {
            title: t ? t.innerText.trim() : '',
            image: i ? i.src : '',
            href: a ? a.href : ''
          };
        })
      };
    }, selector, titleSel, imgSel);
  }

  let blankStatesObserved = 0;
  let gamesTransitions = 0;
  let consolesTransitions = 0;
  
  let lastGamesCards = null;
  let lastConsolesCards = null;

  const logs = {};

  for (let s = 0; s <= 60; s++) {
    const gamesState = await getGridState('.curated-games-grid', '.game-card-title', '.game-artwork');
    const consolesState = await getGridState('.consoles-grid', '.console-card-title', '.console-image');

    if (!gamesState || !consolesState) {
      console.error('FAIL: Grids missing.');
      process.exit(1);
    }

    if (!gamesState.visible || !consolesState.visible) {
      blankStatesObserved++;
    }

    if (s === 0) {
      logs['0s'] = { games: gamesState, consoles: consolesState };
      lastGamesCards = JSON.stringify(gamesState.cards);
      lastConsolesCards = JSON.stringify(consolesState.cards);
    }

    if (s % 10 === 0 && s > 0) {
      logs[`${s}s`] = { games: gamesState, consoles: consolesState };
      const curG = JSON.stringify(gamesState.cards);
      const curC = JSON.stringify(consolesState.cards);
      
      if (curG !== lastGamesCards) gamesTransitions++;
      if (curC !== lastConsolesCards) consolesTransitions++;
      
      lastGamesCards = curG;
      lastConsolesCards = curC;
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  await browser.close();

  // Print Report Format
  console.log(`\nLIVE BROWSER:`);
  console.log(`- observed duration: 60s`);
  console.log(`- visible game transitions: ${gamesTransitions}`);
  console.log(`- visible console transitions: ${consolesTransitions}`);
  console.log(`- blank states observed: ${blankStatesObserved}`);
  console.log(`- browser errors: ${pageErrors.length}`);
  console.log(`- image errors: ${imageErrors.length} (recorded network failures)`);
  
  if (blankStatesObserved > 0) {
    console.error('FAIL: Blank states were observed during the rotation. The grids became invisible or 0-height.');
    process.exit(1);
  }
  
  if (gamesTransitions === 0 || consolesTransitions === 0) {
    console.error('FAIL: Transitions failed to occur.');
    process.exit(1);
  }
  
  console.log('\n--- GAMES SAMPLING ---');
  Object.keys(logs).forEach(k => {
    console.log(`[${k}] Games: ` + logs[k].games.cards.map(c => c.title).join(', '));
    console.log(`[${k}] Consoles: ` + logs[k].consoles.cards.map(c => c.title).join(', '));
  });
})();
