const fs = require('fs');
const path = require('path');

const root = 'd:/nostalgicverse1.com';
const searchIndex = JSON.parse(fs.readFileSync(path.join(root, 'data/search-index.json'), 'utf8'));

const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">

  <title>Archive Search — NostalgicVerse</title>
  <meta name="description" content="Search the permanent digital museum repository across landmark games, historical consoles, chronologies, mechanical genres, technical guides, and monographs.">
  <meta name="keywords" content="retro games search, video game history archive, console hardware database, gaming timeline search, video game preservation search">
  <meta name="author" content="NostalgicVerse Digital Museum">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="https://nostalgicverse.com/search/">
  <link rel="icon" href="/favicon.ico" type="image/x-icon">
  <meta name="theme-color" content="#08080C">

  <meta property="og:type" content="website">
  <meta property="og:url" content="https://nostalgicverse.com/search/">
  <meta property="og:title" content="Archive Search — NostalgicVerse">
  <meta property="og:description" content="Instant multi-collection discovery across video games, hardware generations, historical timeline milestones, genres, guides, and stories.">
  <meta property="og:site_name" content="NostalgicVerse">
  <meta property="og:image" content="https://nostalgicverse.com/assets/images/branding/logo/logo.png">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:url" content="https://nostalgicverse.com/search/">
  <meta name="twitter:title" content="Archive Search — NostalgicVerse">
  <meta name="twitter:description" content="Instant multi-collection discovery across video games, hardware generations, milestones, guides, and stories.">
  <meta name="twitter:image" content="https://nostalgicverse.com/assets/images/branding/logo/logo.png">

  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SearchResultsPage",
        "@id": "https://nostalgicverse.com/search/#searchpage",
        "url": "https://nostalgicverse.com/search/",
        "name": "Archive Search — NostalgicVerse",
        "description": "Central discovery engine for NostalgicVerse digital museum collections.",
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
    .header-action-btn:hover, .header-action-btn.active {
      border-color: var(--nv-border-hover); color: var(--nv-cyan);
    }
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
    .drawer-nav-link:hover { background: var(--nv-surface-raised); color: var(--nv-cyan); }
    .nav-num { font-family: var(--nv-font-mono); font-size: 0.75rem; color: var(--nv-text-muted); }
    .drawer-footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--nv-border); font-family: var(--nv-font-mono); font-size: 0.75rem; color: var(--nv-text-muted); }

    /* Breadcrumbs */
    .breadcrumbs {
      display: flex; align-items: center; gap: 8px; font-family: var(--nv-font-mono);
      font-size: 0.75rem; color: var(--nv-text-muted); padding: 24px 0 12px;
    }
    .breadcrumbs a:hover { color: var(--nv-cyan); }
    .breadcrumbs .current { color: var(--nv-text-secondary); }

    /* Search Hero Section */
    .search-hero {
      padding: 24px 0 40px;
      border-bottom: 1px solid var(--nv-border);
      margin-bottom: 32px;
    }
    .search-hero-eyebrow {
      display: inline-flex; align-items: center; gap: 8px;
      font-family: var(--nv-font-mono); font-size: 0.75rem;
      letter-spacing: 0.15em; text-transform: uppercase; color: var(--nv-cyan);
      margin-bottom: 16px;
    }
    .search-hero-title {
      font-size: clamp(2.2rem, 5vw, 3.6rem); font-weight: 800; line-height: 1.05;
      letter-spacing: -0.03em; margin-bottom: 14px; color: var(--nv-text-primary);
    }
    .search-hero-desc {
      max-width: 800px; font-size: 1.1rem; line-height: 1.65;
      color: var(--nv-text-secondary); margin-bottom: 32px;
    }

    /* Master Search Input Console */
    .search-console-card {
      background: var(--nv-surface);
      border: 1px solid var(--nv-border-strong);
      border-radius: var(--nv-radius-md);
      padding: 24px;
      box-shadow: var(--nv-shadow-card);
      margin-bottom: 32px;
    }
    .search-input-wrap {
      position: relative;
      display: flex;
      align-items: center;
      width: 100%;
    }
    .search-big-icon {
      position: absolute;
      left: 18px;
      color: var(--nv-cyan);
      pointer-events: none;
    }
    .search-input-field {
      width: 100%;
      height: 56px;
      padding: 0 88px 0 54px;
      background: var(--nv-surface-raised);
      border: 1px solid var(--nv-border-strong);
      border-radius: var(--nv-radius-sm);
      color: var(--nv-text-primary);
      font-size: 1.1rem;
      transition: all var(--nv-transition-fast);
    }
    .search-input-field:focus {
      border-color: var(--nv-cyan);
      box-shadow: 0 0 0 3px rgba(0, 229, 255, 0.15);
      outline: none;
    }
    .search-controls-right {
      position: absolute;
      right: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .kbd-hint {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 8px;
      background: var(--nv-surface);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-sm);
      font-family: var(--nv-font-mono);
      font-size: 0.7rem;
      color: var(--nv-text-muted);
      pointer-events: none;
    }
    .clear-search-btn {
      width: 32px;
      height: 32px;
      display: none;
      align-items: center;
      justify-content: center;
      color: var(--nv-text-muted);
      border-radius: 50%;
    }
    .clear-search-btn.is-visible { display: inline-flex; }
    .clear-search-btn:hover { color: var(--nv-text-primary); background: rgba(255, 255, 255, 0.08); }

    /* Type Filter Pills */
    .filter-pills-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--nv-border);
    }
    .pill-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 999px;
      background: var(--nv-surface-raised);
      border: 1px solid var(--nv-border);
      font-family: var(--nv-font-mono);
      font-size: 0.78rem;
      color: var(--nv-text-secondary);
      transition: all var(--nv-transition-fast);
      cursor: pointer;
    }
    .pill-btn:hover { border-color: var(--nv-border-hover); color: var(--nv-text-primary); }
    .pill-btn.active {
      background: rgba(0, 229, 255, 0.12);
      border-color: var(--nv-cyan);
      color: var(--nv-cyan);
      font-weight: 700;
    }
    .pill-count {
      display: inline-flex;
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.08);
      font-size: 0.7rem;
    }
    .pill-btn.active .pill-count {
      background: rgba(0, 229, 255, 0.25);
      color: var(--nv-cyan);
    }

    /* Meta Bar */
    .search-meta-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      margin-bottom: 24px;
      border-bottom: 1px solid var(--nv-border);
      font-family: var(--nv-font-mono);
      font-size: 0.75rem;
      color: var(--nv-text-muted);
    }
    .search-status-text { color: var(--nv-cyan); font-weight: 700; }

    /* Results Grid */
    .search-results-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 16px;
      margin-bottom: 64px;
    }
    @media (min-width: 800px) {
      .search-results-grid { grid-template-columns: repeat(2, 1fr); }
    }

    /* Result Card */
    .result-card {
      background: var(--nv-surface);
      border: 1px solid var(--nv-border);
      border-radius: var(--nv-radius-md);
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 14px;
      transition: all var(--nv-transition-fast);
      position: relative;
    }
    .result-card:hover {
      border-color: var(--nv-border-hover);
      transform: translateY(-2px);
      box-shadow: var(--nv-shadow-card);
    }
    .card-header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .type-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: var(--nv-font-mono);
      font-size: 0.68rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      padding: 3px 8px;
      border-radius: var(--nv-radius-sm);
    }
    .type-game { background: rgba(0, 229, 255, 0.1); color: var(--nv-cyan); border: 1px solid rgba(0, 229, 255, 0.3); }
    .type-console { background: rgba(255, 179, 0, 0.1); color: var(--nv-gold); border: 1px solid rgba(255, 179, 0, 0.3); }
    .type-timeline { background: rgba(255, 42, 109, 0.1); color: var(--nv-crimson); border: 1px solid rgba(255, 42, 109, 0.3); }
    .type-genre { background: rgba(0, 230, 118, 0.1); color: var(--nv-emerald); border: 1px solid rgba(0, 230, 118, 0.3); }
    .type-guide { background: rgba(0, 229, 255, 0.1); color: #80e5ff; border: 1px solid rgba(0, 229, 255, 0.3); }
    .type-story { background: rgba(255, 179, 0, 0.1); color: #ffd54f; border: 1px solid rgba(255, 179, 0, 0.3); }

    .result-year { font-family: var(--nv-font-mono); font-size: 0.75rem; color: var(--nv-text-muted); }
    .card-fav-btn {
      width: 32px; height: 32px; border-radius: 50%;
      background: var(--nv-surface-raised); border: 1px solid var(--nv-border);
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--nv-text-muted); transition: all var(--nv-transition-fast);
    }
    .card-fav-btn:hover, .card-fav-btn.is-active {
      color: var(--nv-gold); border-color: var(--nv-gold); background: rgba(255, 179, 0, 0.12);
    }
    .card-fav-btn svg { width: 16px; height: 16px; fill: none; stroke: currentColor; }
    .card-fav-btn.is-active svg { fill: var(--nv-gold); }

    .result-title {
      font-size: 1.2rem;
      font-weight: 700;
      line-height: 1.3;
      color: var(--nv-text-primary);
    }
    .result-title a { color: inherit; }
    .result-title a:hover { color: var(--nv-cyan); }

    .result-subtitle {
      font-family: var(--nv-font-mono);
      font-size: 0.75rem;
      color: var(--nv-text-muted);
      margin-top: 4px;
    }
    .result-summary {
      font-size: 0.88rem;
      color: var(--nv-text-secondary);
      line-height: 1.6;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .search-highlight {
      background: rgba(0, 229, 255, 0.2);
      color: var(--nv-cyan);
      font-weight: 700;
      padding: 1px 4px;
      border-radius: 2px;
    }

    .result-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding-top: 14px;
      border-top: 1px solid var(--nv-border);
      font-family: var(--nv-font-mono);
      font-size: 0.75rem;
    }
    .result-explore-btn {
      color: var(--nv-cyan);
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .result-explore-btn:hover { color: #fff; }

    /* Empty State */
    .search-empty-state {
      text-align: center;
      padding: 64px 24px;
      background: var(--nv-surface);
      border: 1px dashed var(--nv-border-strong);
      border-radius: var(--nv-radius-md);
      margin-bottom: 64px;
      display: none;
    }
    .search-empty-state.is-visible { display: block; }
    .empty-title { font-size: 1.3rem; font-weight: 700; margin-bottom: 8px; color: var(--nv-text-primary); }
    .empty-desc { max-width: 540px; margin: 0 auto 24px; font-size: 0.95rem; color: var(--nv-text-secondary); }

    /* Suggested exploration chips */
    .suggested-chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: center;
      max-width: 700px;
      margin: 16px auto 0;
    }
    .suggested-chip {
      padding: 6px 14px;
      border-radius: 999px;
      background: var(--nv-surface-raised);
      border: 1px solid var(--nv-border);
      font-family: var(--nv-font-mono);
      font-size: 0.75rem;
      color: var(--nv-text-secondary);
      cursor: pointer;
      transition: all var(--nv-transition-fast);
    }
    .suggested-chip:hover {
      border-color: var(--nv-cyan);
      color: var(--nv-cyan);
      background: rgba(0, 229, 255, 0.08);
    }

    /* Footer */
    .site-footer {
      border-top: 1px solid var(--nv-border);
      background: var(--nv-bg-alt);
      padding: 56px 0 32px;
      font-size: 0.85rem;
      color: var(--nv-text-muted);
      margin-top: auto;
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
  </style>
</head>
<body>
  <a href="#main-content" class="skip-link">Skip to search content</a>
  <div class="bg-grid-overlay" aria-hidden="true"></div>

  <!-- Header -->
  <header class="site-header" id="site-header">
    <div class="container">
      <div class="header-inner">
        <div class="brand-group">
          <a href="/" class="brand-logo-wrap" aria-label="NostalgicVerse Homepage">
            <span class="brand-mark" aria-hidden="true">NV</span>
            <span class="brand-text">NostalgicVerse</span>
          </a>
        </div>

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
          <a href="/search/" class="header-action-btn active" aria-label="Search the Archive" aria-current="page">
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
      <div class="brand-logo-wrap">
        <span class="brand-mark" aria-hidden="true">NV</span>
        <span class="brand-text">NostalgicVerse</span>
      </div>
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
      <a href="/random/" class="drawer-nav-link"><span>Random Discovery</span> <span class="nav-num">/RND</span></a>
    </nav>
    <div class="drawer-footer">
      <p>CENTRAL DISCOVERY // VER 2026.1</p>
      <p style="margin-top: 6px;">Query the complete permanent museum repository.</p>
    </div>
  </aside>

  <!-- Main Content -->
  <main id="main-content">
    <div class="container">
      <nav class="breadcrumbs" aria-label="Breadcrumb">
        <a href="/">Home</a>
        <span aria-hidden="true">/</span>
        <span class="current" aria-current="page">Search</span>
      </nav>

      <!-- Hero -->
      <section class="search-hero" aria-labelledby="search-heading">
        <div class="search-hero-eyebrow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          <span>CENTRAL ARCHIVAL DISCOVERY ENGINE</span>
        </div>
        <h1 class="search-hero-title" id="search-heading">SEARCH THE ARCHIVE</h1>
        <p class="search-hero-desc">
          Query across all 6 permanent museum collections: landmark video games, console hardware generations, chronology milestones, genre mechanics, preservation guides, and historical monographs.
        </p>

        <!-- Search Console Card -->
        <div class="search-console-card">
          <div class="search-input-wrap">
            <svg class="search-big-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input 
              type="search" 
              id="global-search-input" 
              class="search-input-field" 
              placeholder="Search by title, hardware, manufacturer, era, genre, mechanic, or keyword..."
              autocomplete="off"
              spellcheck="false"
              aria-label="Search all archival collections"
              autofocus
            >
            <div class="search-controls-right">
              <span class="kbd-hint" aria-hidden="true">/</span>
              <button type="button" class="clear-search-btn" id="clear-search-btn" aria-label="Clear search query">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>

          <!-- Type Filter Pills -->
          <div class="filter-pills-row" role="tablist" aria-label="Filter results by collection type">
            <button type="button" class="pill-btn active" data-type="all" role="tab" aria-selected="true">
              <span>All Collections</span>
              <span class="pill-count" id="count-all">0</span>
            </button>
            <button type="button" class="pill-btn" data-type="game" role="tab" aria-selected="false">
              <span>Games</span>
              <span class="pill-count" id="count-game">0</span>
            </button>
            <button type="button" class="pill-btn" data-type="console" role="tab" aria-selected="false">
              <span>Consoles</span>
              <span class="pill-count" id="count-console">0</span>
            </button>
            <button type="button" class="pill-btn" data-type="timeline" role="tab" aria-selected="false">
              <span>Timeline</span>
              <span class="pill-count" id="count-timeline">0</span>
            </button>
            <button type="button" class="pill-btn" data-type="genre" role="tab" aria-selected="false">
              <span>Genres</span>
              <span class="pill-count" id="count-genre">0</span>
            </button>
            <button type="button" class="pill-btn" data-type="guide" role="tab" aria-selected="false">
              <span>Guides</span>
              <span class="pill-count" id="count-guide">0</span>
            </button>
            <button type="button" class="pill-btn" data-type="story" role="tab" aria-selected="false">
              <span>Stories</span>
              <span class="pill-count" id="count-story">0</span>
            </button>
          </div>
        </div>
      </section>

      <!-- Search Meta Bar -->
      <div class="search-meta-bar">
        <div>
          <span>QUERY STATUS: </span>
          <span class="search-status-text" id="search-status-text">INITIALIZING REPOSITORY...</span>
        </div>
        <div>
          <span>MATCH ENGINE: LOCAL HISTORICAL SILICON (ZERO RUNTIME AI)</span>
        </div>
      </div>

      <!-- Results Grid -->
      <div class="search-results-grid" id="search-results-grid" role="region" aria-live="polite" aria-label="Search results catalogue">
        <!-- Cards rendered dynamically via safe DOM APIs -->
      </div>

      <!-- Empty State -->
      <div class="search-empty-state" id="search-empty-state">
        <h2 class="empty-title" id="empty-state-title">No Archival Records Found</h2>
        <p class="empty-desc" id="empty-state-desc">
          No entries matched your search query across our collections. Try exploring one of our suggested historical discovery terms below:
        </p>
        <div class="suggested-chips-wrap">
          <button type="button" class="suggested-chip" data-query="Pac-Man">Pac-Man</button>
          <button type="button" class="suggested-chip" data-query="PlayStation">PlayStation</button>
          <button type="button" class="suggested-chip" data-query="Super Mario">Super Mario</button>
          <button type="button" class="suggested-chip" data-query="16-Bit">16-Bit Era</button>
          <button type="button" class="suggested-chip" data-query="CRT">CRT Displays</button>
          <button type="button" class="suggested-chip" data-query="Sega">Sega</button>
          <button type="button" class="suggested-chip" data-query="Emulation">Emulation</button>
          <button type="button" class="suggested-chip" data-query="Survival Horror">Survival Horror</button>
          <button type="button" class="suggested-chip" data-query="Doom">Doom</button>
          <button type="button" class="suggested-chip" data-query="1985">1985</button>
          <button type="button" class="suggested-chip" data-query="RISC">RISC Architecture</button>
        </div>
      </div>
    </div>
  </main>

  <!-- Footer -->
  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-col">
          <h3>The Museum</h3>
          <ul>
            <li><a href="/about/">About NostalgicVerse</a></li>
            <li><a href="/timeline/">Historical Timeline</a></li>
            <li><a href="/genres/">Genre Taxonomy</a></li>
            <li><a href="/support/">Support the Archive</a></li>
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
         01. MASTER CANONICAL SEARCH INDEX
         ========================================================================== */
      const SEARCH_INDEX = ${JSON.stringify(searchIndex)};

      /* ==========================================================================
         02. FAVORITES MANAGEMENT SYSTEM
         ========================================================================== */
      const FAV_STORAGE_KEY = 'nostalgicverse_favs';

      function getStoredFavorites() {
        try {
          const raw = localStorage.getItem(FAV_STORAGE_KEY);
          if (!raw) return [];
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          console.warn('LocalStorage inaccessible', e);
          return [];
        }
      }

      function toggleFavoriteItem(item) {
        try {
          let favs = getStoredFavorites();
          const exists = favs.some(f => f.id === item.id);
          if (exists) {
            favs = favs.filter(f => f.id !== item.id);
          } else {
            favs.push({
              id: item.id,
              type: item.type,
              title: item.title,
              url: item.url,
              category: item.category
            });
          }
          localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify(favs));
          updateFavoriteButtons();
          updateFavoritesHeaderBadge();
        } catch (e) {
          console.warn('Failed to toggle favorite', e);
        }
      }

      function updateFavoriteButtons() {
        const buttons = document.querySelectorAll('[data-fav-id]');
        const favs = getStoredFavorites();
        buttons.forEach(btn => {
          const id = btn.getAttribute('data-fav-id');
          const isFav = favs.some(f => f.id === id);
          if (isFav) {
            btn.classList.add('is-active');
            btn.setAttribute('aria-label', 'Remove from favorites');
          } else {
            btn.classList.remove('is-active');
            btn.setAttribute('aria-label', 'Add to favorites');
          }
        });
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

      window.addEventListener('storage', function (e) {
        if (e.key === FAV_STORAGE_KEY) {
          updateFavoriteButtons();
          updateFavoritesHeaderBadge();
        }
      });

      /* ==========================================================================
         03. DOM FACTORY & HIGHLIGHTING
         ========================================================================== */
      function escapeRegex(string) {
        return string.replace(/[.*+?^$\\{}()|[\\]\\\\]/g, '\\\\$&');
      }

      function createHighlightedText(text, queryTokens) {
        const container = document.createElement('span');
        if (!queryTokens || queryTokens.length === 0 || !text) {
          container.textContent = text || '';
          return container;
        }

        const validTokens = queryTokens.filter(t => t.length > 1);
        if (validTokens.length === 0) {
          container.textContent = text;
          return container;
        }

        const regex = new RegExp('(' + validTokens.map(escapeRegex).join('|') + ')', 'gi');
        const parts = text.split(regex);

        parts.forEach(part => {
          if (validTokens.some(t => t.toLowerCase() === part.toLowerCase())) {
            const mark = document.createElement('mark');
            mark.className = 'search-highlight';
            mark.textContent = part;
            container.appendChild(mark);
          } else {
            container.appendChild(document.createTextNode(part));
          }
        });

        return container;
      }

      function createResultCard(item, queryTokens) {
        const card = document.createElement('article');
        card.className = 'result-card';

        // Header Row
        const headerRow = document.createElement('div');
        headerRow.className = 'card-header-row';

        const badgeWrap = document.createElement('div');
        badgeWrap.style.display = 'flex';
        badgeWrap.style.alignItems = 'center';
        badgeWrap.style.gap = '8px';

        const typeBadge = document.createElement('span');
        typeBadge.className = 'type-badge type-' + item.type;
        typeBadge.textContent = item.typeName.toUpperCase();

        const yearSpan = document.createElement('span');
        yearSpan.className = 'result-year';
        yearSpan.textContent = item.year ? String(item.year) : '';

        badgeWrap.appendChild(typeBadge);
        if (item.year) badgeWrap.appendChild(yearSpan);

        // Fav Button
        const favBtn = document.createElement('button');
        favBtn.type = 'button';
        favBtn.className = 'card-fav-btn';
        favBtn.setAttribute('data-fav-id', item.id);
        favBtn.setAttribute('data-fav-title', item.title);
        favBtn.setAttribute('data-fav-url', item.url);
        favBtn.setAttribute('aria-label', 'Add ' + item.title + ' to favorites');

        const favSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        favSvg.setAttribute('viewBox', '0 0 24 24');
        favSvg.setAttribute('stroke-width', '2');
        favSvg.setAttribute('stroke-linecap', 'round');
        favSvg.setAttribute('stroke-linejoin', 'round');
        const favPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        favPath.setAttribute('d', 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z');
        favSvg.appendChild(favPath);
        favBtn.appendChild(favSvg);

        favBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          toggleFavoriteItem(item);
        });

        headerRow.appendChild(badgeWrap);
        headerRow.appendChild(favBtn);

        // Body Content
        const contentDiv = document.createElement('div');

        const titleHeading = document.createElement('h3');
        titleHeading.className = 'result-title';
        const titleLink = document.createElement('a');
        titleLink.href = item.url;
        titleLink.appendChild(createHighlightedText(item.title, queryTokens));
        titleHeading.appendChild(titleLink);

        const subtitle = document.createElement('div');
        subtitle.className = 'result-subtitle';
        subtitle.appendChild(createHighlightedText(item.subtitle, queryTokens));

        const summary = document.createElement('p');
        summary.className = 'result-summary';
        summary.style.marginTop = '10px';
        summary.appendChild(createHighlightedText(item.summary, queryTokens));

        contentDiv.appendChild(titleHeading);
        contentDiv.appendChild(subtitle);
        contentDiv.appendChild(summary);

        // Footer Action
        const footer = document.createElement('div');
        footer.className = 'result-footer';

        const categoryTag = document.createElement('span');
        categoryTag.textContent = item.category ? item.category.toUpperCase() : '';
        categoryTag.style.color = 'var(--nv-text-muted)';

        const exploreLink = document.createElement('a');
        exploreLink.className = 'result-explore-btn';
        exploreLink.href = item.url;
        exploreLink.textContent = 'Explore Exhibit →';

        footer.appendChild(categoryTag);
        footer.appendChild(exploreLink);

        card.appendChild(headerRow);
        card.appendChild(contentDiv);
        card.appendChild(footer);

        return card;
      }

      /* ==========================================================================
         04. SEARCH ENGINE & URL SYNC
         ========================================================================== */
      const searchInput = document.getElementById('global-search-input');
      const clearBtn = document.getElementById('clear-search-btn');
      const resultsGrid = document.getElementById('search-results-grid');
      const emptyState = document.getElementById('search-empty-state');
      const statusText = document.getElementById('search-status-text');
      const pillButtons = document.querySelectorAll('.pill-btn');

      let activeType = 'all';

      function getQueryTokens(rawQuery) {
        return rawQuery.toLowerCase().trim().split(/\\s+/).filter(t => t.length > 0);
      }

      function executeSearch() {
        const rawQuery = (searchInput.value || '').trim();
        const tokens = getQueryTokens(rawQuery);

        // Toggle clear button
        if (rawQuery.length > 0) {
          clearBtn.classList.add('is-visible');
        } else {
          clearBtn.classList.remove('is-visible');
        }

        // Update URL canonical query parameter
        try {
          const currentUrl = new URL(window.location);
          if (rawQuery.length > 0) {
            currentUrl.searchParams.set('q', rawQuery);
          } else {
            currentUrl.searchParams.delete('q');
          }
          window.history.replaceState(null, '', currentUrl.toString());
        } catch (e) {
          // Ignored in non-browser environments
        }

        // Filter by text match
        let matched = SEARCH_INDEX.filter(item => {
          if (tokens.length === 0) return true; // Show all when query empty
          const haystack = (
            item.title + ' ' +
            item.subtitle + ' ' +
            item.category + ' ' +
            (item.year || '') + ' ' +
            item.summary + ' ' +
            (item.keywords ? item.keywords.join(' ') : '')
          ).toLowerCase();

          return tokens.every(token => haystack.includes(token));
        });

        // Compute counts per type
        const counts = { all: matched.length, game: 0, console: 0, timeline: 0, genre: 0, guide: 0, story: 0 };
        matched.forEach(item => {
          if (counts[item.type] !== undefined) counts[item.type]++;
        });

        // Update Pill Counts
        document.getElementById('count-all').textContent = counts.all;
        document.getElementById('count-game').textContent = counts.game;
        document.getElementById('count-console').textContent = counts.console;
        document.getElementById('count-timeline').textContent = counts.timeline;
        document.getElementById('count-genre').textContent = counts.genre;
        document.getElementById('count-guide').textContent = counts.guide;
        document.getElementById('count-story').textContent = counts.story;

        // Filter by selected pill type
        let filtered = matched;
        if (activeType !== 'all') {
          filtered = matched.filter(item => item.type === activeType);
        }

        // Render Results
        resultsGrid.textContent = '';
        if (filtered.length === 0) {
          emptyState.classList.add('is-visible');
          statusText.textContent = rawQuery.length > 0 
            ? 'NO RECORDS FOUND FOR "' + rawQuery.toUpperCase() + '"'
            : 'NO EXHIBITS FOUND IN THIS CATEGORY';
        } else {
          emptyState.classList.remove('is-visible');
          statusText.textContent = rawQuery.length > 0
            ? 'SHOWING ' + filtered.length + ' MATCHES FOR "' + rawQuery.toUpperCase() + '"'
            : 'BROWSING ALL ' + filtered.length + ' ARCHIVAL EXHIBITS';

          const frag = document.createDocumentFragment();
          filtered.forEach(item => {
            frag.appendChild(createResultCard(item, tokens));
          });
          resultsGrid.appendChild(frag);
        }

        updateFavoriteButtons();
      }

      // Pill Click Handlers
      pillButtons.forEach(btn => {
        btn.addEventListener('click', function () {
          pillButtons.forEach(b => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
          });
          btn.classList.add('active');
          btn.setAttribute('aria-selected', 'true');
          activeType = btn.getAttribute('data-type');
          executeSearch();
        });
      });

      // Clear button
      if (clearBtn) {
        clearBtn.addEventListener('click', function () {
          searchInput.value = '';
          clearBtn.classList.remove('is-visible');
          executeSearch();
          searchInput.focus();
        });
      }

      // Search input handler
      if (searchInput) {
        searchInput.addEventListener('input', executeSearch);
      }

      // Keyboard Shortcut [/] to focus search
      document.addEventListener('keydown', function (e) {
        if (e.key === '/' && document.activeElement !== searchInput) {
          const tag = document.activeElement ? document.activeElement.tagName : '';
          if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
            e.preventDefault();
            searchInput.focus();
            searchInput.select();
          }
        }
      });

      // Suggested Chips Click Handlers
      document.querySelectorAll('.suggested-chip').forEach(chip => {
        chip.addEventListener('click', function () {
          const q = chip.getAttribute('data-query');
          searchInput.value = q;
          executeSearch();
          searchInput.focus();
        });
      });

      /* ==========================================================================
         05. MOBILE NAVIGATION DRAWER
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
         06. INITIALIZATION & URL QUERY HYDRATION
         ========================================================================== */
      window.addEventListener('DOMContentLoaded', function () {
        // Read URL query parameter if present
        try {
          const params = new URLSearchParams(window.location.search);
          const q = params.get('q');
          if (q) {
            searchInput.value = q;
          }
        } catch (e) {
          console.warn('URLSearchParams error', e);
        }

        executeSearch();
        updateFavoritesHeaderBadge();
      });

    })();
  </script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, 'search/index.html'), template, 'utf8');
console.log('Search page created successfully at search/index.html');

