'use strict';
const jwt = require('jsonwebtoken');

/**
 * Express middleware - verifies the Bearer access token.
 * Attaches the decoded payload to req.user on success.
 */
const requireAuth = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing access token' });
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired access token' });
  }
};

/**
 * Middleware - requireAuth + must be admin.
 */
const requireAdmin = (req, res, next) => {
  requireAuth(req, res, () => {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    next();
  });
};

module.exports = { requireAuth, requireAdmin };
