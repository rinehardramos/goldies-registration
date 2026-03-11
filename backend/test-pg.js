const { Pool } = require('pg');
const pool = new Pool({
  connectionString: 'postgres://goldie:goldiepassword@localhost:5432/goldies_registration'
});
async function test() {
  const res = await pool.query("SELECT * FROM registrations WHERE email = 'admin@goldies.com'");
  console.log('Raw user from DB:', res.rows[0]);
  process.exit(0);
}
test();
