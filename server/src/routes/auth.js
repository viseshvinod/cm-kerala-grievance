const express = require('express');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { query } = require('../db/pool');
const { ah, HttpError } = require('../middleware/errors');
const { signToken, setAuthCookie, COOKIE } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimits');

const router = express.Router();
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  mobile: z.string().trim().regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(72)
    .regex(/[A-Za-z]/, 'Password must contain a letter').regex(/\d/, 'Password must contain a number'),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(72),
});

const publicUser = (u) => ({
  id: u.id, name: u.name, email: u.email, mobile: u.mobile, role: u.role,
  departmentId: u.department_id, departmentName: u.department_name || null, designation: u.designation || null,
});

router.post('/register', authLimiter, ah(async (req, res) => {
  const data = registerSchema.parse(req.body);
  const exists = await query('SELECT 1 FROM users WHERE lower(email) = $1', [data.email]);
  if (exists.rowCount) throw new HttpError(409, 'An account with this email already exists');
  const hash = await bcrypt.hash(data.password, 10);
  const mobile = data.mobile.replace(/\D/g, '').slice(-10);
  const { rows } = await query(
    `INSERT INTO users (name, email, mobile, password_hash, role) VALUES ($1,$2,$3,$4,'citizen')
     RETURNING id, name, email, mobile, role, department_id, designation`,
    [data.name, data.email, mobile, hash],
  );
  const token = signToken(rows[0]);
  setAuthCookie(res, token);
  res.status(201).json({ user: publicUser(rows[0]), token });
}));

router.post('/login', authLimiter, ah(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);
  const { rows } = await query(
    `SELECT u.*, d.name AS department_name FROM users u LEFT JOIN departments d ON d.id = u.department_id
      WHERE lower(u.email) = $1`,
    [email],
  );
  const user = rows[0];
  // Compare against a dummy hash when the user is missing to keep timing uniform.
  const ok = await bcrypt.compare(password, user?.password_hash || DUMMY_HASH);
  if (!user || !ok || !user.is_active) throw new HttpError(401, 'Invalid email or password');
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user), token });
}));

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

// Returns { user: null } for anonymous visitors so the SPA can probe the session without a 401.
router.get('/me', (req, res) => res.json({ user: req.user ? publicUser(req.user) : null }));

module.exports = router;
