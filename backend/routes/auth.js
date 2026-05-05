'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db');
const tokenService = require('../services/token');
const { requireAuth } = require('../middleware/auth');
const { validators, validationError } = require('../middleware/validate');

const router = express.Router();

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000,
};

// Helper to shape a user row into the expected API response shape
const shapeUser = (user) => ({
  id:        user.id,
  firstName: user.first_name,
  lastName:  user.last_name,
  email:     user.email,
  batchYear: user.batch_year,
  isAdmin:   user.is_admin,
  qrToken:   user.qr_token,
});

// Reusable login handler – exported so /api/login can use it too
const loginHandler = async (req, res) => {
  const { email, password } = req.body;

  if (validationError(res, {
    email:    () => validators.email(email),
    password: () => (typeof password === 'string' && password.length ? null : 'required'),
  })) return;

  try {
    console.log('Login attempt for: ' + email);
    const { rows } = await pool.query(
      'SELECT * FROM registrations WHERE email = $1',
      [email.trim().toLowerCase()],
    );
    const user = rows[0];

    if (!user) {
      console.log('Login failed: user not found for ' + email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log('Login failed: password mismatch for ' + email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    console.log('Login successful for: ' + email);

    const payload = { id: user.id, email: user.email, isAdmin: user.is_admin };
    const accessToken = tokenService.signAccess(payload);
    const refreshToken = await tokenService.signRefresh(payload);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
    res.json({ accessToken, user: shapeUser(user) });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { firstName, lastName, email, password, batchYear, invitationToken } = req.body;

  if (validationError(res, {
    firstName: () => validators.name(firstName),
    lastName:  () => validators.name(lastName),
    email:     () => validators.email(email),
    password:  () => validators.password(password),
    batchYear: () => validators.batchYear(batchYear),
  })) return;

  // batchYear is required for registration
  if (!batchYear) {
    return res.status(400).json({ error: 'Validation failed', errors: { batchYear: 'required' } });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO registrations (first_name, last_name, email, password, batch_year)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [firstName.trim(), lastName.trim(), email.trim().toLowerCase(), hashedPassword, batchYear],
    );
    const user = rows[0];

    // Mark invitation as registered if an invitation token was provided
    if (invitationToken) {
      await pool.query(
        `UPDATE invitations SET status = 'registered' WHERE qr_token = $1`,
        [invitationToken],
      ).catch(err => console.error('Failed to update invitation status:', err.message));
    }

    // Send confirmation email (non-blocking)
    try {
      const { sendConfirmationEmail } = require('../services/email');
      sendConfirmationEmail(email, {
        firstName,
        lastName,
        batchYear,
        qrToken: user.qr_token,
      }).catch(err => console.error('Confirmation email failed:', err.message));
    } catch (_) {
      // email service may not be configured – ignore
    }

    const payload = { id: user.id, email: user.email, isAdmin: user.is_admin };
    const accessToken = tokenService.signAccess(payload);
    const refreshToken = await tokenService.signRefresh(payload);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
    res.status(201).json({ accessToken, user: shapeUser(user) });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already registered' });
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// POST /api/auth/login  (and also exported as loginHandler for /api/login)
router.post('/login', loginHandler);

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const payload = await tokenService.verifyRefresh(refreshToken);

    // Fetch latest user data so qrToken etc. are fresh
    const { rows } = await pool.query(
      'SELECT * FROM registrations WHERE id = $1',
      [payload.id],
    );
    if (!rows.length) return res.status(401).json({ error: 'User not found' });
    const user = rows[0];

    const newPayload = { id: user.id, email: user.email, isAdmin: user.is_admin };
    const { accessToken, refreshToken: newRefresh } = await tokenService.rotateRefresh(
      refreshToken,
      newPayload,
    );

    res.cookie('refreshToken', newRefresh, REFRESH_COOKIE_OPTS);
    res.json({ accessToken, user: shapeUser(user) });
  } catch (err) {
    console.error('Refresh error:', err.message);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', requireAuth, async (req, res) => {
  const { refreshToken } = req.cookies;

  if (refreshToken) {
    await tokenService.revokeRefresh(refreshToken).catch(() => {});
  }

  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out' });
});

module.exports = router;
module.exports.loginHandler = loginHandler;
