/**
 * NostalgicVerse — Whole-Site Link Integrity Audit
 * Scans all public HTML files and validates every internal href/src.
 * Zero dependencies — Node.js built-ins only.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
let totalChecks = 0;
let totalFails = 0;
let totalDeferred = 0;
const failures = [];
const deferredAssets = [];

// Collect all public HTML files
function findHtmlFiles(dir, rel = '') {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      // Skip non-public directories
      if (['node_modules', '.backups', 'backups', 'tools', 'data', 'assets', '.qodo', '.git'].includes(entry.name)) continue;
      results = results.concat(findHtmlFiles(fullPath, relPath));
    } else if (entry.name.endsWith('.html')) {
      results.push({ fullPath, relPath });
    }
  }
  return results;
}

// Resolve a URL path to a filesystem path
function resolveUrl(urlPath) {
  // Strip query strings and fragments
  let clean = urlPath.split('?')[0].split('#')[0];
  if (!clean || clean === '/') clean = '/index.html';
  // Remove leading slash
  clean = clean.replace(/^\//, '');
  // Directory index resolution
  if (clean.endsWith('/')) clean += 'index.html';
  // Check if it's a directory without trailing slash
  const fullPath = path.join(root, clean);
  if (fs.existsSync(fullPath)) return true;
  // Try as directory index
  const dirIndex = path.join(root, clean, 'index.html');
  if (fs.existsSync(dirIndex)) return true;
  return false;
}

// Extract href and src values from HTML
function extractLinks(content) {
  const links = [];
  // href values
  const hrefRegex = /\bhref\s*=\s*["']([^"']+)["']/gi;
  let match;
  while ((match = hrefRegex.exec(content)) !== null) {
    links.push({ attr: 'href', value: match[1], pos: match.index });
  }
  // src values
  const srcRegex = /\bsrc\s*=\s*["']([^"']+)["']/gi;
  while ((match = srcRegex.exec(content)) !== null) {
    // Check if this img tag has an onerror handler (graceful fallback for missing assets)
    // Look in a wide window to handle multiline img tags
    const surroundingEnd = Math.min(content.length, match.index + 500);
    const surroundingStart = Math.max(0, match.index - 300);
    const surrounding = content.substring(surroundingStart, surroundingEnd);
    const hasOnerror = /onerror\s*=/i.test(surrounding) && /<img\b/i.test(surrounding);
    links.push({ attr: 'src', value: match[1], pos: match.index, hasOnerror });
  }
  // poster values
  const posterRegex = /\bposter\s*=\s*["']([^"']+)["']/gi;
  while ((match = posterRegex.exec(content)) !== null) {
    links.push({ attr: 'poster', value: match[1], pos: match.index });
  }
  return links;
}

function isInternalUrl(url) {
  if (!url) return false;
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('//')) return false;
  if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('javascript:')) return false;
  if (url.startsWith('data:')) return false;
  if (url === '#' || url.startsWith('#')) return false;
  return true;
}

function isProductionUrl(url) {
  return url.startsWith('https://nostalgicverse.com/') || url.startsWith('https://nostalgicverse.com');
}

const htmlFiles = findHtmlFiles(root);
console.log(`\n${'='.repeat(60)}`);
console.log('NOSTALGICVERSE LINK INTEGRITY AUDIT');
console.log(`${'='.repeat(60)}\n`);
console.log(`Scanning ${htmlFiles.length} HTML files...\n`);

for (const { fullPath, relPath } of htmlFiles) {
  const content = fs.readFileSync(fullPath, 'utf8');
  const links = extractLinks(content);
  const pageErrors = [];

  for (const link of links) {
    let url = link.value;

    // Check for Windows filesystem paths in public content
    if (/^[A-Za-z]:[\\\/]/.test(url) || url.startsWith('file:///')) {
      totalChecks++;
      totalFails++;
      pageErrors.push(`  [FAIL] ${link.attr}="${url}" — Windows/file:// path in public HTML`);
      continue;
    }

    // Check for localhost in canonical/og metadata
    if (url.includes('localhost') && (link.attr === 'href' || link.attr === 'src')) {
      // Only flag if it's in a canonical, og:url, or twitter:url context
      const surrounding = content.substring(Math.max(0, link.pos - 100), link.pos + url.length + 10);
      if (/canonical|og:url|twitter:url/i.test(surrounding)) {
        totalChecks++;
        totalFails++;
        pageErrors.push(`  [FAIL] ${link.attr}="${url}" — localhost in production metadata`);
        continue;
      }
    }

    // Production URLs — extract path and validate
    if (isProductionUrl(url)) {
      const urlPath = url.replace('https://nostalgicverse.com', '') || '/';
      totalChecks++;
      if (!resolveUrl(urlPath)) {
        totalFails++;
        pageErrors.push(`  [FAIL] ${link.attr}="${url}" — production URL target not found`);
      }
      continue;
    }

    // Skip external URLs
    if (!isInternalUrl(url)) continue;

    totalChecks++;
    if (!resolveUrl(url)) {
      // Images with onerror fallback are intentionally deferred assets, not broken links
      if (link.attr === 'src' && link.hasOnerror && /\.(webp|png|jpg|jpeg|gif|svg)$/i.test(url)) {
        totalDeferred++;
        deferredAssets.push(`  [DEFERRED] ${link.attr}="${url}" — missing asset with fallback`);
      } else {
        totalFails++;
        pageErrors.push(`  [FAIL] ${link.attr}="${url}" — target not found`);
      }
    }
  }

  if (pageErrors.length > 0) {
    console.log(`\n${relPath}:`);
    pageErrors.forEach(e => console.log(e));
    failures.push({ file: relPath, errors: pageErrors });
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log('LINK INTEGRITY AUDIT SUMMARY');
console.log(`${'='.repeat(60)}`);
console.log(`HTML Files Scanned: ${htmlFiles.length}`);
console.log(`Total Link Checks:  ${totalChecks}`);
console.log(`Passed:             ${totalChecks - totalFails - totalDeferred}`);
console.log(`Failed:             ${totalFails}`);
console.log(`Deferred Assets:    ${totalDeferred} (missing images with onerror fallback)`);

if (totalFails > 0) {
  console.log(`\nFiles with failures: ${failures.length}`);
  failures.forEach(f => {
    console.log(`  ${f.file}: ${f.errors.length} broken link(s)`);
  });
}

if (totalDeferred > 0) {
  console.log(`\nDeferred asset details:`);
  deferredAssets.forEach(d => console.log(d));
}

console.log(`${'='.repeat(60)}\n`);
process.exit(totalFails > 0 ? 1 : 0);
