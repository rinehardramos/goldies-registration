# Registration Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Goldies Day 2026 registration system with multi-registrant wizard, QR code invitations, JWT auth, Resend email, and admin check-in dashboard.

**Architecture:** Express 5 backend with modular route files, JWT auth (access + refresh tokens), QR generation via `qrcode` npm, email via Resend. React 19 frontend with AuthContext, Axios interceptors, and a multi-step registration wizard. PostgreSQL with new tables for invitations, check-ins, refresh tokens, and settings.

**Tech Stack:** React 19, React Router 7, Vite 7, Express 5, PostgreSQL 16, JWT (jsonwebtoken + cookie-parser), Resend, qrcode npm, Framer Motion, Lucide React

**Spec:** `docs/superpowers/specs/2026-05-05-registration-redesign.md`

---

## File Structure

### Backend (restructured from monolithic index.js)

```
backend/
  index.js                    — Express app setup, middleware, server start
  db.js                       — Pool creation and export
  migrate.js                  — Database schema initialization (replaces seed.js logic)
  middleware/
    auth.js                   — JWT verification middleware (requireAuth, requireAdmin)
  routes/
    auth.js                   — POST /api/auth/register, login, refresh, logout
    profile.js                — GET/PUT /api/profile, change-password
    invitations.js            — POST /api/invitations, GET /api/invitations, POST /api/invitations/:id/resend
    qr.js                     — GET /api/qr/:token (date-aware routing)
    checkin.js                — POST /api/checkin/:token, GET /api/checkin/stats
    attendees.js              — CRUD /api/attendees (user scope)
    admin.js                  — Admin endpoints (registrations, attendees, invitations, settings)
  services/
    email.js                  — Resend client, sendInvitation(), sendConfirmation()
    qr.js                     — generateQRCode(token) -> PNG buffer
    token.js                  — generateAccessToken(), generateRefreshToken(), verifyToken()
  templates/
    invitation.js             — HTML email template for invitations
    confirmation.js           — HTML email template for registration confirmation
  package.json
```

### Frontend (restructured)

```
frontend/src/
  main.jsx                    — Entry point
  App.jsx                     — Router with AuthProvider wrapper
  index.css                   — Global styles (redesigned UP gold/maroon)
  context/
    AuthContext.jsx            — JWT state, login/logout/refresh, user object
  hooks/
    useAuth.js                — Hook to consume AuthContext
    useApi.js                 — Axios instance with JWT interceptor
  services/
    api.js                    — API endpoint helper functions
  components/
    ui/
      Button.jsx              — Reusable button (variants: primary, secondary, ghost)
      Input.jsx               — Form input with label and error state
      Card.jsx                — Card container with shadow
      Modal.jsx               — Modal dialog
      Toast.jsx               — Toast notification system
      Tabs.jsx                — Tab navigation component
      Badge.jsx               — Status badge (pending, registered, checked-in)
      Stepper.jsx             — Wizard progress stepper
    layout/
      PageContainer.jsx       — Centered page wrapper with gradient background
      Header.jsx              — Page header with navigation
    auth/
      ProtectedRoute.jsx      — Route guard (checks auth + role)
      LoginForm.jsx           — Email/password form
    register/
      RegisterWizard.jsx      — Multi-step wizard controller
      StepWho.jsx             — "Myself" or "Someone else" radio + form fields
      StepReview.jsx          — Review registrants, add more
      StepInvite.jsx          — Optional email invite textarea
      StepSuccess.jsx         — Success confirmation screen
    qr/
      QRLanding.jsx           — Date-aware QR page logic
      CheckInCard.jsx         — Staff check-in confirmation card
      AlreadyRegistered.jsx   — "Already registered" info screen
    admin/
      Dashboard.jsx           — Stats overview
      RegistrantsTab.jsx      — Registrants table with search/filter/edit
      InvitationsTab.jsx      — Invitations table with resend/bulk invite
      CheckInTab.jsx          — QR scanner + manual search + recent check-ins
      SettingsTab.jsx         — Event date picker, event info
  pages/
    LoginPage.jsx             — Login form + event countdown
    RegisterPage.jsx          — Hosts RegisterWizard
    ProfilePage.jsx           — User profile + attendees + invite
    AdminPage.jsx             — Admin panel with tabs
    QRPage.jsx                — QR landing page (route: /qr/:token)
```

---

## Task 1: Backend — Database & Project Setup

**Files:**
- Create: `backend/db.js`
- Create: `backend/migrate.js`
- Modify: `backend/package.json`
- Modify: `backend/index.js`

- [ ] **Step 1: Install new backend dependencies**

```bash
cd backend && npm install jsonwebtoken cookie-parser resend qrcode uuid
```

- [ ] **Step 2: Create `backend/db.js`**

Extract the pool from index.js into its own module:

```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('onrender.com')
    ? { rejectUnauthorized: false }
    : false
});

module.exports = pool;
```

- [ ] **Step 3: Create `backend/migrate.js`**

Full schema initialization with all new tables:

```javascript
const pool = require('./db');

const migrate = async (retries = 5) => {
  while (retries > 0) {
    try {
      await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS registrations (
          id SERIAL PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          batch_year TEXT NOT NULL,
          is_admin BOOLEAN DEFAULT FALSE,
          qr_token UUID UNIQUE DEFAULT gen_random_uuid(),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS invitations (
          id SERIAL PRIMARY KEY,
          email TEXT NOT NULL,
          invited_by INTEGER REFERENCES registrations(id),
          qr_token UUID UNIQUE DEFAULT gen_random_uuid(),
          status TEXT DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS check_ins (
          id SERIAL PRIMARY KEY,
          registration_id INTEGER REFERENCES registrations(id),
          checked_in_by INTEGER REFERENCES registrations(id),
          checked_in_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
          token TEXT NOT NULL UNIQUE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);

      await pool.query(`
        INSERT INTO settings (key, value) VALUES ('event_date', '2026-07-25T10:00:00+08:00')
        ON CONFLICT (key) DO NOTHING
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

      console.log('Database migration complete');
      return;
    } catch (err) {
      console.error(`Migration error (${retries} retries left):`, err.message);
      retries -= 1;
      if (retries === 0) {
        console.error('Migration failed after all retries.');
        process.exit(1);
      }
      await new Promise(res => setTimeout(res, 5000));
    }
  }
};

