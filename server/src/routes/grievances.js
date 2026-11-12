const express = require('express');
const { z } = require('zod');
const config = require('../config');
const { query, withTransaction } = require('../db/pool');
const { ah, HttpError } = require('../middleware/errors');
const { requireAuth, requireRole } = require('../middleware/auth');
const { DISTRICTS, CATEGORIES, STATUSES, PRIORITIES } = require('../constants');
const { generateReference } = require('../services/reference');
const { upload, saveAttachment } = require('../services/uploads');
const { hashInput } = require('../services/ai');
const { runAnalysis } = require('../services/aiAssistant');
const wf = require('../services/workflow');

const router = express.Router();
router.use(requireAuth);

const DAY = 86400000;
const idParam = (req) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid grievance id');
  return id;
};

/* --------------------------------------------------------------------------- scope helpers */

function scopeClause(user, params) {
  if (user.role === 'citizen') { params.push(user.id); return `g.citizen_id = $${params.length}`; }
  if (user.role === 'dept_officer') { params.push(user.department_id); return `g.department_id = $${params.length}`; }
  return 'TRUE';
}

async function loadScoped(id, user) {
  const params = [id];
  const scope = scopeClause(user, params);
  const { rows } = await query(
    `SELECT g.*, d.name AS department_name, d.code AS department_code,
            u.name AS citizen_name, u.email AS citizen_email, u.mobile AS citizen_mobile,
            ad.name AS ai_suggested_department_name, ad.code AS ai_suggested_department_code,
            (g.status <> 'Resolved' AND g.due_date < now()) AS is_overdue
       FROM grievances g
       JOIN users u ON u.id = g.citizen_id
       LEFT JOIN departments d ON d.id = g.department_id
       LEFT JOIN departments ad ON ad.id = g.ai_suggested_department_id
      WHERE g.id = $1 AND ${scope}`,
    params,
  );
  if (!rows[0]) throw new HttpError(404, 'Grievance not found');
  return rows[0];
}

/* --------------------------------------------------------------------------- submit */

const submitSchema = z.object({
  district: z.enum(DISTRICTS.map((d) => d.name)),
  category: z.enum(CATEGORIES),
  subject: z.string().trim().min(5, 'Subject must be at least 5 characters').max(200),
  description: z.string().trim().min(20, 'Please describe the issue in at least 20 characters').max(5000),
  aiAnalysisId: z.coerce.number().int().positive().optional(),
});

router.post('/', requireRole('citizen'), upload.array('attachments', 3), ah(async (req, res) => {
  const data = submitSchema.parse(req.body);

  // Re-use the analysis the citizen reviewed if it matches this exact text; otherwise run a fresh one.
  let analysis = null;
  if (data.aiAnalysisId) {
    const { rows } = await query(
      'SELECT a.*, d.id AS dept_id FROM ai_analyses a LEFT JOIN departments d ON d.code = a.result->>\'department_code\' WHERE a.id = $1 AND a.requested_by = $2 AND a.grievance_id IS NULL',
      [data.aiAnalysisId, req.user.id],
    );
    if (rows[0] && rows[0].input_hash === hashInput(data)) analysis = rows[0];
  }
  if (!analysis) {
    const fresh = await runAnalysis(data, { userId: req.user.id });
    analysis = { id: fresh.analysisId, result: { category: fresh.category, priority: fresh.priority, summary: fresh.summary }, dept_id: fresh.department?.id };
  }

  const result = await withTransaction(async (c) => {
    let grievance;
    for (let attempt = 0; attempt < 5 && !grievance; attempt += 1) {
      const ref = generateReference(data.district);
      const { rows } = await c.query(
        `INSERT INTO grievances (reference_no, citizen_id, district, category, subject, description, priority, due_date,
                                 ai_analysis_id, ai_summary, ai_suggested_category, ai_suggested_priority, ai_suggested_department_id, ai_category_accepted)
         VALUES ($1,$2,$3,$4,$5,$6,'Medium',$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (reference_no) DO NOTHING
         RETURNING id, reference_no, status, created_at`,
        [ref, req.user.id, data.district, data.category, data.subject, data.description,
          new Date(Date.now() + config.defaultSlaDays * DAY), analysis.id, analysis.result.summary,
          analysis.result.category, analysis.result.priority, analysis.dept_id || null,
          analysis.result.category === data.category],
      );
      grievance = rows[0];
    }
    if (!grievance) throw new HttpError(500, 'Could not allocate a reference number');

    await c.query('UPDATE ai_analyses SET grievance_id = $1 WHERE id = $2', [grievance.id, analysis.id]);
    const files = [];
    for (const file of req.files || []) {
      files.push(await saveAttachment(c, { grievanceId: grievance.id, userId: req.user.id, kind: 'evidence', file }));
    }
    await wf.recordHistory(c, {
      grievanceId: grievance.id, action: 'submitted', from: null, to: 'Submitted', actor: req.user,
      remarks: `Grievance submitted online. Reference ${grievance.reference_no} generated.`,
    });
    return { ...grievance, attachments: files };
  });

  res.status(201).json({ grievance: result });
}));

