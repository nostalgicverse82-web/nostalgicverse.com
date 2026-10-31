const { dbAsync } = require('../server/db/index.cjs');
async function run() {
    const res = await dbAsync.all("SELECT id, username, username_normalized, role, email FROM users WHERE role = 'OWNER'");
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
}
run();