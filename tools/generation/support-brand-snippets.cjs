/**
 * NostalgicVerse — Shared Support & Branding Components
 * Authoritative HTML, CSS, and JS snippets for global branding and support experiences.
 */

const LOGO_SVG_PATH = '/assets/images/branding/logo/logo.svg';
const QR_CODE_PATH = '/assets/images/qr-code/qr-code.png';

const BRANDING_CSS = `
    /* Global Official Logo Styles */
    .site-logo-img {
      height: 36px;
      width: auto;
      max-width: 190px;
      display: block;
    }
    .drawer-logo-img {
      height: 32px;
      max-width: 160px;
    }
    .footer-logo-img {
      height: 40px;
      max-width: 200px;
      margin-bottom: 12px;
    }
    @media (max-width: 768px) {
      .site-logo-img {
        height: 30px;
        max-width: 150px;
      }
    }

    /* Global Archive Support Section */
    .archive-support-section {
      padding: 48px 0;
      border-top: 1px solid var(--nv-border, #1E1E2C);
      background: var(--nv-bg-alt, #0C0C11);
      position: relative;
      z-index: 1;
    }
    .support-panel {
      display: flex;
      flex-direction: column;
      gap: 32px;
      background: var(--nv-surface, #111118);
      border: 1px solid var(--nv-border, #1E1E2C);
      border-radius: var(--nv-radius-lg, 12px);
      padding: clamp(24px, 4vw, 40px);
      align-items: center;
    }
    @media (min-width: 768px) {
      .support-panel {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }
      .support-content {
        max-width: 65%;
      }
    }
    .archive-support-section .catalog-tag {
      display: inline-block;
      font-family: var(--nv-font-mono, monospace);
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: var(--nv-radius-sm, 4px);
    }
    .archive-support-section .tag-gold,
    .support-modal .tag-gold {
      color: var(--nv-gold, #FFB300);
      background: rgba(255, 179, 0, 0.1);
      border: 1px solid rgba(255, 179, 0, 0.25);
    }
    .support-title {
      font-size: clamp(1.4rem, 2.5vw, 1.85rem);
      font-weight: 800;
      color: var(--nv-text-primary, #F4F4F7);
      margin: 10px 0 12px;
      letter-spacing: -0.02em;
    }
    .support-desc {
      font-size: 0.95rem;
      color: var(--nv-text-secondary, #A7A7B5);
      line-height: 1.65;
      margin-bottom: 8px;
    }
    .support-subdesc {
      font-size: 0.85rem;
      color: var(--nv-text-muted, #737381);
      line-height: 1.5;
      margin-bottom: 20px;
    }
    .support-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .archive-support-section .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 24px;
      border-radius: var(--nv-radius-sm, 4px);
      font-size: 0.875rem;
      font-weight: 600;
      text-decoration: none;
      transition: all var(--nv-transition-fast, 160ms ease);
      cursor: pointer;
    }
    .archive-support-section .btn-secondary {
      background: var(--nv-surface-raised, #15151D);
      color: var(--nv-text-primary, #F4F4F7);
      border: 1px solid var(--nv-border-strong, #2A2A38);
    }
    .archive-support-section .btn-secondary:hover {
      border-color: var(--nv-cyan, #00E5FF);
      color: var(--nv-cyan, #00E5FF);
    }
    .support-qr-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      flex-shrink: 0;
    }
    .support-qr-quiet-zone {
      background: #FFFFFF;
      padding: 14px;
      border-radius: var(--nv-radius-md, 8px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    .support-qr-image {
      width: clamp(160px, 20vw, 200px);
      height: auto;
      aspect-ratio: 1440 / 1472;
      display: block;
      object-fit: contain;
    }
    .support-qr-caption {
      font-size: 0.8rem;
      font-family: var(--nv-font-mono, monospace);
      color: var(--nv-text-muted, #737381);
      margin-top: 10px;
    }

    /* Support Modal Backdrop & Dialog */
    .support-modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      z-index: 9998;
    }
    .support-modal {
      position: fixed;
      inset: 0;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      overflow-y: auto;
    }
    .support-modal-dialog {
      background: var(--nv-surface, #111118);
      border: 1px solid var(--nv-border-strong, #2A2A38);
      border-radius: var(--nv-radius-lg, 12px);
      padding: clamp(20px, 3.5vw, 32px);
      max-width: 440px;
      width: 100%;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.8);
      position: relative;
    }
    .support-modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .support-modal .tag-gold {
      display: inline-block;
      font-family: var(--nv-font-mono, monospace);
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      padding: 4px 10px;
      border-radius: var(--nv-radius-sm, 4px);
    }
    .support-modal-close {
      color: var(--nv-text-muted, #737381);
      background: none;
      border: none;
      cursor: pointer;
      padding: 6px;
      border-radius: var(--nv-radius-sm, 4px);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: color var(--nv-transition-fast, 160ms ease);
    }
    .support-modal-close:hover {
      color: var(--nv-text-primary, #F4F4F7);
      background: var(--nv-surface-raised, #15151D);
    }
    .support-modal-title {
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--nv-text-primary, #F4F4F7);
      letter-spacing: -0.01em;
      margin-bottom: 4px;
    }
    .support-modal-subtitle {
      font-size: 0.95rem;
      color: var(--nv-cyan, #00E5FF);
      font-weight: 600;
      margin-bottom: 8px;
    }
    .support-modal-desc {
      font-size: 0.875rem;
      color: var(--nv-text-secondary, #A7A7B5);
      line-height: 1.6;
      margin-bottom: 16px;
    }
    .support-modal-qr-wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin: 16px 0;
    }
    .support-modal-qr {
      width: 160px;
      height: auto;
      aspect-ratio: 1440 / 1472;
      display: block;
      object-fit: contain;
    }
    .support-modal-qr-text {
      font-size: 0.825rem;
      font-weight: 600;
      color: var(--nv-text-primary, #F4F4F7);
      margin-top: 10px;
    }
    .support-modal-actions {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }
    .support-modal-btn {
      flex: 1;
      text-align: center;
      padding: 10px 14px;
      font-size: 0.85rem;
      border-radius: var(--nv-radius-sm, 4px);
      font-family: var(--nv-font-sans, system-ui);
      font-weight: 600;
      cursor: pointer;
      transition: all var(--nv-transition-fast, 160ms ease);
    }
    .support-modal .btn-primary {
      background: var(--nv-cyan, #00E5FF);
      color: #000;
      border: 1px solid var(--nv-cyan, #00E5FF);
    }
    .support-modal .btn-primary:hover {
      background: #33ebff;
    }
    .support-modal .btn-secondary {
      background: var(--nv-surface-raised, #15151D);
      color: var(--nv-text-primary, #F4F4F7);
      border: 1px solid var(--nv-border-strong, #2A2A38);
    }
    .support-modal .btn-secondary:hover {
      border-color: var(--nv-cyan, #00E5FF);
      color: var(--nv-cyan, #00E5FF);
    }
    body.support-modal-open {
      overflow: hidden;
    }
    @media (prefers-reduced-motion: reduce) {
      .support-modal-backdrop,
      .support-modal-dialog {
        transition: none !important;
        animation: none !important;
      }
    }
`;

