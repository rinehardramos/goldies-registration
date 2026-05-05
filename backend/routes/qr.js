"use strict";
const express    = require("express");
const pool       = require("../db");
const qrService  = require("../services/qr");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// GET /api/qr/:token  – return QR code image (PNG) for a valid invitation token
router.get("/:token", requireAuth, async (req, res) => {
  const { token } = req.params;

  try {
    const { rows } = await pool.query(
      "SELECT i.*, a.email as attendee_email, a.user_id FROM invitations i JOIN attendees a ON i.attendee_id = a.id WHERE i.token = $1",
      [token],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    const invitation = rows[0];

    // Only the owner or an admin may download the QR
    if (!req.user.isAdmin && invitation.user_id !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const checkInUrl = (process.env.APP_BASE_URL || "http://localhost:5001") + "/api/checkin/" + token;
    const buffer     = await qrService.generateBuffer(checkInUrl);

    res.set("Content-Type", "image/png");
    res.send(buffer);
  } catch (err) {
    console.error("QR generate error:", err);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
});

// GET /api/qr/:token/data-url  – return QR code as JSON { dataUrl }
router.get("/:token/data-url", requireAuth, async (req, res) => {
  const { token } = req.params;

  try {
    const { rows } = await pool.query(
      "SELECT i.qr_url, a.user_id FROM invitations i JOIN attendees a ON i.attendee_id = a.id WHERE i.token = $1",
      [token],
    );

    if (!rows.length) {
      return res.status(404).json({ error: "Invitation not found" });
    }

    if (!req.user.isAdmin && rows[0].user_id !== req.user.id) {
      return res.status(403).json({ error: "Not authorized" });
    }

    res.json({ dataUrl: rows[0].qr_url });
  } catch (err) {
    console.error("QR data-url error:", err);
    res.status(500).json({ error: "Failed to retrieve QR data" });
  }
});

module.exports = router;
