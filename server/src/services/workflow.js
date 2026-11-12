/**
 * Grievance workflow state machine.
 *
 *  Submitted ──review──▶ Under Review ──forward──▶ Under Review (assigned) ──start──▶ In Progress
 *                                                                                    │
 *                                     ┌──────────── return ATR (In Progress) ◀──────┤ submit ATR
 *                                     ▼                                              ▼
 *                                 In Progress ──────────── accept ATR ──────────▶ Resolved ──reopen──▶ Reopened ─▶ (review/forward again)
 *
 * Every action writes one grievance_history row with timestamp, actor and role.
 * All mutations run in a transaction with the grievance row locked (SELECT ... FOR UPDATE).
 */
const config = require('../config');
const { withTransaction } = require('../db/pool');
const { HttpError } = require('../middleware/errors');

const DAY = 24 * 60 * 60 * 1000;
const REOPEN_WINDOW_DAYS = 30;

async function lockGrievance(client, id) {
  const { rows } = await client.query('SELECT * FROM grievances WHERE id = $1 FOR UPDATE', [id]);
  if (!rows[0]) throw new HttpError(404, 'Grievance not found');
  return rows[0];
}

async function currentAssignment(client, grievanceId) {
  const { rows } = await client.query(
    'SELECT * FROM department_assignments WHERE grievance_id = $1 AND is_current FOR UPDATE',
    [grievanceId],
  );
  return rows[0] || null;
}

async function recordHistory(client, { grievanceId, action, from, to, remarks, isPublic = true, actor }) {
  await client.query(
    `INSERT INTO grievance_history (grievance_id, action, from_status, to_status, remarks, is_public, actor_id, actor_role)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [grievanceId, action, from, to, remarks || null, isPublic, actor?.id || null, actor?.role || null],
  );
}

async function setStatus(client, g, to, extra = {}) {
  const sets = ['status = $2', 'updated_at = now()'];
  const vals = [g.id, to];
  Object.entries(extra).forEach(([col, val]) => {
    vals.push(val);
    sets.push(`${col} = $${vals.length}`);
  });
  await client.query(`UPDATE grievances SET ${sets.join(', ')} WHERE id = $1`, vals);
}

async function addRemark(client, { grievanceId, actor, visibility, body }) {
  await client.query(
    'INSERT INTO remarks (grievance_id, author_id, author_role, visibility, body) VALUES ($1,$2,$3,$4,$5)',
    [grievanceId, actor.id, actor.role, visibility, body],
  );
}

const assertStatus = (g, allowed, action) => {
  if (!allowed.includes(g.status)) {
    throw new HttpError(409, `Cannot ${action} a grievance that is "${g.status}"`);
  }
};

const assertOfficerOwns = (g, actor) => {
  if (actor.role !== 'dept_officer' || g.department_id !== actor.department_id) {
    throw new HttpError(403, 'This grievance is not assigned to your department');
  }
};

/* ----------------------------------------------------------------------------- CMO actions */

async function review(id, actor, { remarks, priority, category }) {
  return withTransaction(async (c) => {
    const g = await lockGrievance(c, id);
    assertStatus(g, ['Submitted', 'Reopened'], 'start review of');
    const extra = {};
    if (priority) extra.priority = priority;
    if (category) extra.category = category;
    await setStatus(c, g, 'Under Review', extra);
    await recordHistory(c, {
      grievanceId: id, action: 'reviewed', from: g.status, to: 'Under Review', actor,
      remarks: remarks || 'Grievance taken up for review by the Chief Minister\'s Office.',
    });
  });
}

async function forward(id, actor, { departmentId, officerId, instructions, priority }) {
  return withTransaction(async (c) => {
    const g = await lockGrievance(c, id);
    assertStatus(g, ['Submitted', 'Under Review', 'Reopened', 'In Progress'], 'forward');

    const { rows: depts } = await c.query('SELECT id, name, sla_days FROM departments WHERE id = $1', [departmentId]);
    const dept = depts[0];
    if (!dept) throw new HttpError(400, 'Unknown department');
    if (officerId) {
      const { rows } = await c.query(
        "SELECT id FROM users WHERE id = $1 AND role = 'dept_officer' AND department_id = $2 AND is_active",
        [officerId, departmentId],
      );
      if (!rows[0]) throw new HttpError(400, 'Officer does not belong to the selected department');
    }

    const prev = await currentAssignment(c, id);
    if (prev) {
      await c.query(
        "UPDATE department_assignments SET is_current = FALSE, review_status = CASE WHEN review_status IN ('awaiting_atr','returned','pending_review') THEN 'withdrawn' ELSE review_status END WHERE id = $1",
        [prev.id],
      );
    }

    const slaDays = g.is_escalated ? Math.ceil(dept.sla_days / 2) : dept.sla_days;
    const due = new Date(Date.now() + slaDays * DAY);
    await c.query(
      `INSERT INTO department_assignments (grievance_id, department_id, officer_id, assigned_by, instructions, due_date)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, departmentId, officerId || null, actor.id, instructions || null, due],
    );
    const extra = { department_id: departmentId, due_date: due };
    if (priority) extra.priority = priority;
    await setStatus(c, g, 'Under Review', extra);
    await recordHistory(c, {
      grievanceId: id, action: prev ? 'reassigned' : 'forwarded', from: g.status, to: 'Under Review', actor,
      remarks: `Forwarded to ${dept.name}. Target date: ${due.toISOString().slice(0, 10)}.`,
    });
    if (instructions) await addRemark(c, { grievanceId: id, actor, visibility: 'internal', body: `Instructions to department: ${instructions}` });
  });
}

