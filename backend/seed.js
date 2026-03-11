const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('onrender.com') 
    ? { rejectUnauthorized: false } 
    : false
});

const seedAdmin = async () => {
  try {
    // 1. Ensure registrations table exists and has is_admin column
    console.log('Ensuring database schema is up to date...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS registrations (
        id SERIAL PRIMARY KEY,
        batch_year TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Add is_admin column if it was created before this feature
    await pool.query(`
      ALTER TABLE registrations ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;
    `);

    // 2. Seed admin user
    // Provide sensible defaults that can be overridden via Render Environment Variables
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@goldies.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
    const adminName = process.env.ADMIN_NAME || 'Super Admin';
    const adminBatch = process.env.ADMIN_BATCH || 'Admin';

    console.log(`Checking if admin user (${adminEmail}) exists...`);
    const checkQuery = await pool.query('SELECT * FROM registrations WHERE email = $1', [adminEmail]);
    
    if (checkQuery.rows.length === 0) {
      console.log('Admin user not found. Seeding new admin user...');
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      await pool.query(
        'INSERT INTO registrations (batch_year, full_name, email, password, is_admin) VALUES ($1, $2, $3, $4, $5)',
        [adminBatch, adminName, adminEmail, hashedPassword, true]
      );
      console.log('Successfully created admin user!');
    } else {
      console.log('Administrator already exists. Updating privileges...');
      await pool.query('UPDATE registrations SET is_admin = TRUE WHERE email = $1', [adminEmail]);
      console.log('Admin privileges verified/updated.');
    }
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await pool.end();
  }
};

seedAdmin();
