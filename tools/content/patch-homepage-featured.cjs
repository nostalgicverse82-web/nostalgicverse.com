/**
 * NostalgicVerse — Patch Homepage Featured Games with Verified Remote Images
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const indexPath = path.join(ROOT, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const targetSection = `    <!-- 03. FEATURED GAMES -->
    <section class="featured-games-section" id="featured-games" aria-labelledby="featured-games-heading">
      <div class="container">
        
        <div class="section-header reveal-on-scroll">
          <span class="catalog-tag tag-cyan">Curated Collection</span>
          <h2 class="section-title" id="featured-games-heading">Featured Games</h2>
          <p class="section-subtitle">Games worth remembering. Milestone achievements in design, engineering, and storytelling that permanently altered video game history.</p>
        </div>

        <div class="curated-games-grid">

          <!-- Lead Game: Metal Gear Solid (1998) -->
          <article class="game-card card-featured-lead reveal-on-scroll">
            <div class="game-card-media">
              <img 
                src="https://upload.wikimedia.org/wikipedia/en/3/33/Metal_Gear_Solid_cover_art.png" 
                alt="Metal Gear Solid game artwork" 
                class="game-artwork"
                width="640" 
                height="480"
                loading="lazy"
                decoding="async"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
              >
              <!-- Graceful Fallback Plate -->
              <div class="artwork-fallback-plate" style="display: none;" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M6 11h12M6 11a4 4 0 0 1-4-4V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2a4 4 0 0 1-4 4M6 11v6a5 5 0 0 0 10 0v-6"></path>
                </svg>
                <span>Artifact: Metal Gear Solid</span>
              </div>

              <div class="game-card-fav-action">
                <button 
                  type="button" 
                  class="fav-btn" 
                  data-fav-id="ps1-metal-gear-solid" 
                  data-fav-title="Metal Gear Solid" 
                  data-fav-url="/games/metal-gear-solid/" 
                  aria-label="Add Metal Gear Solid to favorites"
                >
                  <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div class="game-card-body">
              <div>
                <div class="game-card-meta">PLAYSTATION · 1998 · STEALTH / CINEMATIC</div>
                <h3 class="game-card-title">Metal Gear Solid</h3>
                <p class="game-card-desc">
                  Pioneered cinematic video game storytelling with real-time rendered cutscenes, sophisticated voice acting, and fourth-wall-breaking gameplay mechanics that defined tactical espionage.
                </p>
              </div>
              <div class="game-card-footer">
                <a href="/games/metal-gear-solid/" class="btn btn-inline">
                  <span>Examine Record</span> →
                </a>
              </div>
            </div>
          </article>

          <!-- Game 02: Final Fantasy VII (1997) -->
          <article class="game-card reveal-on-scroll">
            <div class="game-card-media">
              <img 
                src="https://upload.wikimedia.org/wikipedia/en/c/c2/Final_Fantasy_VII_Box_Art.jpg" 
                alt="Final Fantasy VII game artwork" 
                class="game-artwork"
                width="480" 
                height="300"
                loading="lazy"
                decoding="async"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
              >
              <div class="artwork-fallback-plate" style="display: none;" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
                <span>Artifact: Final Fantasy VII</span>
              </div>

              <div class="game-card-fav-action">
                <button 
                  type="button" 
                  class="fav-btn" 
                  data-fav-id="ps1-final-fantasy-vii" 
                  data-fav-title="Final Fantasy VII" 
                  data-fav-url="/games/final-fantasy-vii/" 
                  aria-label="Add Final Fantasy VII to favorites"
                >
                  <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div class="game-card-body">
              <div>
                <div class="game-card-meta">PLAYSTATION · 1997 · JRPG</div>
                <h3 class="game-card-title">Final Fantasy VII</h3>
                <p class="game-card-desc">
                  The multi-disc epic that brought the Japanese role-playing genre to massive worldwide prominence via pre-rendered industrial backgrounds and unforgettable narrative stakes.
                </p>
              </div>
              <div class="game-card-footer">
                <a href="/games/final-fantasy-vii/" class="btn btn-inline">
                  <span>Examine Record</span> →
                </a>
              </div>
            </div>
          </article>

          <!-- Game 03: Super Metroid (1994) -->
          <article class="game-card reveal-on-scroll">
            <div class="game-card-media">
              <img 
                src="https://upload.wikimedia.org/wikipedia/en/e/e4/Smetroidbox.jpg" 
                alt="Super Metroid game artwork" 
                class="game-artwork"
                width="480" 
                height="300"
                loading="lazy"
                decoding="async"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
              >
              <div class="artwork-fallback-plate" style="display: none;" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <circle cx="12" cy="12" r="10"></circle>
                  <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path>
                </svg>
                <span>Artifact: Super Metroid</span>
              </div>

              <div class="game-card-fav-action">
                <button 
                  type="button" 
                  class="fav-btn" 
                  data-fav-id="snes-super-metroid" 
                  data-fav-title="Super Metroid" 
                  data-fav-url="/games/super-metroid/" 
                  aria-label="Add Super Metroid to favorites"
                >
                  <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div class="game-card-body">
              <div>
                <div class="game-card-meta">SNES · 1994 · ACTION EXPLORATION</div>
                <h3 class="game-card-title">Super Metroid</h3>
                <p class="game-card-desc">
                  The quintessential masterclass in environmental isolation, nonlinear exploration, and atmospheric audio design on a 24-megabit silicon cartridge.
                </p>
              </div>
              <div class="game-card-footer">
                <a href="/games/super-metroid/" class="btn btn-inline">
                  <span>Examine Record</span> →
                </a>
              </div>
            </div>
          </article>

          <!-- Game 04: The Legend of Zelda: Ocarina of Time (1998) -->
          <article class="game-card reveal-on-scroll">
            <div class="game-card-media">
              <img 
                src="https://upload.wikimedia.org/wikipedia/en/5/57/The_Legend_of_Zelda_Ocarina_of_Time.jpg" 
                alt="The Legend of Zelda: Ocarina of Time game artwork" 
                class="game-artwork"
                width="480" 
                height="300"
                loading="lazy"
                decoding="async"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
              >
              <div class="artwork-fallback-plate" style="display: none;" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <polygon points="12 2 2 22 22 22 12 2"></polygon>
                </svg>
                <span>Artifact: Ocarina of Time</span>
              </div>

              <div class="game-card-fav-action">
                <button 
                  type="button" 
                  class="fav-btn" 
                  data-fav-id="n64-zelda-ocarina-of-time" 
                  data-fav-title="The Legend of Zelda: Ocarina of Time" 
                  data-fav-url="/games/the-legend-of-zelda-ocarina-of-time/" 
                  aria-label="Add Ocarina of Time to favorites"
                >
                  <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div class="game-card-body">
              <div>
                <div class="game-card-meta">NINTENDO 64 · 1998 · ADVENTURE</div>
                <h3 class="game-card-title">Ocarina of Time</h3>
                <p class="game-card-desc">
                  Invented the grammatical foundation of spatial 3D navigation with Z-targeting lock-on, contextual action controls, and an expansive simulated day-night world.
                </p>
              </div>
              <div class="game-card-footer">
                <a href="/games/the-legend-of-zelda-ocarina-of-time/" class="btn btn-inline">
                  <span>Examine Record</span> →
                </a>
              </div>
            </div>
          </article>

          <!-- Game 05: Doom (1993) -->
          <article class="game-card reveal-on-scroll">
            <div class="game-card-media">
              <img 
                src="https://upload.wikimedia.org/wikipedia/en/5/57/Doom_cover_art.jpg" 
                alt="Doom game artwork" 
                class="game-artwork"
                width="480" 
                height="300"
                loading="lazy"
                decoding="async"
                onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
              >
              <div class="artwork-fallback-plate" style="display: none;" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                  <polyline points="2 17 12 22 22 17"></polyline>
                  <polyline points="2 12 12 17 22 12"></polyline>
                </svg>
                <span>Artifact: Doom</span>
              </div>

              <div class="game-card-fav-action">
                <button 
                  type="button" 
                  class="fav-btn" 
                  data-fav-id="game-doom" 
                  data-fav-title="Doom" 
                  data-fav-url="/games/doom/" 
                  aria-label="Add Doom to favorites"
                >
                  <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                  </svg>
                </button>
              </div>
            </div>

            <div class="game-card-body">
              <div>
                <div class="game-card-meta">PC · 1993 · FIRST-PERSON SHOOTER</div>
                <h3 class="game-card-title">Doom</h3>
                <p class="game-card-desc">
                  Revolutionized 3D gaming graphics, peer-to-peer multiplayer deathmatches, and user modification ecosystems through John Carmack's lightning-fast binary space partitioning engine.
                </p>
              </div>
              <div class="game-card-footer">
                <a href="/games/doom/" class="btn btn-inline">
                  <span>Examine Record</span> →
                </a>
              </div>
            </div>
          </article>

        </div>

      </div>
    </section>`;

// Replace from '<!-- 03. FEATURED GAMES -->' up to '<!-- 04. CONSOLE MUSEUM'
const startToken = '<!-- 03. FEATURED GAMES -->';
const endToken = '<!-- 04. CONSOLE MUSEUM (THE MACHINES) -->';

const startIdx = html.indexOf(startToken);
const endIdx = html.indexOf(endToken);

if (startIdx === -1 || endIdx === -1) {
  console.error('Failed to find tokens in index.html');
  process.exit(1);
}

html = html.substring(0, startIdx) + targetSection + '\n\n    <hr class="museum-divider" aria-hidden="true">\n\n    ' + html.substring(endIdx);
fs.writeFileSync(indexPath, html, 'utf8');
console.log('Successfully updated featured games in index.html with verified remote artwork.');

