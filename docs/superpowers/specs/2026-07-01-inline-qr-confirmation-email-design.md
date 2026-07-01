# Inline QR + details in confirmation emails

**Date:** 2026-07-01
**Status:** Approved

## Goal

When a registrant **or** an attendee successfully registers, the confirmation
email must display the participant's unique QR code **inline in the email body**
(not just as a link or a stripped attachment), alongside their registration
details. Applies to both the primary registrant and every registered attendee.

## Problem

- The confirmation template already embeds the QR — but as a base64 `data:` URI
  in `<img src>`. Gmail, Outlook, and Yahoo strip inline data URIs, so the QR
  renders as a broken image for most recipients.
- `POST /api/attendees` creates an attendee but sends **no email at all**. Only
  an admin manually clicking "Resend Confirmation" ever emails an attendee.

## Design

### 1. Reliable inline QR — CID attachment instead of data URI

In `backend/services/email.js`, `sendConfirmationEmail`:

- Generate the QR as a **PNG buffer** (not a data URL) via the `qrcode` package,
  keeping the exact same encoded content and rendering params as today:
  - text: `${BASE_URL}/qr/${qrToken}` (unchanged — see "Scannability" below)
  - `width: 180`, `margin: 2`, `color: { dark: '#800000', light: '#FFFFFF' }`,
    `errorCorrectionLevel: 'H'`
- Pass it to Resend as an inline attachment:
  `attachments: [{ filename: 'qr.png', content: <buffer>, contentId: 'qrcode' }]`
- Template `<img src="{{qrDataURL}}">` becomes `<img src="cid:qrcode">`.

If QR generation fails, send the email without the attachment (QR block simply
shows no image) — never block delivery.

### 2. Attendees get a confirmation email on registration

`POST /api/attendees` (`backend/routes/attendees.js`) fires
`sendConfirmationEmail` **non-blocking** (same pattern as `auth.js` register):
split `fullName` into first/last, pass `email`, `batchYear`, `qrToken`. Failures
are logged and never block the 201 response.

### 3. Registration details shown

Confirmation template gains an **email** row alongside name and batch year.

## Scannability (must not regress)

The QR encodes `${BASE_URL}/qr/<qr_token>`. The admin scanner
(`CheckInTab.jsx` → `extractQrToken`) decodes that text, extracts the token via
`/\/qr\/([^/?#\s]+)/`, and drives `POST /api/checkin/:token`, which matches
`qr_token` across both `registrations` and `attendees`.

This change alters **only how the image is delivered** (CID vs data URI), never
the encoded content or QR params. The scanner only sees the decoded URL, which
is unchanged. Scanning and check-in confirmation are unaffected.

## Files touched

- `backend/services/email.js`
- `backend/templates/confirmation.html`
- `backend/routes/attendees.js`

## Testing

- Unit: `sendConfirmationEmail` builds a Resend payload with an `attachments`
  entry carrying `contentId: 'qrcode'`, and HTML referencing `cid:qrcode`.
- Unit/integration: `POST /api/attendees` triggers `sendConfirmationEmail` with
  the attendee's email/name/batch/qrToken.
- Admin resend endpoints inherit the CID fix automatically (they already call
  `sendConfirmationEmail`).
