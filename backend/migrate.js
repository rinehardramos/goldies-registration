'use strict';
const pool = require('./db');

const migrate = async (retries = 5) => {
  while (retries > 0) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS registrations (
          id          SERIAL PRIMARY KEY,
          batch_year  TEXT NOT NULL,
          full_name   TEXT NOT NULL,
          email       TEXT NOT NULL UNIQUE,
          password    TEXT NOT NULL,
          is_admin    BOOLEAN DEFAULT FALSE,
          created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS attendees (
          id           SERIAL PRIMARY KEY,
          user_id      INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
          full_name    TEXT NOT NULL,
          email        TEXT NOT NULL UNIQUE,
          phone        TEXT NOT NULL UNIQUE,
          batch_year   TEXT,
          address      TEXT,
          is_archived  BOOLEAN DEFAULT FALSE,
          created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS invitations (
          id          SERIAL PRIMARY KEY,
          attendee_id INTEGER REFERENCES attendees(id) ON DELETE CASCADE,
          token       TEXT NOT NULL UNIQUE,
          qr_url      TEXT,
          sent_at     TIMESTAMP,
          checked_in  BOOLEAN DEFAULT FALSE,
          checked_in_at TIMESTAMP,
          created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id         SERIAL PRIMARY KEY,
          user_id    INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
          token      TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('Migration complete – all tables ready.');
      return;
    } catch (err) {
      console.error(`Migration error (${retries} retries left):`, err.message);
      retries -= 1;
      if (retries === 0) {
        console.error('Migration failed. Exiting.');
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

module.exports = migrate;

if (require.main === module) {
  migrate().then(() => process.exit(0));
}
