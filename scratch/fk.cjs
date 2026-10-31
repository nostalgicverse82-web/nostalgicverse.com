const { dbAsync } = require('../server/db/index.cjs');
async function run() {
    const res = await dbAsync.all("SELECT name FROM sqlite_master WHERE type='table'");
    for (const r of res) {
        const info = await dbAsync.all('PRAGMA foreign_key_list(' + r.name + ')');
        for (const fk of info) {
            if (fk.table === 'users' && fk.on_delete !== 'CASCADE') {
                console.log(r.name + ' references users with ' + fk.on_delete);
            }
        }
    }
    process.exit(0);
}
run();