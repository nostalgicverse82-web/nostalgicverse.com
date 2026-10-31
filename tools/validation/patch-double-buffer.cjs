const fs = require('fs');

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const newRotateSections = `
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
      }`;

const startRotate = html.indexOf('async function rotateMainSections() {');
const endRotate = html.indexOf('function startAutoRotation() {');

html = html.substring(0, startRotate) + newRotateSections + '\n\n      ' + html.substring(endRotate);

const bootstrapSearch = 'hookInteractivePauses();';
const bootstrapInject = 'initDoubleBuffering();\n          hookInteractivePauses();';
html = html.replace(bootstrapSearch, bootstrapInject);

fs.writeFileSync(file, html, 'utf8');
console.log("Successfully patched index.html with Double Buffering!");

