const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
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
const dbPath = process.env.DB_PATH || 'goldies.db';
const db = new Database(dbPath);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batchYear TEXT NOT NULL,
    fullName TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// API Endpoints
app.post('/api/register', async (req, res) => {
  const { batchYear, fullName, email, password } = req.body;

  if (!batchYear || !fullName || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO registrations (batchYear, fullName, email, password) VALUES (?, ?, ?, ?)');
    const info = stmt.run(batchYear, fullName, email, hashedPassword);
    res.status(201).json({ id: info.lastInsertRowid, message: 'Registration successful' });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
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
    const user = db.prepare('SELECT * FROM registrations WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // In a real app, we would return a JWT here
    res.json({ message: 'Login successful', user: { id: user.id, fullName: user.fullName } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/api/registrations', (req, res) => {
  try {
    const registrations = db.prepare('SELECT id, batchYear, fullName, email, createdAt FROM registrations ORDER BY createdAt DESC').all();
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
