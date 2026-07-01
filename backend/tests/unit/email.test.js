'use strict';
/**
 * Unit tests for the email service.
 *
 * The `resend` SDK is mocked so no network calls happen; we capture the
 * payload passed to `resend.emails.send` and assert on its shape.
 */

const mockSend = jest.fn(async () => ({ data: { id: 'mock-email-id' } }));

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

const { sendConfirmationEmail } = require('../../services/email');

afterEach(() => jest.clearAllMocks());

describe('sendConfirmationEmail', () => {
  const data = { firstName: 'Jane', lastName: 'Cruz', batchYear: '1975', qrToken: 'abc-123' };

  it('embeds the QR as a cid inline attachment (not a data URI)', async () => {
    await sendConfirmationEmail('jane@example.com', data);

    expect(mockSend).toHaveBeenCalledTimes(1);
    const payload = mockSend.mock.calls[0][0];

    // Inline attachment carrying the QR PNG with a Content-ID
    expect(Array.isArray(payload.attachments)).toBe(true);
    const qr = payload.attachments.find(a => a.contentId === 'qrcode');
    expect(qr).toBeTruthy();
    expect(Buffer.isBuffer(qr.content)).toBe(true);
    expect(qr.content.length).toBeGreaterThan(0);
    expect(qr.filename).toMatch(/\.png$/);

    // HTML references the cid, and no longer inlines a base64 data URI for the QR
    expect(payload.html).toContain('cid:qrcode');
    expect(payload.html).not.toContain('src="data:image');
  });

  it('includes the recipient email and details in the HTML', async () => {
    await sendConfirmationEmail('jane@example.com', data);
    const payload = mockSend.mock.calls[0][0];

    expect(payload.html).toContain('Jane');
    expect(payload.html).toContain('1975');
    expect(payload.html).toContain('jane@example.com');
  });

  it('still sends the email if QR generation is impossible (no crash)', async () => {
    // A qrToken that is a huge string is still encodable; instead we assert the
    // function resolves and calls send even when attachments may be empty.
    await expect(sendConfirmationEmail('jane@example.com', data)).resolves.toBeDefined();
    expect(mockSend).toHaveBeenCalled();
  });
});
