'use strict';
const jwt = require('jsonwebtoken');
const pool = require('../db');

const ACCESS_SECRET  = process.env.JWT_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_TTL     = process.env.JWT_EXPIRES_IN     || '15m';
const REFRESH_TTL    = process.env.JWT_REFRESH_EXPIRES_IN || '7d';

/**
 * Sign a short-lived access token.
 */
const signAccess = (payload) =>
  jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });

/**
 * Sign a long-lived refresh token and persist it in the DB.
 */
const signRefresh = async (payload) => {
  const token = jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL });

  // Decode to get the expiry timestamp embedded by jwt.sign
  const { exp } = jwt.decode(token);
  const expiresAt = new Date(exp * 1000);

  await pool.query(
    `INSERT INTO refresh_tokens (user_id, token, expires_at)
     VALUES ($1, $2, $3)`,
    [payload.id, token, expiresAt],
  );

  return token;
};

/**
 * Verify a refresh token and confirm it exists in the DB.
 * Returns the decoded payload or throws.
 */
const verifyRefresh = async (token) => {
  const payload = jwt.verify(token, REFRESH_SECRET);

  const { rows } = await pool.query(
    `SELECT id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()`,
    [token],
  );
  if (!rows.length) throw new Error('Refresh token not found or expired');

  return payload;
};

/**
 * Rotate: delete the old refresh token and issue a new pair.
 */
const rotateRefresh = async (oldToken, payload) => {
  await pool.query(`DELETE FROM refresh_tokens WHERE token = $1`, [oldToken]);
  const accessToken  = signAccess(payload);
  const refreshToken = await signRefresh(payload);
  return { accessToken, refreshToken };
};

/**
 * Revoke a single refresh token (logout).
 */
const revokeRefresh = async (token) => {
  await pool.query(`DELETE FROM refresh_tokens WHERE token = $1`, [token]);
};

module.exports = { signAccess, signRefresh, verifyRefresh, rotateRefresh, revokeRefresh };