async function escalate(id, actor, { reason }) {
  return withTransaction(async (c) => {
    const g = await lockGrievance(c, id);
    assertStatus(g, ['Submitted', 'Under Review', 'In Progress', 'Reopened'], 'escalate');
    if (g.is_escalated) throw new HttpError(409, 'Grievance is already escalated');
    await c.query(
      "UPDATE grievances SET is_escalated = TRUE, escalated_at = now(), priority = 'High', updated_at = now() WHERE id = $1",
      [id],
    );
    await recordHistory(c, {
      grievanceId: id, action: 'escalated', from: g.status, to: g.status, actor, isPublic: false,
      remarks: `Escalated by CMO: ${reason}`,
    });
    await addRemark(c, { grievanceId: id, actor, visibility: 'internal', body: `ESCALATION: ${reason}` });
  });
}

async function reviewAtr(id, actor, { decision, remarks, publicMessage }) {
  return withTransaction(async (c) => {
    const g = await lockGrievance(c, id);
    const a = await currentAssignment(c, id);
    if (!a || a.review_status !== 'pending_review') throw new HttpError(409, 'No action-taken report is awaiting review');

    await c.query(
      'UPDATE department_assignments SET review_status = $2, reviewed_by = $3, reviewed_at = now(), review_remarks = $4 WHERE id = $1',
      [a.id, decision === 'accept' ? 'accepted' : 'returned', actor.id, remarks || null],
    );
    if (decision === 'accept') {
      await setStatus(c, g, 'Resolved', { resolved_at: new Date() });
      await recordHistory(c, {
        grievanceId: id, action: 'resolved', from: g.status, to: 'Resolved', actor,
        remarks: publicMessage || 'Action taken by the department has been verified by the CMO. Grievance resolved.',
      });
      await addRemark(c, { grievanceId: id, actor, visibility: 'public', body: publicMessage || 'Your grievance has been resolved. Please share your feedback.' });
    } else {
      await setStatus(c, g, 'In Progress');
      await recordHistory(c, {
        grievanceId: id, action: 'atr_returned', from: g.status, to: 'In Progress', actor, isPublic: false,
        remarks: `Action-taken report returned to department: ${remarks}`,
      });
    }
  });
}

/** CMO may close a grievance directly (e.g. resolved at CMO level, or not actionable). */
async function resolveDirect(id, actor, { publicMessage }) {
  return withTransaction(async (c) => {
    const g = await lockGrievance(c, id);
    assertStatus(g, ['Submitted', 'Under Review', 'In Progress', 'Reopened'], 'resolve');
    const a = await currentAssignment(c, id);
    if (a && a.review_status !== 'accepted') {
      await c.query("UPDATE department_assignments SET review_status = 'withdrawn' WHERE id = $1", [a.id]);
    }
    await setStatus(c, g, 'Resolved', { resolved_at: new Date() });
    await recordHistory(c, { grievanceId: id, action: 'resolved', from: g.status, to: 'Resolved', actor, remarks: publicMessage });
    await addRemark(c, { grievanceId: id, actor, visibility: 'public', body: publicMessage });
  });
}

/* ------------------------------------------------------------------------- Officer actions */

async function startInvestigation(id, actor, { remarks }) {
  return withTransaction(async (c) => {
    const g = await lockGrievance(c, id);
    assertOfficerOwns(g, actor);
    assertStatus(g, ['Under Review'], 'start investigation on');
    const a = await currentAssignment(c, id);
    if (!a) throw new HttpError(409, 'Grievance has not been forwarded to a department');
    if (!a.officer_id) await c.query('UPDATE department_assignments SET officer_id = $2 WHERE id = $1', [a.id, actor.id]);
    await setStatus(c, g, 'In Progress');
    await recordHistory(c, {
      grievanceId: id, action: 'investigation_started', from: g.status, to: 'In Progress', actor,
      remarks: remarks || 'Department has started investigating the grievance.',
    });
  });
}

async function progressUpdate(id, actor, { remarks, visibility }) {
  return withTransaction(async (c) => {
    const g = await lockGrievance(c, id);
    assertOfficerOwns(g, actor);
    assertStatus(g, ['In Progress'], 'update');
    await addRemark(c, { grievanceId: id, actor, visibility, body: remarks });
    await recordHistory(c, {
      grievanceId: id, action: 'progress_update', from: g.status, to: g.status, actor,
      isPublic: visibility === 'public', remarks,
    });
    await c.query('UPDATE grievances SET updated_at = now() WHERE id = $1', [id]);
  });
}

