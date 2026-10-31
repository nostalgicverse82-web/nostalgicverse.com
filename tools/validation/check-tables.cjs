const { dbAsync } = require('../../server/db/connection.cjs');

async function main() {
    const rows = await dbAsync.all("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
    console.log('Tables in DB:');
    console.log(rows.map(r => r.name).join(', '));
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
