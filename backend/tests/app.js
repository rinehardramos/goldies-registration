/**
 * Test app factory — returns the Express app without calling app.listen().
 * All routes, middleware, and rate limiters are wired up identically to
 * production. Tests use supertest to send requests directly.
 *
 * DB calls hit the real Postgres instance (requires DATABASE_URL in env).
 * For security/unit tests that don't need a DB we mock the pool module.
 */
'use strict';

const express      = require('express');
const cors         = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');

function buildApp() {
  const app = express();

  // Disable X-Powered-By to avoid leaking server info in tests
  app.disable('x-powered-by');

  app.use(cors({ origin: true, credentials: true }));

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
  const qrLimiter   = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
  const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false });

  app.use(globalLimiter);
  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  const authRouter = require('../routes/auth');
  app.post('/api/login', authLimiter, authRouter.loginHandler);
  app.use('/api/auth',        authLimiter, authRouter);
  app.use('/api/qr',          qrLimiter,  require('../routes/qr'));
  app.use('/api/invitations', require('../routes/invitations'));
  app.use('/api/checkin',     require('../routes/checkin'));
  app.use('/api/profile',     require('../routes/profile'));
  app.use('/api/attendees',   require('../routes/attendees'));
  app.use('/api/admin',       require('../routes/admin'));

  return app;
}

module.exports = buildApp;
