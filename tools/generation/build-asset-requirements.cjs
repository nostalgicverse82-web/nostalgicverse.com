/**
 * NostalgicVerse — ASSET-REQUIREMENTS.md Generator
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const consolesData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/consoles.json'), 'utf8')).consoles;
const gamesDataDir = path.join(ROOT, 'data/games');
const gameFiles = fs.readdirSync(gamesDataDir).filter(f => f.endsWith('.json'));
const guidesData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/guides.json'), 'utf8').replace(/^\uFEFF/, '')).guides;
const storiesData = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/stories.json'), 'utf8').replace(/^\uFEFF/, '')).stories;

let md = '# NOSTALGICVERSE — MASTER MEDIA & ASSET REQUIREMENTS\n\n';
md += `**Project Root:** \`${ROOT}\`  \n`;
md += '**Canonical Domain:** `https://nostalgicverse.com`  \n';
md += '**Audit Date:** 2026-09-10  \n';
md += '**Status:** Active Reference & Production Specification  \n\n';
md += '---\n\n';

// 1. BRANDING
md += '## 1. Branding Assets\n\n';
md += '| Asset Name | File Path | Format | Dimensions | Purpose | Pages Used | Status | Priority |\n';
md += '| :--- | :--- | :---: | :---: | :--- | :--- | :---: | :---: |\n';
md += '| Primary Logo (PNG) | `/assets/images/branding/logo/logo.png` | PNG | 200×200 | Header logo, drawer logo, fallback OG image | All 113 pages | PRESENT + REQUIRED | P0 |\n';
md += '| Vector Logo Master | `/assets/images/branding/logo/logo.svg` | SVG | Scalable | Scalable vector identity mark | Master identity | PRESENT + REQUIRED | P1 |\n';
md += '| Favicon | `/favicon.ico` | ICO | Multi-res | Browser tab icon | All 113 pages | PRESENT + REQUIRED | P0 |\n\n';
md += '---\n\n';

// 2. CONSOLES
md += '## 2. Console Hardware Assets\n\n';
md += 'Directory: `/assets/images/consoles/`  \n';
md += 'Format: PNG with true alpha transparency (hardware studio cutout)  \n';
md += 'Standard Dimensions: 800×600 (4:3 aspect ratio)  \n\n';
md += '| # | Console Name | Slug | Expected Filename | Path | Current Status | Page(s) Used | Priority |\n';
md += '| :-: | :--- | :--- | :--- | :--- | :---: | :--- | :---: |\n';

const homepageSlugs = new Set(['playstation', 'super-nintendo-entertainment-system', 'nintendo-64', 'dreamcast']);

consolesData.forEach((c, idx) => {
  const filename = `${c.slug}.png`;
  const fullPath = path.join(ROOT, 'assets/images/consoles', filename);
  const exists = fs.existsSync(fullPath);
  const status = exists ? 'PRESENT + REQUIRED' : 'MISSING + REQUIRED';
  const priority = exists ? 'P0 (ACTIVE)' : 'P1 (ACCESSION)';
  let usage = `/consoles/, /consoles/${c.slug}/`;
  if (homepageSlugs.has(c.slug)) {
    usage += ', `/` (Homepage)';
  }
  md += `| ${idx+1} | ${c.name} | \`${c.slug}\` | \`${filename}\` | \`/assets/images/consoles/${filename}\` | **${status}** | ${usage} | ${priority} |\n`;
});

md += '\n---\n\n';

// 3. GAMES
md += '## 3. Game Title Artwork Assets\n\n';
md += 'Directory: `/assets/images/games/`  \n';
md += 'Format: WebP (Lossless/High-Quality Compression)  \n';
md += 'Standard Dimensions: 600×400 (3:2 aspect ratio)  \n\n';
md += '| # | Game Title | Canonical Slug | Expected Filename | Path | Status | Page(s) Used | Priority |\n';
md += '| :-: | :--- | :--- | :--- | :--- | :---: | :--- | :---: |\n';

const homepageGames = new Set(['metal-gear-solid', 'final-fantasy-vii', 'super-metroid', 'the-legend-of-zelda-ocarina-of-time', 'resident-evil']);

gameFiles.forEach((gf, idx) => {
  const game = JSON.parse(fs.readFileSync(path.join(gamesDataDir, gf), 'utf8'));
  const slug = game.slug || gf.replace('.json', '');
  const filename = `${slug}.webp`;
  const fullPath = path.join(ROOT, 'assets/images/games', filename);
  const exists = fs.existsSync(fullPath);
  const status = exists ? 'PRESENT + REQUIRED' : 'MISSING + REQUIRED';
  let usage = `/games/, /games/${slug}/`;
  if (homepageGames.has(slug)) usage += ', `/` (Homepage)';
  md += `| ${idx+1} | ${game.title} | \`${slug}\` | \`${filename}\` | \`/assets/images/games/${filename}\` | ${status} | ${usage} | P1 |\n`;
});

md += '\n---\n\n';

// 4. GENRES
md += '## 4. Genre Media Assets\n\n';
md += 'Architecture: Pure semantic HTML with inline SVG iconography and CSS radial glows.  \n';
md += 'Current Image Files Required: **0**  \n';
md += 'Status: **PRESENT + REQUIRED (Inline SVG Architecture)**  \n\n';
md += 'Optional future enhancements (hero backgrounds) are cataloged under Section 16.\n\n';
md += '---\n\n';

// 5. TIMELINE
md += '## 5. Timeline Media Assets\n\n';
md += 'Architecture: Chronological event tree rendered with semantic HTML nodes, epoch tags, and vector milestones.  \n';
md += 'Current Image Files Required: **0**  \n';
md += 'Status: **PRESENT + REQUIRED (Semantic DOM Architecture)**  \n\n';
md += 'Optional future epoch photography is cataloged under Section 16.\n\n';
md += '---\n\n';

// 6. GUIDES
md += '## 6. Guide Illustration Assets\n\n';
md += 'Directory: `/assets/images/guides/`  \n';
md += 'Format: WebP  \n';
md += 'Standard Dimensions: 480×270 (16:9 aspect ratio)  \n\n';
md += '| # | Guide Title | Slug | Expected Filename | Path | Status | Page(s) Used | Priority |\n';
md += '| :-: | :--- | :--- | :--- | :--- | :---: | :--- | :---: |\n';

guidesData.forEach((g, idx) => {
  const filename = `${g.slug}.webp`;
  const fullPath = path.join(ROOT, 'assets/images/guides', filename);
  const exists = fs.existsSync(fullPath);
  const status = exists ? 'PRESENT + REQUIRED' : 'MISSING + REQUIRED';
  md += `| ${idx+1} | ${g.title} | \`${g.slug}\` | \`${filename}\` | \`/assets/images/guides/${filename}\` | ${status} | \`/guides/\` | P1 |\n`;
});

md += '\n---\n\n';

// 7. STORIES
md += '## 7. Retrospective Story Assets\n\n';
md += 'Directory: `/assets/images/stories/`  \n';
md += 'Format: WebP  \n';
md += 'Standard Dimensions: 480×270 (16:9 aspect ratio)  \n\n';
md += '| # | Story Title | Slug | Expected Filename | Path | Status | Page(s) Used | Priority |\n';
md += '| :-: | :--- | :--- | :--- | :--- | :---: | :--- | :---: |\n';

storiesData.forEach((s, idx) => {
  const filename = `${s.slug}.webp`;
  const fullPath = path.join(ROOT, 'assets/images/stories', filename);
  const exists = fs.existsSync(fullPath);
  const status = exists ? 'PRESENT + REQUIRED' : 'MISSING + REQUIRED';
  md += `| ${idx+1} | ${s.title} | \`${s.slug}\` | \`${filename}\` | \`/assets/images/stories/${filename}\` | ${status} | \`/blog/\` | P1 |\n`;
});

md += '\n---\n\n';

// 8. BLOG / NEWS
md += '## 8. Blog & News Media Audit\n\n';
md += '- **Blog / Retrospective System:** Implemented and operational at `/blog/` (aliased from `/stories/` via HTTP 302). Content and media specified in Section 7 above.\n';
md += '- **News System Status:**\n';
md += '  ```\n';
md += '  NEWS SYSTEM:\n';
md += '  NOT CURRENTLY IMPLEMENTED\n';
md += '  ```\n';
md += '  No `/news/` routes, news article templates, news feeds, breaking headlines, or news media assets currently exist in the codebase. NostalgicVerse operates strictly as an archival museum and retrospective collection rather than a daily news wire.\n\n';
md += '---\n\n';

// 9. EMULATOR
md += '## 9. Emulator & Download Media Assets\n\n';
md += 'Page: `/download/index.html`  \n\n';
md += '| Asset | Expected Path | Format | Status | Priority |\n';
md += '| :--- | :--- | :---: | :---: | :---: |\n';
md += '| Windows OS Icon | `/assets/images/operating-system/windows.png` | PNG | PRESENT + REQUIRED | P0 |\n';
md += '| Linux OS Icon | `/assets/images/operating-system/linux.png` | PNG | PRESENT + REQUIRED | P0 |\n';
md += '| macOS OS Icon | `/assets/images/operating-system/macos.png` | PNG | PRESENT + REQUIRED | P0 |\n';
md += '| Android OS Icon | `/assets/images/operating-system/android.png` | PNG | PRESENT + REQUIRED | P0 |\n';
md += '| iOS OS Icon | `/assets/images/operating-system/ios.png` | PNG | PRESENT + REQUIRED | P0 |\n';
md += '| Emulator Hero Backdrop | `/assets/images/emulator/emulator-hero.webp` | WebP | FUTURE OPTIONAL | P3 |\n';
md += '| Emulator Interface Preview 1 | `/assets/images/emulator/emulator-screen-01.webp` | WebP | FUTURE OPTIONAL | P3 |\n\n';
md += '---\n\n';

// 10. OPERATING SYSTEMS
md += '## 10. Operating System Logo Assets\n\n';
md += 'Directory: `/assets/images/operating-system/`  \n\n';
md += '| Operating System | Filename | Physical Path | Resolution | Dimensions | Size | Status |\n';
md += '| :--- | :--- | :--- | :---: | :---: | :---: | :---: |\n';
md += '| Android | `android.png` | `assets/images/operating-system/android.png` | RGBA Alpha | 18×18 & 32×32 | 90,731 B | PRESENT + REQUIRED |\n';
md += '| iOS | `ios.png` | `assets/images/operating-system/ios.png` | RGBA Alpha | 18×18 & 32×32 | 43,140 B | PRESENT + REQUIRED |\n';
md += '| Linux | `linux.png` | `assets/images/operating-system/linux.png` | RGBA Alpha | 18×18 & 32×32 | 98,452 B | PRESENT + REQUIRED |\n';
md += '| macOS | `macos.png` | `assets/images/operating-system/macos.png` | RGBA Alpha | 18×18 & 32×32 | 87,565 B | PRESENT + REQUIRED |\n';
md += '| Windows | `windows.png` | `assets/images/operating-system/windows.png` | RGBA Alpha | 18×18 & 32×32 | 74,580 B | PRESENT + REQUIRED |\n\n';
md += '---\n\n';

// 11. UI
md += '## 11. UI / Icon Asset Audit\n\n';
md += '- **Vector Iconography:** Zero external font icons or bitmap icons are loaded. All icons (search loupe, favorite heart, filter funnels, directional arrows, mobile hamburger, close drawers) are rendered via inline SVG paths.\n';
md += '- **Museum Fallback Plates:** Dynamic inline SVGs with `.artwork-fallback-plate` and `.card-fallback-plate` containers render on image load failure.\n';
md += '- **Directory `/assets/images/ui/`:** Currently empty; no bitmap UI assets required.\n';
md += '- **Status:** **PRESENT + REQUIRED (Zero-Dependency Inline SVG System)**\n\n';
md += '---\n\n';

// 12. OPEN GRAPH
md += '## 12. Open Graph & Social Sharing Assets\n\n';
md += '- **Default OG Image:** `https://nostalgicverse.com/assets/images/branding/logo/logo.png` (PRESENT + REQUIRED, referenced by all top-level hub pages, legal pages, utility pages).\n';
md += '- **Console OG Images:** `https://nostalgicverse.com/assets/images/consoles/{slug}.png` (PRESENT + REQUIRED for 63 consoles).\n';
md += '- **Dedicated Social Cards (Future):** `/assets/images/og/games/{slug}-og.webp` and `/assets/images/og/consoles/{slug}-og.webp` (FUTURE OPTIONAL, P2).\n\n';
md += '---\n\n';

// 13. VIDEOS
md += '## 13. Video Audit\n\n';
md += '```\n';
md += 'VIDEO SYSTEM:\n';
md += 'NO CURRENT LOCAL VIDEO ASSETS / NO VIDEO REQUIRED\n';
md += '```\n';
md += '- **HTML `<video>` Elements:** 0\n';
md += '- **Third-party Video Embeds (YouTube, Vimeo):** 0\n';
md += '- **Local Video Files (`.mp4`, `.webm`, `.mov`, `.ogg`):** 0\n';
md += '- **Policy:** Video players are NOT to be invented or injected into the static museum architecture without explicit design specifications.\n\n';
md += '---\n\n';

// 14. AUDIO
md += '## 14. Audio Audit\n\n';
md += '```\n';
md += 'AUDIO SYSTEM:\n';
md += 'NOT CURRENTLY REQUIRED\n';
md += '```\n';
md += '- **HTML `<audio>` Elements:** 0\n';
md += '- **Local Audio Files (`.mp3`, `.wav`, `.ogg`):** 0\n';
md += '- **Policy:** Audio playback is not part of the active browsing architecture.\n\n';
md += '---\n\n';

// 15. MISSING REQUIRED ASSETS
md += '## 15. Missing Required Assets (P1 Priority)\n\n';
md += 'These assets are formally referenced or expected by active exhibit pages and will eliminate visible museum accession fallback plates upon acquisition:\n\n';
md += '| Category | Subject / Title | Canonical Slug | Expected Filename | Expected Path | Priority |\n';
md += '| :--- | :--- | :--- | :--- | :--- | :---: |\n';

// Check any missing console cutouts dynamically
const missingConsolesList = consolesData.filter(c => !fs.existsSync(path.join(ROOT, 'assets/images/consoles', `${c.slug}.png`)));
missingConsolesList.forEach(c => {
  md += `| Console | ${c.name} | \`${c.slug}\` | \`${c.slug}.png\` | \`/assets/images/consoles/${c.slug}.png\` | P1 |\n`;
});
if (missingConsolesList.length === 0) {
  md += '| Hardware Cutouts | All 65 Master Consoles | `all-consoles` | `*.png` | `/assets/images/consoles/` | **COMPLETE (65/65 ACQUIRED)** |\n';
}

gameFiles.forEach(gf => {
  const game = JSON.parse(fs.readFileSync(path.join(gamesDataDir, gf), 'utf8'));
  const slug = game.slug || gf.replace('.json', '');
  md += `| Game | ${game.title} | \`${slug}\` | \`${slug}.webp\` | \`/assets/images/games/${slug}.webp\` | P1 |\n`;
});

guidesData.forEach(g => {
  md += `| Guide | ${g.title} | \`${g.slug}\` | \`${g.slug}.webp\` | \`/assets/images/guides/${g.slug}.webp\` | P1 |\n`;
});

storiesData.forEach(s => {
  md += `| Story | ${s.title} | \`${s.slug}\` | \`${s.slug}.webp\` | \`/assets/images/stories/${s.slug}.webp\` | P1 |\n`;
});

md += '\n---\n\n';

// 16. OPTIONAL / FUTURE ASSETS
md += '## 16. Optional & Future Assets (P2 / P3 Priority)\n\n';
md += '| Category | Asset Description | Expected Path | Priority | Notes |\n';
md += '| :--- | :--- | :--- | :---: | :--- |\n';
md += '| OpenGraph | Dedicated Game 1200×630 Cards | `/assets/images/og/games/{slug}-og.webp` | P2 | Enhances Discord / Twitter card presentation |\n';
md += '| OpenGraph | Dedicated Console 1200×630 Cards | `/assets/images/og/consoles/{slug}-og.webp` | P2 | Replaces direct hardware cutout in social links |\n';
md += '| Emulator | Desktop Client Backdrop | `/assets/images/emulator/emulator-hero.webp` | P3 | High-res mock interface banner for `/download/` |\n';
md += '| Emulator | Client In-Game Screenshot | `/assets/images/emulator/emulator-screen-01.webp` | P3 | Filter demonstration screenshot |\n';
md += '| Genres | Genre Category Hero Backgrounds | `/assets/images/genres/{slug}.webp` | P3 | Visual atmosphere backdrops for genre cards |\n';
md += '| Timeline | Era Milestone Archival Photos | `/assets/images/timeline/{event-id}.webp` | P3 | Historical exhibit photos for timeline nodes |\n\n';
md += '---\n\n';

// 17. ASSET NAMING RULES
md += '## 17. Asset Naming Rules & Conventions\n\n';
md += '1. **Strict Lowercase Kebab-Case:** All filenames must consist solely of lowercase ASCII letters, numerals, and single hyphens (e.g. `nintendo-64.png`, `pac-man.webp`).\n';
md += '2. **Forbidden Patterns:** Filenames must never include:\n';
md += '   - Spaces (e.g. `Generated Image.png`)\n';
md += '   - Timestamps (e.g. `September 10, 2026 - 3_41PM.webp`)\n';
md += '   - Copy duplicates (e.g. `(1)`, `(2)`, `_copy`)\n';
md += '   - Random machine hashes or camera tags (e.g. `IMG_4091.jpg`)\n';
md += '3. **Format Standards by Category:**\n';
md += '   - **Console Hardware Cutouts:** `.png` (True 32-bit RGBA with transparent background).\n';
md += '   - **Operating System Logos:** `.png` (True 32-bit RGBA with transparent background).\n';
md += '   - **Game Title Artwork / Box Art:** `.webp` (Optimized lossy/lossless WebP, max quality 90-92).\n';
md += '   - **Guide Illustrations / Technical Graphics:** `.webp`.\n';
md += '   - **Story & Essay Header Art:** `.webp`.\n';
md += '   - **Brand Vector Marks:** `.svg`.\n';
md += '   - **Favicon:** `.ico`.\n\n';
md += '---\n\n';

// 18. RECOMMENDED ACQUISITION ORDER
md += '## 18. Recommended Asset Acquisition Order\n\n';
md += 'To maximize the museum presentation quality systematically without rework, assets should be acquired in the following 5 phases:\n\n';
md += '### Phase 1: Missing Console Hardware Cutouts (2 Items — Priority P1)\n';
md += 'Completes the hardware museum across all 65 consoles:\n';
md += '1. `philips-cd-i.png` (Philips CD-i Hardware)\n';
md += '2. `neo-geo-cd.png` (SNK Neo Geo CD Top-Loading Hardware)\n\n';
md += '### Phase 2: Lead Featured Game Artworks (5 Items — Priority P1)\n';
md += 'Immediately removes fallback plates from the Homepage and Games Lead Showcase:\n';
md += '1. `metal-gear-solid.webp` (PlayStation, 1998)\n';
md += '2. `final-fantasy-vii.webp` (PlayStation, 1997)\n';
md += '3. `super-metroid.webp` (Super Nintendo, 1994)\n';
md += '4. `the-legend-of-zelda-ocarina-of-time.webp` (Nintendo 64, 1998)\n';
md += '5. `resident-evil.webp` (PlayStation, 1996)\n\n';
md += '### Phase 3: Remaining 25 Canonical Game Exhibit Artworks (25 Items — Priority P1)\n';
md += 'Brings 100% complete artwork coverage to all 30 game exhibits in `/games/`.\n\n';
md += '### Phase 4: Archival Guide & Story Illustrations (28 Items — Priority P1)\n';
md += '- 14 Guide technical diagrams in `/assets/images/guides/`\n';
md += '- 14 Historical retrospective illustrations in `/assets/images/stories/`\n\n';
md += '### Phase 5: Optional Polish & Social Media Cards (Priority P2 / P3)\n';
md += '- 1200×630 OpenGraph social media sharing cards in `/assets/images/og/`\n';
md += '- Emulator client interface previews in `/assets/images/emulator/`\n';

fs.writeFileSync(path.join(ROOT, 'ASSET-REQUIREMENTS.md'), md, 'utf8');
console.log('Successfully generated ASSET-REQUIREMENTS.md! Total characters:', md.length);
