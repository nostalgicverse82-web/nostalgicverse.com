const fs = require('fs');
const path = require('path');
const { dbAsync, db } = require('./connection.cjs');

async function runMigrations() {
    console.log('Starting migration engine...');
    
    // Ensure migrations table exists
    await dbAsync.run(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    const migrationsDir = path.join(__dirname, 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
        const version = file.split('_')[0];
        
        const applied = await dbAsync.get('SELECT version FROM schema_migrations WHERE version = ?', [version]);
        if (applied) {
            console.log(`Migration ${file} already applied, skipping.`);
            continue;
        }

        console.log(`Applying migration: ${file}...`);
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

        // Execute in transaction
        try {
            await dbAsync.run('BEGIN TRANSACTION');
            
            try {
                // Primary path: native multi-statement execution
                await dbAsync.exec(sql);
            } catch (execErr) {
                if (execErr.message && execErr.message.includes('duplicate column name')) {
                    // Fallback path: statement-by-statement, tolerating pre-existing columns
                    const statements = sql
                        .split(';')
                        .map(s => s.trim())
                        .filter(s => s.length > 0 && !s.startsWith('--'));
                    for (const stmt of statements) {
                        try {
                            await dbAsync.run(stmt);
                        } catch (sErr) {
                            if (!sErr.message || !sErr.message.includes('duplicate column name')) {
                                throw sErr;
                            }
                        }
                    }
                } else {
                    throw execErr;
                }
            }
            
            await dbAsync.run(
                'INSERT INTO schema_migrations (version, name) VALUES (?, ?)',
                [version, file]
            );
            
            await dbAsync.run('COMMIT');
            console.log(`Successfully applied ${file}.`);
        } catch (err) {
            await dbAsync.run('ROLLBACK');
            console.error(`Error applying migration ${file}:`, err.message);
            process.exit(1);
        }
    }

    console.log('All migrations applied successfully.');
}

if (require.main === module) {
    runMigrations().then(() => {
        db.close();
        process.exit(0);
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { runMigrations };

