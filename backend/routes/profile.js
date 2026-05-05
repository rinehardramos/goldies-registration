'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/profile/:id
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  // Users can only view their own profile unless admin
  if (!req.user.isAdmin && req.user.id !== parseInt(id, 10)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT id,
              batch_year AS "batchYear",
              full_name  AS "fullName",
              email,
              is_admin   AS "isAdmin"
       FROM registrations WHERE id = $1`,
      [id],
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// PUT /api/profile/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { fullName, batchYear, email } = req.body;

  if (!req.user.isAdmin && req.user.id !== parseInt(id, 10)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  if (!fullName || !batchYear || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE registrations
       SET full_name = $1, batch_year = $2, email = $3
       WHERE id = $4
       RETURNING id, full_name AS "fullName", batch_year AS "batchYear", email`,
      [fullName, batchYear, email, id],
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Profile updated successfully', user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already in use' });
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// POST /api/profile/:id/change-password
router.post('/:id/change-password', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  if (!req.user.isAdmin && req.user.id !== parseInt(id, 10)) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT password FROM registrations WHERE id = $1',
      [id],
    );

    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    const match = await bcrypt.compare(currentPassword, rows[0].password);
    if (!match) return res.status(401).json({ error: 'Incorrect current password' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE registrations SET password = $1 WHERE id = $2', [hashed, id]);

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