module.exports = migrate;
```

- [ ] **Step 4: Update `backend/package.json` scripts**

```json
{
  "scripts": {
    "start": "node index.js",
    "migrate": "node -e \"require('./migrate')()\"",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

- [ ] **Step 5: Rewrite `backend/index.js` as slim app shell**

```javascript
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const migrate = require('./migrate');

const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const invitationRoutes = require('./routes/invitations');
const qrRoutes = require('./routes/qr');
const checkinRoutes = require('./routes/checkin');
const attendeesRoutes = require('./routes/attendees');
const adminRoutes = require('./routes/admin');

const app = express();
const port = process.env.PORT || 5001;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5180',
  'https://goldies2026.onrender.com',
  'https://goldies-backend-s3j5.onrender.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS not allowed'), false);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/attendees', attendeesRoutes);
app.use('/api/admin', adminRoutes);

migrate().then(() => {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
});
```

- [ ] **Step 6: Create `backend/.env.example`**

```
DATABASE_URL=postgresql://user:pass@localhost:5433/goldies_registration
JWT_SECRET=change-me-to-random-string
JWT_REFRESH_SECRET=change-me-to-another-random-string
RESEND_API_KEY=re_your_api_key_here
APP_URL=http://localhost:5180
ADMIN_EMAIL=admin@goldies.com
ADMIN_PASSWORD=AdminPass123!
```

- [ ] **Step 7: Commit**

```bash
git add backend/db.js backend/migrate.js backend/index.js backend/package.json backend/.env.example
git commit -m "refactor: restructure backend with modular architecture and new schema"
```

---

## Task 2: Backend — JWT Auth & Token Service

**Files:**
- Create: `backend/services/token.js`
- Create: `backend/middleware/auth.js`
- Create: `backend/routes/auth.js`

- [ ] **Step 1: Create `backend/services/token.js`**

```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-me';

function generateAccessToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, isAdmin: user.is_admin },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function generateRefreshToken() {
  return crypto.randomBytes(40).toString('hex');
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

async function saveRefreshToken(userId, token) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await pool.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, token, expiresAt]
  );
}

async function findRefreshToken(token) {
  const result = await pool.query(
    'SELECT * FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
    [token]
  );
  return result.rows[0] || null;
}

async function deleteRefreshToken(token) {
  await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
}

async function deleteAllUserRefreshTokens(userId) {
  await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  saveRefreshToken,
  findRefreshToken,
  deleteRefreshToken,
  deleteAllUserRefreshTokens
};
```

- [ ] **Step 2: Create `backend/middleware/auth.js`**

```javascript
const { verifyAccessToken } = require('../services/token');

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
}

module.exports = { requireAuth, requireAdmin };
```

- [ ] **Step 3: Create `backend/routes/auth.js`**

```javascript
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const {
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  findRefreshToken,
  deleteRefreshToken
} = require('../services/token');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password, batchYear, invitationToken } = req.body;

  if (!firstName || !lastName || !email || !password || !batchYear) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO registrations (first_name, last_name, email, password, batch_year)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, first_name, last_name, email, batch_year, is_admin, qr_token`,
      [firstName, lastName, email, hashedPassword, batchYear]
    );

    const user = result.rows[0];

    // If registering via invitation token, mark invitation as registered
    if (invitationToken) {
      await pool.query(
        `UPDATE invitations SET status = 'registered' WHERE qr_token = $1 AND email = $2`,
        [invitationToken, email]
      );
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await saveRefreshToken(user.id, refreshToken);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      message: 'Registration successful',
      accessToken,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        batchYear: user.batch_year,
        isAdmin: user.is_admin,
        qrToken: user.qr_token
      }
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email already registered' });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Missing email or password' });
  }

  try {
    const result = await pool.query('SELECT * FROM registrations WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();
    await saveRefreshToken(user.id, refreshToken);

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        batchYear: user.batch_year,
        isAdmin: user.is_admin,
        qrToken: user.qr_token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  try {
    const stored = await findRefreshToken(refreshToken);
    if (!stored) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    const userResult = await pool.query('SELECT * FROM registrations WHERE id = $1', [stored.user_id]);
    const user = userResult.rows[0];
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Rotate refresh token
    await deleteRefreshToken(refreshToken);
    const newRefreshToken = generateRefreshToken();
    await saveRefreshToken(user.id, newRefreshToken);

    const accessToken = generateAccessToken(user);

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      accessToken,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        batchYear: user.batch_year,
        isAdmin: user.is_admin,
        qrToken: user.qr_token
      }
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    await deleteRefreshToken(refreshToken);
  }

  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

module.exports = router;
```

- [ ] **Step 4: Commit**

```bash
git add backend/services/token.js backend/middleware/auth.js backend/routes/auth.js
git commit -m "feat: add JWT authentication with access/refresh token flow"
```

---

## Task 3: Backend — QR Code & Email Services

**Files:**
- Create: `backend/services/qr.js`
- Create: `backend/services/email.js`
- Create: `backend/templates/invitation.js`
- Create: `backend/templates/confirmation.js`

- [ ] **Step 1: Create `backend/services/qr.js`**

```javascript
const QRCode = require('qrcode');

const APP_URL = process.env.APP_URL || 'http://localhost:5180';

async function generateQRCodeBuffer(token) {
  const url = `${APP_URL}/qr/${token}`;
  const buffer = await QRCode.toBuffer(url, {
    type: 'png',
    width: 300,
    margin: 2,
    color: { dark: '#800000', light: '#FFFFFF' }
  });
  return buffer;
}

async function generateQRCodeDataURL(token) {
  const url = `${APP_URL}/qr/${token}`;
  return QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: '#800000', light: '#FFFFFF' }
  });
}

