const fs = require('fs');
const path = require('path');
const { dbAsync } = require('../db/index.cjs');

async function migrate() {
    console.log('Starting database migration...');
    const migrationsDir = path.join(__dirname, '../../server/db/migrations');
    const files = fs.readdirSync(migrationsDir).sort();

    // Create migrations table if not exists
    await dbAsync.exec(`
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filename TEXT UNIQUE NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    const appliedMigrations = await dbAsync.all('SELECT filename FROM migrations');
    const appliedSet = new Set(appliedMigrations.map(m => m.filename));

    for (const file of files) {
        if (!file.endsWith('.sql')) continue;
        if (appliedSet.has(file)) {
            console.log(`Migration ${file} already applied.`);
            continue;
        }

        console.log(`Applying migration ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        try {
            await dbAsync.exec(sql);
            await dbAsync.run('INSERT INTO migrations (filename) VALUES (?)', [file]);
            console.log(`Migration ${file} applied successfully.`);
        } catch (err) {
            console.error(`Error applying migration ${file}:`, err);
            process.exit(1);
        }
    }

    console.log('Database migration complete.');
    await dbAsync.close();
}

migrate().catch(console.error);

