'use strict';
const express = require('express');
const pool    = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validators } = require('../middleware/validate');

const router = express.Router();

const MAX_INVITE_BATCH = 50; // cap emails per request

// POST /api/invitations  – send invitations to a list of emails
router.post('/', requireAuth, async (req, res) => {
  const { emails } = req.body;

  if (!Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'emails must be a non-empty array' });
  }

  if (emails.length > MAX_INVITE_BATCH) {
    return res.status(400).json({ error: `Maximum ${MAX_INVITE_BATCH} emails per request` });
  }

  // Validate every email before doing any DB work
  const invalidEmails = emails.filter(e => validators.email(e) !== null);
  if (invalidEmails.length) {
    return res.status(400).json({ error: 'One or more invalid email addresses', invalid: invalidEmails });
  }

  const results = [];

  for (const rawEmail of emails) {
    const email = rawEmail.trim().toLowerCase();
    try {
      // Check already registered
      const { rows: registered } = await pool.query(
        'SELECT id FROM registrations WHERE email = $1',
        [email],
      );
      if (registered.length) {
        results.push({ email, status: 'already_registered' });
        continue;
      }

      // Check already invited (pending or sent)
      const { rows: existing } = await pool.query(
        `SELECT id FROM invitations WHERE email = $1 AND status IN ('pending', 'sent')`,
        [email],
      );
      if (existing.length) {
        results.push({ email, status: 'already_invited' });
        continue;
      }

      // Create invitation record
      const { rows: inv } = await pool.query(
        `INSERT INTO invitations (email, invited_by, status)
         VALUES ($1, $2, 'sent')
         RETURNING id, qr_token`,
        [email, req.user.id],
      );
      const invitation = inv[0];

      // Send email (non-blocking, report failure without throwing)
      try {
        const { sendInvitationEmail } = require('../services/email');
        await sendInvitationEmail(email, invitation.qr_token);
        results.push({ email, status: 'sent' });
      } catch (emailErr) {
        console.error('Failed to send invitation email to', email, emailErr.message);
        // Mark as failed in DB
        await pool.query(
          `UPDATE invitations SET status = 'failed' WHERE id = $1`,
          [invitation.id],
        ).catch(() => {});
        results.push({ email, status: 'send_failed' });
      }
    } catch (err) {
      console.error('Invitation error for', email, err.message);
      results.push({ email, status: 'send_failed' });
    }
  }

  res.json({ results });
});

// GET /api/invitations  – list all invitations (admin only)
router.get('/', requireAdmin, async (_req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         i.id,
         i.email,
         i.status,
         i.qr_token   AS "qrToken",
         i.created_at AS "createdAt",
         r.first_name || ' ' || r.last_name AS "invitedBy"
       FROM invitations i
       LEFT JOIN registrations r ON i.invited_by = r.id
       ORDER BY i.created_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error('Fetch invitations error:', err);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// POST /api/invitations/:id/resend  – resend an invitation email (admin only)
router.post('/:id/resend', requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      'SELECT id, email, qr_token FROM invitations WHERE id = $1',
      [id],
    );
    if (!rows.length) return res.status(404).json({ error: 'Invitation not found' });

    const invitation = rows[0];

    try {
      const { sendInvitationEmail } = require('../services/email');
      await sendInvitationEmail(invitation.email, invitation.qr_token);
      await pool.query(`UPDATE invitations SET status = 'sent' WHERE id = $1`, [id]);
      res.json({ message: 'Invitation resent' });
    } catch (emailErr) {
      console.error('Resend email error:', emailErr.message);
      res.status(500).json({ error: 'Failed to resend invitation email' });
    }
  } catch (err) {
    console.error('Resend invitation error:', err);
    res.status(500).json({ error: 'Failed to resend invitation' });
  }
});

module.exports = router;
