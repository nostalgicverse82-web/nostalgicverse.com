const { dbAsync } = require('./server/db/connection.cjs'); dbAsync.run('INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (\'001\', \'001_initial.sql\')').then(() => process.exit(0))
