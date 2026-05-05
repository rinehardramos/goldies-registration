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
      `SELECT id, first_name, last_name, batch_year, email FROM registrations WHERE qr_token = $1`,
      [token],
    );
    if (regRows.length) {
      const user = regRows[0];
      if (isEventDay) {
        return res.json({
          type: 'checkin',
          id: user.id,
          firstName: user.first_name,
          lastName: user.last_name,
          batchYear: user.batch_year,
          email: user.email,
        });
      }
      return res.json({
        type: 'already_registered',
        firstName: user.first_name,
        lastName: user.last_name,
        batchYear: user.batch_year,
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
