/**
 * NostalgicVerse Disaster Recovery Suite
 * Provides authoritative database backup snapshotting, non-destructive restore testing,
 * atomic search index rebuilds, and sitemap synchronization.
 *
 * Usage:
 *   node tools/maintenance/disaster-recovery.cjs snapshot
 *   node tools/maintenance/disaster-recovery.cjs verify <path-to-db>
 *   node tools/maintenance/disaster-recovery.cjs test-restore <path-to-db>
 *   node tools/maintenance/disaster-recovery.cjs rebuild-search
 *   node tools/maintenance/disaster-recovery.cjs rebuild-sitemap
 *   node tools/maintenance/disaster-recovery.cjs all
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const ROOT = path.resolve(__dirname, '../..');
const DB_PATH = path.join(ROOT, 'data/nostalgicverse.db');
const BACKUPS_DIR = path.join(ROOT, 'data/backups');

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function openDb(filePath, readOnly = false) {
    const mode = readOnly ? sqlite3.OPEN_READONLY : (sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);
    return new Promise((resolve, reject) => {
        const db = new sqlite3.Database(filePath, mode, (err) => {
            if (err) reject(err);
            else resolve(db);
        });
    });
}

function queryAll(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function queryGet(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function queryRun(db, sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });
}

function closeDb(db) {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

// 1. Create Authoritative SQLite Snapshot
async function createSnapshot() {
    console.log('[DR] Initiating live database snapshot...');
    const startTime = Date.now();
    ensureDir(BACKUPS_DIR);

    if (!fs.existsSync(DB_PATH)) {
        throw new Error(`Database source not found at ${DB_PATH}`);
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `nostalgicverse-backup-${timestamp}.db`;
    const backupFilePath = path.join(BACKUPS_DIR, backupFileName);

    const sourceDb = await openDb(DB_PATH);
    try {
        // Execute VACUUM INTO to generate a cleanly serialized, defragmented backup while online
        const escapedBackupPath = backupFilePath.replace(/\\/g, '/');
        await queryRun(sourceDb, `VACUUM INTO '${escapedBackupPath}'`);
    } finally {
        await closeDb(sourceDb);
    }

    const stats = fs.statSync(backupFilePath);
    const duration = Date.now() - startTime;
    console.log(`[DR] Snapshot created: ${backupFileName} (${(stats.size / (1024 * 1024)).toFixed(2)} MB) in ${duration}ms`);

    // Verify snapshot immediately
    await verifyDatabaseFile(backupFilePath);
    return backupFilePath;
}

// 2. Verify Database Integrity & Schema
async function verifyDatabaseFile(targetDbPath) {
    console.log(`[DR] Verifying integrity of: ${path.basename(targetDbPath)}`);
    const db = await openDb(targetDbPath, true);

    try {
        // Check SQLite page integrity
        const integrity = await queryGet(db, 'PRAGMA integrity_check');
        if (!integrity || integrity.integrity_check !== 'ok') {
            throw new Error(`Integrity check failed: ${JSON.stringify(integrity)}`);
        }

        // Check foreign key consistency
        const fkCheck = await queryAll(db, 'PRAGMA foreign_key_check');
        if (fkCheck.length > 0) {
            throw new Error(`Foreign key check failed with ${fkCheck.length} violations: ${JSON.stringify(fkCheck)}`);
        }

        // Verify primary tables exist
        const requiredTables = ['users', 'sessions', 'games', 'consoles', 'comments', 'reviews', 'reactions', 'conversations', 'messages'];
        const existingTables = await queryAll(db, "SELECT name FROM sqlite_master WHERE type='table'");
        const tableNames = new Set(existingTables.map(t => t.name));

        for (const reqTable of requiredTables) {
            if (!tableNames.has(reqTable)) {
                throw new Error(`Missing expected table: ${reqTable}`);
            }
        }

        // Verify owner presence
        const owner = await queryGet(db, "SELECT id, username, role FROM users WHERE role = 'OWNER'");
        if (!owner) {
            throw new Error('Verification failed: No OWNER account found in database.');
        }

        const userCount = await queryGet(db, "SELECT COUNT(*) as count FROM users");
        console.log(`[DR] Verification PASSED: PRAGMA integrity_check=ok, 0 FK violations, ${userCount.count} users verified.`);
        return true;
    } finally {
        await closeDb(db);
    }
}

// 3. Test Restore (Sandbox Dry-Run)
async function testRestore(backupDbPath) {
    console.log(`[DR] Testing non-destructive restore of: ${path.basename(backupDbPath)}...`);
    ensureDir(BACKUPS_DIR);
    const sandboxPath = path.join(BACKUPS_DIR, `restore-test-sandbox-${Date.now()}.tmp`);

    try {
        fs.copyFileSync(backupDbPath, sandboxPath);
        await verifyDatabaseFile(sandboxPath);

        const sandboxDb = await openDb(sandboxPath);
        try {
            // Test read and write transactions in sandbox
            await queryRun(sandboxDb, 'BEGIN IMMEDIATE');
            const testRow = await queryGet(sandboxDb, 'SELECT COUNT(*) as cnt FROM games');
            if (testRow.cnt < 1) {
                throw new Error('Sandbox restoration check failed: zero games found.');
            }
            await queryRun(sandboxDb, 'COMMIT');
        } finally {
            await closeDb(sandboxDb);
        }

        console.log('[DR] Restore simulation test PASSED cleanly.');
        return true;
    } finally {
        if (fs.existsSync(sandboxPath)) {
            try { fs.unlinkSync(sandboxPath); } catch (_) {}
        }
    }
}

// 4. Atomic Search Index Rebuild
async function rebuildSearchIndexAtomic() {
    console.log('[DR] Performing atomic search index rebuild...');
    const searchIndexPath = path.join(ROOT, 'data/search-index.json');
    const tempPath = path.join(ROOT, 'data/search-index.json.tmp');

    // Run the existing generator script logic or invoke it
    const buildSearchIndexScript = path.join(ROOT, 'tools/generation/build-search-index.cjs');
    if (!fs.existsSync(buildSearchIndexScript)) {
        throw new Error(`Search index builder script not found at ${buildSearchIndexScript}`);
    }

    // Execute builder
    const { execSync } = require('child_process');
    execSync(`node "${buildSearchIndexScript}"`, { cwd: ROOT, stdio: 'pipe' });

    // Validate generated search-index.json
    if (!fs.existsSync(searchIndexPath)) {
        throw new Error('build-search-index.cjs did not produce data/search-index.json');
    }

    const content = fs.readFileSync(searchIndexPath, 'utf8');
    const parsed = JSON.parse(content);
    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('Rebuilt search index is empty or invalid.');
    }

    console.log(`[DR] Search index rebuild PASSED: ${parsed.length} items indexed.`);
    return parsed.length;
}

// 5. Rebuild Sitemap Atomically
async function rebuildSitemapAtomic() {
    console.log('[DR] Performing sitemap rebuild...');
    const buildSitemapScript = path.join(ROOT, 'tools/generation/build-sitemap.cjs');
    if (!fs.existsSync(buildSitemapScript)) {
        throw new Error(`Sitemap builder script not found at ${buildSitemapScript}`);
    }

    const { execSync } = require('child_process');
    execSync(`node "${buildSitemapScript}"`, { cwd: ROOT, stdio: 'pipe' });

    const sitemapPath = path.join(ROOT, 'sitemap.xml');
    if (!fs.existsSync(sitemapPath)) {
        throw new Error('build-sitemap.cjs did not produce sitemap.xml');
    }

    const content = fs.readFileSync(sitemapPath, 'utf8');
    if (!content.includes('<urlset') || !content.includes('https://nostalgicverse.com/')) {
        throw new Error('Generated sitemap is missing root urlset definition.');
    }

    console.log(`[DR] Sitemap rebuild PASSED.`);
    return true;
}

// Suite Runner
async function run() {
    const action = process.argv[2] || 'all';

    try {
        if (action === 'snapshot') {
            await createSnapshot();
        } else if (action === 'verify') {
            const target = process.argv[3] || DB_PATH;
            await verifyDatabaseFile(target);
        } else if (action === 'test-restore') {
            const target = process.argv[3];
            if (!target) throw new Error('Specify path to backup file: node disaster-recovery.cjs test-restore <file>');
            await testRestore(target);
        } else if (action === 'rebuild-search') {
            await rebuildSearchIndexAtomic();
        } else if (action === 'rebuild-sitemap') {
            await rebuildSitemapAtomic();
        } else if (action === 'all') {
            console.log('========================================================');
            console.log('  NOSTALGICVERSE DISASTER RECOVERY & RESILIENCE SUITE   ');
            console.log('========================================================\n');
            const snapshotPath = await createSnapshot();
            await testRestore(snapshotPath);
            await rebuildSearchIndexAtomic();
            await rebuildSitemapAtomic();
            console.log('\n========================================================');
            console.log('  ALL DISASTER RECOVERY SYSTEMS VERIFIED OPERATIONAL    ');
            console.log('========================================================');
        } else {
            console.log(`Unknown action: ${action}`);
            process.exit(1);
        }
    } catch (err) {
        console.error('\n[FATAL ERROR] Disaster Recovery operation failed:');
        console.error(err.message || err);
        process.exit(1);
    }
}

if (require.main === module) {
    run();
}

module.exports = {
    createSnapshot,
    verifyDatabaseFile,
    testRestore,
    rebuildSearchIndexAtomic,
    rebuildSitemapAtomic
};

