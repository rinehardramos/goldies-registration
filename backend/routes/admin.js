'use strict';
const express = require('express');
const pool    = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require admin role
router.use(requireAdmin);

// ── Registrations ─────────────────────────────────────────────────────────────

// GET /api/admin/registrations
router.get('/registrations', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id,
              batch_year AS "batchYear",
              full_name  AS "fullName",
              email,
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
  const { fullName, batchYear, email } = req.body;

  if (!fullName || !batchYear || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE registrations
       SET full_name = $1, batch_year = $2, email = $3
       WHERE id = $4
       RETURNING *`,
      [fullName, batchYear, email, id],
    );

    if (!rows.length) return res.status(404).json({ error: 'Registration not found' });
    res.json({ message: 'Registration updated successfully', user: rows[0] });
  } catch (err) {
    console.error('Admin update registration error:', err);
    res.status(500).json({ error: 'Failed to update registration' });
  }
});

// ── Attendees ─────────────────────────────────────────────────────────────────

// GET /api/admin/attendees
router.get('/attendees', async (req, res) => {
  const { includeArchived } = req.query;

  try {
    const { rows } = await pool.query(
      `SELECT a.id,
              a.user_id     AS "userId",
              a.full_name   AS "fullName",
              a.email,
              a.phone,
              a.batch_year  AS "batchYear",
              a.address,
              a.is_archived AS "isArchived",
              a.created_at  AS "createdAt",
              r.full_name   AS "ownerName",
              r.email       AS "ownerEmail"
       FROM attendees a
       LEFT JOIN registrations r ON a.user_id = r.id
       ${includeArchived === 'true' ? '' : 'WHERE a.is_archived = FALSE'}
       ORDER BY a.created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error('Admin fetch attendees error:', err);
    res.status(500).json({ error: 'Failed to fetch attendees' });
  }
});

// PUT /api/admin/attendees/:id
router.put('/attendees/:id', async (req, res) => {
  const { id } = req.params;
  const { fullName, email, phone, batchYear, address } = req.body;

  if (!fullName || !email || !phone) {
    return res.status(400).json({ error: 'Missing required fields: fullName, email, and phone are required' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE attendees
       SET full_name = $1, email = $2, phone = $3, batch_year = $4, address = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id,
                 full_name   AS "fullName",
                 email,
                 phone,
                 batch_year  AS "batchYear",
                 address,
                 is_archived AS "isArchived",
                 created_at  AS "createdAt"`,
      [fullName, email, phone, batchYear || null, address || null, id],
    );

    if (!rows.length) return res.status(404).json({ error: 'Attendee not found' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint === 'attendees_email_key') return res.status(400).json({ error: 'Email already registered as an attendee' });
      if (err.constraint === 'attendees_phone_key') return res.status(400).json({ error: 'Phone number already registered as an attendee' });
    }
    console.error('Admin update attendee error:', err);
    res.status(500).json({ error: 'Failed to update attendee' });
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
    res.json({ message: 'Attendee archived successfully' });
  } catch (err) {
    console.error('Admin archive attendee error:', err);
    res.status(500).json({ error: 'Failed to archive attendee' });
  }
});

// ── Check-in Stats ────────────────────────────────────────────────────────────

// GET /api/admin/checkin-stats
router.get('/checkin-stats', async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)                              AS "total",
         COUNT(*) FILTER (WHERE checked_in)   AS "checkedIn",
         COUNT(*) FILTER (WHERE NOT checked_in AND sent_at IS NOT NULL) AS "pending"
       FROM invitations`,
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('Admin checkin-stats error:', err);
    res.status(500).json({ error: 'Failed to fetch check-in stats' });
  }
});

module.exports = router;
