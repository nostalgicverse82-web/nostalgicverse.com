const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../index.html');
let content = fs.readFileSync(file, 'utf8');

// 1. We need to inject the fetch for remote-game-images and the new rotation logic
const logicToInject = `
      // --- START HOMEPAGE SECTIONS ROTATION ---
      let remoteImagesManifest = null;
      let isMainRotating = false;

      fetch('/data/remote-game-images.json')
        .then(res => res.json())
        .then(data => {
          remoteImagesManifest = data.games || {};
        })
        .catch(err => console.warn('NostalgicVerse: Failed to load remote-game-images.json', err));

      function resolveGameImage(slug) {
        if (remoteImagesManifest && remoteImagesManifest[slug]) {
          const entry = remoteImagesManifest[slug];
          if (entry.imageType === 'local' && entry.localPath) return entry.localPath;
          if (entry.imageUrl) return entry.imageUrl;
        }
        return null;
      }

      function buildGameCardHTML(item, isLead) {
        const imgSrc = resolveGameImage(item.slug);
        const leadClass = isLead ? ' card-featured-lead' : '';
        const width = isLead ? 640 : 480;
        const height = isLead ? 480 : 300;
        
        let imgHTML = '';
        if (imgSrc) {
          imgHTML = '<img src="' + imgSrc + '" alt="' + item.title + ' game artwork" class="game-artwork" width="' + width + '" height="' + height + '" loading="lazy" decoding="async" style="object-fit: contain;" onerror="this.style.display=\\'none\\'; this.nextElementSibling.style.display=\\'flex\\';">';
        }

        const favSvg = isFavorite(item.id)
          ? '<svg viewBox="0 0 24 24" class="icon-filled"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>'
          : '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>';

        return '<article class="game-card' + leadClass + ' reveal-on-scroll">' +
            '<div class="game-card-media">' +
              imgHTML +
              '<div class="artwork-fallback-plate" style="' + (imgSrc ? 'display: none;' : 'display: flex;') + '" aria-hidden="true">' +
                '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 11h12M6 11a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a4 4 0 0 1-4 4M6 11v6a5 5 0 0 0 10 0v-6"></path></svg>' +
                '<span>Artifact: ' + item.title + '</span>' +
              '</div>' +
              '<div class="game-card-fav-action">' +
                '<button type="button" class="fav-btn" data-fav-id="' + item.id + '" data-fav-title="' + item.title + '" data-fav-url="' + item.url + '" aria-label="Add ' + item.title + ' to favorites">' +
                  favSvg +
                '</button>' +
              '</div>' +
            '</div>' +
            '<div class="game-card-body">' +
              '<div>' +
                '<div class="game-card-meta">' + item.meta.toUpperCase() + '</div>' +
                '<h3 class="game-card-title">' + item.title + '</h3>' +
                '<p class="game-card-desc">' + item.summary + '</p>' +
              '</div>' +
              '<div class="game-card-footer">' +
                '<a href="' + item.url + '" class="btn btn-inline"><span>Examine Record</span> →</a>' +
              '</div>' +
            '</div>' +
          '</article>';
      }

      function buildConsoleCardHTML(item) {
        const imgSrc = '/assets/images/consoles/' + item.slug + '.png';
        
        const favSvg = isFavorite(item.id)
          ? '<svg viewBox="0 0 24 24" class="icon-filled"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>'
          : '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>';

        return '<article class="console-card reveal-on-scroll">' +
            '<div class="console-pedestal">' +
              '<img src="' + imgSrc + '" alt="' + item.title + ' console hardware" class="console-image" width="480" height="300" loading="lazy" decoding="async" style="object-fit: contain;" onerror="this.style.display=\\'none\\'; this.nextElementSibling.style.display=\\'block\\';">' +
              '<svg class="console-diagram" style="display: none;" viewBox="0 0 160 120" stroke-width="1.5" aria-hidden="true">' +
                '<rect x="20" y="40" width="120" height="40" rx="4" fill="none" stroke="currentColor"></rect>' +
                '<line x1="40" y1="60" x2="120" y2="60" stroke="currentColor"></line>' +
              '</svg>' +
              '<div class="console-card-fav-action">' +
                '<button type="button" class="fav-btn" data-fav-id="' + item.id + '" data-fav-title="' + item.title + '" data-fav-url="' + item.url + '" aria-label="Add ' + item.title + ' to favorites">' +
                  favSvg +
                '</button>' +
              '</div>' +
            '</div>' +
            '<div class="console-card-body">' +
              '<div>' +
                '<div class="console-card-meta">' + item.meta.toUpperCase() + '</div>' +
                '<h3 class="console-card-title">' + item.title + '</h3>' +
                '<p class="console-card-desc">' + item.summary + '</p>' +
              '</div>' +
              '<div class="console-card-footer">' +
                '<a href="' + item.url + '" class="btn btn-inline"><span>Examine Record</span> →</a>' +
              '</div>' +
            '</div>' +
          '</article>';
      }

      function rotateMainSections() {
        if (isPaused || isMainRotating) return;
        if (!remoteImagesManifest) return; // Wait until manifest loads
        
        const gamesGrid = document.querySelector('.curated-games-grid');
        const consolesGrid = document.querySelector('.consoles-grid');
        if (!gamesGrid || !consolesGrid) return;

        isMainRotating = true;

        const allGames = DISCOVERY_POOL.filter(item => item.type === 'game');
        const allConsoles = DISCOVERY_POOL.filter(item => item.type === 'console');

        const nextGames = pickDiverseSubarray(allGames, 5);
        const nextConsoles = pickDiverseSubarray(allConsoles, 4);

        const transitionContainer = (grid, htmlContent) => {
          return new Promise(resolve => {
            if (userPrefersReducedMotion) {
              grid.innerHTML = htmlContent;
              resolve();
              return;
            }
            grid.style.transition = 'opacity 300ms ease-out';
            grid.style.opacity = '0';
            
            setTimeout(() => {
              grid.innerHTML = htmlContent;
              const imgs = Array.from(grid.querySelectorAll('img'));
              let loaded = 0;
              const checkLoaded = () => {
                loaded++;
                if (loaded >= imgs.length) {
                  grid.style.transition = 'opacity 400ms ease-in';
                  grid.style.opacity = '1';
                  resolve();
                }
              };
              if (imgs.length === 0) { checkLoaded(); }
              imgs.forEach(img => {
                if (img.complete) { checkLoaded(); } 
                else { img.onload = checkLoaded; img.onerror = checkLoaded; }
              });
              // Safety fallback
              setTimeout(() => {
                if (loaded < imgs.length) {
                  grid.style.transition = 'opacity 400ms ease-in';
                  grid.style.opacity = '1';
                  resolve();
                }
              }, 1200);
            }, 300);
          });
        };

        const gamesHTML = nextGames.map((item, idx) => buildGameCardHTML(item, idx === 0)).join('');
        const consolesHTML = nextConsoles.map(item => buildConsoleCardHTML(item)).join('');

        // Stagger games, then consoles 2 seconds later
        transitionContainer(gamesGrid, gamesHTML).then(() => {
          setTimeout(() => {
            transitionContainer(consolesGrid, consolesHTML).then(() => {
              isMainRotating = false;
              updateAllFavoriteButtons();
            });
          }, 2000);
        });
      }
      // --- END HOMEPAGE SECTIONS ROTATION ---
`;