/* --------------------------------------------------------------------------- list */

const listSchema = z.object({
  status: z.enum(STATUSES).optional(),
  district: z.enum(DISTRICTS.map((d) => d.name)).optional(),
  category: z.enum(CATEGORIES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  departmentId: z.coerce.number().int().positive().optional(),
  overdue: z.enum(['true', 'false']).optional(),
  escalated: z.enum(['true', 'false']).optional(),
  atr: z.enum(['pending_review', 'awaiting_atr', 'returned']).optional(),
  unassigned: z.enum(['true']).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['newest', 'oldest', 'due', 'priority', 'updated']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

router.get('/', ah(async (req, res) => {
  const f = listSchema.parse(req.query);
  const params = [];
  const where = [scopeClause(req.user, params)];
  const add = (sql, val) => { params.push(val); where.push(sql.replace('?', `$${params.length}`)); };

  if (f.status) add('g.status = ?', f.status);
  if (f.district) add('g.district = ?', f.district);
  if (f.category) add('g.category = ?', f.category);
  if (f.priority) add('g.priority = ?', f.priority);
  if (f.departmentId) add('g.department_id = ?', f.departmentId);
  if (f.overdue === 'true') where.push("g.status <> 'Resolved' AND g.due_date < now()");
  if (f.escalated === 'true') where.push('g.is_escalated');
  if (f.unassigned) where.push("g.department_id IS NULL AND g.status <> 'Resolved'");
  if (f.atr) add('a.review_status = ?', f.atr);
  if (f.q) {
    params.push(`%${f.q}%`);
    where.push(`(g.reference_no ILIKE $${params.length} OR g.subject ILIKE $${params.length})`);
  }

  const order = {
    newest: 'g.created_at DESC',
    oldest: 'g.created_at ASC',
    due: 'g.due_date ASC',
    updated: 'g.updated_at DESC',
    priority: "CASE g.priority WHEN 'High' THEN 0 WHEN 'Medium' THEN 1 ELSE 2 END, g.created_at DESC",
  }[f.sort];

  const from = `FROM grievances g
       LEFT JOIN departments d ON d.id = g.department_id
       LEFT JOIN department_assignments a ON a.grievance_id = g.id AND a.is_current
      WHERE ${where.join(' AND ')}`;

  const [list, count] = await Promise.all([
    query(
      `SELECT g.id, g.reference_no, g.district, g.category, g.subject, g.priority, g.status, g.is_escalated,
              g.created_at, g.updated_at, g.due_date, g.resolved_at, g.ai_suggested_priority,
              d.name AS department_name, a.review_status AS atr_status,
              (g.status <> 'Resolved' AND g.due_date < now()) AS is_overdue
         ${from} ORDER BY ${order} LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}`,
      params,
    ),
    query(`SELECT COUNT(*) AS n ${from}`, params),
  ]);
  res.json({ items: list.rows, total: count.rows[0].n, page: f.page, pageSize: f.pageSize });
}));

/* --------------------------------------------------------------------------- role summaries */

router.get('/summary', ah(async (req, res) => {
  const params = [];
  const scope = scopeClause(req.user, params);
  const { rows } = await query(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'Submitted') AS submitted,
            COUNT(*) FILTER (WHERE status = 'Under Review') AS under_review,
            COUNT(*) FILTER (WHERE status = 'In Progress') AS in_progress,
            COUNT(*) FILTER (WHERE status = 'Resolved') AS resolved,
            COUNT(*) FILTER (WHERE status = 'Reopened') AS reopened,
            COUNT(*) FILTER (WHERE status <> 'Resolved') AS pending,
            COUNT(*) FILTER (WHERE status <> 'Resolved' AND due_date < now()) AS overdue,
            COUNT(*) FILTER (WHERE is_escalated AND status <> 'Resolved') AS escalated
       FROM grievances g WHERE ${scope}`,
    params,
  );
  const extra = {};
  if (req.user.role === 'dept_officer') {
    const r = await query(
      `SELECT COUNT(*) FILTER (WHERE review_status = 'pending_review') AS atr_pending,
              COUNT(*) FILTER (WHERE review_status = 'returned') AS atr_returned,
              COUNT(*) FILTER (WHERE g.status = 'Under Review') AS new_assignments
         FROM department_assignments a JOIN grievances g ON g.id = a.grievance_id
        WHERE a.is_current AND a.department_id = $1`,
      [req.user.department_id],
    );
    Object.assign(extra, r.rows[0]);
  }
  res.json({ ...rows[0], ...extra });
}));

/* --------------------------------------------------------------------------- detail */

router.get('/:id', ah(async (req, res) => {
  const id = idParam(req);
  const g = await loadScoped(id, req.user);
  const staff = req.user.role !== 'citizen';

  const [history, remarks, attachments, assignments, feedback, ai] = await Promise.all([
    query(
      `SELECT h.id, h.action, h.from_status, h.to_status, h.remarks, h.is_public, h.created_at, h.actor_role,
              ${staff ? 'u.name' : "CASE h.actor_role WHEN 'citizen' THEN u.name WHEN 'cmo_admin' THEN 'CMO' ELSE 'Department' END"} AS actor_name
         FROM grievance_history h LEFT JOIN users u ON u.id = h.actor_id
        WHERE h.grievance_id = $1 ${staff ? '' : 'AND h.is_public'} ORDER BY h.created_at, h.id`,
      [id],
    ),
    query(
      `SELECT r.id, r.visibility, r.body, r.created_at, r.author_role,
              ${staff ? 'u.name' : "CASE r.author_role WHEN 'cmo_admin' THEN 'Chief Minister''s Office' ELSE 'Department Officer' END"} AS author_name
         FROM remarks r LEFT JOIN users u ON u.id = r.author_id
        WHERE r.grievance_id = $1 ${staff ? '' : "AND r.visibility = 'public'"} ORDER BY r.created_at`,
      [id],
    ),
    query(
      `SELECT at.id, at.kind, at.original_name, at.mime_type, at.size_bytes, at.created_at, u.name AS uploaded_by_name
         FROM attachments at LEFT JOIN users u ON u.id = at.uploaded_by
        WHERE at.grievance_id = $1 ${staff ? '' : "AND at.kind = 'evidence'"} ORDER BY at.created_at`,
      [id],
    ),
    staff ? query(
      `SELECT a.*, d.name AS department_name, o.name AS officer_name, ab.name AS assigned_by_name,
              sb.name AS atr_submitted_by_name, rb.name AS reviewed_by_name
         FROM department_assignments a
         JOIN departments d ON d.id = a.department_id
         LEFT JOIN users o ON o.id = a.officer_id
         LEFT JOIN users ab ON ab.id = a.assigned_by
         LEFT JOIN users sb ON sb.id = a.atr_submitted_by
         LEFT JOIN users rb ON rb.id = a.reviewed_by
        WHERE a.grievance_id = $1 ${req.user.role === 'dept_officer' ? 'AND a.department_id = $2' : ''}
        ORDER BY a.assigned_at DESC`,
      req.user.role === 'dept_officer' ? [id, req.user.department_id] : [id],
    ) : { rows: [] },
    query('SELECT rating, comments, created_at FROM feedback WHERE grievance_id = $1', [id]),
    g.ai_analysis_id
      ? query('SELECT id, provider, model, is_fallback, result, duplicates, latency_ms, created_at FROM ai_analyses WHERE id = $1', [g.ai_analysis_id])
      : { rows: [] },
  ]);

  if (!staff) { delete g.citizen_email; delete g.citizen_mobile; }
  res.json({
    grievance: g,
    history: history.rows,
    remarks: remarks.rows,
    attachments: attachments.rows,
    assignments: assignments.rows,
    feedback: feedback.rows[0] || null,
    ai: ai.rows[0] || null,
  });
}));

router.get('/:id/attachments/:attachmentId', ah(async (req, res) => {
  const id = idParam(req);
  await loadScoped(id, req.user);
  const { rows } = await query(
    `SELECT original_name, mime_type, data, kind FROM attachments WHERE id = $1 AND grievance_id = $2`,
    [Number(req.params.attachmentId), id],
  );
  const file = rows[0];
  if (!file || (req.user.role === 'citizen' && file.kind !== 'evidence')) throw new HttpError(404, 'Attachment not found');
  res.setHeader('Content-Type', file.mime_type);
  res.setHeader('Content-Disposition', `${req.query.download ? 'attachment' : 'inline'}; filename="${file.original_name.replace(/"/g, '')}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.send(file.data);
}));

/* --------------------------------------------------------------------------- CMO actions */

const admin = requireRole('cmo_admin');
const officer = requireRole('dept_officer');
const citizen = requireRole('citizen');
const remarkText = z.string().trim().min(3).max(3000);

const respond = (handler) => ah(async (req, res) => {
  const id = idParam(req);
  await handler(id, req);
  const fresh = await query('SELECT id, reference_no, status, priority, department_id, is_escalated, updated_at FROM grievances WHERE id = $1', [id]);
  res.json({ ok: true, grievance: fresh.rows[0] });
});

router.post('/:id/review', admin, respond((id, req) => wf.review(id, req.user, z.object({
  remarks: z.string().trim().max(3000).optional(),
  priority: z.enum(PRIORITIES).optional(),
  category: z.enum(CATEGORIES).optional(),
}).parse(req.body))));

router.post('/:id/forward', admin, respond((id, req) => wf.forward(id, req.user, z.object({
  departmentId: z.coerce.number().int().positive(),
  officerId: z.coerce.number().int().positive().optional().nullable(),
  instructions: z.string().trim().max(3000).optional(),
  priority: z.enum(PRIORITIES).optional(),
}).parse(req.body))));

router.post('/:id/escalate', admin, respond((id, req) => wf.escalate(id, req.user, z.object({ reason: remarkText }).parse(req.body))));

router.post('/:id/review-atr', admin, respond((id, req) => {
  const body = z.object({
    decision: z.enum(['accept', 'return']),
    remarks: z.string().trim().max(3000).optional(),
    publicMessage: z.string().trim().max(3000).optional(),
  }).refine((b) => b.decision === 'accept' || (b.remarks && b.remarks.length >= 3), {
    message: 'Remarks are required when returning a report', path: ['remarks'],
  }).parse(req.body);
  return wf.reviewAtr(id, req.user, body);
}));

router.post('/:id/resolve', admin, respond((id, req) => wf.resolveDirect(id, req.user, z.object({ publicMessage: remarkText }).parse(req.body))));

router.patch('/:id', admin, respond(async (id, req) => {
  const body = z.object({ priority: z.enum(PRIORITIES).optional(), category: z.enum(CATEGORIES).optional() }).parse(req.body);
  if (!body.priority && !body.category) throw new HttpError(400, 'Nothing to update');
  await withTransaction(async (c) => {
    const { rows } = await c.query('SELECT status, priority, category FROM grievances WHERE id = $1 FOR UPDATE', [id]);
    if (!rows[0]) throw new HttpError(404, 'Grievance not found');
    await c.query('UPDATE grievances SET priority = COALESCE($2, priority), category = COALESCE($3, category), updated_at = now() WHERE id = $1',
      [id, body.priority || null, body.category || null]);
    const changes = [body.priority && `priority ${rows[0].priority} → ${body.priority}`, body.category && `category → ${body.category}`].filter(Boolean).join(', ');
    await wf.recordHistory(c, { grievanceId: id, action: 'updated', from: rows[0].status, to: rows[0].status, actor: req.user, isPublic: false, remarks: `CMO updated ${changes}` });
  });
}));

router.post('/:id/ai/reanalyse', admin, ah(async (req, res) => {
  const id = idParam(req);
  const g = await loadScoped(id, req.user);
  const analysis = await runAnalysis({ subject: g.subject, description: g.description, district: g.district }, { userId: req.user.id, grievanceId: id });
  await query(
    `UPDATE grievances SET ai_analysis_id = $2, ai_summary = $3, ai_suggested_category = $4, ai_suggested_priority = $5,
            ai_suggested_department_id = $6 WHERE id = $1`,
    [id, analysis.analysisId, analysis.summary, analysis.category, analysis.priority, analysis.department?.id || null],
  );
  res.json({ analysis });
}));

/* --------------------------------------------------------------------------- Officer actions */

router.post('/:id/start', officer, respond((id, req) => wf.startInvestigation(id, req.user, z.object({ remarks: z.string().trim().max(3000).optional() }).parse(req.body))));

router.post('/:id/progress', officer, respond((id, req) => wf.progressUpdate(id, req.user, z.object({
  remarks: remarkText, visibility: z.enum(['internal', 'public']).default('public'),
}).parse(req.body))));

router.post('/:id/atr', officer, upload.single('attachment'), respond(async (id, req) => {
  const { report } = z.object({ report: z.string().trim().min(20, 'Action-taken report must be at least 20 characters').max(8000) }).parse(req.body);
  await withTransaction(async (c) => {
    let attachmentId = null;
    if (req.file) {
      const g = await c.query('SELECT department_id FROM grievances WHERE id = $1', [id]);
      if (g.rows[0]?.department_id !== req.user.department_id) throw new HttpError(403, 'This grievance is not assigned to your department');
      attachmentId = (await saveAttachment(c, { grievanceId: id, userId: req.user.id, kind: 'atr', file: req.file })).id;
    }
    await wf.submitAtr(id, req.user, { report, attachmentId }, c);
  });
}));

router.post('/:id/return', officer, respond((id, req) => wf.returnToCmo(id, req.user, z.object({ reason: remarkText }).parse(req.body))));

/* --------------------------------------------------------------------------- Citizen actions */

router.post('/:id/reopen', citizen, respond((id, req) => wf.reopen(id, req.user, z.object({ reason: z.string().trim().min(10, 'Please explain why in at least 10 characters').max(3000) }).parse(req.body))));

router.post('/:id/feedback', citizen, respond((id, req) => wf.giveFeedback(id, req.user, z.object({
  rating: z.coerce.number().int().min(1).max(5), comments: z.string().trim().max(2000).optional(),
}).parse(req.body))));

/* --------------------------------------------------------------------------- Remarks (staff) */

router.post('/:id/remarks', requireRole('cmo_admin', 'dept_officer'), respond((id, req) => wf.addGeneralRemark(id, req.user, z.object({
  body: remarkText, visibility: z.enum(['internal', 'public']).default('internal'),
}).parse(req.body))));

module.exports = router;
