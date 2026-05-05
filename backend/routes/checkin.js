'use strict';
const express = require('express');
const pool    = require('../db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/checkin/stats  – MUST be defined before /:token to avoid route conflict
router.get('/stats', requireAdmin, async (_req, res) => {
  try {
    const { rows: totalRows } = await pool.query(
      `SELECT COUNT(*) AS count FROM registrations WHERE is_admin = FALSE`,
    );
    const { rows: checkinRows } = await pool.query(
      `SELECT COUNT(DISTINCT registration_id) AS count FROM check_ins`,
    );
    const { rows: recentRows } = await pool.query(
      `SELECT r.first_name AS "firstName", r.last_name AS "lastName",
              r.batch_year AS "batchYear", c.checked_in_at AS "checkedInAt"
       FROM check_ins c
       JOIN registrations r ON c.registration_id = r.id
       ORDER BY c.checked_in_at DESC
       LIMIT 10`,
    );

    res.json({
      totalRegistered: parseInt(totalRows[0].count, 10),
      totalCheckedIn:  parseInt(checkinRows[0].count, 10),
      recentCheckIns:  recentRows,
    });
  } catch (err) {
    console.error('Checkin stats error:', err);
    res.status(500).json({ error: 'Failed to fetch check-in stats' });
  }
});

// POST /api/checkin/:token  – check in a registrant by QR token
router.post('/:token', requireAdmin, async (req, res) => {
  const { token } = req.params;

  try {
    const { rows: regRows } = await pool.query(
      `SELECT id, first_name, last_name, batch_year FROM registrations WHERE qr_token = $1`,
      [token],
    );

    if (!regRows.length) {
      return res.status(404).json({ error: 'Invalid or unknown QR code' });
    }

    const registrant = regRows[0];

    // Check if already checked in
    const { rows: existing } = await pool.query(
      `SELECT id, checked_in_at FROM check_ins WHERE registration_id = $1`,
      [registrant.id],
    );
    if (existing.length) {
      return res.status(409).json({
        error: 'Already checked in',
        checkedInAt: existing[0].checked_in_at,
        registrant: {
          firstName: registrant.first_name,
          lastName:  registrant.last_name,
          batchYear: registrant.batch_year,
        },
      });
    }

    const { rows: inserted } = await pool.query(
      `INSERT INTO check_ins (registration_id, checked_in_by) VALUES ($1, $2) RETURNING checked_in_at`,
      [registrant.id, req.user.id],
    );

    res.json({
      message: 'Check-in successful',
      registrant: {
        firstName: registrant.first_name,
        lastName:  registrant.last_name,
        batchYear: registrant.batch_year,
      },
      checkedInAt: inserted[0].checked_in_at,
    });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Failed to process check-in' });
  }
});

module.exports = router;
