'use strict';
const express    = require('express');
const cors       = require('cors');
const morgan     = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit  = require('express-rate-limit');
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
  'https://goldies-frontend-production.up.railway.app',
  'https://goldies-registration-production.up.railway.app',
  'https://goldies.space',
];

app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// ── Rate limiting ────────────────────────────────────────────────────────────
// Tight limit on auth endpoints to slow brute-force / credential-stuffing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Moderate limit on public QR lookups
const qrLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

// Global fallback – generous but still bounded
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});

app.use(globalLimiter);

// ── Core middleware ──────────────────────────────────────────────────────────
// 10 kb body cap — prevents memory-exhaustion / buffer-overflow via large payloads
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.use(morgan('dev'));

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Routes ───────────────────────────────────────────────────────────────────
const authRouter = require('./routes/auth');

// /api/login  – top-level login endpoint the frontend uses
app.post('/api/login', authLimiter, authRouter.loginHandler);

app.use('/api/auth',        authLimiter, authRouter);
app.use('/api/qr',          qrLimiter,  require('./routes/qr'));
app.use('/api/invitations', require('./routes/invitations'));
app.use('/api/checkin',     require('./routes/checkin'));
app.use('/api/profile',     require('./routes/profile'));
app.use('/api/attendees',   require('./routes/attendees'));
app.use('/api/admin',       require('./routes/admin'));

// ── Bootstrap ────────────────────────────────────────────────────────────────
migrate().then(() => {
  app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
});
