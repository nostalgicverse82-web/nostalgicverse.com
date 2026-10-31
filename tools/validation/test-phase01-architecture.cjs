const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function assertFileExists(file) {
    if (!fs.existsSync(path.join(ROOT, file))) {
        throw new Error(`Missing required file: ${file}`);
    }
}

function assertContent(file, regex, description) {
    const content = fs.readFileSync(path.join(ROOT, file), 'utf8');
    if (!regex.test(content)) {
        throw new Error(`Assertion failed in ${file}: ${description}`);
    }
}

console.log('Running Phase 01 Architecture Validation...');

try {
    // 1. Canonical Server Path
    assertFileExists('server/index.cjs');

    // 2. Compatibility Server
    assertFileExists('server.cjs');
    assertContent('server.cjs', /require\(['"]\.\/server\/index\.cjs['"]\)/, 'server.cjs must delegate to server/index.cjs');
    assertContent('server.cjs', /startServer\(\)/, 'server.cjs must start the canonical server');

    // 3. Package Startup Commands
    assertContent('package.json', /"start": "node server\/index\.cjs"/, 'npm start must boot server/index.cjs');
    assertContent('package.json', /"dev": "node server\/index\.cjs"/, 'npm run dev must boot server/index.cjs');

    // 4. Env Example Exists & Secret Names
    assertFileExists('.env.example');
    assertContent('.env.example', /OWNER_USERNAME=Sufiyan_memon17/, 'Owner username correctly provisioned');
    assertContent('.env.example', /OWNER_INITIAL_PASSWORD=/, 'Initial password secret documented');

    // 5. Documentation Existence
    const docs = [
        'docs/PHASE-01-ARCHITECTURE-BASELINE.md',
        'docs/PHASE-01-ARCHITECTURE-LOCK.md',
        'docs/DATABASE-ARCHITECTURE.md',
        'docs/AUTH-ARCHITECTURE.md',
        'docs/CONTENT-ARCHITECTURE.md',
        'docs/REALTIME-ARCHITECTURE.md',
        'docs/SECURITY-ARCHITECTURE.md'
    ];
    docs.forEach(assertFileExists);

    // 6. Identity & Auth Architecture Verification
    assertContent('docs/AUTH-ARCHITECTURE.md', /username_normalized/, 'Normalized username field documented');
    assertContent('docs/AUTH-ARCHITECTURE.md', /UNIQUE/i, 'Unique normalized username constraint documented');
    assertContent('docs/AUTH-ARCHITECTURE.md', /case-insensitive/i, 'Case-insensitive login documented');
    assertContent('docs/AUTH-ARCHITECTURE.md', /passwords are strictly case-sensitive/i, 'Password case-sensitivity documented');
    assertContent('docs/AUTH-ARCHITECTURE.md', /Sufiyan_memon17.*permanently reserved/i, 'Owner namespace reservation documented');

    // 7. Data Truth
    assertContent('docs/PHASE-01-ARCHITECTURE-LOCK.md', /authoritative source/, 'Data source of truth defined');

    // 8. No real secrets
    // Basic structural check - real deep scan handled externally
    const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
    if (envExample.includes('super_secret_deployment_password_change_me') === false) {
        throw new Error('Placeholder secrets have been replaced with real secrets in .env.example');
    }

    console.log('✓ All Phase 01 Architecture Assertions Passed.');
    process.exit(0);

} catch (err) {
    console.error('❌ PHASE 01 VALIDATION FAILED:', err.message);
    process.exit(1);
}
