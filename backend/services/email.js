"use strict";
const { Resend } = require("resend");
const path = require("path");
const fs   = require("fs");

const resend   = new Resend(process.env.RESEND_API_KEY);
const FROM     = process.env.FROM_EMAIL || "noreply@goldies2026.com";
const BASE_URL = process.env.APP_BASE_URL || "http://localhost:5001";

const renderTemplate = (name, vars = {}) => {
  const filePath = path.join(__dirname, "..", "templates", name + ".html");
  let html = fs.readFileSync(filePath, "utf8");
  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll("{{" + key + "}}", value);
  }
  return html;
};

const sendInvitation = async ({ to, attendeeName, token, qrDataURL }) => {
  const checkInUrl = BASE_URL + "/api/checkin/" + token;

  const html = renderTemplate("invitation", {
    attendeeName,
    checkInUrl,
    qrDataURL,
    year: new Date().getFullYear(),
  });

  return resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: "Your Golden Years Reunion Invitation",
    html,
  });
};

module.exports = { sendInvitation };
