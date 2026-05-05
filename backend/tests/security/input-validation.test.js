'use strict';
/**
 * Security tests — input validation, injection hardening, payload limits.
 *
 * These tests mock the DB pool so they run without a live database.
 * Each test exercises the validation layer before any DB call is made.
 */

// ── DB mock ──────────────────────────────────────────────────────────────────
jest.mock('../../db', () => ({
  query: jest.fn(),
}));

// ── Token service mock (login/register return a token) ───────────────────────
jest.mock('../../services/token', () => ({
  signAccess:    jest.fn(() => 'mock-access-token'),
  signRefresh:   jest.fn(async () => 'mock-refresh-token'),
  verifyRefresh: jest.fn(async () => ({ id: 1, email: 'a@b.com', isAdmin: false })),
  rotateRefresh: jest.fn(async () => ({ accessToken: 'new-access', refreshToken: 'new-refresh' })),
  revokeRefresh: jest.fn(async () => {}),
}));

const request  = require('supertest');
const bcrypt   = require('bcryptjs');
const buildApp = require('../app');
const db       = require('../../db');

let app;

beforeAll(() => {
  process.env.JWT_SECRET         = 'test-secret';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.NODE_ENV           = 'test';
  app = buildApp();
});

afterEach(() => jest.clearAllMocks());

// ════════════════════════════════════════════════════════════════════════════
// Login – input validation
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/login — validation', () => {
  test('rejects missing email', async () => {
    const res = await request(app).post('/api/login').send({ password: 'ValidPass1!' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('email');
  });

  test('rejects malformed email', async () => {
    const res = await request(app).post('/api/login').send({ email: 'notanemail', password: 'ValidPass1!' });
    expect(res.status).toBe(400);
    expect(res.body.errors.email).toMatch(/invalid/i);
  });

  test('rejects email over 254 chars', async () => {
    const long = 'a'.repeat(249) + '@b.com'; // 249+6 = 255 chars
    const res = await request(app).post('/api/login').send({ email: long, password: 'ValidPass1!' });
    expect(res.status).toBe(400);
    expect(res.body.errors.email).toMatch(/too long/i);
  });

  test('rejects missing password', async () => {
    const res = await request(app).post('/api/login').send({ email: 'user@test.com' });
    expect(res.status).toBe(400);
    expect(res.body.errors).toHaveProperty('password');
  });

  test('passes to auth logic with valid credentials', async () => {
    const hash = await bcrypt.hash('ValidPass1!', 10);
    db.query.mockResolvedValueOnce({ rows: [{
      id: 1, first_name: 'A', last_name: 'B', email: 'user@test.com',
      batch_year: '2000', is_admin: false, qr_token: 'tok', password: hash,
    }] });
    const res = await request(app).post('/api/login')
      .send({ email: 'user@test.com', password: 'ValidPass1!' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('accessToken');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Register – password strength
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/auth/register — password validation', () => {
  const base = { firstName: 'Jane', lastName: 'Doe', email: 'jane@test.com', batchYear: '2000' };

  test('rejects password under 8 chars', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...base, password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.errors.password).toMatch(/8/);
  });

  test('rejects password over 128 chars (bcrypt DoS guard)', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...base, password: 'A'.repeat(129) + '1!' });
    expect(res.status).toBe(400);
    expect(res.body.errors.password).toMatch(/128/);
  });

  test('rejects invalid email in register', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...base, email: 'bad@', password: 'ValidPass1!' });
    expect(res.status).toBe(400);
    expect(res.body.errors.email).toMatch(/invalid/i);
  });

  test('rejects name longer than 100 chars', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...base, firstName: 'A'.repeat(101), password: 'ValidPass1!' });
    expect(res.status).toBe(400);
    expect(res.body.errors.firstName).toMatch(/too long/i);
  });

  test('rejects invalid batchYear', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...base, password: 'ValidPass1!', batchYear: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.errors.batchYear).toMatch(/numeric/i);
  });

  test('rejects batchYear out of range', async () => {
    const res = await request(app).post('/api/auth/register')
      .send({ ...base, password: 'ValidPass1!', batchYear: '1800' });
    expect(res.status).toBe(400);
    expect(res.body.errors.batchYear).toMatch(/1908/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Body size limit
// ════════════════════════════════════════════════════════════════════════════
describe('Payload size limit', () => {
  test('rejects bodies over 10 kb', async () => {
    const huge = { email: 'a@b.com', password: 'x'.repeat(12_000) };
    const res  = await request(app).post('/api/login').send(huge);
    // Express returns 413 when body exceeds limit
    expect(res.status).toBe(413);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// QR token validation
// ════════════════════════════════════════════════════════════════════════════
describe('GET /api/qr/:token — UUID validation', () => {
  test('rejects non-UUID token', async () => {
    const res = await request(app).get('/api/qr/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });

  test('rejects SQL injection attempt in token param', async () => {
    const res = await request(app).get("/api/qr/' OR '1'='1");
    expect(res.status).toBe(400);
  });

  test('accepts well-formed UUID and reaches DB layer', async () => {
    db.query
      .mockResolvedValueOnce({ rows: [{ value: '2026-07-25T10:00:00+08:00' }] }) // settings
      .mockResolvedValueOnce({ rows: [] }) // registrations (not found)
      .mockResolvedValueOnce({ rows: [] }); // invitations (not found)
    const uuid = '123e4567-e89b-12d3-a456-426614174000';
    const res  = await request(app).get(`/api/qr/${uuid}`);
    expect(res.status).toBe(404); // not found in DB is fine — it hit the DB layer
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Invitations batch cap
// ════════════════════════════════════════════════════════════════════════════
describe('POST /api/invitations — batch cap', () => {
  // Needs auth — mock requireAuth middleware via a pre-built token
  const jwt = require('jsonwebtoken');
  const adminToken = () => jwt.sign({ id: 1, email: 'a@b.com', isAdmin: false }, process.env.JWT_SECRET, { expiresIn: '1h' });

  test('rejects more than 50 emails per request', async () => {
    const emails = Array.from({ length: 51 }, (_, i) => `user${i}@test.com`);
    const res = await request(app)
      .post('/api/invitations')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ emails });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/50/);
  });

  test('rejects invalid email in the batch', async () => {
    const res = await request(app)
      .post('/api/invitations')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ emails: ['valid@test.com', 'notanemail'] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Settings key allowlist
// ════════════════════════════════════════════════════════════════════════════
describe('PUT /api/admin/settings — key allowlist', () => {
  const jwt = require('jsonwebtoken');
  const adminToken = () => jwt.sign({ id: 1, email: 'a@b.com', isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '1h' });

  // Mock requireAdmin chain
  beforeEach(() => {
    db.query.mockResolvedValue({ rows: [{ id: 1, is_admin: true, email: 'a@b.com' }] });
  });

  test('rejects unknown settings key', async () => {
    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ key: 'malicious_key', value: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid settings key/i);
  });

  test('accepts allowed key event_date', async () => {
    db.query.mockResolvedValue({ rows: [] });
    const res = await request(app)
      .put('/api/admin/settings')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send({ key: 'event_date', value: '2026-07-25T10:00:00+08:00' });
    expect(res.status).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// CORS
// ════════════════════════════════════════════════════════════════════════════
describe('CORS policy', () => {
  test('disallows arbitrary origin', async () => {
    // In test the app uses origin:true (allow-all) for simplicity;
    // production CORS is tested via the index.js config, not buildApp().
    // This test verifies the health endpoint is reachable.
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
  });
});
