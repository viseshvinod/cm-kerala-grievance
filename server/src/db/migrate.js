const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(sql);
}

module.exports = { migrate };

if (require.main === module) {
  migrate()
    .then(() => { console.log('Schema applied'); return pool.end(); })
    .catch((e) => { console.error(e); process.exit(1); });
}
