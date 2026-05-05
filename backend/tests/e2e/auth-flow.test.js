'use strict';
/**
 * E2E tests — run against the real database (DATABASE_URL must be set).
 * Tests the complete auth, registration, profile, and attendee flows.
 *
 * Run locally:
 *   DATABASE_URL=<url> JWT_SECRET=... JWT_REFRESH_SECRET=... npm run test:e2e
 *
 * On CI / Railway these env vars come from the service environment.
 */

const request  = require('supertest');
const buildApp = require('../app');
const pool     = require('../../db');

let app;
// Unique suffix so parallel test runs don't collide
const SUFFIX = Date.now();
const TEST_EMAIL    = `e2e-test-${SUFFIX}@goldies-test.invalid`;
const TEST_PASSWORD = 'E2ePassword123!';

let cookies    = '';   // refresh token cookie
let accessToken = '';
let userId;

beforeAll(() => {
  process.env.JWT_SECRET         = process.env.JWT_SECRET || 'e2e-test-secret';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'e2e-test-refresh';
  process.env.NODE_ENV           = 'test';
  app = buildApp();
});

afterAll(async () => {
  // Clean up test user (cascades to refresh_tokens)
  try {
    await pool.query('DELETE FROM registrations WHERE email = $1', [TEST_EMAIL]);
  } catch (_) {}
  await pool.end();
});

// ════════════════════════════════════════════════════════════════════════════
// Registration
// ════════════════════════════════════════════════════════════════════════════
describe('Registration flow', () => {
  test('registers a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'E2E',
      lastName:  'Tester',
      email:     TEST_EMAIL,
      password:  TEST_PASSWORD,
      batchYear: '2000',
    });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(TEST_EMAIL);
    expect(res.body.accessToken).toBeTruthy();
    userId = res.body.user.id;
    // Capture the refresh cookie for later tests
    const setCookie = res.headers['set-cookie'];
    if (setCookie) cookies = setCookie.join('; ');
  });

  test('rejects duplicate registration', async () => {
    const res = await request(app).post('/api/auth/register').send({
      firstName: 'E2E',
      lastName:  'Tester',
      email:     TEST_EMAIL,
      password:  TEST_PASSWORD,
      batchYear: '2000',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already registered/i);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Login
// ════════════════════════════════════════════════════════════════════════════
describe('Login flow', () => {
  test('returns 401 for wrong password', async () => {
    const res = await request(app).post('/api/login')
      .send({ email: TEST_EMAIL, password: 'WrongPassword9!' });
    expect(res.status).toBe(401);
  });

  test('returns 401 for unknown email', async () => {
    const res = await request(app).post('/api/login')
      .send({ email: 'nobody@test.invalid', password: TEST_PASSWORD });
    expect(res.status).toBe(401);
  });

  test('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    accessToken = res.body.accessToken;
    const setCookie = res.headers['set-cookie'];
    if (setCookie) cookies = setCookie.join('; ');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Token refresh
// ════════════════════════════════════════════════════════════════════════════
describe('Token refresh', () => {
  test('issues new access token from refresh cookie', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    accessToken = res.body.accessToken; // keep the freshest token
    const setCookie = res.headers['set-cookie'];
    if (setCookie) cookies = setCookie.join('; ');
  });

  test('rejects refresh with no cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Profile
// ════════════════════════════════════════════════════════════════════════════
describe('Profile', () => {
  test('returns profile for authenticated user', async () => {
    const res = await request(app)
      .get('/api/profile')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(TEST_EMAIL);
  });

  test('returns 401 without token', async () => {
    const res = await request(app).get('/api/profile');
    expect(res.status).toBe(401);
  });

  test('updates profile fields', async () => {
    const res = await request(app)
      .put('/api/profile')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ firstName: 'Updated', lastName: 'Name', email: TEST_EMAIL, batchYear: '2001' });
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('Updated');
    expect(res.body.batchYear).toBe('2001');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Attendees
// ════════════════════════════════════════════════════════════════════════════
describe('Attendees CRUD', () => {
  let attendeeId;

  test('creates an attendee', async () => {
    const res = await request(app)
      .post('/api/attendees')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName:  'John Attendee',
        email:     `attendee-${SUFFIX}@test.invalid`,
        phone:     `+6391${SUFFIX.toString().slice(-7)}`,
        batchYear: '1999',
      });
    expect(res.status).toBe(201);
    expect(res.body.fullName).toBe('John Attendee');
    attendeeId = res.body.id;
  });

  test('lists attendees', async () => {
    const res = await request(app)
      .get('/api/attendees')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(a => a.id === attendeeId)).toBe(true);
  });

  test('updates an attendee', async () => {
    const res = await request(app)
      .put(`/api/attendees/${attendeeId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        fullName:  'John Updated',
        email:     `attendee-${SUFFIX}@test.invalid`,
        phone:     `+6391${SUFFIX.toString().slice(-7)}`,
        batchYear: '1999',
      });
    expect(res.status).toBe(200);
    expect(res.body.fullName).toBe('John Updated');
  });

  test('archives an attendee', async () => {
    const res = await request(app)
      .delete(`/api/attendees/${attendeeId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Logout
// ════════════════════════════════════════════════════════════════════════════
describe('Logout', () => {
  test('revokes refresh token on logout', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
  });

  test('refresh fails after logout', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookies);
    expect(res.status).toBe(401);
  });
});
