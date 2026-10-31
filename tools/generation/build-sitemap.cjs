/**
 * NostalgicVerse Sitemap Generator
 * Generates sitemap.xml from actual filesystem routes.
 * Zero dependencies — Node.js built-ins only.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const CANONICAL_DOMAIN = 'https://nostalgicverse.com';

const urls = [];

function addUrl(loc, changefreq, priority) {
  urls.push({ loc, changefreq, priority });
}

// 1. Core pages
addUrl('/', 'weekly', '1.0');
addUrl('/games/', 'weekly', '0.9');
addUrl('/consoles/', 'weekly', '0.9');
addUrl('/timeline/', 'weekly', '0.9');
addUrl('/genres/', 'weekly', '0.9');
addUrl('/guides/', 'weekly', '0.8');
addUrl('/blog/', 'weekly', '0.8');

// 2. Utility pages
addUrl('/search/', 'monthly', '0.7');
addUrl('/favorites/', 'monthly', '0.6');
addUrl('/random/', 'monthly', '0.6');
addUrl('/download/', 'weekly', '0.8');

// 3. Institutional
addUrl('/about/', 'monthly', '0.5');
addUrl('/support/', 'monthly', '0.5');

// 4. Legal
const legalFiles = ['privacy.html', 'terms.html', 'cookies.html', 'disclaimer.html'];
legalFiles.forEach(f => {
  if (fs.existsSync(path.join(root, 'legal', f))) {
    addUrl(`/legal/${f}`, 'yearly', '0.3');
  }
});

// 5. Individual game exhibits (scan filesystem)
const gamesDir = path.join(root, 'games');
if (fs.existsSync(gamesDir)) {
  const gameSlugs = fs.readdirSync(gamesDir).filter(d => {
    return fs.statSync(path.join(gamesDir, d)).isDirectory() &&
           fs.existsSync(path.join(gamesDir, d, 'index.html'));
  });
  gameSlugs.sort();
  gameSlugs.forEach(slug => addUrl(`/games/${slug}/`, 'monthly', '0.8'));
}

// 6. Individual console exhibits (scan filesystem)
const consolesDir = path.join(root, 'consoles');
if (fs.existsSync(consolesDir)) {
  const consoleSlugs = fs.readdirSync(consolesDir).filter(d => {
    return fs.statSync(path.join(consolesDir, d)).isDirectory() &&
           fs.existsSync(path.join(consolesDir, d, 'index.html'));
  });
  consoleSlugs.sort();
  consoleSlugs.forEach(slug => addUrl(`/consoles/${slug}/`, 'monthly', '0.7'));
}

// Build XML
let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
urls.forEach(u => {
  xml += '  <url>\n';
  xml += `    <loc>${CANONICAL_DOMAIN}${u.loc}</loc>\n`;
  xml += `    <changefreq>${u.changefreq}</changefreq>\n`;
  xml += `    <priority>${u.priority}</priority>\n`;
  xml += '  </url>\n';
});
xml += '</urlset>\n';

fs.writeFileSync(path.join(root, 'sitemap.xml'), xml, 'utf8');
console.log(`Sitemap generated: ${urls.length} URLs written to sitemap.xml`);
