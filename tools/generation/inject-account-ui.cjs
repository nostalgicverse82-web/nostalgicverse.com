const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../');

const accountControlHTML = `
        <!-- Account & Brand Landmark -->
        <div class="brand-group">
          <div class="account-control-wrap" id="account-control-wrap">
            <button class="account-toggle-btn" id="account-toggle-btn" aria-expanded="false" aria-controls="account-dropdown-menu" aria-label="Account Menu">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
            </button>
            <div class="account-dropdown-menu" id="account-dropdown-menu" role="menu" hidden>
              <!-- Populated by JS -->
              <div class="account-dropdown-header">
                <span class="account-dropdown-title">ACCOUNT</span>
              </div>
              <a href="/login/" class="account-dropdown-item" role="menuitem">Log In</a>
              <a href="/signup/" class="account-dropdown-item" role="menuitem">Sign Up</a>
            </div>
          </div>
          <a href="/" class="brand-logo-wrap" aria-label="NostalgicVerse Homepage">
            <img src="/assets/images/branding/logo/logo.svg" alt="NostalgicVerse" class="site-logo-img" width="180" height="36" loading="eager">
          </a>
        </div>
`.trim();

const oldBrandGroupRegex = /<!-- Brand Landmark -->\s*<div class="brand-group">\s*<a href="\/" class="brand-logo-wrap" aria-label="NostalgicVerse Homepage">\s*<img src="\/assets\/images\/branding\/logo\/logo\.svg" alt="NostalgicVerse" class="site-logo-img"[^>]*>\s*<\/a>\s*<\/div>/;

function processHtmlFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;

    // Inject CSS
    if (!content.includes('auth-ui.css')) {
        content = content.replace('</head>', '  <link rel="stylesheet" href="/assets/css/auth-ui.css">\n  <link rel="stylesheet" href="/assets/css/avatar-picker.css">\n</head>');
        changed = true;
    } else if (!content.includes('avatar-picker.css')) {
        content = content.replace('</head>', '  <link rel="stylesheet" href="/assets/css/avatar-picker.css">\n</head>');
        changed = true;
    }

    // Inject JS
    if (!content.includes('auth-ui.js')) {
        content = content.replace('</body>', '  <script src="/assets/js/avatar-picker.js"></script>\n  <script src="/assets/js/auth-ui.js"></script>\n</body>');
        changed = true;
    } else if (!content.includes('avatar-picker.js')) {
        content = content.replace('</body>', '  <script src="/assets/js/avatar-picker.js"></script>\n</body>');
        changed = true;
    }

    // Inject Account Control
    if (oldBrandGroupRegex.test(content)) {
        content = content.replace(oldBrandGroupRegex, accountControlHTML);
        changed = true;
    } else if (content.includes('class="brand-group"') && !content.includes('account-control-wrap')) {
        // Fallback for slightly different formats
        content = content.replace(/<div class="brand-group">([\s\S]*?)<\/div>/, (match, p1) => {
            if (p1.includes('account-control-wrap')) return match; // already done
            return `<div class="brand-group">\n          <div class="account-control-wrap" id="account-control-wrap">\n            <button class="account-toggle-btn" id="account-toggle-btn" aria-expanded="false" aria-controls="account-dropdown-menu" aria-label="Account Menu">\n              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">\n                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>\n                <circle cx="12" cy="7" r="4"></circle>\n              </svg>\n            </button>\n            <div class="account-dropdown-menu" id="account-dropdown-menu" role="menu" hidden>\n              <div class="account-dropdown-header">\n                <span class="account-dropdown-title">ACCOUNT</span>\n              </div>\n              <a href="/login/" class="account-dropdown-item" role="menuitem">Log In</a>\n              <a href="/signup/" class="account-dropdown-item" role="menuitem">Sign Up</a>\n            </div>\n          </div>${p1}</div>`;
        });
        changed = true;
    }

    if (changed) {
        fs.writeFileSync(filePath, content, 'utf8');
    }
}

function findAndProcessHtmlFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'node_modules' || file.startsWith('.')) continue;
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findAndProcessHtmlFiles(filePath);
        } else if (file.endsWith('.html')) {
            processHtmlFile(filePath);
        }
    }
}

console.log('Injecting Account UI into all HTML files...');
findAndProcessHtmlFiles(rootDir);
console.log('Done.');