const HEADER_LOGO_HTML = `        <div class="brand-group">
          <div class="account-control-wrap" id="account-control-wrap">
            <button class="account-toggle-btn" id="account-toggle-btn" aria-expanded="false" aria-controls="account-dropdown-menu" aria-label="Account Menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
            <div class="account-dropdown-menu" id="account-dropdown-menu" role="menu" hidden>
              <div class="account-dropdown-header">
                <span class="account-dropdown-title">ACCOUNT</span>
              </div>
              <a href="/account/" class="account-dropdown-item" role="menuitem">Account</a>
              <a href="/login/" class="account-dropdown-item" role="menuitem">Log In</a>
              <a href="/signup/" class="account-dropdown-item" role="menuitem">Sign Up</a>
            </div>
          </div>
          <a href="/" class="brand-logo-wrap" aria-label="NostalgicVerse Homepage">
            <img src="${LOGO_SVG_PATH}" alt="NostalgicVerse" class="site-logo-img" width="180" height="36" loading="eager">
          </a>
        </div>`;

const DRAWER_LOGO_HTML = `      <div class="brand-group">
        <a href="/" class="brand-logo-wrap" aria-label="NostalgicVerse Homepage">
          <img src="${LOGO_SVG_PATH}" alt="NostalgicVerse" class="site-logo-img drawer-logo-img" width="160" height="32" loading="lazy">
        </a>
      </div>`;

