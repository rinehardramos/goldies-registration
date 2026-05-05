"use strict";
const express      = require("express");
const { v4: uuidv4 } = require("uuid");
const pool         = require("../db");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const qrService    = require("../services/qr");
const emailService = require("../services/email");

const router = express.Router();

// POST /api/invitations  – create & send invitation for an attendee
router.post("/", requireAuth, async (req, res) => {
  const { attendeeId } = req.body;

  if (!attendeeId) {
    return res.status(400).json({ error: "attendeeId is required" });
  }

  try {
    // Verify attendee belongs to the requesting user (or requester is admin)
    const { rows: attendees } = await pool.query(
      "SELECT * FROM attendees WHERE id = $1 AND is_archived = FALSE",
      [attendeeId],
    );

    if (!attendees.length) {
      return res.status(404).json({ error: "Attendee not found" });
    }

    const attendee = attendees[0];
    if (!req.user.isAdmin && attendee.user_id !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    // Generate unique token
    const token = uuidv4();

    // Build the check-in URL and generate QR
    const checkInUrl = (process.env.APP_BASE_URL || "http://localhost:5001") + "/api/checkin/" + token;
    const qrDataURL  = await qrService.generateDataURL(checkInUrl);

    // Persist invitation
    const { rows } = await pool.query(
      "INSERT INTO invitations (attendee_id, token, qr_url) VALUES ($1, $2, $3) RETURNING *",
      [attendeeId, token, qrDataURL],
    );
    const invitation = rows[0];

    // Send email
    await emailService.sendInvitation({
      to:           attendee.email,
      attendeeName: attendee.full_name,
      token,
      qrDataURL,
    });

    // Mark sent_at
    await pool.query(
      "UPDATE invitations SET sent_at = NOW() WHERE id = $1",
      [invitation.id],
    );

    res.status(201).json({ message: "Invitation sent", token, id: invitation.id });
  } catch (err) {
    console.error("Send invitation error:", err);
    res.status(500).json({ error: "Failed to send invitation" });
  }
});

// GET /api/invitations/:attendeeId  – list invitations for an attendee
router.get("/:attendeeId", requireAuth, async (req, res) => {
  const { attendeeId } = req.params;

  try {
    const { rows: attendees } = await pool.query(
      "SELECT * FROM attendees WHERE id = $1",
      [attendeeId],
    );

    if (!attendees.length) {
      return res.status(404).json({ error: "Attendee not found" });
    }

    if (!req.user.isAdmin && attendees[0].user_id !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const { rows } = await pool.query(
      `SELECT id, token, qr_url as "qrUrl", sent_at as "sentAt", checked_in as "checkedIn", checked_in_at as "checkedInAt", created_at as "createdAt" FROM invitations WHERE attendee_id = $1 ORDER BY created_at DESC`,
      [attendeeId],
    );

    res.json(rows);
  } catch (err) {
    console.error("Fetch invitations error:", err);
    res.status(500).json({ error: "Failed to fetch invitations" });
  }
});

// DELETE /api/invitations/:id  – revoke an invitation (admin only)
router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      "DELETE FROM invitations WHERE id = $1 RETURNING id",
      [id],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    res.json({ message: "Invitation revoked" });
  } catch (err) {
    console.error("Delete invitation error:", err);
    res.status(500).json({ error: "Failed to revoke invitation" });
  }
});

module.exports = router;
