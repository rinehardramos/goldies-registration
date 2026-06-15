'use strict';
const pool = require('./db');

const migrate = async (retries = 5) => {
  while (retries > 0) {
    try {
      // Enable pgcrypto for gen_random_uuid()
      await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS registrations (
          id          SERIAL PRIMARY KEY,
          first_name  TEXT NOT NULL,
          last_name   TEXT NOT NULL,
          email       TEXT NOT NULL UNIQUE,
          password    TEXT NOT NULL,
          batch_year  TEXT NOT NULL,
          is_admin    BOOLEAN DEFAULT FALSE,
          qr_token    UUID UNIQUE DEFAULT gen_random_uuid(),
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
          email       TEXT NOT NULL,
          invited_by  INTEGER REFERENCES registrations(id),
          qr_token    UUID UNIQUE DEFAULT gen_random_uuid(),
          status      TEXT DEFAULT 'pending',
          created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS check_ins (
          id                SERIAL PRIMARY KEY,
          registration_id   INTEGER REFERENCES registrations(id),
          checked_in_by     INTEGER REFERENCES registrations(id),
          checked_in_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      await pool.query(`
        INSERT INTO settings (key, value) VALUES ('event_date', '2026-07-25T10:00:00+08:00')
        ON CONFLICT DO NOTHING
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

      // Seed admin user
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@goldies.com';
      const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';
      const existing = await pool.query('SELECT id FROM registrations WHERE email = $1', [adminEmail]);
      if (existing.rows.length === 0) {
        const bcrypt = require('bcryptjs');
        const hashed = await bcrypt.hash(adminPassword, 10);
        await pool.query(
          'INSERT INTO registrations (first_name, last_name, email, password, batch_year, is_admin) VALUES ($1, $2, $3, $4, $5, TRUE)',
          ['Admin', 'User', adminEmail, hashed, '2000'],
        );
        console.log('Admin seeded:', adminEmail);
      } else {
        const bcrypt = require('bcryptjs');
        const hashed = await bcrypt.hash(adminPassword, 10);
        await pool.query(
          'UPDATE registrations SET password = $1, is_admin = TRUE WHERE email = $2',
          [hashed, adminEmail],
        );
        console.log('Admin credentials verified:', adminEmail);
      }

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
