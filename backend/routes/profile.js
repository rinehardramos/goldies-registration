'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validators, validationError } = require('../middleware/validate');

const router = express.Router();

const shapeUser = (user) => ({
  id:        user.id,
  firstName: user.first_name,
  lastName:  user.last_name,
  email:     user.email,
  batchYear: user.batch_year,
  isAdmin:   user.is_admin,
  qrToken:   user.qr_token,
});

// GET /api/profile
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM registrations WHERE id = $1`,
      [req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(shapeUser(rows[0]));
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/profile
router.put('/', requireAuth, async (req, res) => {
  const { firstName, lastName, email, batchYear } = req.body;

  if (validationError(res, {
    firstName: () => validators.name(firstName),
    lastName:  () => validators.name(lastName),
    email:     () => validators.email(email),
    batchYear: () => {
      if (!batchYear) return 'required';
      return validators.batchYear(batchYear);
    },
  })) return;

  try {
    const { rows } = await pool.query(
      `UPDATE registrations
       SET first_name = $1, last_name = $2, email = $3, batch_year = $4
       WHERE id = $5
       RETURNING *`,
      [firstName.trim(), lastName.trim(), email.trim().toLowerCase(), batchYear, req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(shapeUser(rows[0]));
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already in use' });
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/profile/change-password
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (validationError(res, {
    currentPassword: () => (typeof currentPassword === 'string' && currentPassword.length ? null : 'required'),
    newPassword:     () => validators.password(newPassword),
  })) return;

  try {
    const { rows } = await pool.query(
      'SELECT password FROM registrations WHERE id = $1',
      [req.user.id],
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, rows[0].password);
    if (!match) return res.status(401).json({ error: 'Incorrect current password' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE registrations SET password = $1 WHERE id = $2', [hashed, req.user.id]);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
