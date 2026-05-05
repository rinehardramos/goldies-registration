"use strict";
const express = require("express");
const pool    = require("../db");

const router = express.Router();

// GET /api/checkin/:token  – mark an attendee as checked in via QR scan
// This is intentionally PUBLIC (scanned by event staff devices, no auth needed)
router.get("/:token", async (req, res) => {
  const { token } = req.params;

  try {
    const { rows } = await pool.query(
      "SELECT * FROM invitations WHERE token = $1",
      [token],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Invalid or unknown QR code" });
    }

    const invitation = rows[0];

    if (invitation.checked_in) {
      return res.status(409).json({
        error: "Already checked in",
        checkedInAt: invitation.checked_in_at,
      });
    }

    const { rows: updated } = await pool.query(
      "UPDATE invitations SET checked_in = TRUE, checked_in_at = NOW() WHERE id = $1 RETURNING *",
      [invitation.id],
    );

    // Fetch attendee name for the response
    const { rows: attendees } = await pool.query(
      `SELECT full_name as "fullName", email FROM attendees WHERE id = $1`,
      [invitation.attendee_id],
    );

    res.json({
      message:     "Check-in successful",
      attendee:    attendees[0] || null,
      checkedInAt: updated[0].checked_in_at,
    });
  } catch (err) {
    console.error("Check-in error:", err);
    res.status(500).json({ error: "Failed to process check-in" });
  }
});

// GET /api/checkin  – list all checked-in attendees (admin use via front-end guard)
router.get("/", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT i.id, i.token, i.checked_in_at as "checkedInAt",
              a.full_name as "fullName", a.email, a.phone, a.batch_year as "batchYear"
       FROM invitations i
       JOIN attendees a ON i.attendee_id = a.id
       WHERE i.checked_in = TRUE
       ORDER BY i.checked_in_at DESC`,
    );
    res.json(rows);
  } catch (err) {
    console.error("Fetch check-ins error:", err);
    res.status(500).json({ error: "Failed to fetch check-ins" });
  }
});

module.exports = router;
