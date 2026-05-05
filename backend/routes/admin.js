'use strict';
const express = require('express');
const pool    = require('../db');
const { requireAdmin } = require('../middleware/auth');
const { validators, validationError } = require('../middleware/validate');

const router = express.Router();

// All admin routes require admin role
router.use(requireAdmin);

// Allowlist for settings keys — prevents arbitrary key injection
const ALLOWED_SETTINGS_KEYS = new Set(['event_date']);

// ── Dashboard ─────────────────────────────────────────────────────────────────

// GET /api/admin/dashboard
router.get('/dashboard', async (_req, res) => {
  try {
    const { rows: regRows } = await pool.query(
      `SELECT COUNT(*) AS count FROM registrations WHERE is_admin = FALSE`,
    );
    const { rows: invRows } = await pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status IN ('pending', 'sent')) AS pending
       FROM invitations`,
    );
    const { rows: checkinRows } = await pool.query(
      `SELECT COUNT(DISTINCT registration_id) AS count FROM check_ins`,
    );

    res.json({
      totalRegistered:    parseInt(regRows[0].count, 10),
      totalInvitations:   parseInt(invRows[0].total, 10),
      pendingInvitations: parseInt(invRows[0].pending, 10),
      totalCheckedIn:     parseInt(checkinRows[0].count, 10),
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ── Registrations ─────────────────────────────────────────────────────────────

// GET /api/admin/registrations
router.get('/registrations', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id,
              first_name AS "firstName",
              last_name  AS "lastName",
              email,
              batch_year AS "batchYear",
              is_admin   AS "isAdmin",
              created_at AS "createdAt"
       FROM registrations
       ORDER BY created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error('Admin fetch registrations error:', err);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// PUT /api/admin/registrations/:id
router.put('/registrations/:id', async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, batchYear, email } = req.body;

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
       SET first_name = $1, last_name = $2, batch_year = $3, email = $4
       WHERE id = $5
       RETURNING id, first_name AS "firstName", last_name AS "lastName",
                 batch_year AS "batchYear", email, is_admin AS "isAdmin", created_at AS "createdAt"`,
      [firstName.trim(), lastName.trim(), batchYear, email.trim().toLowerCase(), id],
    );

    if (!rows.length) return res.status(404).json({ error: 'Registration not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already in use' });
    console.error('Admin update registration error:', err);
    res.status(500).json({ error: 'Failed to update registration' });
  }
});

// ── Attendees ─────────────────────────────────────────────────────────────────

// GET /api/admin/attendees
router.get('/attendees', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id,
              full_name   AS "fullName",
              email,
              phone,
              batch_year  AS "batchYear",
              address,
              created_at  AS "createdAt"
       FROM attendees
       WHERE is_archived = FALSE
       ORDER BY created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error('Admin fetch attendees error:', err);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

// DELETE /api/admin/attendees/:id  (archive)
router.delete('/attendees/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE attendees
       SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Attendee not found' });
    res.json({ message: 'Attendee deleted' });
  } catch (err) {
    console.error('Admin delete attendee error:', err);
    res.status(500).json({ error: 'Failed to delete attendee' });
  }
});

// ── Settings ──────────────────────────────────────────────────────────────────

// GET /api/admin/settings
router.get('/settings', async (_req, res) => {
  try {
    const { rows } = await pool.query(`SELECT key, value FROM settings`);
    const settings = {};
    for (const row of rows) settings[row.key] = row.value;
    // Always expose event_date even if missing
    res.json({ event_date: settings.event_date || null, ...settings });
  } catch (err) {
    console.error('Admin fetch settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// PUT /api/admin/settings
router.put('/settings', async (req, res) => {
  const { key, value } = req.body;

  if (!key || value === undefined) {
    return res.status(400).json({ error: 'key and value are required' });
  }

  if (!ALLOWED_SETTINGS_KEYS.has(key)) {
    return res.status(400).json({ error: `Invalid settings key. Allowed: ${[...ALLOWED_SETTINGS_KEYS].join(', ')}` });
  }

  if (typeof value !== 'string' || value.length > 100) {
    return res.status(400).json({ error: 'value must be a string (max 100 chars)' });
  }

  try {
    await pool.query(
      `INSERT INTO settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, value],
    );
    res.json({ key, value });
  } catch (err) {
    console.error('Admin update setting error:', err);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

module.exports = router;
