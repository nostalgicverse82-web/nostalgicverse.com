/**
 * NostalgicVerse — Apply Homepage Discovery Engine
 * Integrates rotating discovery showcase into index.html
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const indexPath = path.join(ROOT, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf8');

// Load rankings and master datasets
const rankings = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/discovery-rankings.json'), 'utf8'));
const gamesMaster = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/games.json'), 'utf8')).games;
const consolesMaster = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/consoles.json'), 'utf8')).consoles;

// Prepare diverse exploration pool (games and consoles)
const discoveryPool = [];

// 1. Add diverse games
const featuredGameSlugs = new Set(['metal-gear-solid', 'final-fantasy-vii', 'super-metroid', 'the-legend-of-zelda-ocarina-of-time', 'doom']);
gamesMaster.forEach(g => {
  if (!featuredGameSlugs.has(g.slug)) {
    discoveryPool.push({
      id: g.id,
      type: 'game',
      typeName: 'Game Exhibit',
      badgeClass: 'badge-game',
      slug: g.slug,
      title: g.title,
      meta: `${g.originalReleaseYear} · ${g.originalLaunchPlatform}`,
      metaSecondary: g.developer,
      genre: g.genre,
      era: g.era,
      summary: g.shortDescription || g.historicalSignificance,
      url: `/games/${g.slug}/`
    });
  }
});

// 2. Add diverse consoles
const featuredConsoleSlugs = new Set(['nintendo-entertainment-system', 'sega-genesis', 'game-boy', 'playstation']);
consolesMaster.forEach(c => {
  if (!featuredConsoleSlugs.has(c.slug)) {
    discoveryPool.push({
      id: c.id,
      type: 'console',
      typeName: 'Hardware Specimen',
      badgeClass: 'badge-console',
      slug: c.slug,
      name: c.name,
      title: c.name,
      meta: `${c.originalReleaseYear} · ${c.generation}`,
      metaSecondary: c.manufacturer,
      generation: c.generation,
      summary: c.significance || c.historicalSignificance || (c.editorialContent && c.editorialContent.overview) || 'A preserved hardware platform in the permanent museum archives.',
      url: `/consoles/${c.slug}/`
    });
  }
});

console.log(`Compiled discovery pool with ${discoveryPool.length} items (${discoveryPool.filter(i => i.type === 'game').length} games, ${discoveryPool.filter(i => i.type === 'console').length} consoles).`);

// Initial 6 items (3 diverse games across 1970s-2010s, 3 diverse consoles across Gen 1-7)
const initialItems = [
  discoveryPool.find(i => i.slug === 'missile-command'),
  discoveryPool.find(i => i.slug === 'dreamcast'),
  discoveryPool.find(i => i.slug === 'myst'),
  discoveryPool.find(i => i.slug === 'super-nintendo-entertainment-system'),
  discoveryPool.find(i => i.slug === 'shadow-of-the-colossus'),
  discoveryPool.find(i => i.slug === 'atari-2600')
].filter(Boolean);

// 1. Inject CSS for Discovery Engine
const discoveryCss = `
    /* ==========================================================================
       11. ARCHIVE DISCOVERY ENGINE (DYNAMIC ROTATION)
       ========================================================================== */
    .discovery-engine-section {
      padding-block: 88px;
      background: linear-gradient(180deg, rgba(8, 8, 12, 0) 0%, rgba(14, 14, 22, 0.7) 50%, rgba(8, 8, 12, 0) 100%);
      border-top: 1px solid var(--nv-border);
      border-bottom: 1px solid var(--nv-border);
      position: relative;
    }

    .discovery-header {
      text-align: center;
      max-width: 780px;
      margin-inline: auto;
      margin-bottom: 32px;
    }

    .discovery-controls {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-top: 24px;
      margin-bottom: 36px;
    }

    .discovery-filter-btn {
      font-family: var(--nv-font-mono);
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 8px 16px;
      background: var(--nv-surface);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-sm);
      color: var(--nv-text-secondary);
      cursor: pointer;
      transition: all var(--nv-transition-fast);
    }

    .discovery-filter-btn:hover,
    .discovery-filter-btn.is-active {
      background: var(--nv-surface-raised);
      border-color: var(--nv-cyan);
      color: var(--nv-cyan);
      box-shadow: 0 0 12px rgba(0, 240, 255, 0.15);
    }

    .discovery-reroll-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--nv-font-mono);
      font-size: 0.78rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 8px 18px;
      background: rgba(0, 240, 255, 0.08);
      border: 1px solid var(--nv-cyan);
      border-radius: var(--nv-radius-sm);
      color: var(--nv-cyan);
      cursor: pointer;
      transition: all var(--nv-transition-fast);
    }

    .discovery-reroll-btn:hover {
      background: var(--nv-cyan);
      color: #08080C;
      box-shadow: 0 0 18px rgba(0, 240, 255, 0.35);
      transform: translateY(-1px);
    }

    .discovery-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 24px;
      margin-bottom: 40px;
    }

    @media (min-width: 640px) {
      .discovery-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (min-width: 1024px) {
      .discovery-grid {
        grid-template-columns: repeat(3, 1fr);
      }
    }

    .discovery-card {
      background: var(--nv-surface);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-md);
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
      transition: transform var(--nv-transition-normal), border-color var(--nv-transition-normal), box-shadow var(--nv-transition-normal);
    }

    .discovery-card:hover {
      border-color: var(--nv-cyan);
      transform: translateY(-3px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
    }

    .discovery-card-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }

    .discovery-badge {
      font-family: var(--nv-font-mono);
      font-size: 0.68rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: var(--nv-radius-sm);
    }

    .discovery-badge.badge-game {
      background: rgba(0, 240, 255, 0.08);
      color: var(--nv-cyan);
      border: 1px solid rgba(0, 240, 255, 0.25);
    }

    .discovery-badge.badge-console {
      background: rgba(255, 184, 0, 0.08);
      color: var(--nv-gold);
      border: 1px solid rgba(255, 184, 0, 0.25);
    }

    .discovery-title {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--nv-text-primary);
      margin-bottom: 6px;
      line-height: 1.25;
    }

    .discovery-meta {
      font-family: var(--nv-font-mono);
      font-size: 0.72rem;
      color: var(--nv-text-muted);
      margin-bottom: 12px;
    }

    .discovery-summary {
      font-size: 0.86rem;
      color: var(--nv-text-secondary);
      line-height: 1.5;
      margin-bottom: 18px;
      flex-grow: 1;
    }

    .discovery-action {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid rgba(255, 255, 255, 0.05);
      padding-top: 14px;
      margin-top: auto;
    }

    .discovery-terminal-banner {
      text-align: center;
      padding: 24px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px dashed var(--nv-border);
      border-radius: var(--nv-radius-md);
      max-width: 680px;
      margin-inline: auto;
    }

    .discovery-terminal-banner p {
      font-size: 0.92rem;
      color: var(--nv-text-secondary);
      margin-bottom: 12px;
    }
