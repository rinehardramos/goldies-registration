'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db');
const tokenService = require('../services/token');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge:   7 * 24 * 60 * 60 * 1000,
};

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { batchYear, fullName, email, password } = req.body;

  if (!batchYear || !fullName || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO registrations (batch_year, full_name, email, password) VALUES ($1, $2, $3, $4) RETURNING id',
      [batchYear, fullName, email, hashedPassword],
    );
    res.status(201).json({ id: rows[0].id, message: 'Registration successful' });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already registered' });
    console.error('Register error:', err);
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
    console.log('Login attempt for: ' + email);
    const { rows } = await pool.query(
      'SELECT * FROM registrations WHERE email = $1',
      [email],
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
    const accessToken  = tokenService.signAccess(payload);
    const refreshToken = await tokenService.signRefresh(payload);

    res.cookie('refreshToken', refreshToken, REFRESH_COOKIE_OPTS);
    res.json({
      message: 'Login successful',
      accessToken,
      user: { id: user.id, fullName: user.full_name, isAdmin: user.is_admin },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    return res.status(401).json({ error: 'No refresh token' });
  }

  try {
    const payload = await tokenService.verifyRefresh(refreshToken);
    const { accessToken, refreshToken: newRefresh } = await tokenService.rotateRefresh(
      refreshToken,
      { id: payload.id, email: payload.email, isAdmin: payload.isAdmin },
    );

    res.cookie('refreshToken', newRefresh, REFRESH_COOKIE_OPTS);
    res.json({ accessToken });
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
