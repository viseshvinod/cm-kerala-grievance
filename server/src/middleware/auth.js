const jwt = require('jsonwebtoken');
const config = require('../config');
const { query } = require('../db/pool');
const { HttpError } = require('./errors');

const COOKIE = 'cmk_token';

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  });
}

function readToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map((s) => s.trim()).find((s) => s.startsWith(`${COOKIE}=`));
  return match ? decodeURIComponent(match.slice(COOKIE.length + 1)) : null;
}

/** Attaches req.user if a valid token is present; never rejects. */
async function optionalAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const { rows } = await query(
      `SELECT u.id, u.name, u.email, u.mobile, u.role, u.department_id, u.designation, d.name AS department_name
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.id = $1 AND u.is_active`,
      [payload.sub],
    );
    if (rows[0]) req.user = rows[0];
  } catch {
    /* invalid/expired token: treat as anonymous */
  }
  next();
}

const requireAuth = (req, res, next) => (req.user ? next() : next(new HttpError(401, 'Authentication required')));

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(new HttpError(401, 'Authentication required'));
  if (!roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission for this action'));
  next();
};

module.exports = { COOKIE, signToken, setAuthCookie, optionalAuth, requireAuth, requireRole };
