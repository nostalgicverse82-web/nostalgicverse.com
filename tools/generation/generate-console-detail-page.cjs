/**
 * NostalgicVerse Static Console Detail Page Generator
 * 
 * Mobile-First Responsive Architecture + Museum Hardware Curation
 * Generates self-contained static HTML pages for each canonical console.
 * 
 * Usage:
 *   node tools/generation/generate-console-detail-page.cjs --all
 *   node tools/generation/generate-console-detail-page.cjs --slug <slug>
 *   node tools/generation/generate-console-detail-page.cjs --batch <number>
 *   node tools/generation/generate-console-detail-page.cjs --dry-run
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');
const { BRANDING_CSS, HEADER_LOGO_HTML, DRAWER_LOGO_HTML, FOOTER_LOGO_HTML, SUPPORT_SECTION_HTML, SUPPORT_MODAL_HTML } = require('./support-brand-snippets.cjs');

// Parse CLI flags
const args = process.argv.slice(2);
const options = {
  slug: null,
  batch: null,
  all: false,
  dryRun: false
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--slug' && args[i + 1]) {
    options.slug = args[++i];
  } else if (arg === '--batch' && args[i + 1]) {
    options.batch = parseInt(args[++i], 10);
  } else if (arg === '--all') {
    options.all = true;
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// 1. Load CONSOLES_DATA from consoles/index.html to get supplementary fields
function loadConsolesCatalog() {
  const consolesHtmlPath = path.join(ROOT, 'consoles/index.html');
  if (!fs.existsSync(consolesHtmlPath)) return new Map();
  const content = fs.readFileSync(consolesHtmlPath, 'utf8');
  const match = content.match(/const CONSOLES_DATA = (\[[\s\S]*?\]);/);
  if (!match) return new Map();
  try {
    const arr = eval(match[1]);
    return new Map(arr.map(c => [c.slug, c]));
  } catch (e) {
    console.warn('Warning: Could not parse CONSOLES_DATA from consoles/index.html:', e.message);
    return new Map();
  }
}

// 2. Load timeline milestones to link directly to console exhibits
function loadTimelineEvents() {
  const timelineHtmlPath = path.join(ROOT, 'timeline/index.html');
  if (!fs.existsSync(timelineHtmlPath)) return [];
  const content = fs.readFileSync(timelineHtmlPath, 'utf8');
  const match = content.match(/const TIMELINE_DATA = (\[[\s\S]*?\]);/);
  if (!match) return [];
  try {
    return eval(match[1]);
  } catch (e) {
    console.warn('Warning: Could not parse TIMELINE_DATA from timeline/index.html:', e.message);
    return [];
  }
}

// 3. Load set of existing game exhibits for smart hyperlinking
function loadExistingGames() {
  const gamesDir = path.join(ROOT, 'games');
  if (!fs.existsSync(gamesDir)) return new Set();
  const dirs = fs.readdirSync(gamesDir).filter(f => {
    try {
      return fs.statSync(path.join(gamesDir, f)).isDirectory() && fs.existsSync(path.join(gamesDir, f, 'index.html'));
    } catch (e) {
      return false;
    }
  });
  return new Set(dirs);
}

// Cache global datasets
const consolesCatalogMap = loadConsolesCatalog();
const allTimelineEvents = loadTimelineEvents();
const existingGameSlugs = loadExistingGames();

/**
 * Render single self-contained console exhibit HTML
 */
