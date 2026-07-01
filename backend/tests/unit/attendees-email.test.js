'use strict';
/**
 * Adding an attendee should email that attendee their confirmation (with QR),
 * mirroring the primary-registrant flow. DB and email service are mocked.
 */

jest.mock('../../db', () => ({ query: jest.fn() }));

const mockSendConfirmationEmail = jest.fn(async () => ({ data: { id: 'mock-id' } }));
jest.mock('../../services/email', () => ({
  sendConfirmationEmail: mockSendConfirmationEmail,
  sendInvitationEmail:   jest.fn(async () => ({ data: {} })),
  sendInvitation:        jest.fn(async () => ({ data: {} })),
}));

const request  = require('supertest');
const jwt      = require('jsonwebtoken');
const buildApp = require('../app');
const db       = require('../../db');

let app;
let token;

beforeAll(() => {
  process.env.JWT_SECRET = 'test-secret';
  app = buildApp();
  token = jwt.sign({ id: 1, email: 'owner@example.com', isAdmin: false }, 'test-secret');
});

afterEach(() => jest.clearAllMocks());

it('sends a confirmation email to the attendee on POST /api/attendees', async () => {
  db.query.mockResolvedValueOnce({
    rows: [{
      id: 10,
      fullName:   'Guest One',
      email:      'guest@example.com',
      phone:      null,
      batchYear:  '1980',
      address:    null,
      qrToken:    'tok-10',
      isArchived: false,
      createdAt:  '2026-07-01T00:00:00Z',
    }],
  });

  const res = await request(app)
    .post('/api/attendees')
    .set('Authorization', `Bearer ${token}`)
    .send({ fullName: 'Guest One', email: 'guest@example.com', batchYear: '1980' });

  expect(res.status).toBe(201);
  expect(mockSendConfirmationEmail).toHaveBeenCalledTimes(1);
  expect(mockSendConfirmationEmail).toHaveBeenCalledWith(
    'guest@example.com',
    expect.objectContaining({ qrToken: 'tok-10', batchYear: '1980' }),
  );
});
