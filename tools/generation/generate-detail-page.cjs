/**
 * NostalgicVerse Static Detail Page Generator
 * 
 * Mobile-First Responsive Architecture + Museum Curation
 * 
 * Supports CLI flags:
 *   --collection <games|consoles|guides|stories> (default: games)
 *   --slug <slug>
 *   --list <slug1,slug2,...>
 *   --batch <number>
 *   --all
 *   --dry-run
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');
const { BRANDING_CSS, HEADER_LOGO_HTML, DRAWER_LOGO_HTML, FOOTER_LOGO_HTML, SUPPORT_SECTION_HTML, SUPPORT_MODAL_HTML } = require('./support-brand-snippets.cjs');

const REMOTE_MANIFEST_PATH = path.join(ROOT, 'data', 'remote-game-images.json');
let remoteImagesManifest = {};
if (fs.existsSync(REMOTE_MANIFEST_PATH)) {
  try {
    remoteImagesManifest = JSON.parse(fs.readFileSync(REMOTE_MANIFEST_PATH, 'utf8')).games || {};
  } catch (e) {}
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  collection: 'games',
  slug: null,
  list: null,
  batch: null,
  all: false,
  dryRun: false
};

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--collection' && args[i + 1]) {
    options.collection = args[++i];
  } else if (arg === '--slug' && args[i + 1]) {
    options.slug = args[++i];
  } else if (arg === '--list' && args[i + 1]) {
    options.list = args[++i].split(',').map(s => s.trim());
  } else if (arg === '--batch' && args[i + 1]) {
    options.batch = parseInt(args[++i], 10);
  } else if (arg === '--all') {
    options.all = true;
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
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

function loadGameData(slug) {
  const individualPath = path.join(ROOT, 'data', 'games', `${slug}.json`);
  if (fs.existsSync(individualPath)) {
    return JSON.parse(fs.readFileSync(individualPath, 'utf8'));
  }
  return null;
}

function renderGameHtml(game) {
  const title = escapeHtml(game.title || 'Landmark Game');
  const rawTitle = game.title || 'Landmark Game';
  const slug = game.slug;
  const canonicalUrl = `https://nostalgicverse.com/games/${slug}/`;
  const year = game.originalReleaseYear || '';
  const dev = escapeHtml(game.developer || '');
  const pub = escapeHtml(game.publisher || '');
  const platform = escapeHtml(game.originalLaunchPlatform || '');
  const genre = escapeHtml(game.genre || '');
  const era = escapeHtml(game.era || '');
  const summary = escapeHtml(game.shortDescription || game.historicalSignificance || '');
  const rawSummary = game.shortDescription || game.historicalSignificance || '';
  const editorial = game.editorialContent || {};
  const factual = game.verifiedFactualData || {};

  // Image resolution hierarchy: LOCAL -> REMOTE VERIFIED -> MUSEUM ACCESSION FALLBACK PLATE
  const localWebp = `/assets/images/games/${slug}.webp`;
  const localPng = `/assets/images/games/${slug}.png`;
  const legacyLocalPng = `/assets/images/games/${slug.replace(/-/g, '')}.png`;

  let heroImgUrl = null;
  if (fs.existsSync(path.join(ROOT, localWebp))) {
    heroImgUrl = localWebp;
  } else if (fs.existsSync(path.join(ROOT, localPng))) {
    heroImgUrl = localPng;
  } else if (fs.existsSync(path.join(ROOT, legacyLocalPng))) {
    heroImgUrl = `/assets/images/games/${path.basename(legacyLocalPng)}`;
  } else if (remoteImagesManifest[slug] && remoteImagesManifest[slug].status === 'verified' && remoteImagesManifest[slug].imageUrl) {
    heroImgUrl = remoteImagesManifest[slug].imageUrl;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BreadcrumbList",
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
            "name": "Landmark Games Archive",
            "item": "https://nostalgicverse.com/games/"
          },
          {
            "@type": "ListItem",
            "position": 3,
            "name": rawTitle,
            "item": canonicalUrl
          }
        ]
      },
      {
        "@type": "VideoGame",
        "name": rawTitle,
        "url": canonicalUrl,
        "description": rawSummary,
        "datePublished": game.exactReleaseDate || `${year}-01-01`,
        "genre": [game.genre, ...(game.subgenres || [])].filter(Boolean),
        "gamePlatform": game.platforms || [game.originalLaunchPlatform],
        "author": {
          "@type": "Organization",
          "name": game.developer || "Unknown Developer"
        },
        "publisher": {
          "@type": "Organization",
          "name": game.publisher || "Unknown Publisher"
        }
      }
    ]
  };

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  
  <title>${title} (${year}) — Landmark Games Archive — NostalgicVerse</title>
  <meta name="description" content="${summary}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <meta name="theme-color" content="#08080C">
  
  <!-- Open Graph / Social -->
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="NostalgicVerse">
  <meta property="og:title" content="${title} (${year}) — Landmark Video Game Exhibit">
  <meta property="og:description" content="${summary}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="https://nostalgicverse.com/assets/images/branding/logo/logo.png">

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title} (${year}) — NostalgicVerse">
  <meta name="twitter:description" content="${summary}">
  <meta name="twitter:image" content="https://nostalgicverse.com/assets/images/branding/logo/logo.png">
  
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
      color: var(--nv-gold);
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
      background-color: var(--nv-gold);
      color: #000;
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
      color: var(--nv-gold);
      text-decoration: none;
    }

    /* ==========================================================================
       05. EXHIBIT MAIN CONTAINER & HERO
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
      background: radial-gradient(circle at top right, rgba(255, 179, 0, 0.12), transparent 70%);
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
    .badge-gold {
      background: rgba(255, 179, 0, 0.12);
      color: var(--nv-gold);
      border: 1px solid rgba(255, 179, 0, 0.28);
    }
    .badge-cyan {
      background: rgba(0, 229, 255, 0.12);
      color: var(--nv-cyan);
      border: 1px solid rgba(0, 229, 255, 0.28);
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
      border-color: var(--nv-gold);
      color: #fff;
    }
    .btn-fav.active {
      background: rgba(255, 179, 0, 0.15);
      border-color: var(--nv-gold);
      color: var(--nv-gold);
    }

    /* ==========================================================================
       06. MUSEUM ARTIFACT VISUAL & FALLBACK PLATE
       ========================================================================== */
    .artifact-visual-wrap {
      margin-bottom: 2.25rem;
      border-radius: var(--nv-radius-lg);
      overflow: hidden;
      border: 1px solid var(--nv-border);
      background: radial-gradient(circle at center, #111119 0%, #06060a 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 280px;
      max-height: 520px;
      padding: 16px;
    }

    .artifact-image {
      max-width: 100%;
      max-height: 488px;
      width: auto;
      height: auto;
      display: block;
      margin: 0 auto;
      object-fit: contain;
      border-radius: var(--nv-radius-sm);
      box-shadow: 0 4px 24px rgba(0, 0, 0, 0.55);
      transition: transform var(--nv-transition-normal);
    }

    @media (max-width: 640px) {
      .artifact-visual-wrap {
        min-height: 200px;
        max-height: 380px;
        padding: 10px;
      }
      .artifact-image {
        max-height: 360px;
      }
    }

    .museum-artifact-plate {
      background: linear-gradient(135deg, #0c0c12 0%, #15151f 100%);
      padding: clamp(2rem, 5vw, 3.5rem) clamp(1rem, 4vw, 2rem);
      text-align: center;
      position: relative;
      border-radius: var(--nv-radius-lg);
    }

    .plate-accession {
      font-family: var(--nv-font-mono);
      font-size: 0.75rem;
      color: var(--nv-gold);
      letter-spacing: 0.1em;
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
      display: inline-block;
      font-size: 0.75rem;
      color: var(--nv-text-dim);
      border-top: 1px solid var(--nv-border);
      padding-top: 0.75rem;
      max-width: 480px;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      line-height: 1.5;
    }

    /* ==========================================================================
       07. MOBILE-FIRST EDITORIAL CONTENT & SIDEBAR SPECS
       ========================================================================== */
    .content-grid {
      display: grid;
      grid-template-columns: 2.2fr 1fr;
      gap: 2.25rem;
      align-items: start;
    }

    /* Mobile Single-Column Order: Content first, then Specs below */
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
      width: 44%;
      font-weight: 500;
    }
    .spec-table td.value {
      color: var(--nv-text);
      font-weight: 600;
      text-align: right;
      font-family: var(--nv-font-mono);
      font-size: 0.825rem;
    }

    /* Citations */
    .citation-list {
      list-style: square;
      padding-left: 1.25rem;
      color: var(--nv-text-muted);
      font-size: 0.875rem;
      line-height: 1.6;
    }
    .citation-list li {
      margin-bottom: 0.5rem;
    }

    /* ==========================================================================
       08. SITE FOOTER
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
  <a href="#main-content" class="skip-link">Skip to main exhibit content</a>

  <!-- Global Header -->
  <header class="site-header" id="site-header">
    <div class="header-inner">
${HEADER_LOGO_HTML}

      <!-- Desktop Navigation -->
      <nav class="site-nav" aria-label="Primary Exhibition Navigation">
        <a href="/" class="nav-link">Home</a>
        <a href="/games/" class="nav-link active" aria-current="page">Games</a>
        <a href="/consoles/" class="nav-link">Consoles</a>
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
      <a href="/games/" class="drawer-link active">Games Archive</a>
      <a href="/consoles/" class="drawer-link">Consoles</a>
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
      <a href="/games/">Games Archive</a>
      <span class="sep">/</span>
      <span aria-current="page">${title}</span>
    </nav>
    <a href="/games/" class="back-archive-link" aria-label="Return to Landmark Games Archive">&larr; Return to Games Archive</a>
  </div>

  <!-- Main Exhibit -->
  <main class="exhibit-container" id="main-content">
    
    <!-- Hero Header -->
    <header class="hero-panel">
      <div class="hero-badge-row">
        <span class="badge badge-gold">${genre}</span>
        <span class="badge badge-cyan">${platform}</span>
        <span class="badge badge-era">${era}</span>
      </div>
      <h1 class="hero-title">${title}</h1>
      <p class="hero-subtitle">${summary}</p>
      <div class="hero-actions">
        <button class="btn-fav" id="btn-favorite" data-id="${escapeHtml(game.id)}" data-title="${escapeHtml(rawTitle)}" data-genre="${escapeHtml(game.genre)}" aria-label="Save ${title} to favorites">
          <span class="fav-icon">&#9734;</span>
          <span class="fav-label">Save Exhibit</span>
        </button>
      </div>
    </header>

    <!-- Artifact Visual / Museum Accession Plate -->
    <section class="artifact-visual-wrap" aria-label="Archival artifact plate">
      ${heroImgUrl ? `
      <img src="${heroImgUrl}" alt="${title} game artwork" class="artifact-image" width="1200" height="480" loading="lazy" decoding="async" onerror="this.style.display='none'; document.getElementById('museum-plate-${slug}').style.display='block';">
      <img src="${heroImgUrl}" alt="${title} game artwork" class="artifact-image" width="1200" height="480" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.style.display='none'; document.getElementById('museum-plate-${slug}').style.display='block';">
      <div id="museum-plate-${slug}" class="museum-artifact-plate" style="display: none;">
        <div class="plate-accession">ACCESSION № NV-GM-${year}-${escapeHtml(slug.toUpperCase())}</div>
        <div class="plate-title">${title}</div>
        <div class="plate-meta">${year} · ${dev} · ${platform}</div>
        <div class="plate-status">Physical artifact preserved in archive vault · High-resolution digitization pending</div>
      </div>
      ` : `
      <div class="museum-artifact-plate">
        <div class="plate-accession">ACCESSION № NV-GM-${year}-${escapeHtml(slug.toUpperCase())}</div>
        <div class="plate-title">${title}</div>
        <div class="plate-meta">${year} · ${dev} · ${platform}</div>
        <div class="plate-status">Physical artifact preserved in archive vault · High-resolution digitization pending</div>
      </div>
      `}
    </section>

    <!-- Content Columns -->
    <div class="content-grid">
      
      <!-- Primary Curatorial Essays -->
      <article class="curatorial-body">
        
        <section class="article-section" id="overview">
          <h2 class="section-heading">Curatorial Overview</h2>
          <p>${escapeHtml(editorial.overview || rawSummary)}</p>
        </section>

        ${editorial.gameplayMechanics ? `
        <section class="article-section" id="mechanics">
          <h2 class="section-heading">Mechanical Systems & Architecture</h2>
          <p>${escapeHtml(editorial.gameplayMechanics)}</p>
        </section>
        ` : ''}

        ${editorial.technicalInnovation ? `
        <section class="article-section" id="technical">
          <h2 class="section-heading">Hardware Engineering & Codebase Innovation</h2>
          <p>${escapeHtml(editorial.technicalInnovation)}</p>
        </section>
        ` : ''}

        ${editorial.culturalImpact ? `
        <section class="article-section" id="impact">
          <h2 class="section-heading">Cultural Legacy & Historic Reception</h2>
          <p>${escapeHtml(editorial.culturalImpact)}</p>
        </section>
        ` : ''}

        ${editorial.preservationNotes ? `
        <section class="article-section" id="preservation">
          <h2 class="section-heading">Preservation Notes & Hardware Replication</h2>
          <p>${escapeHtml(editorial.preservationNotes)}</p>
        </section>
        ` : ''}

        ${factual.sourceReferences && factual.sourceReferences.length > 0 ? `
        <section class="article-section" id="sources">
          <h2 class="section-heading">Archival Citations & Sources</h2>
          <ul class="citation-list">
            ${factual.sourceReferences.map(s => `<li>${escapeHtml(s)}</li>`).join('\n            ')}
          </ul>
        </section>
        ` : ''}

      </article>

      <!-- Sidebar Specs -->
      <aside class="sidebar-column">
        <div class="spec-card">
          <h2>Verified Archival Data</h2>
          <table class="spec-table">
            <tbody>
              <tr><td class="label">Release Year</td><td class="value">${escapeHtml(year)}</td></tr>
              ${game.exactReleaseDate ? `<tr><td class="label">Release Date</td><td class="value">${escapeHtml(game.exactReleaseDate)}</td></tr>` : ''}
              <tr><td class="label">Developer</td><td class="value">${dev}</td></tr>
              <tr><td class="label">Publisher</td><td class="value">${pub}</td></tr>
              ${game.director ? `<tr><td class="label">Director</td><td class="value">${escapeHtml(game.director)}</td></tr>` : ''}
              ${game.designer ? `<tr><td class="label">Designer</td><td class="value">${escapeHtml(game.designer)}</td></tr>` : ''}
              ${game.composer ? `<tr><td class="label">Composer</td><td class="value">${escapeHtml(game.composer)}</td></tr>` : ''}
              <tr><td class="label">Launch Platform</td><td class="value">${platform}</td></tr>
              ${factual.romMediaFormat ? `<tr><td class="label">Media Format</td><td class="value">${escapeHtml(factual.romMediaFormat)}</td></tr>` : ''}
              ${factual.romSizeOriginal ? `<tr><td class="label">Original ROM</td><td class="value">${escapeHtml(factual.romSizeOriginal)}</td></tr>` : ''}
              ${factual.displayResolutionOriginal ? `<tr><td class="label">Resolution</td><td class="value">${escapeHtml(factual.displayResolutionOriginal)}</td></tr>` : ''}
              ${factual.audioHardware ? `<tr><td class="label">Sound Chip</td><td class="value">${escapeHtml(factual.audioHardware)}</td></tr>` : ''}
              ${factual.inputMethod ? `<tr><td class="label">Control Interface</td><td class="value">${escapeHtml(factual.inputMethod)}</td></tr>` : ''}
              ${factual.multiplayerCapability ? `<tr><td class="label">Multiplayer</td><td class="value">${escapeHtml(factual.multiplayerCapability)}</td></tr>` : ''}
            </tbody>
          </table>
        </div>
      </aside>

    </div>

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
        <p>A non-profit digital gaming museum, historical archive, and software preservation project.</p>
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
        const itemGenre = favBtn.getAttribute('data-genre');
        const itemUrl = window.location.pathname;

        function isFavorited(favs) {
          return favs.some(function(f) {
            return typeof f === 'string' ? f === itemId : f && f.id === itemId;
          });
        }

        function updateBtnState() {
          const favs = getFavorites();
          const saved = isFavorited(favs);
          if (saved) {
            favBtn.classList.add('active');
            favBtn.querySelector('.fav-icon').innerHTML = '&#9733;';
            favBtn.querySelector('.fav-label').textContent = 'Saved in Favorites';
            favBtn.setAttribute('aria-pressed', 'true');
          } else {
            favBtn.classList.remove('active');
            favBtn.querySelector('.fav-icon').innerHTML = '&#9734;';
            favBtn.querySelector('.fav-label').textContent = 'Save Exhibit';
            favBtn.setAttribute('aria-pressed', 'false');
          }
          updateBadge();
        }

        favBtn.addEventListener('click', function() {
          let favs = getFavorites();
          const saved = isFavorited(favs);
          if (saved) {
            favs = favs.filter(function(f) {
              return typeof f === 'string' ? f !== itemId : f && f.id !== itemId;
            });
          } else {
            favs.push({
              id: itemId,
              title: itemTitle,
              url: itemUrl,
              type: 'game',
              category: itemGenre,
              savedAt: new Date().toISOString()
            });
          }
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
          } catch(e) {}
          updateBtnState();
        });

        updateBtnState();
      } else {
        updateBadge();
      }

      // Cross-tab favorite updates
      window.addEventListener('storage', function(e) {
        if (e.key === STORAGE_KEY) {
          updateBadge();
          if (favBtn && typeof updateBtnState === 'function') {
            updateBtnState();
          }
        }
      });

      /* --------------------------------------------------------------------------
         02. ACCESSIBLE MOBILE DRAWER NAVIGATION
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
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
        drawer.setAttribute('aria-hidden', 'false');
        drawer.focus();
      }

      function closeDrawer() {
        if (!drawer || !backdrop) return;
        document.body.classList.remove('menu-open');
        drawer.classList.remove('is-open');
        backdrop.classList.remove('is-open');
        if (menuBtn) {
          menuBtn.setAttribute('aria-expanded', 'false');
          menuBtn.focus();
        }
        drawer.setAttribute('aria-hidden', 'true');
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
${SUPPORT_MODAL_HTML}
</body>
</html>
`;
}

// Main execution routine
function run() {
  console.log('--- NostalgicVerse Static Detail Page Generator ---');
  console.log(`Collection: ${options.collection}`);

  if (options.slug) {
    const record = loadGameData(options.slug);
    if (!record) {
      console.error(`Error: Could not find verified record for slug "${options.slug}" in /data/${options.collection}/`);
      process.exit(1);
    }
    const html = renderGameHtml(record);
    const targetDir = path.join(ROOT, options.collection, options.slug);
    const targetFile = path.join(targetDir, 'index.html');
    
    if (options.dryRun) {
      console.log(`[DRY RUN] Would write ${html.length} bytes to ${targetFile}`);
    } else {
      ensureDir(targetDir);
      fs.writeFileSync(targetFile, html, 'utf8');
      console.log(`Successfully generated: ${targetFile} (${html.length} bytes)`);
    }
  } else if (options.list) {
    console.log(`Processing list of ${options.list.length} slugs...`);
    options.list.forEach(slug => {
      const record = loadGameData(slug);
      if (record) {
        const html = renderGameHtml(record);
        const targetDir = path.join(ROOT, options.collection, slug);
        const targetFile = path.join(targetDir, 'index.html');
        if (options.dryRun) {
          console.log(`[DRY RUN] Would write ${html.length} bytes to ${targetFile}`);
        } else {
          ensureDir(targetDir);
          fs.writeFileSync(targetFile, html, 'utf8');
          console.log(`Generated: ${targetFile} (${html.length} bytes)`);
        }
      } else {
        console.warn(`Skipping missing record: ${slug}`);
      }
    });
  } else if (options.all) {
    const gamesDir = path.join(ROOT, 'data', options.collection);
    const files = fs.readdirSync(gamesDir).filter(f => f.endsWith('.json'));
    console.log(`Processing all ${files.length} records in ${options.collection}...`);
    files.forEach(file => {
      const slug = path.basename(file, '.json');
      const record = loadGameData(slug);
      if (record) {
        const html = renderGameHtml(record);
        const targetDir = path.join(ROOT, options.collection, slug);
        const targetFile = path.join(targetDir, 'index.html');
        if (options.dryRun) {
          console.log(`[DRY RUN] Would write ${html.length} bytes to ${targetFile}`);
        } else {
          ensureDir(targetDir);
          fs.writeFileSync(targetFile, html, 'utf8');
          console.log(`Generated: ${options.collection}/${slug}/index.html (${html.length} bytes)`);
        }
      }
    });
  } else {
    console.log('Usage: node tools/generation/generate-detail-page.cjs [--collection <col>] [--slug <slug>] [--list <s1,s2>] [--batch <n>] [--all] [--dry-run]');
  }
}

run();
