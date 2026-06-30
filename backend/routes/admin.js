'use strict';
const express = require('express');
const bcrypt  = require('bcryptjs');
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
      `SELECT (SELECT COUNT(*) FROM registrations WHERE is_admin = FALSE)
            + (SELECT COUNT(*) FROM attendees     WHERE is_archived = FALSE) AS count`,
    );
    const { rows: invRows } = await pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status IN ('pending', 'sent')) AS pending
       FROM invitations`,
    );
    const { rows: checkinRows } = await pool.query(
      `SELECT (SELECT COUNT(DISTINCT registration_id) FROM check_ins WHERE registration_id IS NOT NULL)
            + (SELECT COUNT(DISTINCT attendee_id)     FROM check_ins WHERE attendee_id     IS NOT NULL) AS count`,
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
router.get('/registrations', async (req, res) => {
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

  try {
    const params = [];
    let whereClause = '';
    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE first_name ILIKE $1
                        OR last_name ILIKE $1
                        OR email ILIKE $1
                        OR batch_year ILIKE $1`;
    }

    const { rows } = await pool.query(
      `SELECT id,
              first_name AS "firstName",
              last_name  AS "lastName",
              email,
              batch_year AS "batchYear",
              is_admin   AS "isAdmin",
              qr_token   AS "qrToken",
              created_at AS "createdAt"
       FROM registrations
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT 100`,
      params,
    );
    res.json(rows);
  } catch (err) {
    console.error('Admin fetch registrations error:', err);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

// ── Administrators ───────────────────────────────────────────────────────────

// GET /api/admin/admins
router.get('/admins', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id,
              first_name AS "firstName",
              last_name  AS "lastName",
              email,
              batch_year AS "batchYear",
              created_at AS "createdAt"
       FROM registrations
       WHERE is_admin = TRUE
       ORDER BY created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error('Admin list admins error:', err);
    res.status(500).json({ error: 'Failed to fetch administrators' });
  }
});

// POST /api/admin/admins
router.post('/admins', async (req, res) => {
  const { firstName, lastName, email, password, batchYear } = req.body;

  if (validationError(res, {
    firstName: () => validators.name(firstName),
    lastName:  () => validators.name(lastName),
    email:     () => validators.email(email),
    password:  () => validators.password(password),
    batchYear: () => validators.batchYear(batchYear),
  })) return;

  if (!batchYear) {
    return res.status(400).json({ error: 'Validation failed', errors: { batchYear: 'required' } });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      `INSERT INTO registrations (first_name, last_name, email, password, batch_year, is_admin)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING id, first_name AS "firstName", last_name AS "lastName",
                 email, batch_year AS "batchYear", created_at AS "createdAt"`,
      [firstName.trim(), lastName.trim(), email.trim().toLowerCase(), hashedPassword, batchYear],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Email already registered' });
    console.error('Admin create admin error:', err);
    res.status(500).json({ error: 'Failed to create administrator' });
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

// POST /api/admin/registrations/:id/resend-confirmation
router.post('/registrations/:id/resend-confirmation', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT first_name, last_name, email, batch_year, qr_token
       FROM registrations WHERE id = $1`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Registration not found' });

    const { first_name, last_name, email, batch_year, qr_token } = rows[0];

    const { sendConfirmationEmail } = require('../services/email');
    const result = await sendConfirmationEmail(email, {
      firstName: first_name,
      lastName:  last_name,
      batchYear: batch_year,
      qrToken:   qr_token,
    });

    if (result?.error) {
      console.error('Resend confirmation rejected:', JSON.stringify(result.error));
      return res.status(502).json({ error: 'Email provider rejected the request' });
    }

    console.log('Confirmation email resent to', email, 'id:', result?.data?.id ?? result?.id);
    res.json({ message: 'Confirmation email resent' });
  } catch (err) {
    console.error('Resend confirmation error:', err.message);
    res.status(500).json({ error: 'Failed to resend confirmation email' });
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
              qr_token    AS "qrToken",
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

// POST /api/admin/attendees/:id/resend-confirmation  – email the attendee their check-in QR
router.post('/attendees/:id/resend-confirmation', async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT full_name, email, batch_year, qr_token FROM attendees WHERE id = $1 AND is_archived = FALSE`,
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Attendee not found' });

    const { full_name, email, batch_year, qr_token } = rows[0];
    const parts = String(full_name || '').trim().split(/\s+/);
    const firstName = parts[0] || full_name || '';
    const lastName  = parts.slice(1).join(' ');

    const { sendConfirmationEmail } = require('../services/email');
    const result = await sendConfirmationEmail(email, {
      firstName,
      lastName,
      batchYear: batch_year,
      qrToken:   qr_token,
    });

    if (result?.error) {
      console.error('Attendee resend confirmation rejected:', JSON.stringify(result.error));
      return res.status(502).json({ error: 'Email provider rejected the request' });
    }

    console.log('Attendee confirmation resent to', email, 'id:', result?.data?.id ?? result?.id);
    res.json({ message: 'Confirmation email resent' });
  } catch (err) {
    console.error('Attendee resend confirmation error:', err.message);
    res.status(500).json({ error: 'Failed to resend confirmation email' });
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
