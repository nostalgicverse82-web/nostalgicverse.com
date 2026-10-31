/**
 * NostalgicVerse — Batch Global Branding & Support Integrator for Static Pages
 */

const fs = require('fs');
const path = require('path');
const {
  BRANDING_CSS,
  HEADER_LOGO_HTML,
  DRAWER_LOGO_HTML,
  SUPPORT_SECTION_HTML,
  SUPPORT_MODAL_HTML
} = require('../generation/support-brand-snippets.cjs');

const ROOT = path.resolve(__dirname, '../../');

const STATIC_FILES = [
  'index.html',
  'download/index.html',
  'games/index.html',
  'consoles/index.html',
  'genres/index.html',
  'timeline/index.html',
  'guides/index.html',
  'blog/index.html',
  'favorites/index.html',
  'about/index.html',
  '404.html',
  'legal/privacy.html',
  'legal/terms.html',
  'legal/cookies.html',
  'legal/disclaimer.html'
];

const FOOTER_LOGO_COLUMN = `          <div class="brand-group" style="margin-bottom: 14px;">
            <a href="/" class="brand-logo-wrap" aria-label="NostalgicVerse Homepage">
              <img src="/assets/images/branding/logo/logo.svg" alt="NostalgicVerse" class="site-logo-img footer-logo-img" width="200" height="40" loading="lazy">
            </a>
          </div>`;

const FOOTER_LOGO_GRID = `      <div class="brand-group" style="margin-bottom: 24px;">
        <a href="/" class="brand-logo-wrap" aria-label="NostalgicVerse Homepage">
          <img src="/assets/images/branding/logo/logo.svg" alt="NostalgicVerse" class="site-logo-img footer-logo-img" width="200" height="40" loading="lazy">
        </a>
      </div>`;

function processFile(relPath) {
  const filePath = path.join(ROOT, relPath);
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', relPath);
    return false;
  }

  let html = fs.readFileSync(filePath, 'utf8');

  // 1. Inject BRANDING_CSS before </style> if not already present
  if (!html.includes('.archive-support-section')) {
    html = html.replace('</style>', `${BRANDING_CSS}\n  </style>`);
  }

  // 2. Replace Header Brand
  // Matches: <div class="brand-group">\s*<a href="/" class="brand-logo-wrap"[^>]*>[\s\S]*?<\/a>\s*<\/div>
  // OR <a href="/" class="brand-logo-wrap"[^>]*>\s*<span class="brand-mark"[^>]*>NV<\/span>\s*<span class="brand-text">NostalgicVerse<\/span>\s*<\/a>
  const headerBrandRegex1 = /<div class="brand-group">\s*<a href="\/" class="brand-logo-wrap"[^>]*>\s*<span class="brand-mark"[^>]*>NV<\/span>\s*<span class="brand-text">NostalgicVerse<\/span>\s*<\/a>\s*<\/div>/;
  const headerBrandRegex2 = /<a href="\/" class="brand-logo-wrap"[^>]*>\s*<span class="brand-mark"[^>]*>NV<\/span>\s*<span class="brand-text">NostalgicVerse<\/span>\s*<\/a>/;

  if (headerBrandRegex1.test(html)) {
    html = html.replace(headerBrandRegex1, HEADER_LOGO_HTML.trim());
  } else if (headerBrandRegex2.test(html)) {
    html = html.replace(headerBrandRegex2, HEADER_LOGO_HTML.trim());
  }

  // 3. Replace Drawer Brand (inside .drawer-top)
  const drawerBrandRegex1 = /<div class="drawer-top">\s*<div class="brand-group">\s*<span class="brand-mark"[^>]*>NV<\/span>\s*<span class="brand-text">NostalgicVerse<\/span>\s*<\/div>/;
  const drawerBrandRegex2 = /<div class="drawer-top">\s*<div class="brand-logo-wrap">\s*<span class="brand-mark"[^>]*>NV<\/span>\s*<span class="brand-text">NostalgicVerse<\/span>\s*<\/div>/;
  const drawerBrandRegex3 = /<div class="drawer-top">\s*<div class="brand-group">\s*<a href="\/" class="brand-logo-wrap"[^>]*>\s*<span class="brand-mark"[^>]*>NV<\/span>\s*<span class="brand-text">NostalgicVerse<\/span>\s*<\/a>\s*<\/div>/;

  if (drawerBrandRegex1.test(html)) {
    html = html.replace(drawerBrandRegex1, `<div class="drawer-top">\n${DRAWER_LOGO_HTML.trim()}`);
  } else if (drawerBrandRegex2.test(html)) {
    html = html.replace(drawerBrandRegex2, `<div class="drawer-top">\n${DRAWER_LOGO_HTML.trim()}`);
  } else if (drawerBrandRegex3.test(html)) {
    html = html.replace(drawerBrandRegex3, `<div class="drawer-top">\n${DRAWER_LOGO_HTML.trim()}`);
  }

  // 4. Inject or Update Support QR Section before <footer class="site-footer"> (except on support/index.html)
  if (relPath !== 'support/index.html') {
    if (!html.includes('id="archive-support"')) {
      html = html.replace(/\s*<footer class="site-footer">/, `\n${SUPPORT_SECTION_HTML}\n  <footer class="site-footer">`);
    } else {
      // Update existing support section to Support the Creator
      const supportSectionRegex = /<section class="archive-support-section" id="archive-support"[\s\S]*?<\/section>/;
      if (supportSectionRegex.test(html)) {
        html = html.replace(supportSectionRegex, SUPPORT_SECTION_HTML.trim());
      }
    }
  }

  // 5. Update Footer Brand
  // Case A: Has footer-brand-column
  const footerBrandColRegex = /<div class="footer-brand-column">\s*<div class="brand-group">\s*<span class="brand-mark"[^>]*>NV<\/span>\s*<span class="footer-logo">NostalgicVerse<\/span>\s*<\/div>/;
  if (footerBrandColRegex.test(html)) {
    html = html.replace(footerBrandColRegex, `<div class="footer-brand-column">\n${FOOTER_LOGO_COLUMN}`);
  }

  // Case B: Has footer-grid without existing footer logo
  if (html.includes('<div class="footer-grid">') && !html.includes('footer-logo-img')) {
    html = html.replace('<div class="footer-grid">', `${FOOTER_LOGO_GRID}\n      <div class="footer-grid">`);
  }

  // 6. Inject or Update Support Modal & Script before </body>
  if (!html.includes('id="support-modal"')) {
    html = html.replace('</body>', `${SUPPORT_MODAL_HTML}\n</body>`);
  } else {
    // Update existing modal block to Support the Creator
    const modalRegex = /<!-- Support the (Archive|Creator) Global Modal -->[\s\S]*?<\/script>/;
    if (modalRegex.test(html)) {
      html = html.replace(modalRegex, SUPPORT_MODAL_HTML.trim());
    } else {
      const modalRegex2 = /<div class="support-modal-backdrop" id="support-modal-backdrop"[\s\S]*?<\/script>/;
      if (modalRegex2.test(html)) {
        html = html.replace(modalRegex2, SUPPORT_MODAL_HTML.trim());
      }
    }
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  [OK] Updated ${relPath} (${html.length} bytes)`);
  return true;
}

console.log('Applying global branding and support system to static pages...');
let successCount = 0;
for (const f of STATIC_FILES) {
  if (process.processFile ? process.processFile(f) : processFile(f)) {
    successCount++;
  }
}
console.log(`\nSuccessfully updated ${successCount} of ${STATIC_FILES.length} static pages.`);

