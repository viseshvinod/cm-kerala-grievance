const express = require('express');
const { z } = require('zod');
const { query } = require('../db/pool');
const { ah, HttpError } = require('../middleware/errors');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(requireRole('cmo_admin'));

/** CMO statistics: KPIs, distributions, department performance and trend — all from live data. */
router.get('/stats', ah(async (req, res) => {
  const [kpi, byStatus, byDistrict, byDepartment, byCategory, byPriority, trend, ai, feedback] = await Promise.all([
    query(`SELECT COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE status <> 'Resolved') AS pending,
                  COUNT(*) FILTER (WHERE status = 'Resolved') AS resolved,
                  COUNT(*) FILTER (WHERE status <> 'Resolved' AND due_date < now()) AS overdue,
                  COUNT(*) FILTER (WHERE is_escalated AND status <> 'Resolved') AS escalated,
                  COUNT(*) FILTER (WHERE status = 'Submitted') AS new_submissions,
                  COUNT(*) FILTER (WHERE department_id IS NULL AND status <> 'Resolved') AS unassigned,
                  COUNT(*) FILTER (WHERE created_at > now() - interval '7 days') AS last_7_days,
                  COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 86400) FILTER (WHERE resolved_at IS NOT NULL), 1), 0) AS avg_resolution_days,
                  (SELECT COUNT(*) FROM department_assignments WHERE is_current AND review_status = 'pending_review') AS atr_pending
             FROM grievances`),
    query(`SELECT status, COUNT(*) AS count FROM grievances GROUP BY status`),
    query(`SELECT district, COUNT(*) AS total,
                  COUNT(*) FILTER (WHERE status = 'Resolved') AS resolved,
                  COUNT(*) FILTER (WHERE status <> 'Resolved') AS pending,
                  COUNT(*) FILTER (WHERE status <> 'Resolved' AND due_date < now()) AS overdue
             FROM grievances GROUP BY district ORDER BY total DESC`),
    query(`SELECT d.id, d.code, d.name, COUNT(g.id) AS total,
                  COUNT(g.id) FILTER (WHERE g.status = 'Resolved') AS resolved,
                  COUNT(g.id) FILTER (WHERE g.status <> 'Resolved') AS pending,
                  COUNT(g.id) FILTER (WHERE g.status <> 'Resolved' AND g.due_date < now()) AS overdue,
                  COALESCE(ROUND(AVG(EXTRACT(EPOCH FROM (g.resolved_at - g.created_at)) / 86400) FILTER (WHERE g.resolved_at IS NOT NULL), 1), 0) AS avg_days,
                  (SELECT COUNT(*) FROM department_assignments a WHERE a.department_id = d.id AND a.is_current AND a.review_status = 'pending_review') AS atr_pending
             FROM departments d LEFT JOIN grievances g ON g.department_id = d.id
            GROUP BY d.id ORDER BY total DESC, d.name`),
    query(`SELECT category, COUNT(*) AS count FROM grievances GROUP BY category ORDER BY count DESC`),
    query(`SELECT priority, COUNT(*) AS count FROM grievances GROUP BY priority`),
    query(`SELECT to_char(m, 'Mon YY') AS month,
                  (SELECT COUNT(*) FROM grievances WHERE date_trunc('month', created_at) = m) AS submitted,
                  (SELECT COUNT(*) FROM grievances WHERE date_trunc('month', resolved_at) = m) AS resolved
             FROM generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m
            ORDER BY m`),
    query(`SELECT COUNT(*) AS analyses,
                  COUNT(*) FILTER (WHERE NOT is_fallback) AS live_model,
                  COUNT(*) FILTER (WHERE is_fallback) AS fallback,
                  COALESCE(ROUND(AVG(latency_ms) FILTER (WHERE NOT is_fallback)), 0) AS avg_latency_ms,
                  (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE ai_suggested_category = category) / NULLIF(COUNT(*), 0), 0)
                     FROM grievances WHERE ai_suggested_category IS NOT NULL) AS category_agreement_pct,
                  (SELECT ROUND(100.0 * COUNT(*) FILTER (WHERE ai_suggested_department_id = department_id) / NULLIF(COUNT(*), 0), 0)
                     FROM grievances WHERE ai_suggested_department_id IS NOT NULL AND department_id IS NOT NULL) AS department_agreement_pct
             FROM ai_analyses WHERE provider <> 'sample-data'`),
    query(`SELECT COUNT(*) AS responses, COALESCE(ROUND(AVG(rating), 2), 0) AS avg_rating FROM feedback`),
  ]);
  res.json({
    kpi: kpi.rows[0],
    byStatus: byStatus.rows,
    byDistrict: byDistrict.rows,
    byDepartment: byDepartment.rows,
    byCategory: byCategory.rows,
    byPriority: byPriority.rows,
    trend: trend.rows,
    ai: ai.rows[0],
    feedback: feedback.rows[0],
  });
}));

router.get('/officers', ah(async (req, res) => {
  const deptId = req.query.departmentId ? Number(req.query.departmentId) : null;
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.designation, u.department_id, d.name AS department_name,
            (SELECT COUNT(*) FROM department_assignments a JOIN grievances g ON g.id = a.grievance_id
              WHERE a.officer_id = u.id AND a.is_current AND g.status <> 'Resolved') AS open_cases
       FROM users u JOIN departments d ON d.id = u.department_id
      WHERE u.role = 'dept_officer' AND u.is_active AND ($1::int IS NULL OR u.department_id = $1)
      ORDER BY d.name, u.name`,
    [deptId],
  );
  res.json({ officers: rows });
}));

router.get('/enquiries', ah(async (req, res) => {
  const { rows } = await query('SELECT * FROM contact_enquiries ORDER BY created_at DESC LIMIT 200');
  res.json({ enquiries: rows });
}));

router.patch('/enquiries/:id', ah(async (req, res) => {
  const { status } = z.object({ status: z.enum(['new', 'read', 'closed']) }).parse(req.body);
  const { rowCount } = await query('UPDATE contact_enquiries SET status = $2 WHERE id = $1', [Number(req.params.id), status]);
  if (!rowCount) throw new HttpError(404, 'Enquiry not found');
  res.json({ ok: true });
}));

module.exports = router;
