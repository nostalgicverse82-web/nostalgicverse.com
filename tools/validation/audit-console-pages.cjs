/**
 * NostalgicVerse Console Exhibit Pages Auditor
 * 
 * Verifies all generated console exhibit pages:
 * - Single HTML document roots (1x DOCTYPE, 1x HTML, 1x HEAD, 1x BODY)
 * - Zero markdown code fences
 * - Zero unclosed HTML comments
 * - Required semantic elements (<title>, <h1>)
 * - Zero external runtime dependencies (CDNs, remote scripts, remote CSS)
 * - Zero runtime AI endpoints or exposed credentials
 * - Strict canonical storage key: 'nostalgicverse_favs'
 * - Clean JavaScript syntax in inline scripts
 * - Valid canonical URLs & JSON-LD structured data
 * - Viewport meta tag & mobile drawer elements
 * - Accession fallback plate presence
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../');
let totalFailures = 0;
let totalChecks = 0;

function assert(condition, message) {
  totalChecks++;
  if (!condition) {
    totalFailures++;
    console.error(`  [FAIL] ${message}`);
  } else {
    console.log(`  [PASS] ${message}`);
  }
}

const consolesDir = path.join(ROOT, 'consoles');
const consoleSlugs = fs.readdirSync(consolesDir).filter(f => {
  try {
    return fs.statSync(path.join(consolesDir, f)).isDirectory() && fs.existsSync(path.join(consolesDir, f, 'index.html'));
  } catch (e) {
    return false;
  }
});

console.log('==================================================');
console.log(`AUDITING ${consoleSlugs.length} CONSOLE EXHIBIT DETAIL PAGES`);
console.log('==================================================');

consoleSlugs.forEach(slug => {
  const relPath = `consoles/${slug}/index.html`;
  const fullPath = path.join(ROOT, relPath);
  console.log(`\nAuditing: ${relPath}`);

  const content = fs.readFileSync(fullPath, 'utf8');

  // Document structure
  const doctypes = (content.match(/<!DOCTYPE html>/gi) || []).length;
  const htmlOpens = (content.match(/<html[\s>]/gi) || []).length;
  const htmlCloses = (content.match(/<\/html>/gi) || []).length;
  const headOpens = (content.match(/<head[\s>]/gi) || []).length;
  const headCloses = (content.match(/<\/head>/gi) || []).length;
  const bodyOpens = (content.match(/<body[\s>]/gi) || []).length;
  const bodyCloses = (content.match(/<\/body>/gi) || []).length;

  assert(doctypes === 1, `Single <!DOCTYPE html> (found: ${doctypes})`);
  assert(htmlOpens === 1 && htmlCloses === 1, `Single <html> tag pair (opens: ${htmlOpens}, closes: ${htmlCloses})`);
  assert(headOpens === 1 && headCloses === 1, `Single <head> tag pair (opens: ${headOpens}, closes: ${headCloses})`);
  assert(bodyOpens === 1 && bodyCloses === 1, `Single <body> tag pair (opens: ${bodyOpens}, closes: ${bodyCloses})`);

  // Code fences & comments
  const markdownFences = (content.match(/^\`\`\`/gm) || []).length;
  assert(markdownFences === 0, `Zero markdown code fences inside HTML (found: ${markdownFences})`);

  const unclosedComment = content.match(/<!--(?:(?!-->)[\s\S])*$/);
  assert(!unclosedComment, 'No unclosed HTML comments at end of file');

  // Semantic elements
  const hasTitle = /<title>[^<]+<\/title>/i.test(content);
  assert(hasTitle, 'Contains valid <title> tag');

  const hasH1 = /<h1[^>]*>[\s\S]*?<\/h1>/i.test(content);
  assert(hasH1, 'Contains valid <h1> heading');

  // Viewport & Mobile Drawer
  const hasViewport = /<meta\s+name=["']viewport["']\s+content=["'][^"']*width=device-width/i.test(content);
  assert(hasViewport, 'Viewport meta tag present and configured');

  const hasMenuToggle = /id=["']menu-toggle-btn["']/i.test(content);
  const hasDrawer = /id=["']mobile-nav-drawer["']/i.test(content);
  assert(hasMenuToggle && hasDrawer, 'Mobile menu toggle and drawer present');

  // Zero external runtime dependencies
  const extScripts = content.match(/<script[^>]+src=["']https?:\/\//gi);
  const extStyles = content.match(/<link[^>]+href=["']https?:\/\/[^>]+rel=["']stylesheet["']/gi);
  assert(!extScripts, `Zero external CDN scripts (found: ${extScripts ? extScripts.length : 0})`);
  assert(!extStyles, `Zero external stylesheets (found: ${extStyles ? extStyles.length : 0})`);

  // Zero AI API calls or secrets
  const aiApiMatch = content.match(/api\.openai\.com|api\.anthropic\.com|generativelanguage\.googleapis\.com/i);
  assert(!aiApiMatch, `Zero client-side AI API references`);

  const secretMatch = content.match(/sk-[a-zA-Z0-9]{20,}|AIza[a-zA-Z0-9_-]{35}/);
  assert(!secretMatch, `Zero exposed API tokens / credentials`);

  // Storage key compatibility
  if (content.includes('localStorage')) {
    assert(content.includes('nostalgicverse_favs'), `Uses canonical 'nostalgicverse_favs' key`);
  }

  // JavaScript syntax check
  const scripts = content.match(/<script(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/gi) || [];
  scripts.forEach((s, idx) => {
    const jsCode = s.replace(/<\/?script[^>]*>/gi, '');
    try {
      new Function(jsCode);
      assert(true, `Inline script #${idx + 1} syntax valid`);
    } catch (err) {
      assert(false, `Inline script #${idx + 1} syntax error: ${err.message}`);
    }
  });

  // Canonical tag & JSON-LD
  const expectedCanonical = `https://nostalgicverse.com/consoles/${slug}/`;
  const canonicalMatch = content.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i);
  assert(canonicalMatch && canonicalMatch[1] === expectedCanonical, `Canonical URL valid: ${canonicalMatch ? canonicalMatch[1] : 'missing'}`);

  const jsonLdMatch = content.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      JSON.parse(jsonLdMatch[1]);
      assert(true, 'JSON-LD structured data parses cleanly');
    } catch (err) {
      assert(false, `JSON-LD structured data invalid JSON: ${err.message}`);
    }
  } else {
    assert(false, 'JSON-LD structured data script missing');
  }

  // Accession Fallback Plate
  const hasAccessionPlate = content.includes('museum-artifact-plate') && content.includes(`ACCESSION № NV-HW-`);
  assert(hasAccessionPlate, 'Museum Accession Fallback Plate present');
});

console.log('\n==================================================');
console.log('CONSOLE PAGES AUDIT SUMMARY');
console.log('==================================================');
console.log(`Total Checks Run: ${totalChecks}`);
console.log(`Passed: ${totalChecks - totalFailures}`);
console.log(`Failed: ${totalFailures}`);

if (totalFailures === 0) {
  console.log('\n>>> SUCCESS: ALL CONSOLE AUDITS PASSED CLEANLY (EXIT CODE 0) <<<\n');
  process.exit(0);
} else {
  console.error(`\n>>> FAILURE: ${totalFailures} CONSOLE AUDIT CHECKS FAILED <<<\n`);
  process.exit(1);
}

