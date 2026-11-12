const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const { ah, HttpError } = require('../middleware/errors');
const { contactLimiter } = require('../middleware/rateLimits');
const { DISTRICTS, CATEGORIES, STATUSES, PRIORITIES } = require('../constants');
const { REFERENCE_PATTERN } = require('../services/reference');
const { providerStatus } = require('../services/ai');

const router = express.Router();

router.get('/meta', (req, res) => {
  res.json({ districts: DISTRICTS, categories: CATEGORIES, statuses: STATUSES, priorities: PRIORITIES, ai: providerStatus() });
});

router.get('/departments', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT d.id, d.code, d.name, d.description, d.icon, d.categories, d.sla_days, d.is_featured,
            COUNT(g.id) FILTER (WHERE g.status = 'Resolved') AS resolved_count
       FROM departments d LEFT JOIN grievances g ON g.department_id = d.id
      GROUP BY d.id ORDER BY d.name`,
  );
  res.json({ departments: rows });
}));

router.get('/stats/public', ah(async (req, res) => {
  const { rows } = await query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'Resolved') AS resolved,
            COUNT(*) FILTER (WHERE status <> 'Resolved') AS pending,
            COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400) FILTER (WHERE resolved_at IS NOT NULL), 1), 0) AS avg_resolution_days,
            (SELECT COUNT(*) FROM departments) AS departments,
            COUNT(DISTINCT district) AS districts
       FROM grievances`,
  );
  res.json(rows[0]);
}));

/** Public tracker: status, department and public history only — no personal data. */
router.get('/track/:ref', ah(async (req, res) => {
  const ref = String(req.params.ref || '').trim().toUpperCase();
  if (!REFERENCE_PATTERN.test(ref)) throw new HttpError(400, 'Invalid reference number format (e.g. CMK-26-TVM-7K3F9Q)');
  const { rows } = await query(
    `SELECT g.id, g.reference_no, g.district, g.category, g.subject, g.status, g.priority, g.created_at, g.updated_at,
            g.resolved_at, g.due_date, d.name AS department_name
       FROM grievances g LEFT JOIN departments d ON d.id = g.department_id
      WHERE g.reference_no = $1`,
    [ref],
  );
  if (!rows[0]) throw new HttpError(404, 'No grievance found with this reference number');
  const g = rows[0];
  const history = await query(
    `SELECT action, from_status, to_status, remarks, created_at,
            CASE actor_role WHEN 'cmo_admin' THEN 'CMO' WHEN 'dept_officer' THEN 'Department' WHEN 'citizen' THEN 'Citizen' ELSE 'System' END AS actor
       FROM grievance_history WHERE grievance_id = $1 AND is_public ORDER BY created_at, id`,
    [g.id],
  );
  delete g.id;
  res.json({ grievance: g, history: history.rows });
}));

const contactSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  subject: z.string().trim().min(3).max(200),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(5000),
});

router.post('/contact', contactLimiter, ah(async (req, res) => {
  const data = contactSchema.parse(req.body);
  const { rows } = await query(
    'INSERT INTO contact_enquiries (name, email, subject, message) VALUES ($1,$2,$3,$4) RETURNING id, created_at',
    [data.name, data.email, data.subject, data.message],
  );
  res.status(201).json({ ok: true, id: rows[0].id });
}));

module.exports = router;
