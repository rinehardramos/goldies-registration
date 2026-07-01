'use strict';
const { Resend } = require('resend');
const path   = require('path');
const fs     = require('fs');
const QRCode = require('qrcode');

const resend   = new Resend(process.env.RESEND_API_KEY);
const FROM     = process.env.FROM_EMAIL || 'noreply@goldies2026.com';
const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:5173';

const renderTemplate = (name, vars = {}) => {
  const filePath = path.join(__dirname, '..', 'templates', name + '.html');
  let html = fs.readFileSync(filePath, 'utf8');
  for (const [key, value] of Object.entries(vars)) {
    html = html.replaceAll('{{' + key + '}}', value);
  }
  return html;
};

// Try to render a template; fall back to plain HTML if file is missing
const tryRenderTemplate = (name, vars = {}) => {
  try {
    return renderTemplate(name, vars);
  } catch (_) {
    return null;
  }
};

/**
 * Send an invitation email with a registration link.
 * @param {string} email
 * @param {string} qrToken  UUID from invitations.qr_token
 */
const sendInvitationEmail = async (email, qrToken) => {
  const registerUrl = `${BASE_URL}/register?token=${qrToken}`;

  const html = tryRenderTemplate('invitation', { email, registerUrl, year: new Date().getFullYear() })
    || `<p>You have been invited to the Golden Years Reunion 2026.</p>
        <p><a href="${registerUrl}">Click here to register</a></p>`;

  return resend.emails.send({
    from:    FROM,
    to:      [email],
    subject: 'Your Golden Years Reunion 2026 Invitation',
    html,
  });
};

/**
 * Send a confirmation email after successful registration.
 * @param {string} email
 * @param {{ firstName: string, lastName: string, batchYear: string, qrToken: string }} data
 */
const sendConfirmationEmail = async (email, { firstName, lastName, batchYear, qrToken }) => {
  const qrPageUrl  = `${BASE_URL}/qr/${qrToken}`;
  const profileUrl = `${BASE_URL}/profile`;

  // Render the QR as a PNG buffer and send it as an inline (cid) attachment.
  // Base64 data-URI images are stripped by Gmail/Outlook, so the QR must ride
  // along as a real attachment referenced via <img src="cid:qrcode"> to display
  // reliably in the email body. Encoded content is unchanged (${qrPageUrl}).
  const attachments = [];
  try {
    const qrBuffer = await QRCode.toBuffer(qrPageUrl, {
      type: 'png',
      width: 180,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#800000', light: '#FFFFFF' },
    });
    attachments.push({ filename: 'qr.png', content: qrBuffer, contentId: 'qrcode' });
  } catch (err) {
    console.error('QR generation failed for confirmation email:', err.message);
  }

  const html = tryRenderTemplate('confirmation', {
    firstName, lastName, batchYear, qrToken, email,
    qrPageUrl, profileUrl,
    year: new Date().getFullYear(),
  }) || `<p>Hi ${firstName},</p>
         <p>You are now registered for the Golden Years Reunion ${new Date().getFullYear()}!</p>
         <p>Batch year: ${batchYear}</p>
         <p>Email: ${email}</p>
         <p><a href="${profileUrl}">View / Update My Profile</a></p>
         <p><a href="${qrPageUrl}">Open My QR Page</a></p>`;

  const payload = {
    from:    FROM,
    to:      [email],
    subject: 'Registration Confirmed – Golden Years Reunion 2026',
    html,
  };
  if (attachments.length) payload.attachments = attachments;

  return resend.emails.send(payload);
};

// Legacy export kept for backward compat
const sendInvitation = async ({ to, attendeeName, token, qrDataURL }) => {
  const checkInUrl = BASE_URL + '/api/checkin/' + token;
  const html = tryRenderTemplate('invitation', {
    attendeeName,
    checkInUrl,
    qrDataURL: qrDataURL || '',
    year: new Date().getFullYear(),
  }) || `<p>Hi ${attendeeName},</p><p><a href="${checkInUrl}">Check in here</a></p>`;

  return resend.emails.send({
    from:    FROM,
    to:      [to],
    subject: 'Your Golden Years Reunion Invitation',
    html,
  });
};

module.exports = { sendInvitationEmail, sendConfirmationEmail, sendInvitation };
