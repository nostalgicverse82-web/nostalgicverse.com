const fs = require('fs');

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// I will just replace the entire script block with my hand-crafted correct one.
// Let's find the start of the main script block.
const scriptStartIdx = html.indexOf('<script>\n    (function () {\n      \'use strict\';');
const scriptEndIdx = html.indexOf('})();\n  </script>\n\n\n  <!-- Support the Creator Global Modal -->');

if (scriptStartIdx !== -1 && scriptEndIdx !== -1) {
  const originalScript = html.substring(scriptStartIdx, scriptEndIdx + 5);
  
  // We want to keep everything up to "09. HOMEPAGE DISCOVERY ENGINE" or "function bootstrapDiscoveryEngine"
  const bootstrapIdx = originalScript.indexOf('function bootstrapDiscoveryEngine() {');
  
  if (bootstrapIdx !== -1) {
    const topPart = originalScript.substring(0, bootstrapIdx);
    
    // Create the correct bottom part
    const newBottomPart = `
      // --- START HOMEPAGE REPAIR & ROTATION LOGIC ---
      let gamesCatalogue = [];
      let consolesCatalogue = [];
      let timelineCatalogue = [];
      let remoteImagesManifest = null;
      let isMainRotating = false;
      
      const ROTATION_INTERVAL_MS = 9000;
      let autoRotateTimer = null;
      let isPaused = false;
      let currentDiscoveryFilter = 'all';

      // Accessibility: Respect user motion preferences
      const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
      let userPrefersReducedMotion = motionMedia ? motionMedia.matches : false;
      if (motionMedia && motionMedia.addEventListener) {
        motionMedia.addEventListener('change', e => {
          userPrefersReducedMotion = e.matches;
          if (userPrefersReducedMotion) {
            stopAutoRotation();
          } else {
            startAutoRotation();
          }
        });
      }

      function resolveImage(slug) {
        if (remoteImagesManifest && remoteImagesManifest[slug]) {
          const entry = remoteImagesManifest[slug];
          if (entry.imageType === 'local' && entry.localPath) return entry.localPath;
          if (entry.imageUrl) return entry.imageUrl;
        }
        return '/assets/images/museum-fallback.svg'; // Default Museum Fallback
      }

      function getRandomSubarray(arr, size) {
        const shuffled = arr.slice(0);
        let i = arr.length, temp, index;
        while (i--) {
          index = Math.floor((i + 1) * Math.random());
          temp = shuffled[index];
          shuffled[index] = shuffled[i];
          shuffled[i] = temp;
        }
        return shuffled.slice(0, Math.min(size, arr.length));
      }

      function buildGameCardHTML(item, isLead) {
        const imgSrc = resolveImage(item.slug || item.id.replace('game-', ''));
        const leadClass = isLead ? ' card-featured-lead' : '';
        const width = isLead ? 640 : 480;
        const height = isLead ? 480 : 300;
        
        const favSvg = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>';
        
        const slug = item.slug || item.id.replace('game-', '');

        return \`
          <article class="game-card\${leadClass} reveal-on-scroll is-revealed" style="transition: none;">
            <div class="game-card-media">
              <img src="\${imgSrc}" alt="\${item.title} game artwork" class="game-artwork" width="\${width}" height="\${height}" loading="lazy" decoding="async" style="object-fit: contain;" onerror="this.src='/assets/images/museum-fallback.svg'">
              <button class="card-fav-btn" data-fav-id="\${item.id}" data-fav-title="\${item.title}" data-fav-url="/games/\${slug}/" aria-label="Add \${item.title} to favorites" title="Add to favorites">
                \${favSvg}
              </button>
            </div>
            <div class="game-card-content">
              <div class="game-meta">
                <span class="game-year">\${item.releaseYear || item.meta}</span>
                <span class="game-publisher">\${item.publisher || item.manufacturer}</span>
              </div>
              <h3 class="game-card-title">\${item.title}</h3>
              <p class="game-card-desc">\${item.summary}</p>
              <div class="game-card-footer">
                <span class="game-genre">\${item.genre || item.metaSecondary}</span>
                <a href="/games/\${slug}/" class="btn btn-inline">View Archive +'</a>
              </div>
            </div>
          </article>
        \`;
      }

      function buildConsoleCardHTML(item) {
        const slug = item.slug || item.id.replace('console-', '');
        const imgSrc = '/assets/images/consoles/' + slug + '.png';
        return \`
          <article class="console-card reveal-on-scroll is-revealed" style="transition: none;">
            <div class="console-card-media">
              <img src="\${imgSrc}" alt="\${item.title} hardware" class="console-image" width="400" height="300" loading="lazy" decoding="async" style="object-fit: contain;" onerror="this.src='/assets/images/museum-fallback.svg'">
            </div>
            <div class="console-card-content">
              <div class="console-meta">
                <span class="console-year">\${item.releaseYear || item.meta}</span>
                <span class="console-manufacturer">\${item.manufacturer || ''}</span>
              </div>
              <h3 class="console-card-title">\${item.title}</h3>
              <p class="console-card-desc">\${item.summary}</p>
              <div class="console-card-footer">
                <span class="console-generation">\${item.generation ? 'Generation ' + item.generation : item.metaSecondary}</span>
                <a href="/consoles/\${slug}/" class="btn btn-inline">View Specs +'</a>
              </div>
            </div>
          </article>
        \`;
      }
      
      function buildDiscoveryCardHTML(item) {
        const favSvg = '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>';
        return \`
          <article class="discovery-card" data-specimen-id="\${item.id}" data-specimen-type="\${item.type}">
            <div>
              <div class="discovery-card-top">
                <span class="discovery-badge \${item.badgeClass || 'badge-timeline'}">\${item.typeName}</span>
                <button type="button" class="card-fav-btn" data-fav-id="\${item.id}" data-fav-title="\${item.title}" data-fav-url="\${item.url}" aria-label="Add \${item.title} to favorites" title="Add to favorites">
                  \${favSvg}
                </button>
              </div>
              <h3 class="discovery-title">\${item.title}</h3>
              <div class="discovery-meta">\${item.meta} A \${item.metaSecondary}</div>
              <p class="discovery-summary">\${item.summary}</p>
            </div>
            <div class="discovery-action">
              <a class="btn btn-inline" href="\${item.url}">Examine Exhibit +'</a>
            </div>
          </article>
        \`;
      }

      function rotateDiscoveryGrid() {
        const grid = document.getElementById('discovery-grid');
        if (!grid) return;
        
        let eligible = [...gamesCatalogue, ...consolesCatalogue, ...timelineCatalogue];
        if (currentDiscoveryFilter !== 'all') {
          eligible = eligible.filter(item => item.type === currentDiscoveryFilter);
        }
        
        const picks = getRandomSubarray(eligible, 6);
        grid.innerHTML = picks.map(c => buildDiscoveryCardHTML(c)).join('');
      }

      async function rotateMainSections() {
        if (isPaused || isMainRotating) return;
        if (gamesCatalogue.length === 0 || consolesCatalogue.length === 0) return;
        
        isMainRotating = true;

        const nextGames = getRandomSubarray(gamesCatalogue.filter(g => g.type === 'game'), 5);
        const nextConsoles = getRandomSubarray(consolesCatalogue.filter(c => c.type === 'console'), 4);

        const gamesHTML = nextGames.map((g, i) => buildGameCardHTML(g, i === 0)).join('');
        const consolesHTML = nextConsoles.map(c => buildConsoleCardHTML(c)).join('');

        const performAtomicSwap = async (gridSelector, html) => {
          const grid = document.querySelector(gridSelector);
          if (!grid) return;

          // 1. Construct Incoming DOM in memory
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          const imgs = Array.from(tempDiv.querySelectorAll('img'));
          
          // 2. Preload required images
          await new Promise(resolve => {
            let loaded = 0;
            if (imgs.length === 0) return resolve();
            let resolved = false;
            
            const check = () => {
              loaded++;
              if (loaded >= imgs.length && !resolved) {
                resolved = true;
                resolve();
              }
            };
            
            imgs.forEach(imgEl => {
              const img = new Image();
              img.onload = check;
              img.onerror = () => {
                // Image failure must NEVER abort the whole section transition
                imgEl.src = '/assets/images/museum-fallback.svg';
                check();
              };
              img.src = imgEl.src;
            });
            
            // Safety timeout (2.5s maximum wait)
            setTimeout(() => {
              if (!resolved) {
                resolved = true;
                resolve();
              }
            }, 2500);
          });

          // 3. Confirm incoming content is valid & Swap
          if (userPrefersReducedMotion) {
            grid.innerHTML = html;
            return;
          }

          // Crossfade Atomic Swap
          const newCards = Array.from(tempDiv.children);
          
          // Setup initial state for new cards (transparent)
          newCards.forEach(c => {
            c.style.opacity = '0';
            c.style.transition = 'opacity 400ms ease-in';
          });

          // Mount incoming DOM
          grid.innerHTML = '';
          newCards.forEach(c => grid.appendChild(c));

          // Force reflow
          void grid.offsetWidth;

          // Animate incoming content
          newCards.forEach(c => {
            c.style.opacity = '1';
          });

          // Wait for transition
          await new Promise(r => setTimeout(r, 450));
        };

        // Rotate Games
        await performAtomicSwap('.curated-games-grid', gamesHTML);
        
        // Stagger Consoles by 2 seconds
        await new Promise(r => setTimeout(r, 2000));
        await performAtomicSwap('.consoles-grid', consolesHTML);

        if (typeof updateAllFavoriteButtons === 'function') {
          updateAllFavoriteButtons();
        }

        isMainRotating = false;
      }

      function startAutoRotation() {
        stopAutoRotation();
        if (userPrefersReducedMotion) return;
        autoRotateTimer = setInterval(() => {
          if (!isPaused) rotateMainSections();
        }, ROTATION_INTERVAL_MS);
      }

      function stopAutoRotation() {
        if (autoRotateTimer) {
          clearInterval(autoRotateTimer);
          autoRotateTimer = null;
        }
      }

      function hookInteractivePauses() {
        ['.curated-games-grid', '.consoles-grid', '#discovery-grid'].forEach(sel => {
          const el = document.querySelector(sel);
          if (el) {
            el.addEventListener('mouseenter', () => { isPaused = true; });
            el.addEventListener('mouseleave', () => { isPaused = false; });
            el.addEventListener('focusin', () => { isPaused = true; });
            el.addEventListener('focusout', () => { isPaused = false; });
            el.addEventListener('touchstart', () => { isPaused = true; }, { passive: true });
            el.addEventListener('touchend', () => { setTimeout(() => { isPaused = false; }, 3000); }, { passive: true });
          }
        });
        document.addEventListener('visibilitychange', () => {
          isPaused = document.hidden;
        });

        // Hook up Discovery Controls
        const rerollBtn = document.getElementById('discovery-reroll-btn');
        if (rerollBtn) {
          rerollBtn.addEventListener('click', function() {
            rotateDiscoveryGrid();
            startAutoRotation();
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
      }

      function bootstrapDiscoveryEngine() {
        updateAllFavoriteButtons();
        updateFavoritesHeaderBadge();
        
        // Fetch Canonical Data
        Promise.all([
          fetch('/data/search-index.json').then(r => r.json()),
          fetch('/data/remote-game-images.json').then(r => r.json())
        ]).then(([searchData, remoteManifest]) => {
          
          gamesCatalogue = searchData.filter(d => d.type === 'game');
          consolesCatalogue = searchData.filter(d => d.type === 'console');
          timelineCatalogue = searchData.filter(d => d.type === 'timeline');
          
          // MAP fields for backwards compatibility with the layout
          [...gamesCatalogue, ...consolesCatalogue, ...timelineCatalogue].forEach(item => {
             item.meta = item.meta || item.year || item.releaseYear || '';
             item.metaSecondary = item.metaSecondary || item.genre || item.generation ? 'Generation ' + item.generation : item.category;
             item.badgeClass = item.type === 'game' ? 'badge-game' : (item.type === 'console' ? 'badge-console' : 'badge-timeline');
          });

          remoteImagesManifest = remoteManifest.games || {};
          
          hookInteractivePauses();
          
          rotateDiscoveryGrid();
          rotateMainSections();
          startAutoRotation();
        }).catch(err => {
          console.error("NostalgicVerse: Failed to load canonical catalogue.", err);
        });
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrapDiscoveryEngine);
      } else {
        bootstrapDiscoveryEngine();
      }

    })();
  </script>`;

    html = html.substring(0, scriptStartIdx) + topPart + newBottomPart + html.substring(scriptEndIdx + 9);
    fs.writeFileSync(file, html, 'utf8');
    console.log("Success!");
  } else {
    console.log("Could not find bootstrapDiscoveryEngine");
  }
} else {
  console.log("Could not find script block bounds");
}

