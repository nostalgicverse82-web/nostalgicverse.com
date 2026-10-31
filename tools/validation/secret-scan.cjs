const fs = require('fs');
const path = require('path');

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file === '.git' || file === 'data' || file.startsWith('.env') || file.includes('test') || file.endsWith('.md')) continue;
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDir(fullPath);
        } else {
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.includes('changeme123') && file !== 'index.cjs') {
                console.log(`Secret found in ${fullPath}`);
            }
        }
    }
}
scanDir('d:/nostalgicverse1.com');
console.log('Scan complete');