const FOOTER_LOGO_HTML = `          <div class="brand-group">
            <a href="/" class="brand-logo-wrap" aria-label="NostalgicVerse Homepage">
              <img src="${LOGO_SVG_PATH}" alt="NostalgicVerse" class="site-logo-img footer-logo-img" width="200" height="40" loading="lazy">
            </a>
          </div>`;

const SUPPORT_SECTION_HTML = `
  <!-- ==========================================================================
       GLOBAL ARCHIVE SUPPORT SECTION
       ========================================================================== -->
  <section class="archive-support-section" id="archive-support" aria-labelledby="support-heading">
    <div class="container">
      <div class="support-panel">
        <div class="support-content">
          <span class="catalog-tag tag-gold">Preservation Initiative</span>
          <h2 class="support-title" id="support-heading">Support the Creator</h2>
          <p class="support-desc">
            Help me keep building NostalgicVerse and bringing more gaming history, hardware, stories and preservation resources to the archive.
          </p>
          <p class="support-subdesc">
            NostalgicVerse is an independent project created to preserve the games, machines, stories and memories that made gaming history. Thank you for supporting NostalgicVerse.
          </p>
          <div class="support-actions">
            <a href="/support/" class="btn btn-secondary">
              <span>Support the Creator</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </a>
          </div>
        </div>
        <div class="support-qr-card">
          <div class="support-qr-quiet-zone">
            <img src="${QR_CODE_PATH}" alt="QR code to support NostalgicVerse creator" class="support-qr-image" width="200" height="200" loading="lazy" decoding="async">
          </div>
          <p class="support-qr-caption">Scan to support NostalgicVerse</p>
        </div>
      </div>
    </div>
  </section>
`;

