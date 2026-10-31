const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');

function checkDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', '.git', 'backups', 'scratch'].includes(e.name)) {
        checkDir(full);
      }
    } else if (e.isFile() && e.name.endsWith('.html')) {
      const html = fs.readFileSync(full, 'utf8');
      const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
      let match;
      let sIdx = 0;
      while ((match = scriptRegex.exec(html)) !== null) {
        sIdx++;
        const openTag = match[0].match(/<script\b[^>]*>/i)[0];
        if (openTag.includes('src=') || openTag.includes('application/ld+json')) continue;
        const code = match[1];
        try {
          new vm.Script(code);
        } catch (err) {
          console.error(`FAIL in ${path.relative(root, full)} script #${sIdx}: ${err.message}`);
        }
      }
    }
  }
}

checkDir(root);

