'use strict';

// ── Primitive validators ─────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE  = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE_RE = /^[+\d][\d\s\-().]{5,}$/;

/**
 * Returns an error string if invalid, or null if valid.
 */
const validators = {
  email(v) {
    if (typeof v !== 'string') return 'must be a string';
    const s = v.trim();
    if (!s) return 'required';
    if (s.length > 254) return 'too long (max 254 chars)';
    if (!EMAIL_RE.test(s)) return 'invalid email format';
    return null;
  },

  password(v) {
    if (typeof v !== 'string') return 'must be a string';
    if (v.length < 8)   return 'must be at least 8 characters';
    if (v.length > 128) return 'too long (max 128 characters)';
    return null;
  },

  name(v, { max = 100 } = {}) {
    if (typeof v !== 'string') return 'must be a string';
    const s = v.trim();
    if (!s) return 'required';
    if (s.length > max) return `too long (max ${max} chars)`;
    return null;
  },

  phone(v) {
    if (v === undefined || v === null || v === '') return null; // optional
    if (typeof v !== 'string') return 'must be a string';
    const s = v.trim();
    if (!s) return null; // blank is allowed (optional)
    if (s.length < 7 || s.length > 20) return 'must be 7–20 characters';
    if (!PHONE_RE.test(s)) return 'invalid phone format';
    return null;
  },

  batchYear(v) {
    if (v === undefined || v === null || v === '') return null; // optional
    const s = String(v).trim();
    const n = parseInt(s, 10);
    if (isNaN(n) || String(n) !== s) return 'must be a numeric year';
    if (n < 1908 || n > 2030) return 'must be between 1908 and 2030';
    return null;
  },

  address(v) {
    if (v === undefined || v === null || v === '') return null; // optional
    if (typeof v !== 'string') return 'must be a string';
    if (v.length > 500) return 'too long (max 500 chars)';
    return null;
  },

  uuid(v) {
    if (typeof v !== 'string') return 'invalid token';
    if (!UUID_RE.test(v)) return 'invalid token format';
    return null;
  },
};

/**
 * Run a map of { fieldName: validatorFn(value) } and collect errors.
 * Returns null if clean, or a 400 response sent via res.
 *
 * Usage:
 *   if (validationError(res, {
 *     email:    () => validators.email(email),
 *     password: () => validators.password(password),
 *   })) return;
 */
function validationError(res, checks) {
  const errors = {};
  for (const [field, check] of Object.entries(checks)) {
    const err = check();
    if (err) errors[field] = err;
  }
  if (Object.keys(errors).length === 0) return false;
  res.status(400).json({ error: 'Validation failed', errors });
  return true;
}

module.exports = { validators, validationError };
