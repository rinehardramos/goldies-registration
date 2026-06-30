'use strict';
const express = require('express');
const pool    = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/checkin/stats  – MUST be defined before /:token to avoid route conflict
router.get('/stats', requireAdmin, async (_req, res) => {
  try {
    const { rows: totalRows } = await pool.query(
      `SELECT (SELECT COUNT(*) FROM registrations WHERE is_admin = FALSE)
            + (SELECT COUNT(*) FROM attendees     WHERE is_archived = FALSE) AS count`,
    );
    const { rows: checkinRows } = await pool.query(
      `SELECT (SELECT COUNT(DISTINCT registration_id) FROM check_ins WHERE registration_id IS NOT NULL)
            + (SELECT COUNT(DISTINCT attendee_id)     FROM check_ins WHERE attendee_id     IS NOT NULL) AS count`,
    );
    const { rows: recentRows } = await pool.query(
      `SELECT name, batch_year AS "batchYear", checked_in_at AS "checkedInAt"
       FROM (
         SELECT (r.first_name || ' ' || r.last_name) AS name, r.batch_year, c.checked_in_at
         FROM check_ins c JOIN registrations r ON c.registration_id = r.id
         UNION ALL
         SELECT a.full_name AS name, a.batch_year, c.checked_in_at
         FROM check_ins c JOIN attendees a ON c.attendee_id = a.id
       ) t
       ORDER BY t.checked_in_at DESC
       LIMIT 10`,
    );

    const total     = parseInt(totalRows[0].count, 10);
    const checkedIn = parseInt(checkinRows[0].count, 10);

    res.json({
      totalRegistered: total,
      total,
      totalCheckedIn:  checkedIn,
      checkedIn,
      recentCheckIns:  recentRows.map(row => ({ ...row, name: (row.name || '').trim() })),
    });
  } catch (err) {
    console.error('Checkin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch check-in stats' });
  }
});

// GET /api/checkin/search?q=...  – unified search across registrants + attendees
// MUST be defined before /:token to avoid route conflict
router.get('/search', requireAdmin, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.json([]);
  const like = `%${q}%`;

  try {
    const { rows } = await pool.query(
      `SELECT id, type,
              first_name AS "firstName", last_name AS "lastName",
              full_name  AS "fullName",  email,
              batch_year AS "batchYear", qr_token AS "qrToken"
       FROM (
         SELECT id, 'registrant'::text AS type, first_name, last_name,
                (first_name || ' ' || last_name) AS full_name, email, batch_year, qr_token, created_at
         FROM registrations
         WHERE is_admin = FALSE
           AND (first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1 OR batch_year ILIKE $1)
         UNION ALL
         SELECT id, 'attendee'::text AS type, NULL AS first_name, NULL AS last_name,
                full_name, email, batch_year, qr_token, created_at
         FROM attendees
         WHERE is_archived = FALSE
           AND (full_name ILIKE $1 OR email ILIKE $1 OR batch_year ILIKE $1)
       ) t
       ORDER BY t.created_at DESC
       LIMIT 20`,
      [like],
    );
    res.json(rows);
  } catch (err) {
    console.error('Checkin search error:', err);
    res.status(500).json({ error: 'Failed to search participants' });
  }
});

// Record a registration check-in and respond
async function checkInRegistration(req, res, r) {
  const registrant = {
    firstName: r.first_name, lastName: r.last_name,
    batchYear: r.batch_year, email: r.email,
  };
  const { rows: existing } = await pool.query(
    `SELECT checked_in_at FROM check_ins WHERE registration_id = $1`,
    [r.id],
  );
  if (existing.length) {
    return res.status(409).json({ error: 'Already checked in', checkedInAt: existing[0].checked_in_at, registrant });
  }
  const { rows: inserted } = await pool.query(
    `INSERT INTO check_ins (registration_id, checked_in_by) VALUES ($1, $2) RETURNING checked_in_at`,
    [r.id, req.user.id],
  );
  const fullName = `${r.first_name} ${r.last_name}`.trim();
  return res.json({
    message: 'Check-in successful',
    name: fullName, fullName, batchYear: r.batch_year, email: r.email,
    registrant, checkedInAt: inserted[0].checked_in_at,
  });
}

// Record an attendee check-in and respond
async function checkInAttendee(req, res, a) {
  const parts = String(a.full_name || '').trim().split(/\s+/);
  const registrant = {
    firstName: parts[0] || a.full_name || '', lastName: parts.slice(1).join(' '),
    batchYear: a.batch_year, email: a.email,
  };
  const { rows: existing } = await pool.query(
    `SELECT checked_in_at FROM check_ins WHERE attendee_id = $1`,
    [a.id],
  );
  if (existing.length) {
    return res.status(409).json({ error: 'Already checked in', checkedInAt: existing[0].checked_in_at, registrant });
  }
  const { rows: inserted } = await pool.query(
    `INSERT INTO check_ins (attendee_id, checked_in_by) VALUES ($1, $2) RETURNING checked_in_at`,
    [a.id, req.user.id],
  );
  const fullName = String(a.full_name || '').trim();
  return res.json({
    message: 'Check-in successful',
    name: fullName, fullName, batchYear: a.batch_year, email: a.email,
    registrant, checkedInAt: inserted[0].checked_in_at,
  });
}

// POST /api/checkin/:token  – check in a registrant OR attendee by QR token
router.post('/:token', requireAdmin, async (req, res) => {
  const { token } = req.params;

  try {
    const { rows: regRows } = await pool.query(
      `SELECT id, first_name, last_name, batch_year, email FROM registrations WHERE qr_token = $1`,
      [token],
    );
    if (regRows.length) return await checkInRegistration(req, res, regRows[0]);

    const { rows: attRows } = await pool.query(
      `SELECT id, full_name, batch_year, email FROM attendees WHERE qr_token = $1 AND is_archived = FALSE`,
      [token],
    );
    if (attRows.length) return await checkInAttendee(req, res, attRows[0]);

    return res.status(404).json({ error: 'Invalid or unknown QR code' });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Failed to process check-in' });
  }
});

module.exports = router;
