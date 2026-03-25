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
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5180',
  'https://goldies2026.onrender.com',
  'https://goldies-backend-s3j5.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
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
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS attendees (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
          full_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          phone TEXT NOT NULL UNIQUE,
          batch_year TEXT,
          address TEXT,
          is_archived BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      console.log('PostgreSQL Tables initialized');
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

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
    console.log(`Login attempt for: ${email}`);
    const query = 'SELECT * FROM registrations WHERE email = $1';
    const result = await pool.query(query, [email]);
    const user = result.rows[0];

    if (!user) {
      console.log(`Login failed: User not found for ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`Login failed: Password mismatch for ${email}`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log(`Login successful for: ${email}`);

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

app.get('/api/profile/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT id, batch_year as "batchYear", full_name as "fullName", email, is_admin as "isAdmin" FROM registrations WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.put('/api/profile/:id', async (req, res) => {
  const { id } = req.params;
  const { fullName, batchYear, email } = req.body;

  if (!fullName || !batchYear || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const query = 'UPDATE registrations SET full_name = $1, batch_year = $2, email = $3 WHERE id = $4 RETURNING id, full_name as "fullName", batch_year as "batchYear", email';
    const values = [fullName, batchYear, email, id];
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ message: 'Profile updated successfully', user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email already in use' });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

app.post('/api/profile/:id/change-password', async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const userResult = await pool.query('SELECT password FROM registrations WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE registrations SET password = $1 WHERE id = $2', [hashedNewPassword, id]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// ========== ATTENDEES ENDPOINTS ==========

app.post('/api/attendees', async (req, res) => {
  const { userId, fullName, email, phone, batchYear, address } = req.body;

  if (!userId || !fullName || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields: userId, fullName, email, and phone are required' });
  }

  try {
    const query = `
      INSERT INTO attendees (user_id, full_name, email, phone, batch_year, address)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, full_name as "fullName", email, phone, batch_year as "batchYear", address, is_archived as "isArchived", created_at as "createdAt"
    `;
    const values = [userId, fullName, email, phone, batchYear || null, address || null];
    const result = await pool.query(query, values);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      if (error.constraint === 'attendees_email_key') {
        return res.status(400).json({ error: 'Email already registered as an attendee' });
      }
      if (error.constraint === 'attendees_phone_key') {
        return res.status(400).json({ error: 'Phone number already registered as an attendee' });
      }
    }
    console.error('Create attendee error:', error);
    res.status(500).json({ error: 'Failed to create attendee' });
  }
});

app.get('/api/attendees', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  try {
    const query = `
      SELECT id, full_name as "fullName", email, phone, batch_year as "batchYear", address, is_archived as "isArchived", created_at as "createdAt"
      FROM attendees
      WHERE user_id = $1 AND is_archived = FALSE
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch attendees error:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

app.get('/api/attendees/:id', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.query;

  try {
    const query = `
      SELECT id, user_id as "userId", full_name as "fullName", email, phone, batch_year as "batchYear", address, is_archived as "isArchived", created_at as "createdAt"
      FROM attendees
      WHERE id = $1
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }

    const attendee = result.rows[0];
    if (userId && attendee.userId !== parseInt(userId)) {
      return res.status(403).json({ error: 'Not authorized to view this attendee' });
    }

    res.json(attendee);
  } catch (error) {
    console.error('Fetch attendee error:', error);
    res.status(500).json({ error: 'Failed to fetch attendee' });
  }
});

app.put('/api/attendees/:id', async (req, res) => {
  const { id } = req.params;
  const { fullName, email, phone, batchYear, address } = req.body;

  if (!fullName || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields: fullName, email, and phone are required' });
  }

  try {
    const query = `
      UPDATE attendees
      SET full_name = $1, email = $2, phone = $3, batch_year = $4, address = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND is_archived = FALSE
      RETURNING id, full_name as "fullName", email, phone, batch_year as "batchYear", address, is_archived as "isArchived", created_at as "createdAt"
    `;
    const values = [fullName, email, phone, batchYear || null, address || null, id];
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found or archived' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      if (error.constraint === 'attendees_email_key') {
        return res.status(400).json({ error: 'Email already registered as an attendee' });
      }
      if (error.constraint === 'attendees_phone_key') {
        return res.status(400).json({ error: 'Phone number already registered as an attendee' });
      }
    }
    console.error('Update attendee error:', error);
    res.status(500).json({ error: 'Failed to update attendee' });
  }
});

app.delete('/api/attendees/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      UPDATE attendees
      SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND is_archived = FALSE
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found or already archived' });
    }
    
    res.json({ message: 'Attendee archived successfully' });
  } catch (error) {
    console.error('Archive attendee error:', error);
    res.status(500).json({ error: 'Failed to archive attendee' });
  }
});

// ========== ADMIN ATTENDEES ENDPOINTS ==========

app.get('/api/admin/attendees', async (req, res) => {
  const { includeArchived } = req.query;

  try {
    const query = `
      SELECT a.id, a.user_id as "userId", a.full_name as "fullName", a.email, a.phone, a.batch_year as "batchYear", a.address, a.is_archived as "isArchived", a.created_at as "createdAt",
             r.full_name as "ownerName", r.email as "ownerEmail"
      FROM attendees a
      LEFT JOIN registrations r ON a.user_id = r.id
      ${includeArchived === 'true' ? '' : 'WHERE a.is_archived = FALSE'}
      ORDER BY a.created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch admin attendees error:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

app.put('/api/admin/attendees/:id', async (req, res) => {
  const { id } = req.params;
  const { fullName, email, phone, batchYear, address } = req.body;

  if (!fullName || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields: fullName, email, and phone are required' });
  }

  try {
    const query = `
      UPDATE attendees
      SET full_name = $1, email = $2, phone = $3, batch_year = $4, address = $5, updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING id, full_name as "fullName", email, phone, batch_year as "batchYear", address, is_archived as "isArchived", created_at as "createdAt"
    `;
    const values = [fullName, email, phone, batchYear || null, address || null, id];
    const result = await pool.query(query, values);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      if (error.constraint === 'attendees_email_key') {
        return res.status(400).json({ error: 'Email already registered as an attendee' });
      }
      if (error.constraint === 'attendees_phone_key') {
        return res.status(400).json({ error: 'Phone number already registered as an attendee' });
      }
    }
    console.error('Admin update attendee error:', error);
    res.status(500).json({ error: 'Failed to update attendee' });
  }
});

app.delete('/api/admin/attendees/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const query = `
      UPDATE attendees
      SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `;
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    
    res.json({ message: 'Attendee archived successfully' });
  } catch (error) {
    console.error('Admin archive attendee error:', error);
    res.status(500).json({ error: 'Failed to archive attendee' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
