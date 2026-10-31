
    (function () {
      'use strict';

      /* --------------------------------------------------------------------------
         01. CONSTANTS & LOCAL STORAGE ARCHITECTURE
         -------------------------------------------------------------------------- */
      const FAV_STORAGE_KEY = 'nostalgicverse_favs';

      /* --------------------------------------------------------------------------
         02. SAFE LOCAL STORAGE ACCESS (DEFENSIVE ERROR RESILIENCE)
         -------------------------------------------------------------------------- */
      function getStoredFavorites() {
        try {
          const raw = localStorage.getItem(FAV_STORAGE_KEY);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
          console.warn('NostalgicVerse: Safe fallback - LocalStorage inaccessible.', err);
          return [];
        }
      }

      function saveFavorites(favsArray) {
        try {
          localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favsArray));
        } catch (err) {
          console.warn('NostalgicVerse: Unable to write to LocalStorage.', err);
        }
      }

      function isFavorite(id) {
        const favs = getStoredFavorites();
        return favs.some(item => item.id === id);
      }

      function toggleFavoriteItem(item) {
        let favs = getStoredFavorites();
        const exists = favs.some(f => f.id === item.id);

        if (exists) {
          favs = favs.filter(f => f.id !== item.id);
        } else {
          favs.push({
            id: item.id,
            title: item.title,
            url: item.url
          });
        }

        saveFavorites(favs);
        updateAllFavoriteButtons();
        updateFavoritesHeaderBadge();
      }

      /* --------------------------------------------------------------------------
         03. SYNCHRONIZE FAVORITE BUTTON STATES & BADGE COUNT
         -------------------------------------------------------------------------- */
      function updateAllFavoriteButtons() {
        const favButtons = document.querySelectorAll('[data-fav-id]');
        favButtons.forEach(btn => {
          const id = btn.getAttribute('data-fav-id');
          const title = btn.getAttribute('data-fav-title') || 'Game';
          const active = isFavorite(id);

          if (active) {
            btn.classList.add('is-active');
            btn.setAttribute('aria-label', `Remove ${title} from favorites`);
            btn.setAttribute('title', `Remove ${title} from favorites`);
          } else {
            btn.classList.remove('is-active');
            btn.setAttribute('aria-label', `Add ${title} to favorites`);
            btn.setAttribute('title', `Add ${title} to favorites`);
          }
        });
      }

      function updateFavoritesHeaderBadge() {
        const badge = document.getElementById('header-fav-badge');
        if (!badge) return;

        const favs = getStoredFavorites();
        const count = favs.length;
        badge.textContent = count;

        if (count > 0) {
          badge.classList.add('has-items');
        } else {
          badge.classList.remove('has-items');
        }
      }

      // Cross-tab synchronization
      window.addEventListener('storage', function (event) {
        if (event.key === FAV_STORAGE_KEY) {
          updateAllFavoriteButtons();
          updateFavoritesHeaderBadge();
        }
      });

      /* --------------------------------------------------------------------------
         04. ACCESSIBLE MOBILE DRAWER NAVIGATION
         -------------------------------------------------------------------------- */
      const menuBtn = document.getElementById('menu-toggle-btn');
      const closeBtn = document.getElementById('drawer-close-btn');
      const drawer = document.getElementById('mobile-nav-drawer');
      const backdrop = document.getElementById('drawer-backdrop');

      function openMobileMenu() {
        if (!drawer || !backdrop) return;
        document.body.classList.add('menu-open');
        drawer.classList.add('is-open');
        backdrop.classList.add('is-open');
        menuBtn.setAttribute('aria-expanded', 'true');
        drawer.setAttribute('aria-hidden', 'false');
        drawer.focus();
      }

      function closeMobileMenu() {
        if (!drawer || !backdrop) return;
        document.body.classList.remove('menu-open');
        drawer.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
        drawer.setAttribute('aria-hidden', 'true');
        menuBtn.focus();
      }

      if (menuBtn) {
        menuBtn.addEventListener('click', openMobileMenu);
      }

      if (closeBtn) {
        closeBtn.addEventListener('click', closeMobileMenu);
      }

      if (backdrop) {
        backdrop.addEventListener('click', closeMobileMenu);
      }

      // Keyboard Trap & Escape handling for Drawer
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) {
          closeMobileMenu();
        }
      });

      /* --------------------------------------------------------------------------
         05. SCROLL REVEAL (INTERSECTION OBSERVER WITH SAFE DEGRADATION)
         -------------------------------------------------------------------------- */
      if ('IntersectionObserver' in window) {
        const revealObserver = new IntersectionObserver((entries, observer) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-revealed');
              observer.unobserve(entry.target);
            }
          });
        }, {
          threshold: 0.08,
          rootMargin: '0px 0px -40px 0px'
        });

        document.querySelectorAll('.reveal-on-scroll').forEach(el => {
          revealObserver.observe(el);
        });
      } else {
        // Fallback for non-supporting browsers: display immediately
        document.querySelectorAll('.reveal-on-scroll').forEach(el => {
          el.classList.add('is-revealed');
        });
      }

      /* --------------------------------------------------------------------------
         06. SEARCH FORM SUBMISSION SANITIZATION
         -------------------------------------------------------------------------- */
      const searchForm = document.getElementById('archive-search-form');
      if (searchForm) {
        searchForm.addEventListener('submit', function (e) {
          const input = searchForm.querySelector('input[name="q"]');
          if (input && !input.value.trim()) {
            e.preventDefault();
            input.focus();
          }
        });
      }

      /* --------------------------------------------------------------------------
         07. INITIALIZE FAVORITES BUTTON BINDINGS
         -------------------------------------------------------------------------- */
      document.addEventListener('click', function (e) {
        const favBtn = e.target.closest('[data-fav-id]');
        if (favBtn) {
          e.preventDefault();
          const item = {
            id: favBtn.getAttribute('data-fav-id'),
            title: favBtn.getAttribute('data-fav-title'),
            url: favBtn.getAttribute('data-fav-url')
          };
          toggleFavoriteItem(item);
        }
      });

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
        
        const favSvg = isFavorite(item.id)
          ? '<svg viewBox="0 0 24 24" class="icon-filled"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>'
          : '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>';
        const favClass = isFavorite(item.id) ? 'card-fav-btn is-active' : 'card-fav-btn';
        
        const slug = item.slug || item.id.replace('game-', '');

        return `
          <article class="game-card${leadClass} reveal-on-scroll is-revealed" style="transition: none;">
            <div class="game-card-media">
              <img src="${imgSrc}" alt="${item.title} game artwork" class="game-artwork" width="${width}" height="${height}" loading="lazy" decoding="async" style="object-fit: contain;" onerror="this.src='/assets/images/museum-fallback.svg'">
              <button class="${favClass}" data-fav-id="${item.id}" data-fav-title="${item.title}" data-fav-url="/games/${slug}/" aria-label="${isFavorite(item.id) ? 'Remove' : 'Add'} ${item.title} ${isFavorite(item.id) ? 'from' : 'to'} favorites" title="${isFavorite(item.id) ? 'Remove from' : 'Add to'} favorites">
                ${favSvg}
              </button>
            </div>
            <div class="game-card-content">
              <div class="game-meta">
                <span class="game-year">${item.releaseYear || item.meta}</span>
                <span class="game-publisher">${item.publisher || item.manufacturer}</span>
              </div>
              <h3 class="game-card-title">${item.title}</h3>
              <p class="game-card-desc">${item.summary}</p>
              <div class="game-card-footer">
                <span class="game-genre">${item.genre || item.metaSecondary}</span>
                <a href="/games/${slug}/" class="btn btn-inline">View Archive +'</a>
              </div>
            </div>
          </article>
        `;
      }

      function buildConsoleCardHTML(item) {
        const slug = item.slug || item.id.replace('console-', '');
        const imgSrc = '/assets/images/consoles/' + slug + '.png';
        return `
          <article class="console-card reveal-on-scroll is-revealed" style="transition: none;">
            <div class="console-card-media">
              <img src="${imgSrc}" alt="${item.title} hardware" class="console-image" width="400" height="300" loading="lazy" decoding="async" style="object-fit: contain;" onerror="this.src='/assets/images/museum-fallback.svg'">
            </div>
            <div class="console-card-content">
              <div class="console-meta">
                <span class="console-year">${item.releaseYear || item.meta}</span>
                <span class="console-manufacturer">${item.manufacturer || ''}</span>
              </div>
              <h3 class="console-card-title">${item.title}</h3>
              <p class="console-card-desc">${item.summary}</p>
              <div class="console-card-footer">
                <span class="console-generation">${item.generation ? 'Generation ' + item.generation : item.metaSecondary}</span>
                <a href="/consoles/${slug}/" class="btn btn-inline">View Specs +'</a>
              </div>
            </div>
          </article>
        `;
      }
      
      function buildDiscoveryCardHTML(item) {
        const favSvg = isFavorite(item.id)
          ? '<svg viewBox="0 0 24 24" class="icon-filled"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>'
          : '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>';
        const favClass = isFavorite(item.id) ? 'card-fav-btn is-active' : 'card-fav-btn';
        return `
          <article class="discovery-card" data-specimen-id="${item.id}" data-specimen-type="${item.type}">
            <div>
              <div class="discovery-card-top">
                <span class="discovery-badge ${item.badgeClass || 'badge-timeline'}">${item.typeName}</span>
                <button type="button" class="${favClass}" data-fav-id="${item.id}" data-fav-title="${item.title}" data-fav-url="${item.url}" aria-label="${isFavorite(item.id) ? 'Remove' : 'Add'} ${item.title} ${isFavorite(item.id) ? 'from' : 'to'} favorites" title="${isFavorite(item.id) ? 'Remove from' : 'Add to'} favorites">
                  ${favSvg}
                </button>
              </div>
              <h3 class="discovery-title">${item.title}</h3>
              <div class="discovery-meta">${item.meta} A ${item.metaSecondary}</div>
              <p class="discovery-summary">${item.summary}</p>
            </div>
            <div class="discovery-action">
              <a class="btn btn-inline" href="${item.url}">Examine Exhibit +'</a>
            </div>
          </article>
        `;
      }

      function rotateDiscoveryGrid() {
        const grid = document.getElementById('discovery-grid');
        if (!grid) return;
        
        let eligible = [...gamesCatalogue, ...consolesCatalogue, ...timelineCatalogue];
        if (currentDiscoveryFilter !== 'all') {
          eligible = eligible.filter(item => item.type === currentDiscoveryFilter);
        }
        
        const picks = getRandomSubarray(eligible, 6);
        
        if (userPrefersReducedMotion) {
          grid.innerHTML = picks.map(c => buildDiscoveryCardHTML(c)).join('');
          return;
        }

        grid.style.transition = 'opacity 250ms ease-out';
        grid.style.opacity = '0';
        
        setTimeout(() => {
          grid.innerHTML = picks.map(c => buildDiscoveryCardHTML(c)).join('');
          
          const cards = Array.from(grid.querySelectorAll('.discovery-card'));
          cards.forEach(card => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(12px)';
            card.style.transition = 'none';
          });
          
          grid.style.transition = 'opacity 100ms ease-in';
          grid.style.opacity = '1';
          
          requestAnimationFrame(() => {
            cards.forEach((card, idx) => {
              setTimeout(() => {
                card.style.transition = 'opacity 300ms ease-out, transform 300ms ease-out';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
              }, idx * 60);
            });
          });
        }, 250);
      }

      
      function initDoubleBuffering() {
        ['.curated-games-grid', '.consoles-grid'].forEach(selector => {
          const grid = document.querySelector(selector);
          if (!grid || grid.dataset.buffered === 'true') return;
          grid.dataset.buffered = 'true';
          
          const wrapper = document.createElement('div');
          wrapper.className = 'rotation-wrapper ' + grid.className;
          // Set grid to absolute overlapping rows
          wrapper.style.display = 'grid';
          wrapper.style.gridTemplateColumns = '100%';
          wrapper.style.gridTemplateRows = '100%';
          
          grid.parentNode.insertBefore(wrapper, grid);
          
          grid.classList.add('rotation-layer-current');
          grid.style.gridArea = '1 / 1 / 2 / 2'; // Ensure they overlap exactly
          wrapper.appendChild(grid);
          
          const nextGrid = grid.cloneNode(false);
          nextGrid.classList.replace('rotation-layer-current', 'rotation-layer-next');
          nextGrid.style.gridArea = '1 / 1 / 2 / 2';
          nextGrid.style.opacity = '0';
          nextGrid.style.visibility = 'hidden';
          nextGrid.style.pointerEvents = 'none';
          
          wrapper.appendChild(nextGrid);
        });
      }

      async function rotateMainSections() {
        if (isPaused || isMainRotating) return;
        if (gamesCatalogue.length === 0 || consolesCatalogue.length === 0) return;
        
        isMainRotating = true;

        const nextGames = getRandomSubarray(gamesCatalogue.filter(g => g.type === 'game'), 5);
        const nextConsoles = getRandomSubarray(consolesCatalogue.filter(c => c.type === 'console'), 4);

        const gamesHTML = nextGames.map((g, i) => buildGameCardHTML(g, i === 0)).join('');
        const consolesHTML = nextConsoles.map(c => buildConsoleCardHTML(c)).join('');

        const performDoubleBufferSwap = async (gridSelector, html) => {
          const originalGrid = document.querySelector(gridSelector);
          if (!originalGrid) return;
          const wrapper = originalGrid.closest('.rotation-wrapper');
          if (!wrapper) return;
          
          const currentGrid = wrapper.querySelector('.rotation-layer-current');
          const nextGrid = wrapper.querySelector('.rotation-layer-next');

          // 1. Construct Incoming DOM directly into the hidden next layer
          nextGrid.innerHTML = html;
          const imgs = Array.from(nextGrid.querySelectorAll('img'));
          
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
              if (imgEl.complete) {
                check();
                return;
              }
              const img = new Image();
              img.onload = check;
              img.onerror = () => {
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
            currentGrid.innerHTML = html;
            nextGrid.innerHTML = '';
            return;
          }

          // Crossfade via Double Buffering Layers
          nextGrid.style.visibility = 'visible';
          
          // Force layout
          void nextGrid.offsetWidth;

          // Transition both opacity
          currentGrid.style.transition = 'opacity 500ms ease-in-out';
          nextGrid.style.transition = 'opacity 500ms ease-in-out';
          
          currentGrid.style.opacity = '0';
          nextGrid.style.opacity = '1';

          // Wait for transition
          await new Promise(r => setTimeout(r, 550));
          
          // Retire old buffer and flip pointers
          currentGrid.innerHTML = '';
          currentGrid.style.visibility = 'hidden';
          currentGrid.style.pointerEvents = 'none';
          currentGrid.style.transition = 'none';
          currentGrid.classList.replace('rotation-layer-current', 'rotation-layer-next');
          
          nextGrid.style.pointerEvents = 'auto';
          nextGrid.style.transition = 'none';
          nextGrid.classList.replace('rotation-layer-next', 'rotation-layer-current');
        };

        // Rotate Games
        await performDoubleBufferSwap('.curated-games-grid', gamesHTML);
        
        // Stagger Consoles by 2 seconds
        await new Promise(r => setTimeout(r, 2000));
        await performDoubleBufferSwap('.consoles-grid', consolesHTML);

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
          
          initDoubleBuffering();
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
  