// Insert the logic just before `function renderDiscoveryCards(grid, picks)`
if (!content.includes('function buildGameCardHTML')) {
  content = content.replace('function renderDiscoveryCards(grid, picks) {', logicToInject + '\n      function renderDiscoveryCards(grid, picks) {');
}

// 2. Add pause listeners for .curated-games-grid and .consoles-grid
const pauseLogicToInject = `
      // Additional interactive pause listeners for main grids
      const gamesGridEl = document.querySelector('.curated-games-grid');
      if (gamesGridEl) {
        gamesGridEl.addEventListener('mouseenter', () => { isPaused = true; });
        gamesGridEl.addEventListener('mouseleave', () => { isPaused = false; });
        gamesGridEl.addEventListener('focusin', () => { isPaused = true; });
        gamesGridEl.addEventListener('focusout', () => { isPaused = false; });
        gamesGridEl.addEventListener('touchstart', () => { isPaused = true; }, { passive: true });
        gamesGridEl.addEventListener('touchend', () => { setTimeout(() => { isPaused = false; }, 3000); }, { passive: true });
      }
      const consolesGridEl = document.querySelector('.consoles-grid');
      if (consolesGridEl) {
        consolesGridEl.addEventListener('mouseenter', () => { isPaused = true; });
        consolesGridEl.addEventListener('mouseleave', () => { isPaused = false; });
        consolesGridEl.addEventListener('focusin', () => { isPaused = true; });
        consolesGridEl.addEventListener('focusout', () => { isPaused = false; });
        consolesGridEl.addEventListener('touchstart', () => { isPaused = true; }, { passive: true });
        consolesGridEl.addEventListener('touchend', () => { setTimeout(() => { isPaused = false; }, 3000); }, { passive: true });
      }
`;

if (!content.includes('gamesGridEl.addEventListener')) {
  content = content.replace("const discoveryGridEl = document.getElementById('discovery-grid');", pauseLogicToInject + "\n      const discoveryGridEl = document.getElementById('discovery-grid');");
}

// 3. Call `rotateMainSections()` inside `startAutoRotation`
if (!content.includes('rotateMainSections();')) {
  content = content.replace('rotateDiscoveryGrid();', 'rotateDiscoveryGrid();\n            rotateMainSections();');
  // Also call it in bootstrap
  content = content.replace('rotateDiscoveryGrid();\n        startAutoRotation();', 'rotateDiscoveryGrid();\n        rotateMainSections();\n        startAutoRotation();');
}

fs.writeFileSync(file, content);
console.log('Successfully injected main sections rotation into index.html');
