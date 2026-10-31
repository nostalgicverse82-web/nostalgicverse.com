const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../../');
const pages = [
  'index.html',
  'games/index.html',
  'consoles/index.html',
  'genres/index.html',
  'timeline/index.html',
  'guides/index.html',
  'blog/index.html',
  'search/index.html',
  'favorites/index.html',
  'random/index.html',
  'download/index.html'
];

console.log('--- NAVIGATION LINK AUDIT ---');

pages.forEach(p => {
  const filePath = path.join(root, p);
  const content = fs.readFileSync(filePath, 'utf8');
  const hasDownload = content.includes('/download/');
  
  // Extract nav links
  const navMatches = content.match(/<nav[\s\S]*?<\/nav>/gi) || [];
  const navContent = navMatches.join(' ');
  const navLinks = (navContent.match(/href="([^"]+)"/gi) || []).map(m => m.replace(/href="|"/gi, ''));
  
  console.log(`Page: ${p}`);
  console.log(`  Includes /download/: ${hasDownload}`);
  console.log(`  Header Nav links: ${navLinks.slice(0, 12).join(', ')}`);
});

