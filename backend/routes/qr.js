'use strict';
const express = require('express');
const pool    = require('../db');
const { validators } = require('../middleware/validate');

const router = express.Router();

// GET /api/qr/:token  – public endpoint for QR code scan
// Returns type: 'register' | 'already_registered' | 'checkin'
router.get('/:token', async (req, res) => {
  const { token } = req.params;

  if (validators.uuid(token) !== null) {
    return res.status(400).json({ error: 'Invalid QR token' });
  }

  try {
    // Get event date from settings
    const { rows: settingsRows } = await pool.query(
      `SELECT value FROM settings WHERE key = 'event_date'`,
    );
    const eventDate = settingsRows.length ? new Date(settingsRows[0].value) : null;
    const now = new Date();
    const isEventDay = eventDate ? now >= eventDate : false;

    // Check registrations table first (registered user's personal QR)
    const { rows: regRows } = await pool.query(
      `SELECT r.id, r.first_name, r.last_name, r.batch_year, r.email,
              c.checked_in_at
       FROM registrations r
       LEFT JOIN check_ins c ON c.registration_id = r.id
       WHERE r.qr_token = $1`,
      [token],
    );
    if (regRows.length) {
      const user = regRows[0];
      const registrant = {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        batchYear: user.batch_year,
        email: user.email,
      };
      if (isEventDay) {
        return res.json({
          type: 'checkin',
          registrant,
          alreadyCheckedIn: Boolean(user.checked_in_at),
          checkedInAt: user.checked_in_at || null,
          eventDate: eventDate?.toISOString() || null,
        });
      }
      return res.json({
        type: 'already_registered',
        registrant,
        eventDate: eventDate?.toISOString() || null,
      });
    }

    // Check invitations table
    const { rows: invRows } = await pool.query(
      `SELECT id, email, status FROM invitations WHERE qr_token = $1`,
      [token],
    );
    if (invRows.length) {
      const inv = invRows[0];

      if (inv.status === 'registered') {
        return res.json({ type: 'already_registered', email: inv.email });
      }

      if (isEventDay) {
        return res.json({ type: 'checkin', email: inv.email, invitationId: inv.id });
      }

      return res.json({ type: 'register', email: inv.email, token });
    }

    return res.status(404).json({ error: 'Invalid QR token' });
  } catch (err) {
    console.error('QR lookup error:', err);
    res.status(500).json({ error: 'Failed to look up QR token' });
  }
});

module.exports = router;
