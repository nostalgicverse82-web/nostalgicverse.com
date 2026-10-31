const { dbAsync } = require('./server/db/index.cjs');
async function run() {
  const tables = await dbAsync.all("SELECT name FROM sqlite_master WHERE type='table'");
  console.log(tables.map(t => t.name).join('\n'));
}
run();