module.exports = { generateQRCodeBuffer, generateQRCodeDataURL };
```

- [ ] **Step 2: Create `backend/templates/invitation.js`**

```javascript
function invitationTemplate({ eventDate, qrCid }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background: #FFF9E6; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #FFFFFF; border-radius: 12px; padding: 40px; text-align: center; border-top: 4px solid #800000; }
    h1 { color: #800000; font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #B8860B; font-size: 16px; margin-bottom: 24px; }
    p { color: #333; font-size: 14px; line-height: 1.6; }
    .qr-container { margin: 24px 0; }
    .qr-container img { width: 200px; height: 200px; }
    .event-date { background: #800000; color: #FFD700; padding: 12px 24px; border-radius: 8px; display: inline-block; font-weight: bold; margin: 16px 0; }
    .footer { text-align: center; margin-top: 24px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>You're Invited!</h1>
      <p class="subtitle">Goldies Day 2026</p>
      <p>You've been invited to join us for Goldies Day 2026. Scan the QR code below or click it to register.</p>
      <div class="event-date">${eventDate}</div>
      <div class="qr-container">
        <img src="cid:${qrCid}" alt="Registration QR Code" />
      </div>
      <p>Scan this QR code to register for the event. On event day, show this same QR code at the door for check-in.</p>
    </div>
    <div class="footer">
      <p>University of the Philippines Alumni Association</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = invitationTemplate;
```

- [ ] **Step 3: Create `backend/templates/confirmation.js`**

```javascript
function confirmationTemplate({ firstName, lastName, batchYear, eventDate, qrCid }) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background: #FFF9E6; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .card { background: #FFFFFF; border-radius: 12px; padding: 40px; text-align: center; border-top: 4px solid #800000; }
    h1 { color: #800000; font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #B8860B; font-size: 16px; margin-bottom: 24px; }
    p { color: #333; font-size: 14px; line-height: 1.6; }
    .details { background: #FFF9E6; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: left; }
    .details strong { color: #800000; }
    .qr-container { margin: 24px 0; }
    .qr-container img { width: 200px; height: 200px; }
    .event-date { background: #800000; color: #FFD700; padding: 12px 24px; border-radius: 8px; display: inline-block; font-weight: bold; margin: 16px 0; }
    .instructions { background: #F0F0F0; border-radius: 8px; padding: 16px; margin-top: 16px; text-align: left; }
    .footer { text-align: center; margin-top: 24px; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1>You're Officially Registered!</h1>
      <p class="subtitle">Goldies Day 2026</p>
      <div class="details">
        <p><strong>Name:</strong> ${firstName} ${lastName}</p>
        <p><strong>Batch Year:</strong> ${batchYear}</p>
      </div>
      <div class="event-date">${eventDate}</div>
      <div class="qr-container">
        <img src="cid:${qrCid}" alt="Event QR Code" />
      </div>
      <div class="instructions">
        <p><strong>On event day:</strong></p>
        <p>Show this QR code at the entrance for check-in. Staff will scan it to confirm your attendance.</p>
      </div>
    </div>
    <div class="footer">
      <p>University of the Philippines Alumni Association</p>
    </div>
  </div>
</body>
</html>`;
}

module.exports = confirmationTemplate;
```

- [ ] **Step 4: Create `backend/services/email.js`**

```javascript
const { Resend } = require('resend');
const { generateQRCodeBuffer } = require('./qr');
const invitationTemplate = require('../templates/invitation');
const confirmationTemplate = require('../templates/confirmation');
const pool = require('../db');

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'Goldies Day 2026 <noreply@goldies2026.com>';

async function getEventDate() {
  const result = await pool.query("SELECT value FROM settings WHERE key = 'event_date'");
  const isoDate = result.rows[0]?.value || '2026-07-25T10:00:00+08:00';
  return new Date(isoDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Manila'
  });
}

async function sendInvitationEmail(email, qrToken) {
  const eventDate = await getEventDate();
  const qrBuffer = await generateQRCodeBuffer(qrToken);
  const qrCid = 'qr-code';

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "You're Invited to Goldies Day 2026!",
    html: invitationTemplate({ eventDate, qrCid }),
    attachments: [
      {
        filename: 'qr-code.png',
        content: qrBuffer,
        contentType: 'image/png',
        contentDisposition: 'inline',
        cid: qrCid
      }
    ]
  });
}

async function sendConfirmationEmail(email, { firstName, lastName, batchYear, qrToken }) {
  const eventDate = await getEventDate();
  const qrBuffer = await generateQRCodeBuffer(qrToken);
  const qrCid = 'qr-code';

  await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "You're Officially Registered for Goldies Day 2026!",
    html: confirmationTemplate({ firstName, lastName, batchYear, eventDate, qrCid }),
    attachments: [
      {
        filename: 'qr-code.png',
        content: qrBuffer,
        contentType: 'image/png',
        contentDisposition: 'inline',
        cid: qrCid
      }
    ]
  });
}

module.exports = { sendInvitationEmail, sendConfirmationEmail };
```

- [ ] **Step 5: Commit**

```bash
git add backend/services/qr.js backend/services/email.js backend/templates/invitation.js backend/templates/confirmation.js
git commit -m "feat: add QR code generation and Resend email services"
```

---

## Task 4: Backend — Invitations & QR Routes

**Files:**
- Create: `backend/routes/invitations.js`
- Create: `backend/routes/qr.js`

- [ ] **Step 1: Create `backend/routes/invitations.js`**

```javascript
const express = require('express');
const pool = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { sendInvitationEmail } = require('../services/email');

const router = express.Router();

// POST /api/invitations — send invitations (any authenticated user)
router.post('/', requireAuth, async (req, res) => {
  const { emails } = req.body; // array of email strings

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'emails array is required' });
  }

  try {
    const results = [];
    for (const email of emails) {
      const trimmed = email.trim().toLowerCase();
      if (!trimmed) continue;

      // Check if already registered
      const existing = await pool.query('SELECT id FROM registrations WHERE email = $1', [trimmed]);
      if (existing.rows.length > 0) {
        results.push({ email: trimmed, status: 'already_registered' });
        continue;
      }

      // Check if already invited
      const existingInvite = await pool.query(
        'SELECT id FROM invitations WHERE email = $1 AND status = $2',
        [trimmed, 'pending']
      );
      if (existingInvite.rows.length > 0) {
        results.push({ email: trimmed, status: 'already_invited' });
        continue;
      }

      // Create invitation
      const invite = await pool.query(
        'INSERT INTO invitations (email, invited_by) VALUES ($1, $2) RETURNING qr_token',
        [trimmed, req.user.id]
      );

      // Send email
      try {
        await sendInvitationEmail(trimmed, invite.rows[0].qr_token);
        results.push({ email: trimmed, status: 'sent' });
      } catch (emailErr) {
        console.error(`Failed to send email to ${trimmed}:`, emailErr.message);
        results.push({ email: trimmed, status: 'send_failed' });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Invitation error:', error);
    res.status(500).json({ error: 'Failed to process invitations' });
  }
});

// GET /api/invitations — list invitations (admin only)
router.get('/', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT i.id, i.email, i.status, i.qr_token as "qrToken", i.created_at as "createdAt",
             r.first_name || ' ' || r.last_name as "invitedBy"
      FROM invitations i
      LEFT JOIN registrations r ON i.invited_by = r.id
      ORDER BY i.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch invitations error:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// POST /api/invitations/:id/resend — resend invitation email (admin only)
router.post('/:id/resend', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      'SELECT email, qr_token FROM invitations WHERE id = $1 AND status = $2',
      [id, 'pending']
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Pending invitation not found' });
    }

    const { email, qr_token } = result.rows[0];
    await sendInvitationEmail(email, qr_token);

    res.json({ message: 'Invitation resent' });
  } catch (error) {
    console.error('Resend error:', error);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Create `backend/routes/qr.js`**

```javascript
const express = require('express');
const pool = require('../db');

const router = express.Router();

// GET /api/qr/:token — date-aware QR landing
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  try {
    // Get event date from settings
    const settingsResult = await pool.query("SELECT value FROM settings WHERE key = 'event_date'");
    const eventDateStr = settingsResult.rows[0]?.value || '2026-07-25T10:00:00+08:00';
    const eventDate = new Date(eventDateStr);
    const now = new Date();

    // Check if it's event day (same calendar date in PHT)
    const eventDay = eventDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const today = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const isEventDay = eventDay === today;

    // Look up token in registrations first
    const regResult = await pool.query(
      `SELECT id, first_name as "firstName", last_name as "lastName", email, batch_year as "batchYear"
       FROM registrations WHERE qr_token = $1`,
      [token]
    );

    if (regResult.rows.length > 0) {
      const registrant = regResult.rows[0];

      if (isEventDay) {
        // Check if already checked in
        const checkinResult = await pool.query(
          'SELECT checked_in_at FROM check_ins WHERE registration_id = $1',
          [registrant.id]
        );

        return res.json({
          type: 'checkin',
          registrant,
          alreadyCheckedIn: checkinResult.rows.length > 0,
          checkedInAt: checkinResult.rows[0]?.checked_in_at || null
        });
      } else {
        return res.json({
          type: 'already_registered',
          registrant,
          eventDate: eventDateStr
        });
      }
    }

    // Look up token in invitations
    const invResult = await pool.query(
      'SELECT id, email, status FROM invitations WHERE qr_token = $1',
      [token]
    );

    if (invResult.rows.length > 0) {
      const invitation = invResult.rows[0];

      if (invitation.status === 'registered') {
        return res.json({ type: 'already_registered', eventDate: eventDateStr });
      }

      // Pending invitation — redirect to register
      return res.json({
        type: 'register',
        email: invitation.email,
        token
      });
    }

    // Token not found
    res.status(404).json({ error: 'Invalid QR code' });
  } catch (error) {
    console.error('QR lookup error:', error);
    res.status(500).json({ error: 'Failed to process QR code' });
  }
});

module.exports = router;
```

- [ ] **Step 3: Commit**

```bash
git add backend/routes/invitations.js backend/routes/qr.js
git commit -m "feat: add invitation management and date-aware QR routing"
```

---

## Task 5: Backend — Check-in, Profile, Attendees & Admin Routes

**Files:**
- Create: `backend/routes/checkin.js`
- Create: `backend/routes/profile.js`
- Create: `backend/routes/attendees.js`
- Create: `backend/routes/admin.js`

- [ ] **Step 1: Create `backend/routes/checkin.js`**

```javascript
const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/checkin/stats — check-in statistics (admin only)
// NOTE: this must be defined BEFORE /:token to avoid route conflict
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const totalReg = await pool.query('SELECT COUNT(*) as count FROM registrations WHERE is_admin = FALSE');
    const totalCheckedIn = await pool.query('SELECT COUNT(*) as count FROM check_ins');
    const recent = await pool.query(`
      SELECT c.checked_in_at as "checkedInAt",
             r.first_name as "firstName", r.last_name as "lastName", r.batch_year as "batchYear"
      FROM check_ins c
      JOIN registrations r ON c.registration_id = r.id
      ORDER BY c.checked_in_at DESC
      LIMIT 20
    `);

    res.json({
      totalRegistered: parseInt(totalReg.rows[0].count),
      totalCheckedIn: parseInt(totalCheckedIn.rows[0].count),
      recentCheckIns: recent.rows
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// POST /api/checkin/:token — check in a registrant (admin only)
router.post('/:token', requireAdmin, async (req, res) => {
  const { token } = req.params;

  try {
    const regResult = await pool.query(
      'SELECT id, first_name as "firstName", last_name as "lastName", batch_year as "batchYear" FROM registrations WHERE qr_token = $1',
      [token]
    );

    if (regResult.rows.length === 0) {
      return res.status(404).json({ error: 'Registrant not found' });
    }

    const registrant = regResult.rows[0];

    // Check if already checked in
    const existing = await pool.query(
      'SELECT checked_in_at FROM check_ins WHERE registration_id = $1',
      [registrant.id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'Already checked in',
        checkedInAt: existing.rows[0].checked_in_at,
        registrant
      });
    }

    // Record check-in
    const checkin = await pool.query(
      'INSERT INTO check_ins (registration_id, checked_in_by) VALUES ($1, $2) RETURNING checked_in_at',
      [registrant.id, req.user.id]
    );

    res.json({
      message: 'Check-in successful',
      registrant,
      checkedInAt: checkin.rows[0].checked_in_at
    });
  } catch (error) {
    console.error('Check-in error:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

module.exports = router;
```

- [ ] **Step 2: Create `backend/routes/profile.js`**

```javascript
const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/profile — get own profile
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, first_name as "firstName", last_name as "lastName", email,
              batch_year as "batchYear", is_admin as "isAdmin", qr_token as "qrToken"
       FROM registrations WHERE id = $1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fetch profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/profile — update own profile
router.put('/', requireAuth, async (req, res) => {
  const { firstName, lastName, batchYear, email } = req.body;

  if (!firstName || !lastName || !batchYear || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `UPDATE registrations SET first_name = $1, last_name = $2, batch_year = $3, email = $4
       WHERE id = $5
       RETURNING id, first_name as "firstName", last_name as "lastName", email, batch_year as "batchYear"`,
      [firstName, lastName, batchYear, email, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'Profile updated', user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email already in use' });
    }
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/profile/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const userResult = await pool.query('SELECT password FROM registrations WHERE id = $1', [req.user.id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE registrations SET password = $1 WHERE id = $2', [hashedNewPassword, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
```

- [ ] **Step 3: Create `backend/routes/attendees.js`**

```javascript
const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/attendees
router.post('/', requireAuth, async (req, res) => {
  const { fullName, email, phone, batchYear, address } = req.body;

  if (!fullName || !email || !phone) {
    return res.status(400).json({ error: 'fullName, email, and phone are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO attendees (user_id, full_name, email, phone, batch_year, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, full_name as "fullName", email, phone, batch_year as "batchYear", address, created_at as "createdAt"`,
      [req.user.id, fullName, email, phone, batchYear || null, address || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      const field = error.constraint === 'attendees_email_key' ? 'Email' : 'Phone';
      return res.status(400).json({ error: `${field} already registered` });
    }
    console.error('Create attendee error:', error);
    res.status(500).json({ error: 'Failed to create attendee' });
  }
});

// GET /api/attendees
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, full_name as "fullName", email, phone, batch_year as "batchYear", address, created_at as "createdAt"
       FROM attendees WHERE user_id = $1 AND is_archived = FALSE ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch attendees error:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

// PUT /api/attendees/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { fullName, email, phone, batchYear, address } = req.body;

  if (!fullName || !email || !phone) {
    return res.status(400).json({ error: 'fullName, email, and phone are required' });
  }

  try {
    const result = await pool.query(
      `UPDATE attendees SET full_name = $1, email = $2, phone = $3, batch_year = $4, address = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND user_id = $7 AND is_archived = FALSE
       RETURNING id, full_name as "fullName", email, phone, batch_year as "batchYear", address`,
      [fullName, email, phone, batchYear || null, address || null, id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      const field = error.constraint === 'attendees_email_key' ? 'Email' : 'Phone';
      return res.status(400).json({ error: `${field} already registered` });
    }
    console.error('Update attendee error:', error);
    res.status(500).json({ error: 'Failed to update attendee' });
  }
});

// DELETE /api/attendees/:id (archive)
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE attendees SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2 AND is_archived = FALSE RETURNING id`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    res.json({ message: 'Attendee archived' });
  } catch (error) {
    console.error('Archive attendee error:', error);
    res.status(500).json({ error: 'Failed to archive attendee' });
  }
});

module.exports = router;
```

- [ ] **Step 4: Create `backend/routes/admin.js`**

```javascript
const express = require('express');
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/admin/registrations
router.get('/registrations', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, first_name as "firstName", last_name as "lastName", email,
             batch_year as "batchYear", is_admin as "isAdmin", created_at as "createdAt"
      FROM registrations ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch registrations error:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// PUT /api/admin/registrations/:id
router.put('/registrations/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, batchYear, email } = req.body;

  if (!firstName || !lastName || !batchYear || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `UPDATE registrations SET first_name = $1, last_name = $2, batch_year = $3, email = $4
       WHERE id = $5
       RETURNING id, first_name as "firstName", last_name as "lastName", email, batch_year as "batchYear"`,
      [firstName, lastName, batchYear, email, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Email already in use' });
    }
    console.error('Update registration error:', error);
    res.status(500).json({ error: 'Failed to update registration' });
  }
});

// GET /api/admin/attendees
router.get('/attendees', requireAdmin, async (req, res) => {
  const { includeArchived } = req.query;

  try {
    const result = await pool.query(`
      SELECT a.id, a.full_name as "fullName", a.email, a.phone, a.batch_year as "batchYear",
             a.address, a.is_archived as "isArchived", a.created_at as "createdAt",
             r.first_name || ' ' || r.last_name as "ownerName", r.email as "ownerEmail"
      FROM attendees a
      LEFT JOIN registrations r ON a.user_id = r.id
      ${includeArchived === 'true' ? '' : 'WHERE a.is_archived = FALSE'}
      ORDER BY a.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch attendees error:', error);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

// DELETE /api/admin/attendees/:id (archive)
router.delete('/attendees/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `UPDATE attendees SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    res.json({ message: 'Attendee archived' });
  } catch (error) {
    console.error('Archive attendee error:', error);
    res.status(500).json({ error: 'Failed to archive attendee' });
  }
});

// GET /api/admin/settings
router.get('/settings', requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT key, value FROM settings');
    const settings = {};
    result.rows.forEach(row => { settings[row.key] = row.value; });
    res.json(settings);
  } catch (error) {
    console.error('Fetch settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/settings
router.put('/settings', requireAdmin, async (req, res) => {
  const { key, value } = req.body;

  if (!key || !value) {
    return res.status(400).json({ error: 'key and value are required' });
  }

  try {
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
      [key, value]
    );
    res.json({ message: 'Setting updated' });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// GET /api/admin/dashboard
router.get('/dashboard', requireAdmin, async (req, res) => {
  try {
    const [regCount, invCount, pendingCount, checkinCount] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM registrations WHERE is_admin = FALSE'),
      pool.query('SELECT COUNT(*) as count FROM invitations'),
      pool.query("SELECT COUNT(*) as count FROM invitations WHERE status = 'pending'"),
      pool.query('SELECT COUNT(*) as count FROM check_ins')
    ]);

    res.json({
      totalRegistered: parseInt(regCount.rows[0].count),
      totalInvitations: parseInt(invCount.rows[0].count),
      pendingInvitations: parseInt(pendingCount.rows[0].count),
      totalCheckedIn: parseInt(checkinCount.rows[0].count)
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

module.exports = router;
```

- [ ] **Step 5: Commit**

```bash
git add backend/routes/checkin.js backend/routes/profile.js backend/routes/attendees.js backend/routes/admin.js
git commit -m "feat: add check-in, profile, attendees, and admin routes"
```

---

## Task 6: Frontend — Project Setup & Auth Context

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/src/context/AuthContext.jsx`
- Create: `frontend/src/hooks/useAuth.js`
- Create: `frontend/src/hooks/useApi.js`
- Create: `frontend/src/services/api.js`
- Create: `frontend/src/components/auth/ProtectedRoute.jsx`
- Modify: `frontend/src/App.jsx`

- [ ] **Step 1: Install frontend dependencies**

```bash
cd frontend && npm install react-hot-toast
```

- [ ] **Step 2: Create `frontend/src/services/api.js`**

```javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,
});

let accessToken = null;

export function setAccessToken(token) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { data } = await axios.post(
          `${API_URL}/api/auth/refresh`,
          {},
          { withCredentials: true }
        );
        setAccessToken(data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        accessToken = null;
        window.location.href = '/';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

- [ ] **Step 3: Create `frontend/src/context/AuthContext.jsx`**

```javascript
import React, { createContext, useState, useEffect } from 'react';
import api, { setAccessToken } from '../services/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshAuth();
  }, []);

  async function refreshAuth() {
    try {
      const { data } = await api.post('/auth/refresh');
      setAccessToken(data.accessToken);
      setUser(data.user);
    } catch {
      setUser(null);
      setAccessToken(null);
    } finally {
      setLoading(false);
    }
  }

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }

  async function register(formData) {
    const { data } = await api.post('/auth/register', formData);
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }

  async function logout() {
    try {
      await api.post('/auth/logout');
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshAuth }}>
      {children}
    </AuthContext.Provider>
  );
}
```

- [ ] **Step 4: Create `frontend/src/hooks/useAuth.js`**

```javascript
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

- [ ] **Step 5: Create `frontend/src/hooks/useApi.js`**

```javascript
import api from '../services/api';

export function useApi() {
  return api;
}
```

- [ ] **Step 6: Create `frontend/src/components/auth/ProtectedRoute.jsx`**

```javascript
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (requireAdmin && !user.isAdmin) {
    return <Navigate to="/profile" replace />;
  }

  return children;
}
```

- [ ] **Step 7: Rewrite `frontend/src/App.jsx`**

```javascript
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import QRPage from './pages/QRPage';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/qr/:token" element={<QRPage />} />
          <Route path="/profile" element={
            <ProtectedRoute><ProfilePage /></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute requireAdmin><AdminPage /></ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
      <Toaster position="top-right" />
    </AuthProvider>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/services/api.js frontend/src/context/AuthContext.jsx frontend/src/hooks/ frontend/src/components/auth/ProtectedRoute.jsx frontend/src/App.jsx frontend/package.json
git commit -m "feat: add JWT auth context, API service with interceptors, protected routes"
```

---

## Task 7: Frontend — UI Components & Layout

**Files:**
- Create: `frontend/src/components/ui/Button.jsx`
- Create: `frontend/src/components/ui/Input.jsx`
- Create: `frontend/src/components/ui/Card.jsx`
- Create: `frontend/src/components/ui/Modal.jsx`
- Create: `frontend/src/components/ui/Tabs.jsx`
- Create: `frontend/src/components/ui/Badge.jsx`
- Create: `frontend/src/components/ui/Stepper.jsx`
- Create: `frontend/src/components/layout/PageContainer.jsx`

- [ ] **Step 1: Create all UI components**

Create each component as described in the file structure. Use Framer Motion for animations, Lucide React for icons. Each component should be self-contained with props documented by usage.

**Button.jsx** — variants: primary (maroon bg), secondary (gold border), ghost (transparent), danger (red). Sizes: sm, md, lg. Props: children, variant, size, disabled, loading, onClick, type, className. Uses framer-motion whileHover/whileTap.

**Input.jsx** — Props: label, error, type, ...rest. Renders label, input field, error message.

**Card.jsx** — Animated container with framer-motion fade-in. Props: children, className.

**Modal.jsx** — AnimatePresence overlay with centered content. Props: open, onClose, title, children. Close button uses Lucide X icon.

**Tabs.jsx** — Horizontal tab bar. Props: tabs (array of {id, label, icon}), active, onChange.

**Badge.jsx** — Status indicator. Props: status. Maps status to color class and display label.

**Stepper.jsx** — Horizontal step indicator with circles and connecting lines. Props: steps (string[]), currentStep. Shows checkmark for completed steps.

**PageContainer.jsx** — Full-page wrapper with gradient background and centered content area. Uses framer-motion fade-in.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ui/ frontend/src/components/layout/
git commit -m "feat: add reusable UI components (Button, Input, Card, Modal, Tabs, Badge, Stepper)"
```

---

## Task 8: Frontend — Global Styles Redesign

**Files:**
- Rewrite: `frontend/src/index.css`

- [ ] **Step 1: Rewrite `frontend/src/index.css` with full design system**

CSS custom properties:
```css
:root {
  --color-maroon: #800000;
  --color-maroon-dark: #5C0000;
  --color-gold: #FFD700;
  --color-gold-dark: #B8860B;
  --color-gold-light: #FFF9E6;
  --color-cream: #FFFDF5;
  --color-white: #FFFFFF;
  --color-gray-100: #F7F7F7;
  --color-gray-200: #E5E5E5;
  --color-gray-500: #666666;
  --color-gray-800: #333333;
  --color-success: #16A34A;
  --color-error: #DC2626;
  --color-warning: #F59E0B;
  --font-family: 'Outfit', sans-serif;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 16px;
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.1);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
}
```

Must include styles for: page-container, card, btn (all variants and sizes), input-group/input-field/input-label/input-error, modal-overlay/modal-content, tabs/tab/tab-active, badge (all statuses), stepper/stepper-item/stepper-circle/stepper-line, loading-screen, radio-group/radio-option, registrant-card/registrant-list, step-actions, stats-grid/stat-card, admin-header/admin-content, checkin-card (success/duplicate states), login-page/login-header/login-card, register-page/register-header/wizard-card, qr-page, already-registered, settings-tab, success-icon/success-details/success-info, btn-spinner animation.

Mobile-first responsive with breakpoint at 768px. Background: subtle warm gradient (cream to light gold).

- [ ] **Step 2: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat: redesign global styles with UP gold/maroon design system"
```

---

## Task 9: Frontend — Login Page

**Files:**
- Rewrite: `frontend/src/pages/LoginPage.jsx`

- [ ] **Step 1: Rewrite LoginPage.jsx**

```javascript
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import PageContainer from '../components/layout/PageContainer';
import Card from '../components/ui/Card';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Countdown from '../components/Countdown';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  // Redirect if already logged in
  if (user) {
    navigate(user.isAdmin ? '/admin' : '/profile', { replace: true });
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const loggedInUser = await login(email, password);
      toast.success('Welcome back!');
      navigate(loggedInUser.isAdmin ? '/admin' : '/profile');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageContainer>
      <div className="login-page">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="login-header"
        >
          <h1>Goldies Day 2026</h1>
          <Countdown />
        </motion.div>

        <Card className="login-card">
          <h2>Sign In</h2>
          <form onSubmit={handleSubmit}>
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <Button type="submit" variant="primary" size="lg" loading={loading} className="login-btn">
              Sign In
            </Button>
          </form>
          <p className="login-footer">
            Don't have an account? <Link to="/register">Register here</Link>
          </p>
        </Card>
      </div>
    </PageContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/LoginPage.jsx
git commit -m "feat: redesign login page with auth context and toast notifications"
```

---

## Task 10: Frontend — Registration Wizard

**Files:**
- Create: `frontend/src/components/register/RegisterWizard.jsx`
- Create: `frontend/src/components/register/StepWho.jsx`
- Create: `frontend/src/components/register/StepReview.jsx`
- Create: `frontend/src/components/register/StepInvite.jsx`
- Create: `frontend/src/components/register/StepSuccess.jsx`
- Create: `frontend/src/pages/RegisterPage.jsx`

- [ ] **Step 1: Create RegisterWizard.jsx** — multi-step controller with state for registrants array and currentStep. Uses Stepper component. Reads `token` and `email` from URL search params for invitation flow.

- [ ] **Step 2: Create StepWho.jsx** — radio select (Myself/Someone else), form with firstName, lastName, email, batchYear dropdown (1970-2020), password + confirm (only for "Myself"). Client-side validation. On submit, adds to registrants array and advances.

- [ ] **Step 3: Create StepReview.jsx** — lists registrant cards with remove button. "Add another" loops back. "Continue" calls auth register for "myself" type and sends invitations for "someone else" types.

- [ ] **Step 4: Create StepInvite.jsx** — textarea for email addresses (comma/newline separated). "Send Invites & Complete" or "Skip" buttons. Calls POST /api/invitations.

- [ ] **Step 5: Create StepSuccess.jsx** — animated checkmark, "You're Officially Registered!" message, event details, link to profile.

- [ ] **Step 6: Create RegisterPage.jsx** — wrapper with header (title + countdown) and RegisterWizard component.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/register/ frontend/src/pages/RegisterPage.jsx
git commit -m "feat: add multi-registrant registration wizard with invitation flow"
```

---

## Task 11: Frontend — QR Landing Page

**Files:**
- Create: `frontend/src/pages/QRPage.jsx`
- Create: `frontend/src/components/qr/AlreadyRegistered.jsx`
- Create: `frontend/src/components/qr/CheckInCard.jsx`

- [ ] **Step 1: Create AlreadyRegistered.jsx** — shows registrant info, event date, and instructions to show QR on event day.

- [ ] **Step 2: Create CheckInCard.jsx** — three states: (a) confirm check-in button with registrant details, (b) success with animated checkmark after confirming, (c) "Already checked in" warning with timestamp for duplicate scans. Calls POST /api/checkin/:token.

- [ ] **Step 3: Create QRPage.jsx** — reads token from URL params, calls GET /api/qr/:token on mount. Routes to: AlreadyRegistered (type=already_registered), CheckInCard (type=checkin), or redirects to /register with token+email params (type=register).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/QRPage.jsx frontend/src/components/qr/
git commit -m "feat: add QR landing page with date-aware check-in and registration redirect"
```

---

## Task 12: Frontend — Profile Page

**Files:**
- Rewrite: `frontend/src/pages/ProfilePage.jsx`

- [ ] **Step 1: Rewrite ProfilePage.jsx**

Sections:
1. Personal details (first name, last name, email, batch year) with edit/save
2. Security (change password form with current/new/confirm)
3. My QR Code (display QR code as image using the qrToken from user profile — generate data URL client-side or fetch from API)
4. My Attendees (list, add form, edit, archive buttons)
5. Invite Others (email textarea + send button)
6. Logout button

Use useAuth for user data, api service for CRUD, toast for notifications, Card/Input/Button components.

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/ProfilePage.jsx
git commit -m "feat: redesign profile page with attendees, invites, and QR display"
```

---

## Task 13: Frontend — Admin Page

**Files:**
- Rewrite: `frontend/src/pages/AdminPage.jsx`
- Create: `frontend/src/components/admin/Dashboard.jsx`
- Create: `frontend/src/components/admin/RegistrantsTab.jsx`
- Create: `frontend/src/components/admin/InvitationsTab.jsx`
- Create: `frontend/src/components/admin/CheckInTab.jsx`
- Create: `frontend/src/components/admin/SettingsTab.jsx`

- [ ] **Step 1: Create Dashboard.jsx** — 4 stat cards (registered, invitations, pending, checked-in). Fetches from GET /api/admin/dashboard.

- [ ] **Step 2: Create RegistrantsTab.jsx** — table with search/filter by name/email/batch, inline editing, export to Excel using xlsx package.

- [ ] **Step 3: Create InvitationsTab.jsx** — table with status badges, resend button per row, bulk invite form (textarea + send).

- [ ] **Step 4: Create CheckInTab.jsx** — stats bar, text input for QR scanner (accepts pasted/scanned URL, extracts token, auto-checks-in), manual search by name/email, recent check-ins list, confirmation card display.

- [ ] **Step 5: Create SettingsTab.jsx** — event date datetime-local picker, save button. Fetches/updates from /api/admin/settings.

- [ ] **Step 6: Rewrite AdminPage.jsx** — tab-based layout with header, logout, and all 5 tabs (Dashboard, Registrants, Invitations, Check-in, Settings).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/AdminPage.jsx frontend/src/components/admin/
git commit -m "feat: redesign admin panel with dashboard, invitations, check-in, and settings tabs"
```

---

## Task 14: Cleanup & Final Backend Wiring

**Files:**
- Modify: `backend/routes/auth.js` (add confirmation email)
- Modify: `backend/migrate.js` (add admin seed)
- Delete: `frontend/src/pages/RegistrationPage.jsx`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add confirmation email to auth register route**

In `backend/routes/auth.js`, add at top:
```javascript
const { sendConfirmationEmail } = require('../services/email');
```

After `const user = result.rows[0];` in the register handler, add:
```javascript
sendConfirmationEmail(email, {
  firstName,
  lastName,
  batchYear,
  qrToken: user.qr_token
}).catch(err => console.error('Failed to send confirmation email:', err.message));
```

- [ ] **Step 2: Add admin seeding to migrate.js**

Before `console.log('Database migration complete')`:
```javascript
const adminEmail = process.env.ADMIN_EMAIL || 'admin@goldies.com';
const adminPassword = process.env.ADMIN_PASSWORD || 'AdminPass123!';
const existingAdmin = await pool.query('SELECT id FROM registrations WHERE email = $1', [adminEmail]);
if (existingAdmin.rows.length === 0) {
  const bcrypt = require('bcryptjs');
  const hashedPassword = await bcrypt.hash(adminPassword, 10);
  await pool.query(
    `INSERT INTO registrations (first_name, last_name, email, password, batch_year, is_admin)
     VALUES ($1, $2, $3, $4, $5, TRUE)`,
    ['Admin', 'User', adminEmail, hashedPassword, '2000']
  );
  console.log(`Admin user seeded: ${adminEmail}`);
}
```

- [ ] **Step 3: Delete old RegistrationPage.jsx**

```bash
rm frontend/src/pages/RegistrationPage.jsx
```

- [ ] **Step 4: Update docker-compose.yml**

Add these environment variables to the backend service (using placeholder values — real values go in .env):
- JWT_SECRET
- JWT_REFRESH_SECRET
- RESEND_API_KEY (use `${RESEND_API_KEY:-re_placeholder}`)
- APP_URL=http://localhost:5180
- ADMIN_EMAIL=admin@goldies.com
- ADMIN_PASSWORD=AdminPass123!

- [ ] **Step 5: Commit**

```bash
git add backend/routes/auth.js backend/migrate.js docker-compose.yml
git rm frontend/src/pages/RegistrationPage.jsx
git commit -m "feat: add confirmation email, admin seed, and cleanup old files"
```

---

## Task 15: Integration Verification

- [ ] **Step 1: Start the application**

```bash
docker compose down -v && docker compose up --build
```

- [ ] **Step 2: Verify backend health**

```bash
curl http://localhost:5001/api/health
```

Expected: `{"status":"ok","timestamp":"..."}`

- [ ] **Step 3: Verify admin login**

```bash
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@goldies.com","password":"AdminPass123!"}' \
  -c cookies.txt
```

Expected: JSON with `accessToken` and `user` object with `isAdmin: true`.

- [ ] **Step 4: Verify registration flow**

```bash
curl -X POST http://localhost:5001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Test","lastName":"User","email":"test@example.com","password":"TestPass123!","batchYear":"1990"}'
```

Expected: 201 with `accessToken`, `user` with `qrToken`.

- [ ] **Step 5: Verify QR token lookup**

Using the `qrToken` from Step 4:

```bash
curl http://localhost:5001/api/qr/<qr_token_from_step_4>
```

Expected: `{"type":"already_registered","registrant":{...},"eventDate":"..."}`

- [ ] **Step 6: Verify frontend loads**

Open `http://localhost:5180` in browser. Should show redesigned login page with gold/maroon branding and countdown.

- [ ] **Step 7: Fix any issues found and commit**