function renderConsoleHtml(consoleData) {
  const slug = consoleData.slug;
  const extra = consolesCatalogMap.get(slug) || {};
  
  const rawName = consoleData.name || extra.name || 'Hardware Exhibit';
  const name = escapeHtml(rawName);
  const manufacturer = escapeHtml(consoleData.manufacturer || extra.manufacturer || 'Unknown Manufacturer');
  const generation = escapeHtml(consoleData.generation || extra.generation || 'Historical Generation');
  const year = consoleData.originalReleaseYear || extra.originalReleaseYear || '';
  const exactDate = escapeHtml(consoleData.exactReleaseDate || extra.originalReleaseDate || `${year}`);
  const region = escapeHtml(extra.primaryRegion || 'Worldwide');
  const price = escapeHtml(extra.launchPrice || 'Historic Release');
  const mediaFormat = escapeHtml(consoleData.mediaFormat || extra.mediaFormat || 'Solid-State / Physical Media');
  const mediaCategory = escapeHtml(extra.mediaCategory || mediaFormat);
  const era = escapeHtml(extra.era || `${String(year).slice(0, 3)}0s`);
  const significance = escapeHtml(consoleData.significance || extra.historicalSignificance || 'A landmark hardware milestone in digital computing and interactive entertainment history.');
  const rawSignificance = consoleData.significance || extra.historicalSignificance || 'A landmark hardware milestone in digital computing and interactive entertainment history.';

  const canonicalUrl = `https://nostalgicverse.com/consoles/${slug}/`;
  
  // Factual engineering data
  const factual = consoleData.verifiedFactualData || {};
  const cpu = escapeHtml(factual.cpu || extra.cpu || 'Proprietary Microarchitecture');
  const gpu = escapeHtml(factual.gpuOrVideoChip || extra.gpu || 'Custom Video Graphics Architecture');
  const ram = escapeHtml(factual.ram || extra.memory || 'System Main Memory');
  const storage = escapeHtml(extra.storage || 'Solid-State Media / ROM Cartridge');
  const controller = escapeHtml(consoleData.editorialContent?.controllerDesign || extra.controller || 'Dedicated Game Controller');
  const powerSupply = escapeHtml(factual.powerSupply || 'Standard External AC/DC Adapter');
  const avOutputs = factual.avOutputs ? factual.avOutputs.map(escapeHtml).join(', ') : 'RF Coaxial / Composite Video';
  const soundChip = escapeHtml(factual.soundChip || 'Integrated Custom Audio Synthesizer');
  const onlineService = escapeHtml(extra.onlineService || '');
  const predecessor = extra.predecessor ? escapeHtml(extra.predecessor) : null;
  const successor = extra.successor ? escapeHtml(extra.successor) : null;

  // Editorial essays
  const editorial = consoleData.editorialContent || {};
  const overview = escapeHtml(editorial.overview || extra.shortDescription || significance);
  const marketLegacy = escapeHtml(editorial.marketLegacy || significance);
  const engineeringInnovations = escapeHtml(editorial.engineeringInnovations || '');
  const controllerDesign = escapeHtml(editorial.controllerDesign || extra.controller || '');
  const preservationNotes = escapeHtml(editorial.preservationAndCommonFailures || '');

  // Check physical asset existence on disk
  const expectedImgPath = `/assets/images/consoles/${slug}.png`;
  const physicalImgExists = fs.existsSync(path.join(ROOT, expectedImgPath));
  const heroImgUrl = physicalImgExists ? expectedImgPath : null;

  // Related timeline milestones
  const consoleTimelineEvents = allTimelineEvents.filter(e => e.relatedConsole === slug);

  // Key games
  const keyGames = Array.isArray(consoleData.keyGames) && consoleData.keyGames.length > 0
    ? consoleData.keyGames
    : (Array.isArray(extra.notableGames) ? extra.notableGames : []);

  // Related consoles in same generation or manufacturer
  const relatedConsoles = [];
  consolesCatalogMap.forEach(c => {
    if (c.slug !== slug && (c.generation === consoleData.generation || c.manufacturer === consoleData.manufacturer)) {
      relatedConsoles.push(c);
    }
  });
  const curatedRelatedConsoles = relatedConsoles.slice(0, 4);

  // Schema.org structured data (Product + BreadcrumbList + ItemPage)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
        "@id": `${canonicalUrl}#breadcrumb`,
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": "https://nostalgicverse.com/"
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Console Archive",
            "item": "https://nostalgicverse.com/consoles/"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": rawName,
            "item": canonicalUrl
          }
        ]
      },
      {
        "@type": "ItemPage",
        "@id": `${canonicalUrl}#webpage`,
        "url": canonicalUrl,
        "name": `${rawName} (${year}) — Hardware Archive Exhibit`,
        "description": rawSignificance,
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://nostalgicverse.com/#website",
          "url": "https://nostalgicverse.com/",
          "name": "NostalgicVerse"
        }
      },
      {
        "@type": "Product",
        "@id": `${canonicalUrl}#product`,
        "name": rawName,
        "description": rawSignificance,
        "category": "Video Game Console",
        "brand": {
          "@type": "Brand",
          "name": consoleData.manufacturer || "Unknown Manufacturer"
        },
        "manufacturer": {
          "@type": "Organization",
          "name": consoleData.manufacturer || "Unknown Manufacturer"
        },
        "releaseDate": consoleData.exactReleaseDate || `${year}-01-01`,
        "image": physicalImgExists
          ? `https://nostalgicverse.com${expectedImgPath}`
          : "https://nostalgicverse.com/assets/images/branding/logo/logo.png"
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  
  <title>${name} (${year}) — Hardware Archive Exhibit — NostalgicVerse</title>
  <meta name="description" content="${significance}">
  <meta name="keywords" content="${escapeHtml((consoleData.keywords || []).join(', '))}, ${name}, ${manufacturer}, retro console, video game hardware, museum archive">
  <meta name="author" content="NostalgicVerse Digital Museum">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="theme-color" content="#08080C">
  
  <!-- Open Graph / Social -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="NostalgicVerse">
  <meta property="og:title" content="${name} (${year}) — Hardware Archive Exhibit">
  <meta property="og:description" content="${significance}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${physicalImgExists ? 'https://nostalgicverse.com' + expectedImgPath : 'https://nostalgicverse.com/assets/images/branding/logo/logo.png'}">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${name} (${year}) — NostalgicVerse">
  <meta name="twitter:description" content="${significance}">
  <meta name="twitter:image" content="${physicalImgExists ? 'https://nostalgicverse.com' + expectedImgPath : 'https://nostalgicverse.com/assets/images/branding/logo/logo.png'}">
  
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>

  <style>
    /* ==========================================================================
       01. APPROVED NOSTALGICVERSE DESIGN TOKENS
       ========================================================================== */
    :root {
      --nv-bg: #08080C;
      --nv-bg-alt: #0C0C11;
      --nv-surface: #111118;
      --nv-surface-raised: #15151D;
      --nv-surface-active: #1C1C26;
      --nv-border: #1E1E2C;
      --nv-border-strong: #2A2A38;
      --nv-border-hover: rgba(0, 229, 255, 0.35);
      --nv-text: #F4F4F7;
      --nv-text-muted: #A7A7B5;
      --nv-text-dim: #737381;
      --nv-cyan: #00E5FF;
      --nv-gold: #FFB300;
      --nv-crimson: #FF2A6D;
      --nv-font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --nv-font-mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace;
      --nv-container-max: 1280px;
      --nv-header-height: 72px;
      --nv-radius-sm: 4px;
      --nv-radius-md: 8px;
      --nv-radius-lg: 12px;
      --nv-transition-fast: 160ms cubic-bezier(0.16, 1, 0.3, 1);
      --nv-transition-normal: 260ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      background-color: var(--nv-bg);
      color: var(--nv-text);
      font-family: var(--nv-font-sans);
      scroll-behavior: smooth;
      -webkit-text-size-adjust: 100%;
    }

    body {
      background-color: var(--nv-bg);
      color: var(--nv-text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      line-height: 1.65;
      overflow-x: hidden;
      width: 100%;
      -webkit-font-smoothing: antialiased;
    }

    body.menu-open {
      overflow: hidden;
    }

    /* Accessibility Skip Link */
    .skip-link {
      position: absolute;
      top: -100px;
      left: 16px;
      background: var(--nv-cyan);
      color: #000;
      padding: 10px 16px;
      font-weight: 700;
      font-size: 0.875rem;
      z-index: 10000;
      border-radius: var(--nv-radius-sm);
      text-decoration: none;
      transition: top var(--nv-transition-fast);
    }
    .skip-link:focus {
      top: 16px;
    }

    a {
      color: var(--nv-cyan);
      text-decoration: none;
      transition: color var(--nv-transition-fast);
    }
    a:hover {
      color: #66efff;
      text-decoration: underline;
    }

    /* Focus Ring */
    :focus-visible {
      outline: 2px solid var(--nv-cyan);
      outline-offset: 2px;
    }

    /* ==========================================================================
       02. SITE HEADER & MOBILE RESPONSIVE NAVIGATION
       ========================================================================== */
    .site-header {
      position: sticky;
      top: 0;
      z-index: 100;
      background-color: rgba(8, 8, 12, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--nv-border);
      height: var(--nv-header-height);
      display: flex;
      align-items: center;
    }

    .header-inner {
      width: 100%;
      max-width: var(--nv-container-max);
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
    }

    .brand-group {
      display: flex;
      align-items: center;
      flex-shrink: 0;
    }

    .brand-logo-wrap {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--nv-text);
    }
    .brand-logo-wrap:hover {
      text-decoration: none;
    }

    .brand-mark {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--nv-radius-md);
      background: linear-gradient(135deg, var(--nv-surface-raised) 0%, var(--nv-surface-active) 100%);
      border: 1px solid var(--nv-border-strong);
      color: var(--nv-cyan);
      font-weight: 900;
      font-size: 0.95rem;
      letter-spacing: -0.05em;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
    }

    .brand-text {
      font-size: 1.15rem;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #fff;
    }

    /* Desktop Navigation */
    .site-nav {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .nav-link {
      padding: 8px 12px;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--nv-text-muted);
      border-radius: var(--nv-radius-sm);
      transition: color var(--nv-transition-fast), background-color var(--nv-transition-fast);
      text-decoration: none;
    }
    .nav-link:hover {
      color: #fff;
      background-color: var(--nv-surface-raised);
      text-decoration: none;
    }
    .nav-link.active {
      color: #fff;
      background-color: var(--nv-surface);
      font-weight: 600;
    }

    /* Header Actions */
    .header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .header-action-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: var(--nv-radius-md);
      background-color: var(--nv-surface);
      border: 1px solid var(--nv-border);
      color: var(--nv-text-muted);
      cursor: pointer;
      position: relative;
      transition: all var(--nv-transition-fast);
      text-decoration: none;
    }
    .header-action-btn:hover {
      color: var(--nv-cyan);
      border-color: var(--nv-border-hover);
      background-color: var(--nv-surface-raised);
      text-decoration: none;
    }

    .fav-badge {
      position: absolute;
      top: 6px;
      right: 6px;
      background-color: var(--nv-crimson);
      color: #fff;
      font-size: 0.65rem;
      font-weight: 800;
      min-width: 16px;
      height: 16px;
      padding: 0 4px;
      border-radius: 999px;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    /* Mobile Menu Toggle (44px touch target) */
    .menu-toggle {
      display: none;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: var(--nv-surface);
      border: 1px solid var(--nv-border);
      color: var(--nv-text);
      border-radius: var(--nv-radius-md);
      cursor: pointer;
      transition: all var(--nv-transition-fast);
    }
    .menu-toggle:hover {
      background: var(--nv-surface-raised);
      color: var(--nv-cyan);
      border-color: var(--nv-border-hover);
    }

    /* Mobile Header Breakpoint (<= 991px) */
    @media (max-width: 991px) {
      .site-nav {
        display: none;
      }
      .menu-toggle {
        display: inline-flex;
      }
    }

    /* ==========================================================================
       03. ACCESSIBLE MOBILE NAVIGATION DRAWER
       ========================================================================== */
    .mobile-drawer-overlay {
      position: fixed;
      inset: 0;
      background: rgba(4, 4, 6, 0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 200;
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--nv-transition-normal);
    }

    .mobile-drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(85vw, 360px);
      background-color: var(--nv-bg-alt);
      border-left: 1px solid var(--nv-border);
      z-index: 210;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      transform: translateX(100%);
      transition: transform var(--nv-transition-normal);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }

    .mobile-drawer-overlay.is-open {
      opacity: 1;
      pointer-events: auto;
    }

    .mobile-drawer.is-open {
      transform: translateX(0);
    }

    .drawer-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-bottom: 20px;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--nv-border);
    }

    .drawer-close-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      background: var(--nv-surface);
      border: 1px solid var(--nv-border);
      color: var(--nv-text-muted);
      border-radius: var(--nv-radius-md);
      cursor: pointer;
      transition: all var(--nv-transition-fast);
    }
    .drawer-close-btn:hover {
      color: #fff;
      background: var(--nv-surface-raised);
      border-color: var(--nv-border-hover);
    }

    .drawer-nav {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .drawer-link {
      display: flex;
      align-items: center;
      min-height: 44px;
      padding: 8px 16px;
      border-radius: var(--nv-radius-md);
      font-size: 0.95rem;
      font-weight: 500;
      color: var(--nv-text-muted);
      text-decoration: none;
      transition: all var(--nv-transition-fast);
    }
    .drawer-link:hover {
      background-color: var(--nv-surface);
      color: #fff;
      text-decoration: none;
    }
    .drawer-link.active {
      background-color: var(--nv-surface-active);
      color: var(--nv-cyan);
      font-weight: 600;
    }

    .drawer-divider {
      height: 1px;
      background-color: var(--nv-border);
      margin: 12px 0;
    }

    /* ==========================================================================
       04. NAVIGATION BAR (BREADCRUMBS & ARCHIVE BACKLINK)
       ========================================================================== */
    .nav-breadcrumb-bar {
      width: 100%;
      max-width: var(--nv-container-max);
      margin: 1.5rem auto 0;
      padding: 0 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      font-size: 0.875rem;
    }

    .breadcrumbs {
      color: var(--nv-text-dim);
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .breadcrumbs a {
      color: var(--nv-text-muted);
    }
    .breadcrumbs a:hover {
      color: #fff;
    }
    .breadcrumbs span.sep {
      opacity: 0.4;
    }

    .back-archive-link {
      color: var(--nv-text-muted);
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      padding: 0 4px;
    }
    .back-archive-link:hover {
      color: var(--nv-cyan);
      text-decoration: none;
    }

    /* ==========================================================================
       05. EXHIBIT HERO PANEL
       ========================================================================== */
    .exhibit-container {
      width: 100%;
      max-width: var(--nv-container-max);
      margin: 1.5rem auto 4rem;
      padding: 0 24px;
      flex: 1;
    }

    .hero-panel {
      background-color: var(--nv-surface);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-lg);
      padding: clamp(1.5rem, 4vw, 2.5rem);
      margin-bottom: 2rem;
      position: relative;
      overflow: hidden;
    }
    .hero-panel::before {
      content: "";
      position: absolute;
      top: 0;
      right: 0;
      width: 320px;
      height: 320px;
      background: radial-gradient(circle at top right, rgba(0, 229, 255, 0.12), transparent 70%);
      pointer-events: none;
    }

    .hero-badge-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .badge-cyan {
      background: rgba(0, 229, 255, 0.12);
      color: var(--nv-cyan);
      border: 1px solid rgba(0, 229, 255, 0.28);
    }
    .badge-gold {
      background: rgba(255, 179, 0, 0.12);
      color: var(--nv-gold);
      border: 1px solid rgba(255, 179, 0, 0.28);
    }
    .badge-era {
      background: rgba(255, 42, 109, 0.12);
      color: var(--nv-crimson);
      border: 1px solid rgba(255, 42, 109, 0.28);
    }

    .hero-title {
      font-size: clamp(1.75rem, 5vw, 2.85rem);
      font-weight: 900;
      line-height: 1.15;
      margin-bottom: 0.75rem;
      color: #fff;
      letter-spacing: -0.02em;
      word-break: break-word;
    }

    .hero-subtitle {
      font-size: clamp(1rem, 2.5vw, 1.15rem);
      color: var(--nv-text-muted);
      max-width: 860px;
      margin-bottom: 1.5rem;
      line-height: 1.6;
    }

    .hero-actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }

    .btn-fav {
      background-color: var(--nv-surface-raised);
      border: 1px solid var(--nv-border-strong);
      color: var(--nv-text);
      min-height: 44px;
      padding: 0 1.25rem;
      border-radius: var(--nv-radius-md);
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      transition: all var(--nv-transition-fast);
    }
    .btn-fav:hover {
      background-color: var(--nv-surface-active);
      border-color: var(--nv-crimson);
      color: #fff;
    }
    .btn-fav.active {
      background: rgba(255, 42, 109, 0.15);
      border-color: var(--nv-crimson);
      color: var(--nv-crimson);
    }

    /* ==========================================================================
       06. MUSEUM IDENTIFICATION STRIP (KEY FACTS MATRIX)
       ========================================================================== */
    .key-facts-strip {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 2rem;
    }

    .fact-card {
      background: var(--nv-surface);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-md);
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .fact-label {
      font-family: var(--nv-font-mono);
      font-size: 0.7rem;
      text-transform: uppercase;
      color: var(--nv-text-dim);
      letter-spacing: 0.08em;
    }
    .fact-value {
      font-weight: 700;
      font-size: 0.95rem;
      color: var(--nv-text);
    }
    .fact-value.highlight {
      color: var(--nv-cyan);
    }

    /* ==========================================================================
       07. MUSEUM ARTIFACT VISUAL & ACCESSION FALLBACK PLATE
       ========================================================================== */
    .artifact-visual-wrap {
      margin-bottom: 2.25rem;
      border-radius: var(--nv-radius-lg);
      overflow: hidden;
      border: 1px solid var(--nv-border);
      background: radial-gradient(circle at center, #151520 0%, #0c0c12 100%);
      position: relative;
    }

    .artifact-image-container {
      width: 100%;
      aspect-ratio: 16 / 9;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: clamp(1rem, 3vw, 2.5rem);
    }

    .artifact-image {
      width: 100%;
      height: 100%;
      max-height: 540px;
      object-fit: contain;
      filter: drop-shadow(0 20px 40px rgba(0, 0, 0, 0.75));
    }

    .museum-artifact-plate {
      background: linear-gradient(135deg, #0c0c12 0%, #15151f 100%);
      padding: clamp(2.5rem, 6vw, 4rem) clamp(1.25rem, 4vw, 2.5rem);
      text-align: center;
      position: relative;
      border-radius: var(--nv-radius-lg);
    }

    .plate-vector-box {
      width: 120px;
      height: 80px;
      margin: 0 auto 1.5rem;
      color: var(--nv-border-strong);
      display: grid;
      place-items: center;
    }
    .plate-vector-box svg {
      width: 100%;
      height: 100%;
      stroke: var(--nv-border-strong);
    }

    .plate-accession {
      font-family: var(--nv-font-mono);
      font-size: 0.75rem;
      color: var(--nv-gold);
      letter-spacing: 0.12em;
      margin-bottom: 0.75rem;
      text-transform: uppercase;
      word-break: break-all;
    }

    .plate-title {
      font-size: clamp(1.35rem, 4vw, 1.85rem);
      font-weight: 800;
      color: #fff;
      margin-bottom: 0.5rem;
      word-break: break-word;
    }

    .plate-meta {
      font-size: 0.95rem;
      color: var(--nv-text-muted);
      margin-bottom: 1.25rem;
    }

    .plate-status {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-family: var(--nv-font-mono);
      font-size: 0.75rem;
      color: var(--nv-text-dim);
      border-top: 1px solid var(--nv-border);
      padding-top: 0.75rem;
      max-width: 540px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      line-height: 1.5;
    }

    .status-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: var(--nv-gold);
      display: inline-block;
      flex-shrink: 0;
    }

    /* ==========================================================================
       08. TWO-COLUMN EDITORIAL CONTENT & SIDEBAR SPECS
       ========================================================================== */
    .content-grid {
      display: grid;
      grid-template-columns: 2.2fr 1fr;
      gap: 2.25rem;
      align-items: start;
    }

    @media (max-width: 960px) {
      .content-grid {
        grid-template-columns: 1fr;
        gap: 2rem;
      }
    }

    .article-section {
      background-color: var(--nv-surface);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-lg);
      padding: clamp(1.25rem, 3vw, 2rem);
      margin-bottom: 1.75rem;
    }

    .section-heading {
      font-size: clamp(1.15rem, 3vw, 1.35rem);
      font-weight: 800;
      color: #fff;
      margin-bottom: 1.25rem;
      padding-bottom: 0.75rem;
      border-bottom: 1px solid var(--nv-border);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .section-heading-icon {
      color: var(--nv-cyan);
      display: inline-flex;
    }

    .article-section p {
      color: #cbd5e1;
      margin-bottom: 1.25rem;
      font-size: clamp(0.95rem, 2vw, 1.05rem);
      line-height: 1.75;
    }
    .article-section p:last-child {
      margin-bottom: 0;
    }

    /* Spec Sheet Sidebar */
    .spec-card {
      background-color: var(--nv-surface);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-lg);
      padding: clamp(1.25rem, 3vw, 1.75rem);
      position: sticky;
      top: calc(var(--nv-header-height) + 1.5rem);
    }
    @media (max-width: 960px) {
      .spec-card {
        position: static;
        top: auto;
      }
    }

    .spec-card h2 {
      font-size: 1.15rem;
      font-weight: 800;
      color: #fff;
      margin-bottom: 1.25rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid var(--nv-border);
    }

    .spec-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
      table-layout: fixed;
    }
    .spec-table tr {
      border-bottom: 1px solid rgba(30, 30, 44, 0.6);
    }
    .spec-table tr:last-child {
      border-bottom: none;
    }
    .spec-table td {
      padding: 0.75rem 0;
      vertical-align: top;
      word-break: break-word;
    }
    .spec-table td.label {
      color: var(--nv-text-dim);
      width: 42%;
      font-weight: 500;
    }
    .spec-table td.value {
      color: var(--nv-text);
      font-weight: 600;
      text-align: right;
      font-family: var(--nv-font-mono);
      font-size: 0.825rem;
    }

    /* Important Games Grid */
    .games-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 12px;
      margin-top: 1rem;
    }

    .game-card {
      background: var(--nv-surface-raised);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-md);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      text-decoration: none;
      color: var(--nv-text);
      transition: all var(--nv-transition-fast);
    }
    .game-card:hover {
      border-color: var(--nv-border-hover);
      background-color: var(--nv-surface-active);
      text-decoration: none;
    }
    .game-card-title {
      font-weight: 700;
      font-size: 0.9rem;
      color: #fff;
      line-height: 1.3;
    }
    .game-card-meta {
      font-family: var(--nv-font-mono);
      font-size: 0.72rem;
      color: var(--nv-text-dim);
    }
    .game-card-badge {
      display: inline-flex;
      font-family: var(--nv-font-mono);
      font-size: 0.65rem;
      color: var(--nv-cyan);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* Timeline Milestones List */
    .timeline-milestones-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 1rem;
    }

    .milestone-item {
      background: var(--nv-surface-raised);
      border-left: 3px solid var(--nv-gold);
      border-radius: 0 var(--nv-radius-md) var(--nv-radius-md) 0;
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .milestone-year {
      font-family: var(--nv-font-mono);
      font-size: 0.75rem;
      color: var(--nv-gold);
      font-weight: 700;
    }
    .milestone-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: #fff;
    }
    .milestone-desc {
      font-size: 0.85rem;
      color: var(--nv-text-muted);
      line-height: 1.5;
    }
    .milestone-link {
      font-family: var(--nv-font-mono);
      font-size: 0.75rem;
      color: var(--nv-cyan);
      margin-top: 4px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* Related Consoles Grid */
    .related-consoles-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
      margin-top: 1rem;
    }

    .related-console-card {
      background: var(--nv-surface-raised);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-md);
      padding: 14px 16px;
      text-decoration: none;
      color: var(--nv-text);
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: all var(--nv-transition-fast);
    }
    .related-console-card:hover {
      border-color: var(--nv-border-hover);
      background-color: var(--nv-surface-active);
      text-decoration: none;
    }
    .related-console-name {
      font-weight: 700;
      font-size: 0.95rem;
      color: #fff;
    }
    .related-console-meta {
      font-family: var(--nv-font-mono);
      font-size: 0.75rem;
      color: var(--nv-text-muted);
    }

    /* Explore More Strip */
    .explore-more-panel {
      background: var(--nv-surface);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-lg);
      padding: clamp(1.5rem, 3vw, 2rem);
      margin-top: 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .explore-text h3 {
      font-size: 1.15rem;
      font-weight: 800;
      color: #fff;
      margin-bottom: 4px;
    }
    .explore-text p {
      font-size: 0.9rem;
      color: var(--nv-text-muted);
    }
    .explore-links {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn-secondary-link {
      background: var(--nv-surface-raised);
      border: 1px solid var(--nv-border-strong);
      color: var(--nv-text);
      padding: 8px 16px;
      border-radius: var(--nv-radius-md);
      font-size: 0.85rem;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 44px;
      text-decoration: none;
      transition: all var(--nv-transition-fast);
    }
    .btn-secondary-link:hover {
      background: var(--nv-surface-active);
      border-color: var(--nv-cyan);
      color: var(--nv-cyan);
      text-decoration: none;
    }

    /* ==========================================================================
       09. SITE FOOTER
       ========================================================================== */
    .site-footer {
      background-color: #050508;
      border-top: 1px solid var(--nv-border);
      padding: 3rem 24px;
      margin-top: auto;
      font-size: 0.875rem;
      color: var(--nv-text-dim);
    }

    .footer-inner {
      width: 100%;
      max-width: var(--nv-container-max);
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 24px;
    }

    .footer-links {
      display: flex;
      gap: 20px;
      list-style: none;
      flex-wrap: wrap;
    }
    .footer-links a {
      color: var(--nv-text-muted);
      min-height: 44px;
      display: inline-flex;
      align-items: center;
    }
    .footer-links a:hover {
      color: #fff;
    }

    /* Reduced Motion */
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
${BRANDING_CSS}
  </style>
</head>
<body>

  <!-- Skip to Content Link -->
  <a href="#main-content" class="skip-link">Skip to main hardware exhibit content</a>

  <!-- Global Header -->
  <header class="site-header" id="site-header">
    <div class="header-inner">
${HEADER_LOGO_HTML}

      <!-- Desktop Navigation -->
      <nav class="site-nav" aria-label="Primary Exhibition Navigation">
        <a href="/" class="nav-link">Home</a>
        <a href="/games/" class="nav-link">Games</a>
        <a href="/consoles/" class="nav-link active" aria-current="page">Consoles</a>
        <a href="/timeline/" class="nav-link">Timeline</a>
        <a href="/genres/" class="nav-link">Genres</a>
        <a href="/guides/" class="nav-link">Guides</a>
        <a href="/blog/" class="nav-link">Stories</a>
        <a href="/download/" class="nav-link">Emulator</a>
      </nav>

      <!-- Utility Actions -->
      <div class="header-actions">
        <a href="/search/" class="header-action-btn" aria-label="Search the Archive">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </a>

        <a href="/favorites/" class="header-action-btn" aria-label="View Saved Archive Favorites">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
          </svg>
          <span class="fav-badge" id="header-fav-badge" aria-live="polite">0</span>
        </a>

        <!-- Mobile Menu Toggle Button (44px target) -->
        <button type="button" class="menu-toggle" id="menu-toggle-btn" aria-expanded="false" aria-controls="mobile-nav-drawer" aria-label="Open Archive Navigation">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="3" y1="6" x2="21" y2="6"></line>
            <line x1="3" y1="18" x2="21" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
  </header>

  <!-- Accessible Mobile Navigation Drawer -->
  <div class="mobile-drawer-overlay" id="drawer-backdrop" aria-hidden="true"></div>

  <aside class="mobile-drawer" id="mobile-nav-drawer" aria-label="Mobile Navigation" aria-hidden="true" tabindex="-1">
    <div class="drawer-top">
${DRAWER_LOGO_HTML}
      <button type="button" class="drawer-close-btn" id="drawer-close-btn" aria-label="Close Archive Navigation">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    <nav class="drawer-nav" aria-label="Mobile Archive Links">
      <a href="/" class="drawer-link">Home</a>
      <a href="/games/" class="drawer-link">Games Archive</a>
      <a href="/consoles/" class="drawer-link active">Console Archive</a>
      <a href="/timeline/" class="drawer-link">Timeline</a>
      <a href="/genres/" class="drawer-link">Genres</a>
      <a href="/guides/" class="drawer-link">Guides</a>
      <a href="/blog/" class="drawer-link">Stories</a>
      <a href="/download/" class="drawer-link">Emulator</a>
      <div class="drawer-divider"></div>
      <a href="/search/" class="drawer-link">Universal Search</a>
      <a href="/favorites/" class="drawer-link">Curated Favorites</a>
      <a href="/random/" class="drawer-link">Discovery Engine</a>
      <a href="/about/" class="drawer-link">About Archive</a>
      <a href="/support/" class="drawer-link">Support</a>
    </nav>
  </aside>

  <!-- Navigation Bar: Breadcrumbs & Backlink -->
  <div class="nav-breadcrumb-bar">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <a href="/">Home</a>
      <span class="sep">/</span>
      <a href="/consoles/">Console Archive</a>
      <span class="sep">/</span>
      <span aria-current="page">${name}</span>
    </nav>
    <a href="/consoles/" class="back-archive-link" aria-label="Return to Console Archive">&larr; Return to Console Archive</a>
  </div>

  <!-- Main Exhibit -->
  <main class="exhibit-container" id="main-content">
    
    <!-- Hero Header -->
    <header class="hero-panel">
      <div class="hero-badge-row">
        <span class="badge badge-cyan">${manufacturer}</span>
        <span class="badge badge-gold">${generation}</span>
        <span class="badge badge-era">${era}</span>
      </div>
      <h1 class="hero-title">${name}</h1>
      <p class="hero-subtitle">${significance}</p>
      <div class="hero-actions">
        <button class="btn-fav" id="btn-favorite" data-id="${escapeHtml(consoleData.id)}" data-title="${escapeHtml(rawName)}" data-type="console" aria-label="Save ${name} to favorites">
          <span class="fav-icon">&#9734;</span>
          <span class="fav-label">Save Exhibit</span>
        </button>
      </div>
    </header>

    <!-- Key Facts Strip -->
    <div class="key-facts-strip">
      <div class="fact-card">
        <span class="fact-label">Manufacturer</span>
        <span class="fact-value highlight">${manufacturer}</span>
      </div>
      <div class="fact-card">
        <span class="fact-label">Debut Year</span>
        <span class="fact-value">${year}</span>
      </div>
      <div class="fact-card">
        <span class="fact-label">Architecture / Era</span>
        <span class="fact-value">${generation}</span>
      </div>
      <div class="fact-card">
        <span class="fact-label">Media Category</span>
        <span class="fact-value">${mediaCategory}</span>
      </div>
      <div class="fact-card">
        <span class="fact-label">Primary Region</span>
        <span class="fact-value">${region}</span>
      </div>
      <div class="fact-card">
        <span class="fact-label">Debut Price</span>
        <span class="fact-value">${price}</span>
      </div>
    </div>

    <!-- Artifact Visual / Museum Accession Plate -->
    <section class="artifact-visual-wrap" aria-label="Archival hardware artifact visual">
      ${heroImgUrl ? `
      <div class="artifact-image-container">
        <img src="${heroImgUrl}" alt="Historical archival photograph of ${name} console hardware" class="artifact-image" width="1600" height="900" loading="eager" onerror="this.parentElement.style.display='none'; document.getElementById('museum-plate-${slug}').style.display='block';">
      </div>
      <div id="museum-plate-${slug}" class="museum-artifact-plate" style="display: none;">
        <div class="plate-vector-box">
          <svg viewBox="0 0 120 80" fill="none" stroke-width="1.5">
            <rect x="15" y="20" width="90" height="45" rx="4" stroke="currentColor"/>
            <circle cx="60" cy="42" r="14" stroke="currentColor"/>
            <line x1="25" y1="35" x2="35" y2="35" stroke="currentColor"/>
            <line x1="85" y1="35" x2="95" y2="35" stroke="currentColor"/>
          </svg>
        </div>
        <div class="plate-accession">ACCESSION № NV-HW-${year}-${escapeHtml(slug.toUpperCase())}</div>
        <div class="plate-title">${name}</div>
        <div class="plate-meta">${year} · ${manufacturer} · ${generation}</div>
        <div class="plate-status"><span class="status-dot"></span> Physical hardware specimen accessioned · High-resolution studio photography cataloging in progress</div>
      </div>
      ` : `
      <div id="museum-plate-${slug}" class="museum-artifact-plate">
        <div class="plate-vector-box">
          <svg viewBox="0 0 120 80" fill="none" stroke-width="1.5">
            <rect x="15" y="20" width="90" height="45" rx="4" stroke="currentColor"/>
            <circle cx="60" cy="42" r="14" stroke="currentColor"/>
            <line x1="25" y1="35" x2="35" y2="35" stroke="currentColor"/>
            <line x1="85" y1="35" x2="95" y2="35" stroke="currentColor"/>
          </svg>
        </div>
        <div class="plate-accession">ACCESSION № NV-HW-${year}-${escapeHtml(slug.toUpperCase())}</div>
        <div class="plate-title">${name}</div>
        <div class="plate-meta">${year} · ${manufacturer} · ${generation}</div>
        <div class="plate-status"><span class="status-dot"></span> Physical hardware specimen accessioned · High-resolution studio photography cataloging in progress</div>
      </div>
      `}
    </section>

    <!-- Content Columns -->
    <div class="content-grid">
      
      <!-- Primary Curatorial Column -->
      <article class="curatorial-body">
        
        <section class="article-section" id="overview">
          <h2 class="section-heading">
            <span class="section-heading-icon">&#9670;</span>
            Curatorial Overview & Historical Significance
          </h2>
          <p>${overview}</p>
          <p>${significance}</p>
        </section>

        <section class="article-section" id="architecture">
          <h2 class="section-heading">
            <span class="section-heading-icon">&#9670;</span>
            Architectural Engineering & Hardware Topology
          </h2>
          <p>${engineeringInnovations || `The ${name} represents a milestone implementation in ${generation.toLowerCase()} hardware architecture. Engineered around the ${cpu}, the system integrated ${gpu} with ${ram}, establishing specialized pipelines for real-time video generation and audio processing.`}</p>
          <p>The hardware architecture reflected the economic and manufacturing realities of ${year}, balancing component yield rates, consumer television signal compliance, and bus throughput to maximize gameplay fidelity within strict thermal and acoustic limits.</p>
        </section>

        <section class="article-section" id="controller">
          <h2 class="section-heading">
            <span class="section-heading-icon">&#9670;</span>
            Human Interface & Controller Architecture
          </h2>
          <p>${controllerDesign ? `The primary human interface for the platform featured ${controllerDesign}.` : `The console utilized ${controller}, delivering precise tactile feedback tailored to the gaming mechanics of its era.`}</p>
          <p>The controller ergonomics were designed to bridge the transition from mechanical arcade controls to intuitive home entertainment, directly shaping genre design across its lifecycle.</p>
        </section>

        <section class="article-section" id="legacy">
          <h2 class="section-heading">
            <span class="section-heading-icon">&#9670;</span>
            Market Impact & Preservation Context
          </h2>
          <p>${marketLegacy}</p>
          <p>${preservationNotes || `From a digital preservation standpoint, hardware units of the ${name} require attentive archival care. Common physical aging factors include electrolytic capacitor dry-out, power supply regulation drift, optical laser diode degradation, and composite video signal attenuation. Museum archives prioritize non-destructive recapping and digital signal tapping for long-term conservation.`}</p>
        </section>

        ${keyGames && keyGames.length > 0 ? `
        <section class="article-section" id="games">
          <h2 class="section-heading">
            <span class="section-heading-icon">&#9670;</span>
            Defining Software Milestones
          </h2>
          <p>The historical legacy of the ${name} is inextricably linked to its landmark software catalogue:</p>
          <div class="games-grid">
            ${keyGames.map(g => {
              const gameSlug = typeof g === 'string' ? g : g.slug;
              const gameTitle = typeof g === 'string' ? g.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : g.title;
              const hasExhibit = existingGameSlugs.has(gameSlug);
              if (hasExhibit) {
                return `<a href="/games/${escapeHtml(gameSlug)}/" class="game-card" aria-label="View ${escapeHtml(gameTitle)} landmark game exhibit">
                  <span class="game-card-badge">Landmark Exhibit</span>
                  <span class="game-card-title">${escapeHtml(gameTitle)}</span>
                  <span class="game-card-meta">Interactive Museum Record &rarr;</span>
                </a>`;
              } else {
                return `<a href="/search/?q=${encodeURIComponent(gameSlug.replace(/-/g, ' '))}" class="game-card" aria-label="Search ${escapeHtml(gameTitle)} in archive">
                  <span class="game-card-badge">Catalog Title</span>
                  <span class="game-card-title">${escapeHtml(gameTitle)}</span>
                  <span class="game-card-meta">Archive Search &rarr;</span>
                </a>`;
              }
            }).join('\n            ')}
          </div>
        </section>
        ` : ''}

        ${consoleTimelineEvents && consoleTimelineEvents.length > 0 ? `
        <section class="article-section" id="timeline">
          <h2 class="section-heading">
            <span class="section-heading-icon">&#9670;</span>
            Chronological Timeline Milestones
          </h2>
          <p>Verified historical events linked to the ${name} in the NostalgicVerse permanent chronicle:</p>
          <div class="timeline-milestones-list">
            ${consoleTimelineEvents.map(e => `
            <div class="milestone-item">
              <span class="milestone-year">${e.year} · ${escapeHtml(e.category || 'MILESTONE')}</span>
              <span class="milestone-title">${escapeHtml(e.title)}</span>
              <p class="milestone-desc">${escapeHtml(e.significance || e.description)}</p>
              <a href="/timeline/#${escapeHtml(e.id)}" class="milestone-link">Examine Timeline Record &rarr;</a>
            </div>
            `).join('')}
          </div>
        </section>
        ` : ''}

        ${curatedRelatedConsoles && curatedRelatedConsoles.length > 0 ? `
        <section class="article-section" id="related">
          <h2 class="section-heading">
            <span class="section-heading-icon">&#9670;</span>
            Related Hardware Platforms
          </h2>
          <p>Contemporary and architectural sister systems within the museum hardware collection:</p>
          <div class="related-consoles-grid">
            ${curatedRelatedConsoles.map(c => `
            <a href="/consoles/${escapeHtml(c.slug)}/" class="related-console-card">
              <span class="related-console-name">${escapeHtml(c.name)}</span>
              <span class="related-console-meta">${c.originalReleaseYear} · ${escapeHtml(c.manufacturer)}</span>
            </a>
            `).join('')}
          </div>
        </section>
        ` : ''}

      </article>

      <!-- Sidebar Specs Column -->
      <aside class="sidebar-column">
        <div class="spec-card">
          <h2>Verified Hardware Specs</h2>
          <table class="spec-table">
            <tbody>
              <tr><td class="label">Manufacturer</td><td class="value">${manufacturer}</td></tr>
              <tr><td class="label">Generation</td><td class="value">${generation}</td></tr>
              <tr><td class="label">Release Year</td><td class="value">${year}</td></tr>
              <tr><td class="label">Debut Date</td><td class="value">${exactDate}</td></tr>
              <tr><td class="label">Primary Region</td><td class="value">${region}</td></tr>
              <tr><td class="label">Launch Price</td><td class="value">${price}</td></tr>
              <tr><td class="label">Media Format</td><td class="value">${mediaFormat}</td></tr>
              <tr><td class="label">Processor (CPU)</td><td class="value">${cpu}</td></tr>
              <tr><td class="label">Graphics (GPU)</td><td class="value">${gpu}</td></tr>
              <tr><td class="label">Memory (RAM)</td><td class="value">${ram}</td></tr>
              <tr><td class="label">Storage</td><td class="value">${storage}</td></tr>
              <tr><td class="label">Audio Chip</td><td class="value">${soundChip}</td></tr>
              <tr><td class="label">Video Output</td><td class="value">${avOutputs}</td></tr>
              <tr><td class="label">Power Supply</td><td class="value">${powerSupply}</td></tr>
              ${onlineService ? `<tr><td class="label">Online Service</td><td class="value">${onlineService}</td></tr>` : ''}
              ${predecessor ? `<tr><td class="label">Predecessor</td><td class="value">${predecessor}</td></tr>` : ''}
              ${successor ? `<tr><td class="label">Successor</td><td class="value">${successor}</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </aside>

    </div>

    <!-- Explore More Navigation Strip -->
    <div class="explore-more-panel">
      <div class="explore-text">
        <h3>Continue Exploring the Archive</h3>
        <p>Cross-reference hardware generations with landmark software titles and chronological milestones.</p>
      </div>
      <div class="explore-links">
        <a href="/consoles/" class="btn-secondary-link">All Consoles</a>
        <a href="/games/" class="btn-secondary-link">Landmark Games</a>
        <a href="/timeline/" class="btn-secondary-link">Historical Timeline</a>
        <a href="/guides/" class="btn-secondary-link">Preservation Guides</a>
      </div>
    </div>

      <!-- Community Section (Comments, Reviews, Reactions) -->
      <div id="community-section" class="community-section" data-type="console" data-id="${consoleData.id || 'console-' + consoleData.slug}"></div>

  </main>
${SUPPORT_SECTION_HTML}
  <!-- Site Footer -->
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-col">
        <div class="brand-group" style="margin-bottom: 12px;">
          <a href="/" class="brand-logo-wrap" aria-label="NostalgicVerse Homepage">
            <img src="/assets/images/branding/logo/logo.svg" alt="NostalgicVerse" class="site-logo-img footer-logo-img" width="200" height="40" loading="lazy">
          </a>
        </div>
        <p><strong>NostalgicVerse</strong> — The Games That Made History.</p>
        <p>A non-profit digital gaming museum, historical archive, and hardware preservation project.</p>
      </div>
      <ul class="footer-links">
        <li><a href="/about/">About Archive</a></li>
        <li><a href="/support/">Support</a></li>
        <li><a href="/legal/privacy.html">Privacy Policy</a></li>
        <li><a href="/legal/terms.html">Terms of Service</a></li>
        <li><a href="/legal/cookies.html">Cookie Policy</a></li>
        <li><a href="/legal/disclaimer.html">Preservation Disclaimer</a></li>
      </ul>
    </div>
  </footer>

  <!-- Vanilla Client Interactions -->
  <script>
    (function() {
      'use strict';
      const STORAGE_KEY = 'nostalgicverse_favs';

      /* --------------------------------------------------------------------------
         01. FAVORITES SYSTEM (nostalgicverse_favs)
         -------------------------------------------------------------------------- */
      const favBtn = document.getElementById('btn-favorite');
      const badge = document.getElementById('header-fav-badge');

      function getFavorites() {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch(e) {
          return [];
        }
      }

      function updateBadge() {
        if (!badge) return;
        const favs = getFavorites();
        badge.textContent = String(favs.length);
      }

      if (favBtn) {
        const itemId = favBtn.getAttribute('data-id');
        const itemTitle = favBtn.getAttribute('data-title');
        const itemType = favBtn.getAttribute('data-type') || 'console';
        const itemUrl = window.location.pathname;

        function checkFavoriteState() {
          const favs = getFavorites();
          const isSaved = favs.some(item => item.id === itemId);
          if (isSaved) {
            favBtn.classList.add('active');
            favBtn.setAttribute('aria-pressed', 'true');
            favBtn.querySelector('.fav-icon').innerHTML = '&#9733;';
            favBtn.querySelector('.fav-label').textContent = 'Saved in Favorites';
          } else {
            favBtn.classList.remove('active');
            favBtn.setAttribute('aria-pressed', 'false');
            favBtn.querySelector('.fav-icon').innerHTML = '&#9734;';
            favBtn.querySelector('.fav-label').textContent = 'Save Exhibit';
          }
        }

        favBtn.addEventListener('click', function() {
          let favs = getFavorites();
          const index = favs.findIndex(item => item.id === itemId);

          if (index >= 0) {
            favs.splice(index, 1);
          } else {
            favs.push({
              id: itemId,
              title: itemTitle,
              type: itemType,
              url: itemUrl,
              savedAt: new Date().toISOString()
            });
          }

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
          } catch(e) {
            console.error('NostalgicVerse storage error:', e);
          }

          checkFavoriteState();
          updateBadge();
        });

        checkFavoriteState();
      }

      updateBadge();

      window.addEventListener('storage', function(e) {
        if (e.key === STORAGE_KEY) {
          updateBadge();
          if (favBtn) {
            const itemId = favBtn.getAttribute('data-id');
            const favs = getFavorites();
            const isSaved = favs.some(item => item.id === itemId);
            if (isSaved) {
              favBtn.classList.add('active');
              favBtn.setAttribute('aria-pressed', 'true');
              favBtn.querySelector('.fav-icon').innerHTML = '&#9733;';
              favBtn.querySelector('.fav-label').textContent = 'Saved in Favorites';
            } else {
              favBtn.classList.remove('active');
              favBtn.setAttribute('aria-pressed', 'false');
              favBtn.querySelector('.fav-icon').innerHTML = '&#9734;';
              favBtn.querySelector('.fav-label').textContent = 'Save Exhibit';
            }
          }
        }
      });

      /* --------------------------------------------------------------------------
         02. ACCESSIBLE MOBILE NAVIGATION DRAWER
         -------------------------------------------------------------------------- */
      const menuBtn = document.getElementById('menu-toggle-btn');
      const closeBtn = document.getElementById('drawer-close-btn');
      const drawer = document.getElementById('mobile-nav-drawer');
      const backdrop = document.getElementById('drawer-backdrop');

      function openDrawer() {
        if (!drawer || !backdrop) return;
        document.body.classList.add('menu-open');
        drawer.classList.add('is-open');
        backdrop.classList.add('is-open');
        menuBtn.setAttribute('aria-expanded', 'true');
        drawer.setAttribute('aria-hidden', 'false');
        drawer.focus();
      }

      function closeDrawer() {
        if (!drawer || !backdrop) return;
        document.body.classList.remove('menu-open');
        drawer.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        menuBtn.setAttribute('aria-expanded', 'false');
        drawer.setAttribute('aria-hidden', 'true');
        menuBtn.focus();
      }

      if (menuBtn) menuBtn.addEventListener('click', openDrawer);
      if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
      if (backdrop) backdrop.addEventListener('click', closeDrawer);

      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) {
          closeDrawer();
        }
      });
    })();
    </script>
    <script src="/assets/js/community-ui.js"></script>
  ${SUPPORT_MODAL_HTML}
</body>
</html>`;
}

/**
 * Main Execution Function
 */
async function main() {
  const { dbAsync } = require('../../server/db/index.cjs');
  let consoles = [];
  try {
    const rows = await dbAsync.all("SELECT * FROM consoles WHERE status = 'PUBLISHED'");
    consoles = rows.map(r => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      manufacturer: r.manufacturer,
      description: r.description,
      significance: r.description, // fallback
      originalReleaseYear: r.release_year,
      generation: r.generation,
      featured: r.featured === 1,
      localImage: r.local_image,
      remoteImage: r.remote_image
    }));
  } catch (e) {
    console.error('Database error:', e);
    process.exit(1);
  }

  console.log(`Discovered ${consoles.length} canonical console records in database.`);

  if (options.slug) {
    consoles = consoles.filter(c => c.slug === options.slug);
    if (consoles.length === 0) {
      console.error(`Error: Console record not found for slug: ${options.slug}`);
      process.exit(1);
    }
  } else if (options.batch) {
    consoles = consoles.slice(0, options.batch);
  }

  console.log(`Processing ${consoles.length} console exhibit page(s)...`);

  let generatedCount = 0;
  let failedCount = 0;
  const generatedFiles = [];

  consoles.forEach(data => {
    try {
      const slug = data.slug;

      if (!slug) {
        console.error(`  [FAIL] Missing slug for console ${data.name}`);
        failedCount++;
        return;
      }

      const html = renderConsoleHtml(data);
      const targetDir = path.join(ROOT, 'consoles', slug);
      const targetFile = path.join(targetDir, 'index.html');

      if (!options.dryRun) {
        ensureDir(targetDir);
        fs.writeFileSync(targetFile, html, 'utf8');
      }

      generatedCount++;
      generatedFiles.push(targetFile);
      console.log(`  [OK] ${options.dryRun ? '[DRY-RUN] ' : ''}Generated: consoles/${slug}/index.html (${html.length} bytes)`);
    } catch (err) {
      failedCount++;
      console.error(`  [ERROR] Generating ${data.slug}:`, err.message);
    }
  });

  console.log('\n==================================================');
  console.log('CONSOLE EXHIBIT GENERATION SUMMARY');
  console.log('==================================================');
  console.log(`Total Records Processed: ${consoles.length}`);
  console.log(`Successfully Generated:  ${generatedCount}`);
  console.log(`Failed Generations:      ${failedCount}`);
  console.log(`Mode:                    ${options.dryRun ? 'DRY RUN' : 'PRODUCTION WRITE'}`);
  console.log('==================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  renderConsoleHtml
};

