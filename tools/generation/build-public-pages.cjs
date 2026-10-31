const fs = require('fs');
const path = require('path');
const { dbAsync } = require('../../server/db/index.cjs');

const ROOT = path.resolve(__dirname, '../../');
const { BRANDING_CSS, HEADER_LOGO_HTML, DRAWER_LOGO_HTML, FOOTER_LOGO_HTML, SUPPORT_SECTION_HTML, SUPPORT_MODAL_HTML } = require('./support-brand-snippets.cjs');

async function buildPages() {
    console.log('Building public pages from canonical DB...');
    
    const games = await dbAsync.all("SELECT * FROM games WHERE status = 'PUBLISHED'");
    console.log(`Found ${games.length} published games.`);
    
    for (const game of games) {
        const slug = game.slug;
        const targetDir = path.join(ROOT, 'games', slug);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        
        // Very basic template generation. In reality this would share common layouts.
        const title = (game.title || 'Game').replace(/</g, '&lt;');
        const desc = (game.short_description || '').replace(/</g, '&lt;');
        
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - NostalgicVerse</title>
  <meta name="description" content="${desc}">
  <link rel="canonical" href="https://nostalgicverse.com/games/${slug}/">
  ${BRANDING_CSS}
</head>
<body>
  <div class="drawer-overlay" id="drawer-overlay" aria-hidden="true"></div>
  <aside class="side-drawer" id="side-drawer" aria-hidden="true">
    <div class="drawer-header">
      ${DRAWER_LOGO_HTML}
      <button class="drawer-close-btn" id="drawer-close-btn" aria-label="Close menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
  </aside>
  <header class="site-header">
    <div class="container">
      <div class="header-inner">
        ${HEADER_LOGO_HTML}
      </div>
    </div>
  </header>
  <main class="container" style="padding-top: 120px;">
    <h1>${title}</h1>
    <p>${desc}</p>
    <div>
        <strong>Released:</strong> ${game.release_year || 'Unknown'} <br>
        <strong>Platform:</strong> ${game.original_platform || 'Unknown'} <br>
        <strong>Developer:</strong> ${game.developer || 'Unknown'}
    </div>
  </main>
  <footer class="site-footer">
    ${FOOTER_LOGO_HTML}
  </footer>
  <script src="/assets/js/theme-toggle.js"></script>
</body>
</html>`;
        
        fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf8');
    }
    
    const consoles = await dbAsync.all("SELECT * FROM consoles WHERE status = 'PUBLISHED'");
    console.log(`Found ${consoles.length} published consoles.`);
    for (const c of consoles) {
        const slug = c.slug;
        const targetDir = path.join(ROOT, 'consoles', slug);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        
        const title = (c.title || 'Console').replace(/</g, '&lt;');
        const html = `<!DOCTYPE html><html lang="en"><head><title>${title} - NostalgicVerse</title></head><body><h1>${title}</h1></body></html>`;
        fs.writeFileSync(path.join(targetDir, 'index.html'), html, 'utf8');
    }

    console.log('Public pages built successfully.');
    
    // Also build search index
    require('child_process').execSync('node tools/generation/build-search-index.cjs', { cwd: ROOT });
}

buildPages().catch(console.error);

