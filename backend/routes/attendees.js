'use strict';
const express = require('express');
const pool    = require('../db');
const { requireAuth } = require('../middleware/auth');
const { validators, validationError } = require('../middleware/validate');

const router = express.Router();

const ATTENDEE_COLS = `
  id,
  full_name   AS "fullName",
  email,
  phone,
  batch_year  AS "batchYear",
  address,
  qr_token    AS "qrToken",
  is_archived AS "isArchived",
  created_at  AS "createdAt"
`;

function validateAttendeeBody(res, { fullName, email, phone, batchYear, address }) {
  return validationError(res, {
    fullName:  () => validators.name(fullName, { max: 200 }),
    email:     () => validators.email(email),
    phone:     () => validators.phone(phone),
    batchYear: () => validators.batchYear(batchYear),
    address:   () => validators.address(address),
  });
}

// POST /api/attendees
router.post('/', requireAuth, async (req, res) => {
  const { fullName, email, phone, batchYear, address } = req.body;
  const userId = req.user.id;

  if (validateAttendeeBody(res, { fullName, email, phone, batchYear, address })) return;

  try {
    const { rows } = await pool.query(
      `INSERT INTO attendees (user_id, full_name, email, phone, batch_year, address)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING ${ATTENDEE_COLS}`,
      [userId, fullName.trim(), email.trim().toLowerCase(), phone?.trim() || null, batchYear || null, address || null],
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint === 'attendees_email_key') return res.status(400).json({ error: 'Email already registered as an attendee' });
      if (err.constraint === 'attendees_phone_key') return res.status(400).json({ error: 'Phone number already registered as an attendee' });
    }
    console.error('Create attendee error:', err);
    res.status(500).json({ error: 'Failed to create attendee' });
  }
});

// GET /api/attendees
router.get('/', requireAuth, async (req, res) => {
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(
      `SELECT ${ATTENDEE_COLS}
       FROM attendees
       WHERE user_id = $1 AND is_archived = FALSE
       ORDER BY created_at DESC`,
      [userId],
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch attendees error:', err);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

// GET /api/attendees/:id
router.get('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT id, user_id AS "userId", full_name AS "fullName", email, phone,
              batch_year AS "batchYear", address, is_archived AS "isArchived",
              created_at AS "createdAt"
       FROM attendees WHERE id = $1`,
      [id],
    );

    if (!rows.length) return res.status(404).json({ error: 'Attendee not found' });

    const attendee = rows[0];
    if (!req.user.isAdmin && attendee.userId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to view this attendee' });
    }

    res.json(attendee);
  } catch (err) {
    console.error('Fetch attendee error:', err);
    res.status(500).json({ error: 'Failed to fetch attendee' });
  }
});

// PUT /api/attendees/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { fullName, email, phone, batchYear, address } = req.body;

  if (validateAttendeeBody(res, { fullName, email, phone, batchYear, address })) return;

  try {
    // Ownership check
    const { rows: existing } = await pool.query(
      'SELECT user_id FROM attendees WHERE id = $1',
      [id],
    );
    if (!existing.length) return res.status(404).json({ error: 'Attendee not found or archived' });
    if (!req.user.isAdmin && existing[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { rows } = await pool.query(
      `UPDATE attendees
       SET full_name = $1, email = $2, phone = $3, batch_year = $4, address = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND is_archived = FALSE
       RETURNING ${ATTENDEE_COLS}`,
      [fullName.trim(), email.trim().toLowerCase(), phone?.trim() || null, batchYear || null, address || null, id],
    );

    if (!rows.length) return res.status(404).json({ error: 'Attendee not found or archived' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint === 'attendees_email_key') return res.status(400).json({ error: 'Email already registered as an attendee' });
      if (err.constraint === 'attendees_phone_key') return res.status(400).json({ error: 'Phone number already registered as an attendee' });
    }
    console.error('Update attendee error:', err);
    res.status(500).json({ error: 'Failed to update attendee' });
  }
});

// DELETE /api/attendees/:id  (archive)
router.delete('/:id', requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows: existing } = await pool.query(
      'SELECT user_id FROM attendees WHERE id = $1',
      [id],
    );
    if (!existing.length) return res.status(404).json({ error: 'Attendee not found or already archived' });
    if (!req.user.isAdmin && existing[0].user_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const { rows } = await pool.query(
      `UPDATE attendees
       SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND is_archived = FALSE
       RETURNING id`,
      [id],
    );

    if (!rows.length) return res.status(404).json({ error: 'Attendee not found or already archived' });
    res.json({ message: 'Attendee archived successfully' });
  } catch (err) {
    console.error('Archive attendee error:', err);
    res.status(500).json({ error: 'Failed to archive attendee' });
  }
});

module.exports = router;