const SUPPORT_MODAL_HTML = `
  <!-- Support the Creator Global Modal -->
  <div class="support-modal-backdrop" id="support-modal-backdrop" aria-hidden="true" style="display: none;"></div>
  <div class="support-modal" id="support-modal" role="dialog" aria-modal="true" aria-labelledby="support-modal-title" aria-describedby="support-modal-desc" tabindex="-1" style="display: none;">
    <div class="support-modal-dialog">
      <div class="support-modal-header">
        <span class="catalog-tag tag-gold">Preservation Initiative</span>
        <button type="button" class="support-modal-close" id="support-modal-close-btn" aria-label="Close Support Dialog">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <h2 class="support-modal-title" id="support-modal-title">Support the Creator</h2>
      <p class="support-modal-subtitle">Enjoying NostalgicVerse?</p>
      <p class="support-modal-desc" id="support-modal-desc">
        I'm building this project to preserve the games, machines, stories and memories that shaped gaming history. Your support helps me keep expanding it.
      </p>
      <div class="support-modal-qr-wrap">
        <div class="support-qr-quiet-zone">
          <img src="${QR_CODE_PATH}" alt="QR code to support NostalgicVerse creator" class="support-modal-qr" width="180" height="180" loading="lazy" decoding="async">
        </div>
        <p class="support-modal-qr-text">Would you like to support NostalgicVerse?</p>
      </div>
      <div class="support-modal-actions">
        <button type="button" class="btn btn-primary support-modal-btn" id="support-btn-yes">Yes</button>
        <button type="button" class="btn btn-secondary support-modal-btn" id="support-btn-no">No</button>
        <button type="button" class="btn btn-secondary support-modal-btn" id="support-btn-later">Later</button>
      </div>
    </div>
  </div>

  <!-- Support Modal & Active-Time Tracking Script -->
  <script>
    (function() {
      'use strict';
      const STORAGE_KEY = 'nostalgicverse_support_prompt_state';
      const ACTIVE_TIME_KEY = 'nostalgicverse_active_time_ms';
      const TARGET_ACTIVE_MS = 120000;
      const INACTIVITY_TIMEOUT_MS = 30000;

      function safeGet(k) {
        try { return localStorage.getItem(k); } catch (e) { return null; }
      }
      function safeSet(k, v) {
        try { localStorage.setItem(k, v); } catch (e) {}
      }

      const currentState = safeGet(STORAGE_KEY);
      if (currentState === 'shown' || currentState === 'accepted' || currentState === 'declined' || currentState === 'later') {
        return;
      }

      const modal = document.getElementById('support-modal');
      const backdrop = document.getElementById('support-modal-backdrop');
      const btnYes = document.getElementById('support-btn-yes');
      const btnNo = document.getElementById('support-btn-no');
      const btnLater = document.getElementById('support-btn-later');
      const btnClose = document.getElementById('support-modal-close-btn');

      if (!modal || !backdrop) return;

      let lastActive = Date.now();
      let accumulatedMs = parseInt(safeGet(ACTIVE_TIME_KEY) || '0', 10);
      if (isNaN(accumulatedMs) || accumulatedMs < 0) accumulatedMs = 0;

      let previousFocusedElement = null;
      let isModalOpen = false;

      function onActivity() {
        lastActive = Date.now();
      }
      ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'].forEach(function(evt) {
        window.addEventListener(evt, onActivity, { passive: true });
      });

      window.addEventListener('storage', function(e) {
        if (e.key === STORAGE_KEY) {
          if (e.newValue === 'shown' || e.newValue === 'accepted' || e.newValue === 'declined' || e.newValue === 'later') {
            closeModal(false);
          }
        }
      });

      function openModal() {
        if (isModalOpen) return;
        const state = safeGet(STORAGE_KEY);
        if (state === 'shown' || state === 'accepted' || state === 'declined' || state === 'later') return;

        safeSet(STORAGE_KEY, 'shown');
        isModalOpen = true;
        previousFocusedElement = document.activeElement;

        backdrop.style.display = 'block';
        modal.style.display = 'flex';
        document.body.classList.add('support-modal-open');

        if (btnYes) btnYes.focus();
      }

      function closeModal(recordState, stateValue) {
        if (recordState && stateValue) {
          safeSet(STORAGE_KEY, stateValue);
        }
        isModalOpen = false;
        if (backdrop) backdrop.style.display = 'none';
        if (modal) modal.style.display = 'none';
        document.body.classList.remove('support-modal-open');

        if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
          try { previousFocusedElement.focus(); } catch (e) {}
        }
      }

      if (btnYes) {
        btnYes.addEventListener('click', function() {
          closeModal(true, 'accepted');
          window.location.href = '/support/';
        });
      }
      if (btnNo) {
        btnNo.addEventListener('click', function() {
          closeModal(true, 'declined');
        });
      }
      if (btnLater) {
        btnLater.addEventListener('click', function() {
          closeModal(true, 'later');
        });
      }
      if (btnClose) {
        btnClose.addEventListener('click', function() {
          closeModal(true, 'later');
        });
      }

      document.addEventListener('keydown', function(e) {
        if (!isModalOpen) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          closeModal(true, 'later');
          return;
        }
        if (e.key === 'Tab') {
          const focusables = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      });

      const interval = setInterval(function() {
        const state = safeGet(STORAGE_KEY);
        if (state === 'shown' || state === 'accepted' || state === 'declined' || state === 'later') {
          clearInterval(interval);
          return;
        }

        const now = Date.now();
        const idleTime = now - lastActive;
        const isDocumentVisible = document.visibilityState === 'visible';

        if (isDocumentVisible && idleTime < INACTIVITY_TIMEOUT_MS) {
          accumulatedMs += 1000;
          safeSet(ACTIVE_TIME_KEY, accumulatedMs.toString());
          if (accumulatedMs >= TARGET_ACTIVE_MS) {
            clearInterval(interval);
            openModal();
          }
        }
      }, 1000);
    })();
  </script>
`;

module.exports = {
  LOGO_SVG_PATH,
  QR_CODE_PATH,
  BRANDING_CSS,
  HEADER_LOGO_HTML,
  DRAWER_LOGO_HTML,
  FOOTER_LOGO_HTML,
  SUPPORT_SECTION_HTML,
  SUPPORT_MODAL_HTML
};

