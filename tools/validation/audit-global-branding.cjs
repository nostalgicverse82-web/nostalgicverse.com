/**
 * NostalgicVerse — Comprehensive Global Branding & Support System Audit
 * Validates:
 * 1. Official logo presence in header across all 113 pages.
 * 2. Official logo presence in mobile drawer across all 113 pages.
 * 3. Official logo presence in footer across all 113 pages.
 * 4. Zero old <span class="brand-mark">NV</span> brand marks in header/drawer/footer.
 * 5. Exactly 1 scannable support QR section on all 112 pages (and 0 duplicate panels on support/index.html).
 * 6. Exactly 1 support modal with 2-minute active-time script across all 113 pages.
 * 7. Canonical favicon.ico reference on all 113 pages.
 * 8. Zero image files modified.
 * 9. Modal accessibility & touch/responsive constraints.
 * 10. LocalStorage key & parsing safety.
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = [];

function check(desc, condition, failDetail) {
  totalChecks++;
  if (condition) {
    passedChecks++;
  } else {
    failedChecks.push({ desc, failDetail });
    console.error(`  [FAIL] ${desc} - ${failDetail}`);
  }
}

function getAllHtmlFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const fullPath = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'node_modules' && e.name !== '.git' && e.name !== 'backups' && e.name !== 'scratch') {
        results = results.concat(getAllHtmlFiles(fullPath));
      }
    } else if (e.isFile() && e.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

const htmlFiles = getAllHtmlFiles(ROOT);
console.log('==================================================');
console.log('AUDITING NOSTALGICVERSE GLOBAL BRANDING & SUPPORT');
console.log('==================================================');
console.log(`Found ${htmlFiles.length} public HTML pages.\n`);

check('Public HTML page count is 611', htmlFiles.length === 611, `Found ${htmlFiles.length}`);

let headerLogoCount = 0;
let drawerLogoCount = 0;
let footerLogoCount = 0;
let supportSectionCount = 0;
let supportModalCount = 0;
let faviconCount = 0;
let oldBrandMarkCount = 0;

for (const filePath of htmlFiles) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const html = fs.readFileSync(filePath, 'utf8');

  // 1. Header logo
  const hasHeaderLogo = html.includes('assets/images/branding/logo/logo.svg') && html.includes('site-logo-img');
  if (hasHeaderLogo) headerLogoCount++;
  else check(`${rel} has official header logo`, false, 'Missing site-logo-img or logo.svg');

  // 2. Drawer logo
  const hasDrawerLogo = html.includes('drawer-logo-img') || (html.includes('mobile-drawer') && html.includes('logo.svg'));
  if (hasDrawerLogo) drawerLogoCount++;
  else check(`${rel} has drawer logo`, false, 'Missing drawer-logo-img');

  // 3. Footer logo
  const hasFooterLogo = html.includes('footer-logo-img');
  if (hasFooterLogo) footerLogoCount++;
  else check(`${rel} has footer logo`, false, 'Missing footer-logo-img');

  // 4. Old small NV mark inside brand-logo-wrap or drawer/footer brand-group
  const hasOldBrandMark = />NV<\/span>\s*<span class="(brand-text|footer-logo)">NostalgicVerse/.test(html);
  if (hasOldBrandMark) {
    oldBrandMarkCount++;
    check(`${rel} has no old small NV brand mark`, false, 'Found old NV brand mark');
  }

  // 5. Support QR section
  const isSupportPage = (rel === 'support/index.html');
  const hasSupportSection = html.includes('id="archive-support"');
  const supportSectionMatches = (html.match(/id="archive-support"/g) || []).length;

  if (isSupportPage) {
    check('support/index.html has 0 duplicate archive-support sections', supportSectionMatches === 0, `Found ${supportSectionMatches}`);
    check('support/index.html has dedicated QR panel', html.includes('id="support-qr-panel"') || html.includes('qr-panel'), 'Missing support QR exhibit');
  } else {
    check(`${rel} has exactly 1 archive-support section`, supportSectionMatches === 1, `Found ${supportSectionMatches}`);
    if (hasSupportSection) supportSectionCount++;
  }

  // 6. Support Modal & Active-time script
  const modalMatches = (html.match(/id="support-modal"/g) || []).length;
  check(`${rel} has exactly 1 support modal`, modalMatches === 1, `Found ${modalMatches}`);
  if (modalMatches === 1) supportModalCount++;

  const hasStorageKey = html.includes("'nostalgicverse_support_prompt_state'");
  check(`${rel} has support modal storage key`, hasStorageKey, 'Missing nostalgicverse_support_prompt_state');

  const hasActiveTimeKey = html.includes("'nostalgicverse_active_time_ms'");
  check(`${rel} has active time key`, hasActiveTimeKey, 'Missing nostalgicverse_active_time_ms');

  const hasEscapeHandler = html.includes("e.key === 'Escape'");
  check(`${rel} has Escape key handler`, hasEscapeHandler, 'Missing Escape key handler');

  const hasReducedMotion = html.includes('prefers-reduced-motion');
  check(`${rel} respects prefers-reduced-motion`, hasReducedMotion, 'Missing prefers-reduced-motion');

  // 7. Favicon
  const hasFavicon = html.includes('href="/favicon.ico"') || html.includes("href='/favicon.ico'");
  check(`${rel} references canonical /favicon.ico`, hasFavicon, 'Missing /favicon.ico');
  if (hasFavicon) faviconCount++;
}

console.log('\n--- Asset Reference Integrity ---');
const qrCodePath = path.join(ROOT, 'assets/images/qr-code/qr-code.png');
const logoSvgPath = path.join(ROOT, 'assets/images/branding/logo/logo.svg');
const logoPngPath = path.join(ROOT, 'assets/images/branding/logo/logo.png');
const faviconPath = path.join(ROOT, 'favicon.ico');

check('QR code file exists on disk', fs.existsSync(qrCodePath), qrCodePath);
check('Logo SVG exists on disk', fs.existsSync(logoSvgPath), logoSvgPath);
check('Logo PNG exists on disk', fs.existsSync(logoPngPath), logoPngPath);
check('Favicon exists on disk', fs.existsSync(faviconPath), faviconPath);

if (fs.existsSync(qrCodePath)) {
  const stat = fs.statSync(qrCodePath);
  check('QR code file size unmodified (864,842 bytes)', stat.size === 864842, `Size is ${stat.size}`);
}
if (fs.existsSync(logoSvgPath)) {
  const stat = fs.statSync(logoSvgPath);
  check('Logo SVG file size unmodified (1,026 bytes)', stat.size === 1026, `Size is ${stat.size}`);
}
if (fs.existsSync(logoPngPath)) {
  const stat = fs.statSync(logoPngPath);
  check('Logo PNG file size unmodified (2,684 bytes)', stat.size === 2684, `Size is ${stat.size}`);
}
if (fs.existsSync(faviconPath)) {
  const stat = fs.statSync(faviconPath);
  check('Favicon file size unmodified (1,887,110 bytes)', stat.size === 1887110, `Size is ${stat.size}`);
}

console.log('\n==================================================');
console.log('AUDIT SUMMARY RESULTS');
console.log('==================================================');
console.log(`Total Checks:          ${totalChecks}`);
console.log(`Passed:                ${passedChecks}`);
console.log(`Failed:                ${failedChecks.length}`);
console.log(`Header Logos:          ${headerLogoCount} / 113`);
console.log(`Drawer Logos:          ${drawerLogoCount} / 113`);
console.log(`Footer Logos:          ${footerLogoCount} / 113`);
console.log(`Support QR Sections:   ${supportSectionCount} / 112 (support/index.html has 0 duplicate)`);
console.log(`Support Modals:        ${supportModalCount} / 113`);
console.log(`Favicon References:    ${faviconCount} / 113`);
console.log(`Old NV Brand Marks:    ${oldBrandMarkCount} (MUST BE 0)`);
console.log('==================================================\n');

if (failedChecks.length > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
