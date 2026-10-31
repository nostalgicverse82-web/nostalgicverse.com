const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const { BRANDING_CSS, HEADER_LOGO_HTML, DRAWER_LOGO_HTML, FOOTER_LOGO_HTML, SUPPORT_SECTION_HTML, SUPPORT_MODAL_HTML } = require('./support-brand-snippets.cjs');
const searchIndex = JSON.parse(fs.readFileSync(path.join(root, 'data/search-index.json'), 'utf8'));

const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">

  <title>Random Discovery Terminal — NostalgicVerse</title>
  <meta name="description" content="Discover uncurated gems, landmark hardware breakthroughs, chronological milestones, and preservation workflows across the NostalgicVerse permanent archives.">
  <meta name="keywords" content="random video game discovery, retro gaming randomizer, random console hardware, gaming museum discovery">
  <meta name="author" content="NostalgicVerse Digital Museum">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://nostalgicverse.com/random/">
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <meta name="theme-color" content="#08080C">

  <meta property="og:type" content="website">
  <meta property="og:url" content="https://nostalgicverse.com/random/">
  <meta property="og:title" content="Random Discovery Terminal — NostalgicVerse">
  <meta property="og:description" content="Encounter unexpected historical specimens, obscure hardware platforms, and groundbreaking video games.">
  <meta property="og:site_name" content="NostalgicVerse">
  <meta property="og:image" content="https://nostalgicverse.com/assets/images/branding/logo/logo.png">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="https://nostalgicverse.com/random/">
  <meta name="twitter:title" content="Random Discovery Terminal — NostalgicVerse">
  <meta name="twitter:description" content="Encounter unexpected historical specimens, obscure hardware platforms, and groundbreaking video games.">
  <meta name="twitter:image" content="https://nostalgicverse.com/assets/images/branding/logo/logo.png">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": "https://nostalgicverse.com/random/#webpage",
        "url": "https://nostalgicverse.com/random/",
        "name": "Random Discovery Terminal — NostalgicVerse",
        "description": "Procedural serendipitous discovery interface for historical video game exhibits.",
        "isPartOf": {
          "@type": "WebSite",
          "@id": "https://nostalgicverse.com/#website",
          "url": "https://nostalgicverse.com/",
          "name": "NostalgicVerse"
        }
      }
    ]
  }
  </script>

  <style>
    :root {
      --nv-bg: #08080C;
      --nv-bg-alt: #0C0C11;
      --nv-surface: #111118;
      --nv-surface-raised: #15151D;
      --nv-surface-active: #1C1C26;
      --nv-border: #1E1E2C;
      --nv-border-strong: #2A2A38;
      --nv-border-hover: rgba(0, 229, 255, 0.35);

      --nv-text-primary: #F4F4F7;
      --nv-text-secondary: #A7A7B5;
      --nv-text-muted: #737381;

      --nv-cyan: #00E5FF;
      --nv-gold: #FFB300;
      --nv-crimson: #FF2A6D;
      --nv-emerald: #00E676;

      --nv-font-sans: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      --nv-font-mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace;

      --nv-container-max: 1400px;
      --nv-header-height: 72px;
      --nv-radius-sm: 4px;
      --nv-radius-md: 8px;
      --nv-radius-lg: 12px;

      --nv-shadow-ambient: 0 20px 60px rgba(0, 0, 0, 0.45);
      --nv-shadow-card: 0 10px 30px rgba(0, 0, 0, 0.35);

      --nv-transition-fast: 160ms cubic-bezier(0.16, 1, 0.3, 1);
      --nv-transition-normal: 260ms cubic-bezier(0.16, 1, 0.3, 1);
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html {
      font-size: 16px;
      line-height: 1.5;
      background-color: var(--nv-bg);
      color: var(--nv-text-primary);
      font-family: var(--nv-font-sans);
      scroll-behavior: smooth;
      text-rendering: optimizeLegibility;
      -webkit-font-smoothing: antialiased;
    }
    body {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background-color: var(--nv-bg);
      color: var(--nv-text-primary);
      overflow-x: hidden;
      position: relative;
    }
    body.menu-open { overflow: hidden; }

    img, svg { display: block; max-width: 100%; height: auto; }
    a { color: inherit; text-decoration: none; transition: color var(--nv-transition-fast); }
    button, input, select { font-family: inherit; font-size: inherit; color: inherit; border: none; background: none; }
    button { cursor: pointer; }
    :focus-visible { outline: 2px solid var(--nv-cyan); outline-offset: 3px; }

    .skip-link {
      position: absolute; top: -100px; left: 16px; background: var(--nv-cyan); color: #000;
      padding: 10px 16px; font-weight: 700; z-index: 10000; border-radius: var(--nv-radius-sm);
      transition: top 0.2s;
    }
    .skip-link:focus { top: 16px; }

    .bg-grid-overlay {
      position: fixed; inset: 0;
      background-image: 
        linear-gradient(to right, rgba(255, 255, 255, 0.015) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255, 255, 255, 0.015) 1px, transparent 1px);
      background-size: 48px 48px;
      pointer-events: none;
      z-index: 0;
    }
    .container { width: 100%; max-width: var(--nv-container-max); margin: 0 auto; padding: 0 24px; position: relative; z-index: 1; }

    /* Header */
    .site-header {
      position: sticky; top: 0; z-index: 1000; height: var(--nv-header-height);
      background: rgba(8, 8, 12, 0.88); backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px); border-bottom: 1px solid var(--nv-border);
      display: flex; align-items: center;
    }
    .header-inner { display: flex; align-items: center; justify-content: space-between; width: 100%; }
    .brand-group { display: flex; align-items: center; gap: 16px; }
    .brand-logo-wrap { display: flex; align-items: center; gap: 12px; }
    .brand-mark {
      display: inline-flex; align-items: center; justify-content: center;
      width: 36px; height: 36px; background: var(--nv-surface-raised);
      border: 1px solid var(--nv-border-strong); border-radius: var(--nv-radius-sm);
      font-family: var(--nv-font-mono); font-size: 0.85rem; font-weight: 700;
      color: var(--nv-cyan); letter-spacing: 0.05em;
    }
    .brand-text { font-size: 1.1rem; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }

    .site-nav { display: none; align-items: center; gap: 24px; }
    @media (min-width: 1024px) { .site-nav { display: flex; } }
    .nav-link { font-size: 0.875rem; font-weight: 500; color: var(--nv-text-secondary); transition: color var(--nv-transition-fast); padding: 6px 0; }
    .nav-link:hover { color: var(--nv-text-primary); }

    .header-actions { display: flex; align-items: center; gap: 10px; }
    .header-action-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border-radius: var(--nv-radius-sm);
      background: var(--nv-surface); border: 1px solid var(--nv-border);
      color: var(--nv-text-secondary); transition: all var(--nv-transition-fast);
      position: relative;
    }
    .header-action-btn:hover { border-color: var(--nv-border-hover); color: var(--nv-cyan); }
    .fav-badge {
      position: absolute; top: -4px; right: -4px; min-width: 18px; height: 18px;
      padding: 0 4px; border-radius: 9px; background: var(--nv-gold); color: #000;
      font-size: 0.65rem; font-weight: 700; font-family: var(--nv-font-mono);
      display: none; align-items: center; justify-content: center;
    }
    .fav-badge.has-items { display: flex; }
    .menu-toggle {
      display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border-radius: var(--nv-radius-sm);
      background: var(--nv-surface); border: 1px solid var(--nv-border);
      color: var(--nv-text-secondary);
    }
    @media (min-width: 1024px) { .menu-toggle { display: none; } }

    /* Mobile Drawer */
    .mobile-drawer-overlay {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px); z-index: 1999; opacity: 0; pointer-events: none;
      transition: opacity var(--nv-transition-normal);
    }
    .mobile-drawer-overlay.is-open { opacity: 1; pointer-events: auto; }
    .mobile-drawer {
      position: fixed; top: 0; right: 0; bottom: 0; width: 320px; max-width: 85vw;
      background: var(--nv-surface); border-left: 1px solid var(--nv-border);
      z-index: 2000; transform: translateX(100%); transition: transform var(--nv-transition-normal);
      display: flex; flex-direction: column; padding: 24px; overflow-y: auto;
    }
    .mobile-drawer.is-open { transform: translateX(0); }
    .drawer-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; }
    .drawer-nav { display: flex; flex-direction: column; gap: 8px; flex: 1; }
    .drawer-nav-link {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 14px; border-radius: var(--nv-radius-sm); color: var(--nv-text-secondary);
      font-size: 0.95rem; font-weight: 500;
    }
    .drawer-nav-link:hover, .drawer-nav-link.active { background: var(--nv-surface-raised); color: var(--nv-cyan); }
    .nav-num { font-family: var(--nv-font-mono); font-size: 0.75rem; color: var(--nv-text-muted); }
    .drawer-footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--nv-border); font-family: var(--nv-font-mono); font-size: 0.75rem; color: var(--nv-text-muted); }

    /* Breadcrumbs */
    .breadcrumbs {
      display: flex; align-items: center; gap: 8px; font-family: var(--nv-font-mono);
      font-size: 0.75rem; color: var(--nv-text-muted); padding: 24px 0 12px;
    }
    .breadcrumbs a:hover { color: var(--nv-cyan); }
    .breadcrumbs .current { color: var(--nv-text-secondary); }

    /* Hero */
    .rnd-hero {
      padding: 24px 0 32px;
      border-bottom: 1px solid var(--nv-border);
      margin-bottom: 32px;
    }
    .rnd-eyebrow {
      display: inline-flex; align-items: center; gap: 8px;
      font-family: var(--nv-font-mono); font-size: 0.75rem;
      letter-spacing: 0.15em; text-transform: uppercase; color: var(--nv-cyan);
      margin-bottom: 16px;
    }
    .rnd-headline {
      font-size: clamp(2.4rem, 5vw, 4rem); font-weight: 800; line-height: 1.05;
      letter-spacing: -0.03em; margin-bottom: 16px; color: var(--nv-text-primary);
    }
    .rnd-lead {
      max-width: 820px; font-size: 1.15rem; line-height: 1.65;
      color: var(--nv-text-secondary); margin-bottom: 24px;
    }

    /* Category Scope Filter Bar */
    .scope-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      background: var(--nv-surface);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-md);
      padding: 12px 16px;
      margin-bottom: 32px;
    }
    .scope-label {
      font-family: var(--nv-font-mono);
      font-size: 0.72rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--nv-text-muted);
      margin-right: 8px;
    }
    .scope-pill {
      padding: 6px 14px;
      border-radius: 999px;
      background: var(--nv-surface-raised);
      border: 1px solid var(--nv-border);
      font-family: var(--nv-font-mono);
      font-size: 0.78rem;
      color: var(--nv-text-secondary);
      cursor: pointer;
      transition: all var(--nv-transition-fast);
    }
    .scope-pill:hover { border-color: var(--nv-border-hover); color: var(--nv-text-primary); }
    .scope-pill.active {
      background: rgba(0, 229, 255, 0.12);
      border-color: var(--nv-cyan);
      color: var(--nv-cyan);
      font-weight: 700;
    }

    /* Terminal Main Stage */
    .terminal-stage {
      display: grid;
      grid-template-columns: 1fr;
      gap: 32px;
      margin-bottom: 48px;
    }
    @media (min-width: 900px) {
      .terminal-stage { grid-template-columns: 1.6fr 1fr; align-items: start; }
    }

    /* Spotlight Exhibit Card */
    .spotlight-card {
      background: var(--nv-surface);
      border: 1px solid var(--nv-border-strong);
      border-radius: var(--nv-radius-lg);
      padding: 36px 32px;
      box-shadow: var(--nv-shadow-ambient);
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 440px;
    }
    .spotlight-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
    }
    .type-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--nv-font-mono);
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: var(--nv-radius-sm);
    }
    .type-game { background: rgba(0, 229, 255, 0.1); color: var(--nv-cyan); border: 1px solid rgba(0, 229, 255, 0.3); }
    .type-console { background: rgba(255, 179, 0, 0.1); color: var(--nv-gold); border: 1px solid rgba(255, 179, 0, 0.3); }
    .type-timeline { background: rgba(255, 42, 109, 0.1); color: var(--nv-crimson); border: 1px solid rgba(255, 42, 109, 0.3); }
    .type-genre { background: rgba(0, 230, 118, 0.1); color: var(--nv-emerald); border: 1px solid rgba(0, 230, 118, 0.3); }
    .type-guide { background: rgba(0, 229, 255, 0.1); color: #80e5ff; border: 1px solid rgba(0, 229, 255, 0.3); }
    .type-story { background: rgba(255, 179, 0, 0.1); color: #ffd54f; border: 1px solid rgba(255, 179, 0, 0.3); }

    .spotlight-fav-btn {
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--nv-surface-raised); border: 1px solid var(--nv-border);
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--nv-text-muted); transition: all var(--nv-transition-fast);
    }
    .spotlight-fav-btn:hover, .spotlight-fav-btn.is-active {
      color: var(--nv-gold); border-color: var(--nv-gold); background: rgba(255, 179, 0, 0.12);
    }
    .spotlight-fav-btn svg { width: 20px; height: 20px; fill: none; stroke: currentColor; }
    .spotlight-fav-btn.is-active svg { fill: var(--nv-gold); }

    .spotlight-title {
      font-size: clamp(1.8rem, 3.5vw, 2.6rem);
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -0.02em;
      color: var(--nv-text-primary);
      margin-bottom: 12px;
    }
    .spotlight-meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 12px;
      background: var(--nv-surface-raised);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-sm);
      padding: 14px 18px;
      margin-bottom: 24px;
    }
    .meta-box-label { font-family: var(--nv-font-mono); font-size: 0.65rem; letter-spacing: 0.1em; text-transform: uppercase; color: var(--nv-text-muted); }
    .meta-box-val { font-size: 0.95rem; font-weight: 600; color: var(--nv-text-primary); margin-top: 2px; }

    .spotlight-summary {
      font-size: 1.05rem;
      line-height: 1.7;
      color: var(--nv-text-secondary);
      margin-bottom: 32px;
    }

    .spotlight-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      padding-top: 24px;
      border-top: 1px solid var(--nv-border);
    }

    /* Terminal Console Controller */
    .terminal-side-console {
      display: flex;
      flex-direction: column;
      gap: 24px;
    }
    .re-roll-box {
      background: var(--nv-surface);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-md);
      padding: 24px;
      text-align: center;
    }
    .re-roll-desc {
      font-size: 0.88rem;
      color: var(--nv-text-secondary);
      line-height: 1.6;
      margin-bottom: 20px;
    }
    .roll-again-btn {
      width: 100%;
      height: 52px;
      background: var(--nv-cyan);
      color: #000;
      border: 1px solid var(--nv-cyan);
      border-radius: var(--nv-radius-sm);
      font-size: 1rem;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      transition: all var(--nv-transition-fast);
      cursor: pointer;
    }
    .roll-again-btn:hover { background: #33ebff; transform: scale(1.02); }

    /* Recent Rolls Reel */
    .recent-reel-box {
      background: var(--nv-surface);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-md);
      padding: 24px;
    }
    .reel-title {
      font-family: var(--nv-font-mono);
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--nv-text-muted);
      margin-bottom: 16px;
    }
    .reel-list {
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .reel-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: var(--nv-surface-raised);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-sm);
      font-size: 0.85rem;
    }
    .reel-item a { color: var(--nv-text-secondary); }
    .reel-item a:hover { color: var(--nv-cyan); }
    .reel-tag { font-family: var(--nv-font-mono); font-size: 0.65rem; color: var(--nv-text-muted); }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: var(--nv-radius-sm);
      font-size: 0.9rem;
      font-weight: 600;
      transition: all var(--nv-transition-fast);
      cursor: pointer;
    }
    .btn-primary { background: var(--nv-cyan); color: #000; border: 1px solid var(--nv-cyan); }
    .btn-primary:hover { background: #33ebff; }
    .btn-secondary { background: var(--nv-surface-raised); color: var(--nv-text-primary); border: 1px solid var(--nv-border-strong); }
    .btn-secondary:hover { border-color: var(--nv-cyan); color: var(--nv-cyan); }

    /* Footer */
    .site-footer {
      border-top: 1px solid var(--nv-border); background: var(--nv-bg-alt);
      padding: 56px 0 32px; font-size: 0.85rem; color: var(--nv-text-muted); margin-top: auto;
    }
    .footer-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 36px; margin-bottom: 40px; }
    .footer-col h3 {
      font-family: var(--nv-font-mono); font-size: 0.75rem; letter-spacing: 0.12em;
      text-transform: uppercase; color: var(--nv-text-primary); margin-bottom: 16px;
    }
    .footer-col ul { list-style: none; display: flex; flex-direction: column; gap: 10px; }
    .footer-col a { color: var(--nv-text-secondary); }
    .footer-col a:hover { color: var(--nv-cyan); }
    .footer-bottom {
      border-top: 1px solid var(--nv-border); padding-top: 24px;
      display: flex; flex-wrap: wrap; justify-content: space-between; gap: 16px;
      font-family: var(--nv-font-mono); font-size: 0.75rem;
    }
    .footer-bottom a { color: var(--nv-text-muted); margin-left: 16px; }
    .footer-bottom a:hover { color: var(--nv-cyan); }
${BRANDING_CSS}
  </style>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to random discovery terminal</a>
  <div class="bg-grid-overlay" aria-hidden="true"></div>

  <!-- Header -->
  <header class="site-header" id="site-header">
    <div class="container">
      <div class="header-inner">
${HEADER_LOGO_HTML}

        <nav class="site-nav" aria-label="Primary Exhibition Navigation">
          <a href="/" class="nav-link">Home</a>
          <a href="/games/" class="nav-link">Games</a>
          <a href="/consoles/" class="nav-link">Consoles</a>
          <a href="/timeline/" class="nav-link">Timeline</a>
          <a href="/genres/" class="nav-link">Genres</a>
          <a href="/guides/" class="nav-link">Guides</a>
          <a href="/blog/" class="nav-link">Stories</a>
          <a href="/download/" class="nav-link">Emulator</a>
        </nav>

        <div class="header-actions">
          <a href="/search/" class="header-action-btn" aria-label="Search the Archive">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </a>
          <a href="/favorites/" class="header-action-btn" aria-label="View Saved Archive Favorites">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>
            <span class="fav-badge" id="header-fav-badge" aria-live="polite">0</span>
          </a>
          <button type="button" class="menu-toggle" id="menu-toggle-btn" aria-expanded="false" aria-controls="mobile-nav-drawer" aria-label="Open Archive Navigation">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
        </div>
      </div>
    </div>
  </header>

  <!-- Mobile Drawer -->
  <div class="mobile-drawer-overlay" id="drawer-backdrop" aria-hidden="true"></div>
  <aside class="mobile-drawer" id="mobile-nav-drawer" aria-label="Mobile Navigation" aria-hidden="true" tabindex="-1">
    <div class="drawer-top">
${DRAWER_LOGO_HTML}
      <button type="button" class="menu-toggle" id="drawer-close-btn" aria-label="Close Archive Navigation">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    </div>
    <nav class="drawer-nav">
      <a href="/" class="drawer-nav-link"><span>Home</span> <span class="nav-num">/01</span></a>
      <a href="/games/" class="drawer-nav-link"><span>Games</span> <span class="nav-num">/02</span></a>
      <a href="/consoles/" class="drawer-nav-link"><span>Consoles</span> <span class="nav-num">/03</span></a>
      <a href="/timeline/" class="drawer-nav-link"><span>Timeline</span> <span class="nav-num">/04</span></a>
      <a href="/genres/" class="drawer-nav-link"><span>Genres</span> <span class="nav-num">/05</span></a>
      <a href="/guides/" class="drawer-nav-link"><span>Guides</span> <span class="nav-num">/06</span></a>
      <a href="/blog/" class="drawer-nav-link"><span>Stories</span> <span class="nav-num">/07</span></a>
      <a href="/download/" class="drawer-nav-link"><span>Emulator Project</span> <span class="nav-num">/08</span></a>
      <a href="/favorites/" class="drawer-nav-link"><span>Favorites Archive</span> <span class="nav-num">/FAV</span></a>
      <a href="/random/" class="drawer-nav-link active"><span>Random Discovery</span> <span class="nav-num">/RND</span></a>
    </nav>
    <div class="drawer-footer">
      <p>DISCOVERY TERMINAL // VER 2026.1</p>
      <p style="margin-top: 6px;">Serendipitous archival exploration.</p>
    </div>
  </aside>

  <!-- Main Content -->
  <main id="main-content">
    <div class="container">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span aria-hidden="true">/</span>
        <span class="current" aria-current="page">Random Discovery</span>
      </nav>

      <!-- Hero -->
      <section class="rnd-hero" aria-labelledby="rnd-hero-title">
        <div class="rnd-eyebrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
          <span>EXHIBITION EXPLORER // PROCEDURAL TERMINAL</span>
        </div>
        <h1 class="rnd-headline" id="rnd-hero-title">RANDOM DISCOVERY</h1>
        <p class="rnd-lead">
          Encounter unexpected milestones, hidden mechanical innovations, pioneering hardware architectures, and preservation procedures selected across our complete 289-item verified museum archives.
        </p>

        <!-- Scope Filter Bar -->
        <div class="scope-bar" role="tablist" aria-label="Select collection pool for random discovery">
          <span class="scope-label">Discovery Scope:</span>
          <button type="button" class="scope-pill active" data-scope="all" role="tab" aria-selected="true">Any Collection</button>
          <button type="button" class="scope-pill" data-scope="game" role="tab" aria-selected="false">Games Only</button>
          <button type="button" class="scope-pill" data-scope="console" role="tab" aria-selected="false">Consoles Only</button>
          <button type="button" class="scope-pill" data-scope="timeline" role="tab" aria-selected="false">Timeline Only</button>
          <button type="button" class="scope-pill" data-scope="genre" role="tab" aria-selected="false">Genres Only</button>
          <button type="button" class="scope-pill" data-scope="guide" role="tab" aria-selected="false">Guides Only</button>
          <button type="button" class="scope-pill" data-scope="story" role="tab" aria-selected="false">Stories Only</button>
        </div>
      </section>

      <!-- Terminal Stage -->
      <section class="terminal-stage" aria-label="Random Discovery Console">
        <!-- Spotlight Card -->
        <div class="spotlight-card" id="spotlight-card">
          <div>
            <div class="spotlight-header">
              <span class="type-badge" id="spotlight-type-badge">EXHIBIT</span>
              <button type="button" class="spotlight-fav-btn" id="spotlight-fav-btn" aria-label="Save exhibit to collection">
                <svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>
              </button>
            </div>

            <h2 class="spotlight-title" id="spotlight-title">Loading Archival Exhibit...</h2>

            <div class="spotlight-meta-grid" id="spotlight-meta-grid">
              <div>
                <span class="meta-box-label">Classification</span>
                <div class="meta-box-val" id="spotlight-meta-category">—</div>
              </div>
              <div>
                <span class="meta-box-label">Era / Milestone</span>
                <div class="meta-box-val" id="spotlight-meta-year">—</div>
              </div>
              <div>
                <span class="meta-box-label">Attribution</span>
                <div class="meta-box-val" id="spotlight-meta-sub">—</div>
              </div>
            </div>

            <p class="spotlight-summary" id="spotlight-summary">
              Initializing the historical registry silicon. Please wait while a museum specimen is selected...
            </p>
          </div>

          <div class="spotlight-actions">
            <a href="#" class="btn btn-primary" id="spotlight-link">Examine Exhibit Record →</a>
            <button type="button" class="btn btn-secondary" id="stage-reroll-btn">Discover Another</button>
          </div>
        </div>

        <!-- Right Side Console -->
        <div class="terminal-side-console">
          <div class="re-roll-box">
            <p class="re-roll-desc">
              Looking for something different? Trigger a clean random draw from the 289 cataloged specimens in our collection.
            </p>
            <button type="button" class="roll-again-btn" id="side-roll-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="16 3 21 3 21 8"></polyline><line x1="4" y1="20" x2="21" y2="3"></line><polyline points="21 16 21 21 16 21"></polyline><line x1="15" y1="15" x2="21" y2="21"></line><line x1="4" y1="4" x2="9" y2="9"></line></svg>
              <span>Discover Another Exhibit</span>
            </button>
          </div>

          <div class="recent-reel-box">
            <h3 class="reel-title">Recent Session Discoveries</h3>
            <ul class="reel-list" id="recent-reel-list">
              <!-- Dynamically populated -->
            </ul>
          </div>
        </div>
      </section>
    </div>
  </main>
${SUPPORT_SECTION_HTML}
  <!-- Footer -->
  <footer class="site-footer">
    <div class="container">
      <div class="brand-group" style="margin-bottom: 24px;">
        <a href="/" class="brand-logo-wrap" aria-label="NostalgicVerse Homepage">
          <img src="/assets/images/branding/logo/logo.svg" alt="NostalgicVerse" class="site-logo-img footer-logo-img" width="200" height="40" loading="lazy">
        </a>
      </div>
      <div class="footer-grid">
        <div class="footer-col">
          <h3>The Museum</h3>
          <ul>
            <li><a href="/about/">About NostalgicVerse</a></li>
            <li><a href="/timeline/">Historical Timeline</a></li>
            <li><a href="/genres/">Genre Taxonomy</a></li>
            <li><a href="/support/">Support the Creator</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h3>Exhibits</h3>
          <ul>
            <li><a href="/games/">Landmark Games</a></li>
            <li><a href="/consoles/">Hardware Generations</a></li>
            <li><a href="/guides/">Preservation Guides</a></li>
            <li><a href="/blog/">Archival Stories</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h3>Software</h3>
          <ul>
            <li><a href="/download/">NostalgicVerse Emulator</a></li>
            <li><a href="/favorites/">Saved Collection</a></li>
            <li><a href="/random/">Random Discovery</a></li>
            <li><a href="/search/">Archive Search</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h3>Legal & Standards</h3>
          <ul>
            <li><a href="/legal/privacy.html">Privacy Policy</a></li>
            <li><a href="/legal/terms.html">Terms of Service</a></li>
            <li><a href="/legal/cookies.html">Cookie Policy</a></li>
            <li><a href="/legal/disclaimer.html">Archival Disclaimer</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <div>&copy; 2026 NostalgicVerse. Dedicated to digital preservation and video game history.</div>
        <div>
          <a href="/legal/privacy.html">Privacy</a>
          <a href="/legal/terms.html">Terms</a>
          <a href="/legal/disclaimer.html">Disclaimer</a>
        </div>
      </div>
    </div>
  </footer>

  <script>
    (function () {
      "use strict";

      /* ==========================================================================
         01. MASTER CATALOG POOL
         ========================================================================== */
      const POOL = ${JSON.stringify(searchIndex)};

      /* ==========================================================================
         02. FAVORITES MANAGEMENT
         ========================================================================== */
      const FAV_STORAGE_KEY = 'nostalgicverse_favs';

      function getStoredFavorites() {
        try {
          const raw = localStorage.getItem(FAV_STORAGE_KEY);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.warn('LocalStorage error', e);
          return [];
        }
      }

      function updateFavoritesHeaderBadge() {
        const badge = document.getElementById('header-fav-badge');
        if (!badge) return;
        try {
          const favs = getStoredFavorites();
          const count = favs.length;
          badge.textContent = count;
          if (count > 0) { badge.classList.add('has-items'); } else { badge.classList.remove('has-items'); }
        } catch (e) {
          console.warn('Badge error', e);
        }
      }

      let currentItem = null;

      function updateSpotlightFavBtn() {
        const favBtn = document.getElementById('spotlight-fav-btn');
        if (!favBtn || !currentItem) return;
        const favs = getStoredFavorites();
        const isFav = favs.some(f => f.id === currentItem.id);
        if (isFav) {
          favBtn.classList.add('is-active');
          favBtn.setAttribute('aria-label', 'Remove ' + currentItem.title + ' from saved collection');
        } else {
          favBtn.classList.remove('is-active');
          favBtn.setAttribute('aria-label', 'Save ' + currentItem.title + ' to collection');
        }
      }

      function toggleCurrentFavorite() {
        if (!currentItem) return;
        try {
          let favs = getStoredFavorites();
          const exists = favs.some(f => f.id === currentItem.id);
          if (exists) {
            favs = favs.filter(f => f.id !== currentItem.id);
          } else {
            favs.push({
              id: currentItem.id,
              type: currentItem.type,
              title: currentItem.title,
              url: currentItem.url,
              category: currentItem.category
            });
          }
          localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favs));
          updateSpotlightFavBtn();
          updateFavoritesHeaderBadge();
        } catch (e) {
          console.warn('Favorite toggle error', e);
        }
      }

      window.addEventListener('storage', function (e) {
        if (e.key === FAV_STORAGE_KEY) {
          updateSpotlightFavBtn();
          updateFavoritesHeaderBadge();
        }
      });

      /* ==========================================================================
         03. RANDOM DISCOVERY ENGINE
         ========================================================================== */
      let activeScope = 'all';
      const recentRolls = [];

      const typeBadge = document.getElementById('spotlight-type-badge');
      const titleEl = document.getElementById('spotlight-title');
      const metaCat = document.getElementById('spotlight-meta-category');
      const metaYear = document.getElementById('spotlight-meta-year');
      const metaSub = document.getElementById('spotlight-meta-sub');
      const summaryEl = document.getElementById('spotlight-summary');
      const linkEl = document.getElementById('spotlight-link');
      const reelList = document.getElementById('recent-reel-list');
      const scopePills = document.querySelectorAll('.scope-pill');

      function rollExhibit() {
        let eligible = POOL;
        if (activeScope !== 'all') {
          eligible = POOL.filter(i => i.type === activeScope);
        }

        if (eligible.length === 0) return;

        // Pick random item avoiding exact current
        let pick;
        if (eligible.length > 1) {
          do {
            pick = eligible[Math.floor(Math.random() * eligible.length)];
          } while (currentItem && pick.id === currentItem.id);
        } else {
          pick = eligible[0];
        }

        currentItem = pick;

        // Render Spotlight
        typeBadge.className = 'type-badge type-' + pick.type;
        typeBadge.textContent = pick.typeName.toUpperCase() + ' EXHIBIT';

        titleEl.textContent = pick.title;
        metaCat.textContent = pick.category || 'EXHIBITION SPECIMEN';
        metaYear.textContent = pick.year ? String(pick.year) : 'PERMANENT ARCHIVE';
        metaSub.textContent = pick.subtitle || 'NOSTALGICVERSE MUSEUM';
        summaryEl.textContent = pick.summary || 'A defining milestone in interactive entertainment history.';

        linkEl.href = pick.url;
        linkEl.textContent = 'Examine ' + pick.typeName + ' Record →';

        updateSpotlightFavBtn();

        // Update Recent Reel
        if (!recentRolls.some(r => r.id === pick.id)) {
          recentRolls.unshift(pick);
          if (recentRolls.length > 5) recentRolls.pop();
          renderRecentReel();
        }
      }

      function renderRecentReel() {
        reelList.textContent = '';
        if (recentRolls.length === 0) {
          const emptyLi = document.createElement('li');
          emptyLi.className = 'reel-item';
          emptyLi.style.color = 'var(--nv-text-muted)';
          emptyLi.textContent = 'No previous items rolled in this session.';
          reelList.appendChild(emptyLi);
          return;
        }

        recentRolls.forEach(item => {
          const li = document.createElement('li');
          li.className = 'reel-item';

          const a = document.createElement('a');
          a.href = item.url;
          a.textContent = item.title;

          const tag = document.createElement('span');
          tag.className = 'reel-tag';
          tag.textContent = item.typeName.toUpperCase();

          li.appendChild(a);
          li.appendChild(tag);
          reelList.appendChild(li);
        });
      }

      // Scope Pill clicks
      scopePills.forEach(pill => {
        pill.addEventListener('click', function () {
          scopePills.forEach(p => {
            p.classList.remove('active');
            p.setAttribute('aria-selected', 'false');
          });
          pill.classList.add('active');
          pill.setAttribute('aria-selected', 'true');
          activeScope = pill.getAttribute('data-scope');
          rollExhibit();
        });
      });

      // Reroll Buttons
      const sideRollBtn = document.getElementById('side-roll-btn');
      const stageRerollBtn = document.getElementById('stage-reroll-btn');
      const spotlightFavBtn = document.getElementById('spotlight-fav-btn');

      if (sideRollBtn) sideRollBtn.addEventListener('click', rollExhibit);
      if (stageRerollBtn) stageRerollBtn.addEventListener('click', rollExhibit);
      if (spotlightFavBtn) spotlightFavBtn.addEventListener('click', toggleCurrentFavorite);

      /* ==========================================================================
         04. MOBILE NAVIGATION DRAWER
         ========================================================================== */
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

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && drawer && drawer.classList.contains('is-open')) {
          closeDrawer();
        }
      });

      /* ==========================================================================
         05. INITIALIZATION
         ========================================================================== */
      window.addEventListener('DOMContentLoaded', function () {
        rollExhibit();
        updateFavoritesHeaderBadge();
      });

    })();
  </script>
${SUPPORT_MODAL_HTML}
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'random/index.html'), template, 'utf8');
console.log('Random Discovery page created at random/index.html');

