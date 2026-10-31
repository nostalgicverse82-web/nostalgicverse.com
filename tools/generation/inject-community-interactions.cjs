/**
 * NostalgicVerse Community Interactions Injector
 * Integrates the universal interaction bar, comments, reactions, and reviews
 * into public museum exhibits and catalog pages safely without modifying historical text.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');

function injectIntoFile(filePath, contentType, contentId) {
    if (!fs.existsSync(filePath)) return false;
    let content = fs.readFileSync(filePath, 'utf8');

    // Skip if already injected
    if (content.includes('id="community-interactions"')) {
        return false;
    }

    // 1. Inject CSS in head
    if (!content.includes('content-interactions.css')) {
        content = content.replace('</head>', '  <link rel="stylesheet" href="/assets/css/content-interactions.css">\n</head>');
    }

    // 2. Inject Community Container before </main>
    const communitySnippet = `
    <!-- Museum Community Interactions & Discussion -->
    <div class="container" style="margin-top: 48px; margin-bottom: 48px;">
      <div id="community-interactions" data-type="${contentType}" data-id="${contentId}"></div>
    </div>
  </main>`;

    content = content.replace('</main>', communitySnippet);

    // 3. Inject JS before </body>
    const jsSnippet = `
  <script src="/assets/js/realtime-client.js"></script>
  <script src="/assets/js/content-interactions.js"></script>
</body>`;

    if (!content.includes('content-interactions.js')) {
        content = content.replace('</body>', jsSnippet);
    }

    fs.writeFileSync(filePath, content, 'utf8');
    return true;
}

function run() {
    console.log('Injecting Universal Community Interactions into public pages...');
    let count = 0;

    // 1. Root & Section Pages
    const standardPages = [
        { file: 'games/index.html', type: 'game', id: 'games-archive' },
        { file: 'consoles/index.html', type: 'console', id: 'consoles-archive' },
        { file: 'guides/index.html', type: 'guide', id: 'retro-guides' },
        { file: 'blog/index.html', type: 'story', id: 'retro-stories' },
        { file: 'timeline/index.html', type: 'timeline', id: 'historical-timeline' },
        { file: 'genres/index.html', type: 'genre', id: 'retro-genres' },
        { file: 'ideas/index.html', type: 'idea', id: 'community-ideas' }
    ];

    for (const p of standardPages) {
        const fullPath = path.join(ROOT, p.file);
        if (injectIntoFile(fullPath, p.type, p.id)) {
            console.log(`Injected into ${p.file}`);
            count++;
        }
    }

    // 2. Game exhibits
    const gamesDir = path.join(ROOT, 'games');
    if (fs.existsSync(gamesDir)) {
        const gameFolders = fs.readdirSync(gamesDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);

        for (const slug of gameFolders) {
            const htmlPath = path.join(gamesDir, slug, 'index.html');
            if (injectIntoFile(htmlPath, 'game', slug)) {
                count++;
            }
        }
    }

    // 3. Console exhibits
    const consolesDir = path.join(ROOT, 'consoles');
    if (fs.existsSync(consolesDir)) {
        const consoleFolders = fs.readdirSync(consolesDir, { withFileTypes: true })
            .filter(d => d.isDirectory())
            .map(d => d.name);

        for (const slug of consoleFolders) {
            const htmlPath = path.join(consolesDir, slug, 'index.html');
            if (injectIntoFile(htmlPath, 'console', slug)) {
                count++;
            }
        }
    }

    console.log(`Finished injecting into ${count} exhibit and catalog pages.`);
}

if (require.main === module) {
    run();
}

module.exports = { injectIntoFile, run };

