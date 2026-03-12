const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const path = require('path');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Database setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('onrender.com') 
    ? { rejectUnauthorized: false } 
    : false
});

// Create table if not exists using PostgreSQL syntax
const initDb = async (retries = 5) => {
  while (retries > 0) {
    try {
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
      console.log('PostgreSQL Table initialized');
      return;
    } catch (err) {
      console.error(`Error initializing database (${retries} retries left):`, err.message);
      retries -= 1;
      if (retries === 0) {
        console.error('Max retries reached. Database initialization failed.');
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};
initDb();

// API Endpoints
app.post('/api/register', async (req, res) => {
  const { batchYear, fullName, email, password } = req.body;

  if (!batchYear || !fullName || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const query = 'INSERT INTO registrations (batch_year, full_name, email, password) VALUES ($1, $2, $3, $4) RETURNING id';
    const values = [batchYear, fullName, email, hashedPassword];
    const result = await pool.query(query, values);
    res.status(201).json({ id: result.rows[0].id, message: 'Registration successful' });
  } catch (error) {
    if (error.code === '23505') { // PostgreSQL unique violation code
      return res.status(400).json({ error: 'Email already registered' });
    }
    console.error('Database error:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    const query = 'SELECT * FROM registrations WHERE email = $1';
    const result = await pool.query(query, [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({ 
      message: 'Login successful', 
      user: { 
        id: user.id, 
        fullName: user.full_name,
        isAdmin: user.is_admin 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/api/registrations', async (req, res) => {
  try {
    const result = await pool.query('SELECT id, batch_year as "batchYear", full_name as "fullName", email, created_at as "createdAt" FROM registrations ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

app.put('/api/registrations/:id', async (req, res) => {
  const { id } = req.params;
  const { fullName, batchYear, email } = req.body;

  if (!fullName || !batchYear || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const query = 'UPDATE registrations SET full_name = $1, batch_year = $2, email = $3 WHERE id = $4 RETURNING *';
    const values = [fullName, batchYear, email, id];
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    
    res.json({ message: 'Registration updated successfully', user: result.rows[0] });
  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({ error: 'Failed to update registration' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