`;

// Insert CSS before closing </style>
if (!indexHtml.includes('.discovery-engine-section')) {
  const styleCloseIdx = indexHtml.indexOf('</style>');
  indexHtml = indexHtml.substring(0, styleCloseIdx) + discoveryCss + indexHtml.substring(styleCloseIdx);
}

// 2. Replace section 06. RANDOM DISCOVERY
function renderCardHtml(item) {
  return `            <article class="discovery-card" data-specimen-id="${item.id}" data-specimen-type="${item.type}">
              <div>
                <div class="discovery-card-top">
                  <span class="discovery-badge ${item.badgeClass}">${item.typeName}</span>
                  <button type="button" class="card-fav-btn" data-fav-id="${item.id}" data-fav-title="${item.title.replace(/"/g, '&quot;')}" data-fav-url="${item.url}" aria-label="Add ${item.title.replace(/"/g, '&quot;')} to favorites" title="Add to favorites">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                    </svg>
                  </button>
                </div>
                <h3 class="discovery-title">${item.title}</h3>
                <div class="discovery-meta">${item.meta} · ${item.metaSecondary}</div>
                <p class="discovery-summary">${item.summary}</p>
              </div>
              <div class="discovery-action">
                <a href="${item.url}" class="btn btn-inline">Examine Exhibit →</a>
              </div>
            </article>`;
}

const initialCardsHtml = initialItems.map(renderCardHtml).join('\n');

const newDiscoverySectionHtml = `    <!-- 06. ARCHIVAL DISCOVERY ENGINE -->
    <section class="discovery-engine-section" id="discovery-engine" aria-labelledby="discovery-heading">
      <div class="container">
        <div class="discovery-header reveal-on-scroll">
          <span class="catalog-tag tag-crimson">From the Archive // Dynamic Discovery</span>
          <h2 class="random-headline" id="discovery-heading">
            Explore Beyond the Canon.<br>
            <span>Discover Something New.</span>
          </h2>
          <p class="random-lead">
            Procedurally surfacing unexpected masterpieces, forgotten hardware breakthroughs, and chronological turning points from across 143 landmark games and 65 consoles.
          </p>

          <div class="discovery-controls" role="toolbar" aria-label="Discovery Controls">
            <button type="button" class="discovery-filter-btn is-active" data-discovery-filter="all">All Specimens</button>
            <button type="button" class="discovery-filter-btn" data-discovery-filter="game">Games Archive</button>
            <button type="button" class="discovery-filter-btn" data-discovery-filter="console">Hardware Systems</button>
            <button type="button" class="discovery-reroll-btn" id="discovery-reroll-btn" aria-label="Surprise me with a new randomized selection">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
              <span>Rotate Selection</span>
            </button>
          </div>
        </div>

        <div class="discovery-grid" id="discovery-grid" aria-live="polite">
${initialCardsHtml}
        </div>

        <div class="discovery-terminal-banner reveal-on-scroll">
          <p>Seeking single-specimen deep focus or algorithmic serendipity?</p>
          <a href="/random/" class="btn btn-primary">
            <span>Launch Random Discovery Terminal</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <polyline points="12 5 19 12 12 19"></polyline>
            </svg>
          </a>
        </div>
      </div>
    </section>`;

// Replace existing section 06
const randomSecStart = indexHtml.indexOf('<!-- 06. RANDOM DISCOVERY -->');
const storiesSecStart = indexHtml.indexOf('<!-- 07. EDITORIAL STORIES -->');

if (randomSecStart !== -1 && storiesSecStart !== -1) {
  indexHtml = indexHtml.substring(0, randomSecStart) + newDiscoverySectionHtml + '\n\n    ' + indexHtml.substring(storiesSecStart);
  console.log('Successfully replaced section 06 with Discovery Engine HTML!');
} else {
  console.warn('Could not find exact section markers for 06. RANDOM DISCOVERY');
}

// 3. Inject Client-side Discovery Rotation Script
const discoveryJs = `
      /* --------------------------------------------------------------------------
         09. HOMEPAGE DISCOVERY ENGINE (CLIENT-SIDE ROTATION)
         -------------------------------------------------------------------------- */
      const DISCOVERY_POOL = ${JSON.stringify(discoveryPool)};
      let currentDiscoveryFilter = 'all';

      function getRandomSubarray(arr, size) {
        const shuffled = arr.slice(0);
        let i = arr.length;
        let temp, index;
        while (i--) {
          index = Math.floor((i + 1) * Math.random());
          temp = shuffled[index];
          shuffled[index] = shuffled[i];
          shuffled[i] = temp;
        }
        return shuffled.slice(0, size);
      }

      function rotateDiscoveryGrid() {
        const grid = document.getElementById('discovery-grid');
        if (!grid) return;

        let eligible = DISCOVERY_POOL;
        if (currentDiscoveryFilter !== 'all') {
          eligible = DISCOVERY_POOL.filter(item => item.type === currentDiscoveryFilter);
        }

        const picks = getRandomSubarray(eligible, 6);
        grid.innerHTML = '';

        picks.forEach(item => {
          const card = document.createElement('article');
          card.className = 'discovery-card';
          card.setAttribute('data-specimen-id', item.id);
          card.setAttribute('data-specimen-type', item.type);

          const innerTop = document.createElement('div');
          
          const cardTop = document.createElement('div');
          cardTop.className = 'discovery-card-top';

          const badge = document.createElement('span');
          badge.className = 'discovery-badge ' + item.badgeClass;
          badge.textContent = item.typeName;

          const favBtn = document.createElement('button');
          favBtn.type = 'button';
          favBtn.className = 'card-fav-btn';
          favBtn.setAttribute('data-fav-id', item.id);
          favBtn.setAttribute('data-fav-title', item.title);
          favBtn.setAttribute('data-fav-url', item.url);
          favBtn.setAttribute('aria-label', 'Add ' + item.title + ' to favorites');
          favBtn.setAttribute('title', 'Add to favorites');
          favBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';

          cardTop.appendChild(badge);
          cardTop.appendChild(favBtn);

          const title = document.createElement('h3');
          title.className = 'discovery-title';
          title.textContent = item.title;

          const meta = document.createElement('div');
          meta.className = 'discovery-meta';
          meta.textContent = item.meta + ' · ' + item.metaSecondary;

          const summary = document.createElement('p');
          summary.className = 'discovery-summary';
          summary.textContent = item.summary;

          innerTop.appendChild(cardTop);
          innerTop.appendChild(title);
          innerTop.appendChild(meta);
          innerTop.appendChild(summary);

          const action = document.createElement('div');
          action.className = 'discovery-action';
          const link = document.createElement('a');
          link.className = 'btn btn-inline';
          link.href = item.url;
          link.textContent = 'Examine Exhibit →';
          action.appendChild(link);

          card.appendChild(innerTop);
          card.appendChild(action);

          grid.appendChild(card);
        });

        if (typeof updateAllFavoriteButtons === 'function') {
          updateAllFavoriteButtons();
        }
      }

      // Hook up Discovery Controls
      const rerollBtn = document.getElementById('discovery-reroll-btn');
      if (rerollBtn) {
        rerollBtn.addEventListener('click', function() {
          rotateDiscoveryGrid();
        });
      }

      const filterBtns = document.querySelectorAll('[data-discovery-filter]');
      filterBtns.forEach(btn => {
        btn.addEventListener('click', function() {
          filterBtns.forEach(b => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          currentDiscoveryFilter = btn.getAttribute('data-discovery-filter');
          rotateDiscoveryGrid();
        });
      });
`;

// Insert JS before closing </script> inside main script block
const mainScriptEnd = indexHtml.indexOf('window.addEventListener(\'DOMContentLoaded\', function () {');
if (mainScriptEnd !== -1 && !indexHtml.includes('DISCOVERY_POOL')) {
  indexHtml = indexHtml.substring(0, mainScriptEnd) + discoveryJs + '\n\n      ' + indexHtml.substring(mainScriptEnd);
  console.log('Successfully injected client-side Discovery Engine JavaScript!');
}

fs.writeFileSync(indexPath, indexHtml, 'utf8');
console.log(`Successfully written updated index.html (${indexHtml.length} bytes)!`);