async function submitAtr(id, actor, { report, attachmentId }, client) {
  const run = async (c) => {
    const g = await lockGrievance(c, id);
    assertOfficerOwns(g, actor);
    assertStatus(g, ['In Progress'], 'submit an action-taken report for');
    const a = await currentAssignment(c, id);
    if (!a || !['awaiting_atr', 'returned'].includes(a.review_status)) {
      throw new HttpError(409, 'An action-taken report is already awaiting CMO review');
    }
    await c.query(
      `UPDATE department_assignments
          SET atr_text = $2, atr_attachment_id = COALESCE($3, atr_attachment_id), atr_submitted_by = $4,
              atr_submitted_at = now(), review_status = 'pending_review'
        WHERE id = $1`,
      [a.id, report, attachmentId || null, actor.id],
    );
    await recordHistory(c, {
      grievanceId: id, action: 'atr_submitted', from: g.status, to: g.status, actor,
      remarks: 'Department submitted its action-taken report to the CMO for verification.',
    });
    await c.query('UPDATE grievances SET updated_at = now() WHERE id = $1', [id]);
  };
  return client ? run(client) : withTransaction(run);
}

/** Officer flags that the grievance belongs to another department; it goes back to the CMO queue. */
async function returnToCmo(id, actor, { reason }) {
  return withTransaction(async (c) => {
    const g = await lockGrievance(c, id);
    assertOfficerOwns(g, actor);
    assertStatus(g, ['Under Review', 'In Progress'], 'return');
    const a = await currentAssignment(c, id);
    if (a) await c.query("UPDATE department_assignments SET is_current = FALSE, review_status = 'withdrawn' WHERE id = $1", [a.id]);
    await setStatus(c, g, 'Under Review', { department_id: null });
    await recordHistory(c, {
      grievanceId: id, action: 'returned_to_cmo', from: g.status, to: 'Under Review', actor, isPublic: false,
      remarks: `Returned to CMO by department: ${reason}`,
    });
    await addRemark(c, { grievanceId: id, actor, visibility: 'internal', body: `Returned to CMO: ${reason}` });
  });
}

/* ------------------------------------------------------------------------- Citizen actions */

async function reopen(id, actor, { reason }) {
  return withTransaction(async (c) => {
    const g = await lockGrievance(c, id);
    if (g.citizen_id !== actor.id) throw new HttpError(403, 'You can only reopen your own grievance');
    assertStatus(g, ['Resolved'], 'reopen');
    if (g.resolved_at && Date.now() - new Date(g.resolved_at).getTime() > REOPEN_WINDOW_DAYS * DAY) {
      throw new HttpError(409, `Grievances can only be reopened within ${REOPEN_WINDOW_DAYS} days of resolution`);
    }
    const a = await currentAssignment(c, id);
    if (a) await c.query('UPDATE department_assignments SET is_current = FALSE WHERE id = $1', [a.id]);
    await setStatus(c, g, 'Reopened', {
      resolved_at: null, reopen_count: g.reopen_count + 1,
      due_date: new Date(Date.now() + config.defaultSlaDays * DAY),
    });
    await c.query('DELETE FROM feedback WHERE grievance_id = $1', [id]);
    await recordHistory(c, { grievanceId: id, action: 'reopened', from: g.status, to: 'Reopened', actor, remarks: `Reopened by citizen: ${reason}` });
  });
}

async function giveFeedback(id, actor, { rating, comments }) {
  return withTransaction(async (c) => {
    const g = await lockGrievance(c, id);
    if (g.citizen_id !== actor.id) throw new HttpError(403, 'You can only give feedback on your own grievance');
    assertStatus(g, ['Resolved'], 'give feedback on');
    await c.query(
      'INSERT INTO feedback (grievance_id, citizen_id, rating, comments) VALUES ($1,$2,$3,$4)',
      [id, actor.id, rating, comments || null],
    );
    await recordHistory(c, {
      grievanceId: id, action: 'feedback', from: g.status, to: g.status, actor, isPublic: false,
      remarks: `Citizen rated the resolution ${rating}/5${comments ? `: ${comments}` : ''}`,
    });
  });
}

/* ------------------------------------------------------------------------- shared */

async function addGeneralRemark(id, actor, { body, visibility }) {
  return withTransaction(async (c) => {
    const g = await lockGrievance(c, id);
    if (actor.role === 'dept_officer') assertOfficerOwns(g, actor);
    await addRemark(c, { grievanceId: id, actor, visibility, body });
    if (visibility === 'public') {
      await recordHistory(c, { grievanceId: id, action: 'remark', from: g.status, to: g.status, actor, remarks: body });
    }
  });
}

module.exports = {
  recordHistory, review, forward, escalate, reviewAtr, resolveDirect,
  startInvestigation, progressUpdate, submitAtr, returnToCmo, reopen, giveFeedback, addGeneralRemark,
  REOPEN_WINDOW_DAYS,
};
