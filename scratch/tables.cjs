const { dbAsync } = require('../server/db/index.cjs');
async function run() {
    const res = await dbAsync.all("SELECT name FROM sqlite_master WHERE type='table'");
    console.log(res.map(r => r.name).join(', '));
    process.exit(0);
}
run();