'use strict';
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const migrate = require('./migrate');

const app = express();
const port = process.env.PORT || 5001;

// ── CORS ────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5180',
  'https://goldies2026.onrender.com',
  'https://goldies-backend-s3j5.onrender.com',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Core middleware ──────────────────────────────────────────────────────────
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/invitations', require('./routes/invitations'));
app.use('/api/qr',          require('./routes/qr'));
app.use('/api/checkin',     require('./routes/checkin'));
app.use('/api/profile',     require('./routes/profile'));
app.use('/api/attendees',   require('./routes/attendees'));
app.use('/api/admin',       require('./routes/admin'));

// ── Bootstrap ────────────────────────────────────────────────────────────────
migrate().then(() => {
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
});
