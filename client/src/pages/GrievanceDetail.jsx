import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Icon from '../components/Icon';
import AiPanel, { normaliseAnalysis } from '../components/AiPanel';
import {
  Alert, Attachments, Button, Field, Loading, PriorityBadge, StatusBadge, StatusStepper, Timeline, useToast,
} from '../components/ui';
import { api, fileUrl } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMeta } from '../lib/meta';
import { daysLeft, fmtDate, fmtDateTime, relTime } from '../lib/format';

const BASE = { citizen: '/citizen', cmo_admin: '/cmo', dept_officer: '/officer' };

/** Small helper for "fill a form → POST → refresh" patterns. */
function useAction(id, reload) {
  const toast = useToast();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const run = useCallback(async (key, path, body, okMsg) => {
    setBusy(key); setError('');
    try {
      await api.post(`/grievances/${id}/${path}`, body);
      toast(okMsg);
      await reload();
      return true;
    } catch (err) {
      setError(err.details?.[0]?.message || err.message);
      return false;
    } finally { setBusy(''); }
  }, [id, reload, toast]);
  return { busy, error, setError, run };
}

function Section({ title, icon, children, tone }) {
  return (
    <section className="card" style={tone === 'gold' ? { borderColor: '#f1d48f', background: 'var(--gold-50)' } : undefined}>
      <div className="card-head"><h3 className="row" style={{ gap: 8 }}>{icon && <Icon name={icon} size={18} />}{title}</h3></div>
      <div className="card-body stack">{children}</div>
    </section>
  );
}

/* ============================================================================ CMO */

function CmoActions({ data, reload, setAnalysis }) {
  const g = data.grievance;
  const { departments, priorities, categories } = useMeta();
  const { busy, error, run } = useAction(g.id, reload);
  const toast = useToast();
  const current = data.assignments.find((a) => a.is_current);
  const open = g.status !== 'Resolved';

  const [fwd, setFwd] = useState({ departmentId: '', officerId: '', priority: '', instructions: '' });
  const [officers, setOfficers] = useState([]);
  const [atr, setAtr] = useState({ publicMessage: '', remarks: '' });
  const [escReason, setEscReason] = useState('');
  const [remark, setRemark] = useState({ body: '', visibility: 'internal' });
  const [resolveMsg, setResolveMsg] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    setFwd({
      departmentId: g.department_id || g.ai_suggested_department_id || '',
      officerId: '',
      priority: g.status === 'Submitted' && g.ai_suggested_priority ? g.ai_suggested_priority : g.priority,
      instructions: '',
    });
  }, [g.id, g.department_id, g.ai_suggested_department_id, g.ai_suggested_priority, g.priority, g.status]);

  useEffect(() => {
    if (!fwd.departmentId) { setOfficers([]); return; }
    api.get(`/admin/officers?departmentId=${fwd.departmentId}`).then((d) => setOfficers(d.officers)).catch(() => setOfficers([]));
  }, [fwd.departmentId]);

  const rerunAi = async () => {
    setAiBusy(true);
    try { const { analysis } = await api.post(`/grievances/${g.id}/ai/reanalyse`); setAnalysis(analysis); toast('AI analysis refreshed'); await reload(); } catch (e) { toast(e.message, 'error'); } finally { setAiBusy(false); }
  };

  const patch = async (body) => {
    try { await api.patch(`/grievances/${g.id}`, body); toast('Updated'); reload(); } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <div className="stack">
      {error && <Alert kind="error">{error}</Alert>}

      {current?.review_status === 'pending_review' && (
        <Section title="Action-taken report — awaiting your review" icon="checkCircle" tone="gold">
          <dl className="kv"><dt>Department</dt><dd>{current.department_name}</dd><dt>Submitted by</dt><dd>{current.atr_submitted_by_name} · {fmtDateTime(current.atr_submitted_at)}</dd></dl>
          <div className="t-body pre" style={{ background: '#fff', borderRadius: 8, padding: 12, border: '1px solid var(--line)' }}>{current.atr_text}</div>
          {current.atr_attachment_id && <a className="file-chip" href={fileUrl(g.id, current.atr_attachment_id)} target="_blank" rel="noreferrer"><Icon name="paperclip" size={15} />View ATR attachment</a>}
          <Field label="Message to citizen (shown on acceptance)" htmlFor="atr-pub">
            <textarea id="atr-pub" className="textarea" style={{ minHeight: 80 }} placeholder="e.g. Water supply has been restored after replacing the pump motor." value={atr.publicMessage} onChange={(e) => setAtr({ ...atr, publicMessage: e.target.value })} />
          </Field>
          <Field label="Remarks to department (required if returning)" htmlFor="atr-rem">
            <textarea id="atr-rem" className="textarea" style={{ minHeight: 70 }} value={atr.remarks} onChange={(e) => setAtr({ ...atr, remarks: e.target.value })} />
          </Field>
          <div className="row">
            <Button className="btn-success" loading={busy === 'accept'} onClick={() => run('accept', 'review-atr', { decision: 'accept', ...atr }, 'Report accepted — grievance resolved')}><Icon name="check" size={16} />Accept & resolve</Button>
            <Button className="btn-outline" loading={busy === 'return'} onClick={() => run('return', 'review-atr', { decision: 'return', remarks: atr.remarks }, 'Report returned to department')}>Return to department</Button>
          </div>
        </Section>
      )}

      {['Submitted', 'Reopened'].includes(g.status) && (
        <Section title={g.status === 'Reopened' ? 'Reopened — review again' : 'New grievance'} icon="eye">
          <p className="small muted" style={{ margin: 0 }}>Mark as under review to acknowledge it to the citizen, or forward it directly below.</p>
          <Button className="btn-outline" loading={busy === 'review'} onClick={() => run('review', 'review', { priority: fwd.priority || undefined }, 'Marked as Under Review')}>Start review</Button>
        </Section>
      )}

      {open && (
        <Section title={current ? 'Reassign / forward' : 'Forward to department'} icon="send">
          <Field label="Department" htmlFor="f-dept" hint={g.ai_suggested_department_name ? `AI suggested: ${g.ai_suggested_department_name}` : undefined}>
            <select id="f-dept" className="select" value={fwd.departmentId} onChange={(e) => setFwd({ ...fwd, departmentId: e.target.value, officerId: '' })}>
              <option value="">Select department</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}{d.id === g.ai_suggested_department_id ? '  ✦ AI' : ''}</option>)}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Officer (optional)" htmlFor="f-off">
              <select id="f-off" className="select" value={fwd.officerId} onChange={(e) => setFwd({ ...fwd, officerId: e.target.value })}>
                <option value="">Any officer in department</option>
                {officers.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.open_cases} open)</option>)}
              </select>
            </Field>
            <Field label="Priority" htmlFor="f-pri" hint={g.ai_suggested_priority ? `AI suggested: ${g.ai_suggested_priority}` : undefined}>
              <select id="f-pri" className="select" value={fwd.priority} onChange={(e) => setFwd({ ...fwd, priority: e.target.value })}>
                {priorities.map((p) => <option key={p}>{p}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Instructions to department" htmlFor="f-ins">
            <textarea id="f-ins" className="textarea" style={{ minHeight: 70 }} placeholder="e.g. Conduct site inspection and restore service within the SLA." value={fwd.instructions} onChange={(e) => setFwd({ ...fwd, instructions: e.target.value })} />
          </Field>
          <Button disabled={!fwd.departmentId} loading={busy === 'forward'} onClick={() => run('forward', 'forward', { departmentId: Number(fwd.departmentId), officerId: fwd.officerId ? Number(fwd.officerId) : null, priority: fwd.priority, instructions: fwd.instructions || undefined }, 'Forwarded to department')}>
            <Icon name="send" size={16} />{current ? 'Reassign' : 'Forward'}
          </Button>
        </Section>
      )}

      <Section title="Remarks" icon="message">
        <div className="radio-row">
          <label><input type="radio" name="vis" checked={remark.visibility === 'internal'} onChange={() => setRemark({ ...remark, visibility: 'internal' })} />Internal note</label>
          <label><input type="radio" name="vis" checked={remark.visibility === 'public'} onChange={() => setRemark({ ...remark, visibility: 'public' })} />Update to citizen</label>
        </div>
        <textarea className="textarea" style={{ minHeight: 70 }} aria-label="Remark" value={remark.body} onChange={(e) => setRemark({ ...remark, body: e.target.value })} />
        <Button className="btn-outline" disabled={remark.body.trim().length < 3} loading={busy === 'remark'} onClick={async () => { if (await run('remark', 'remarks', remark, 'Remark added')) setRemark({ ...remark, body: '' }); }}>Add remark</Button>
      </Section>

      {open && (
        <Section title="Escalation & closure" icon="flag">
          {!g.is_escalated ? (
            <>
              <Field label="Escalate (sets High priority, halves SLA on next assignment)" htmlFor="esc"><input id="esc" className="input" placeholder="Reason for escalation" value={escReason} onChange={(e) => setEscReason(e.target.value)} /></Field>
              <Button className="btn-danger" disabled={escReason.trim().length < 3} loading={busy === 'esc'} onClick={() => run('esc', 'escalate', { reason: escReason }, 'Grievance escalated')}><Icon name="flag" size={16} />Escalate</Button>
            </>
          ) : <Alert kind="warn">Escalated {relTime(g.escalated_at)}.</Alert>}
          <div className="divider" />
          <Field label="Close at CMO level (e.g. resolved without department action)" htmlFor="res"><textarea id="res" className="textarea" style={{ minHeight: 60 }} placeholder="Message to citizen" value={resolveMsg} onChange={(e) => setResolveMsg(e.target.value)} /></Field>
          <Button className="btn-outline" disabled={resolveMsg.trim().length < 3} loading={busy === 'resolve'} onClick={() => run('resolve', 'resolve', { publicMessage: resolveMsg }, 'Grievance resolved')}>Mark resolved</Button>
        </Section>
      )}

      <Section title="Classification" icon="target">
        <div className="form-grid">
          <Field label="Priority"><select className="select" value={g.priority} onChange={(e) => patch({ priority: e.target.value })}>{priorities.map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Category"><select className="select" value={g.category} onChange={(e) => patch({ category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select></Field>
        </div>
        <Button className="btn-outline btn-sm" loading={aiBusy} onClick={rerunAi}><Icon name="sparkles" size={14} />Re-run AI analysis</Button>
      </Section>
    </div>
  );
}

/* ============================================================================ Officer */

function OfficerActions({ data, reload }) {
  const g = data.grievance;
  const { busy, error, run, setError } = useAction(g.id, reload);
  const toast = useToast();
  const current = data.assignments.find((a) => a.is_current);
  const [startNote, setStartNote] = useState('');
  const [progress, setProgress] = useState({ remarks: '', visibility: 'public' });
  const [report, setReport] = useState('');
  const [file, setFile] = useState(null);
  const [atrBusy, setAtrBusy] = useState(false);
  const [returnReason, setReturnReason] = useState('');

  const submitAtr = async () => {
    setAtrBusy(true); setError('');
    const fd = new FormData();
    fd.append('report', report);
    if (file) fd.append('attachment', file);
    try { await api.post(`/grievances/${g.id}/atr`, fd); toast('Action-taken report submitted to CMO'); setReport(''); setFile(null); await reload(); } catch (e) { setError(e.details?.[0]?.message || e.message); } finally { setAtrBusy(false); }
  };

  if (!current) return <Alert kind="info">This grievance is no longer assigned to your department.</Alert>;

  return (
    <div className="stack">
      {error && <Alert kind="error">{error}</Alert>}
      <Section title="Assignment" icon="inbox">
        <dl className="kv">
          <dt>Assigned by</dt><dd>{current.assigned_by_name} · {fmtDate(current.assigned_at)}</dd>
          <dt>Officer</dt><dd>{current.officer_name || 'Any officer'}</dd>
          <dt>Target date</dt><dd>{fmtDate(current.due_date)} {g.status !== 'Resolved' && <span className={`badge plain ${daysLeft(current.due_date) < 0 ? 'b-danger' : 'b-neutral'}`}>{daysLeft(current.due_date) < 0 ? `${-daysLeft(current.due_date)}d overdue` : `${daysLeft(current.due_date)}d left`}</span>}</dd>
        </dl>
        {current.instructions && <div className="t-body"><strong>CMO instructions:</strong> {current.instructions}</div>}
      </Section>

      {g.status === 'Under Review' && (
        <Section title="Begin investigation" icon="search">
          <textarea className="textarea" style={{ minHeight: 70 }} placeholder="Optional note to citizen, e.g. Site inspection scheduled for Monday." aria-label="Note" value={startNote} onChange={(e) => setStartNote(e.target.value)} />
          <Button loading={busy === 'start'} onClick={() => run('start', 'start', { remarks: startNote || undefined }, 'Status changed to In Progress')}><Icon name="arrowRight" size={16} />Start investigation</Button>
          <div className="divider" />
          <Field label="Not handled by your department?" htmlFor="ret"><input id="ret" className="input" placeholder="Reason to return to CMO" value={returnReason} onChange={(e) => setReturnReason(e.target.value)} /></Field>
          <Button className="btn-outline btn-sm" disabled={returnReason.trim().length < 3} loading={busy === 'ret'} onClick={() => run('ret', 'return', { reason: returnReason }, 'Returned to CMO')}>Return to CMO</Button>
        </Section>
      )}

      {g.status === 'In Progress' && (
        <>
          <Section title="Investigation update" icon="message">
            <div className="radio-row">
              <label><input type="radio" name="pv" checked={progress.visibility === 'public'} onChange={() => setProgress({ ...progress, visibility: 'public' })} />Visible to citizen</label>
              <label><input type="radio" name="pv" checked={progress.visibility === 'internal'} onChange={() => setProgress({ ...progress, visibility: 'internal' })} />Internal (CMO only)</label>
            </div>
            <textarea className="textarea" style={{ minHeight: 70 }} aria-label="Investigation remarks" placeholder="Findings, actions taken so far…" value={progress.remarks} onChange={(e) => setProgress({ ...progress, remarks: e.target.value })} />
            <Button className="btn-outline" disabled={progress.remarks.trim().length < 3} loading={busy === 'prog'} onClick={async () => { if (await run('prog', 'progress', progress, 'Update posted')) setProgress({ ...progress, remarks: '' }); }}>Post update</Button>
          </Section>

          {current.review_status === 'pending_review' ? (
            <Alert kind="info">Your action-taken report was submitted {relTime(current.atr_submitted_at)} and is awaiting CMO verification.</Alert>
          ) : (
            <Section title="Action-taken report (ATR)" icon="file" tone="gold">
              {current.review_status === 'returned' && <Alert kind="warn"><strong>Returned by CMO:</strong> {current.review_remarks}</Alert>}
              <Field label="Report" htmlFor="atr" hint="Describe what was done, when, and the outcome. Min 20 characters.">
                <textarea id="atr" className="textarea" value={report} onChange={(e) => setReport(e.target.value)} />
              </Field>
              <Field label="Supporting document (optional)" hint="JPG, PNG, WEBP or PDF up to 5 MB">
                <input type="file" accept=".jpg,.jpeg,.png,.webp,.pdf" onChange={(e) => setFile(e.target.files[0] || null)} />
              </Field>
              <Button className="btn-primary" disabled={report.trim().length < 20} loading={atrBusy} onClick={submitAtr}><Icon name="send" size={16} />Submit to CMO for review</Button>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

/* ============================================================================ Citizen */

function CitizenActions({ data, reload }) {
  const g = data.grievance;
  const { busy, error, run } = useAction(g.id, reload);
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState('');
  const [reason, setReason] = useState('');
  const canReopen = g.status === 'Resolved' && g.resolved_at && daysLeft(new Date(new Date(g.resolved_at).getTime() + 30 * 86400000)) >= 0;

  if (g.status !== 'Resolved') {
    return (
      <Section title="What happens next" icon="clock">
        <p className="small muted" style={{ margin: 0 }}>
          {{ Submitted: "Your grievance is waiting for review by the Chief Minister's Office.", 'Under Review': g.department_name ? `Forwarded to ${g.department_name}. The department will begin investigating soon.` : 'The CMO is reviewing your grievance and will forward it to the right department.', 'In Progress': `${g.department_name || 'The department'} is working on it. Updates will appear here.`, Reopened: 'You reopened this grievance. The CMO will review it again.' }[g.status]}
        </p>
        <p className="small" style={{ margin: 0 }}>Target date: <strong>{fmtDate(g.due_date)}</strong></p>
      </Section>
    );
  }

  return (
    <div className="stack">
      {error && <Alert kind="error">{error}</Alert>}
      {data.feedback ? (
        <Section title="Your feedback" icon="star">
          <div className="stars">{[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ color: n <= data.feedback.rating ? 'var(--gold-500)' : 'var(--line)', fontSize: '1.4rem' }}>★</span>)}</div>
          {data.feedback.comments && <p className="small" style={{ margin: 0 }}>{data.feedback.comments}</p>}
          <p className="tiny muted" style={{ margin: 0 }}>Submitted {fmtDate(data.feedback.created_at)}. Thank you.</p>
        </Section>
      ) : (
        <Section title="Rate the resolution" icon="star">
          <div className="stars" role="radiogroup" aria-label="Rating">
            {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={n <= rating ? 'on' : ''} aria-label={`${n} star`} onClick={() => setRating(n)}>★</button>)}
          </div>
          <textarea className="textarea" style={{ minHeight: 70 }} aria-label="Comments" placeholder="Optional comments" value={comments} onChange={(e) => setComments(e.target.value)} />
          <Button disabled={!rating} loading={busy === 'fb'} onClick={() => run('fb', 'feedback', { rating, comments: comments || undefined }, 'Thank you for your feedback')}>Submit feedback</Button>
        </Section>
      )}
      {canReopen && (
        <Section title="Problem not solved?" icon="refresh">
          <textarea className="textarea" style={{ minHeight: 70 }} aria-label="Reason" placeholder="Explain what is still wrong (min 10 characters)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button className="btn-outline" disabled={reason.trim().length < 10} loading={busy === 'reopen'} onClick={() => run('reopen', 'reopen', { reason }, 'Grievance reopened')}>Reopen grievance</Button>
          <p className="tiny muted" style={{ margin: 0 }}>You can reopen within 30 days of resolution.</p>
        </Section>
      )}
    </div>
  );
}

/* ============================================================================ Page */

export default function GrievanceDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const { departments } = useMeta();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [freshAnalysis, setFreshAnalysis] = useState(null);

  const load = useCallback(() => api.get(`/grievances/${id}`).then(setData).catch((e) => setError(e.message)), [id]);
  useEffect(() => { setData(null); setFreshAnalysis(null); load(); }, [load]);

  if (error) return <Alert kind="error">{error}</Alert>;
  if (!data) return <Loading />;

  const g = data.grievance;
  const role = user.role;
  const staff = role !== 'citizen';
  const base = BASE[role];
  const analysis = freshAnalysis || normaliseAnalysis(data.ai, departments);
  const publicRemarks = data.remarks.filter((r) => r.visibility === 'public');
  const internalRemarks = data.remarks.filter((r) => r.visibility === 'internal');

  return (
    <>
      <div className="dash-title">
        <div>
          <Link to={base === '/cmo' ? '/cmo/grievances' : base} className="small row" style={{ gap: 4 }}><Icon name="arrowLeft" size={14} />Back</Link>
          <div className="mono small muted" style={{ marginTop: 8 }}>{g.reference_no}</div>
          <h1 style={{ fontSize: '1.5rem' }}>{g.subject}</h1>
        </div>
        <div className="row">
          {g.is_overdue && <span className="badge plain b-danger">Overdue</span>}
          {g.is_escalated && <span className="badge plain p-high"><Icon name="flag" size={12} />Escalated</span>}
          <PriorityBadge priority={g.priority} />
          <StatusBadge status={g.status} />
        </div>
      </div>

      <div className="detail-grid">
        <div className="stack">
          <section className="card">
            <div className="card-body stack">
              <StatusStepper status={g.status} />
              <dl className="kv">
                <dt>District</dt><dd>{g.district}</dd>
                <dt>Category</dt><dd>{g.category}{staff && g.ai_suggested_category && g.ai_suggested_category !== g.category && <span className="muted small"> (AI: {g.ai_suggested_category})</span>}</dd>
                <dt>Department</dt><dd>{g.department_name || <span className="muted">Not yet assigned</span>}</dd>
                <dt>Submitted</dt><dd>{fmtDateTime(g.created_at)}</dd>
                <dt>{g.status === 'Resolved' ? 'Resolved' : 'Target date'}</dt><dd>{g.status === 'Resolved' ? fmtDateTime(g.resolved_at) : fmtDate(g.due_date)}</dd>
                {staff && <><dt>Citizen</dt><dd>{g.citizen_name} · {g.citizen_mobile} · {g.citizen_email}</dd></>}
                {g.reopen_count > 0 && <><dt>Reopened</dt><dd>{g.reopen_count} time(s)</dd></>}
              </dl>
              <div>
                <div className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>Description</div>
                <p className="pre" style={{ margin: 0 }}>{g.description}</p>
              </div>
              <div>
                <div className="small muted" style={{ fontWeight: 600, marginBottom: 6 }}>Attachments</div>
                <Attachments grievanceId={g.id} items={data.attachments} />
              </div>
            </div>
          </section>

          {staff && analysis && (
            <AiPanel analysis={analysis} audience="staff" title="AI triage for this grievance" duplicateLinkBase={role === 'cmo_admin' ? '/cmo/grievances' : undefined} />
          )}

          <section className="card">
            <div className="card-head"><h3>Updates from officials</h3><span className="muted small">{publicRemarks.length}</span></div>
            <div className="card-body">
              {publicRemarks.length ? (
                <div className="stack">{publicRemarks.map((r) => (
                  <div key={r.id}><div className="small"><strong>{r.author_name}</strong> <span className="muted">· {fmtDateTime(r.created_at)}</span></div><div className="t-body">{r.body}</div></div>
                ))}</div>
              ) : <p className="muted small" style={{ margin: 0 }}>No updates yet.</p>}
            </div>
          </section>

          {staff && (
            <section className="card">
              <div className="card-head"><h3 className="row" style={{ gap: 8 }}><Icon name="lock" size={16} />Internal remarks</h3><span className="muted small">Not visible to citizen</span></div>
              <div className="card-body">
                {internalRemarks.length ? (
                  <div className="stack">{internalRemarks.map((r) => (
                    <div key={r.id}><div className="small"><strong>{r.author_name}</strong> <span className="muted">· {r.author_role === 'cmo_admin' ? 'CMO' : 'Department'} · {fmtDateTime(r.created_at)}</span></div><div className="t-body">{r.body}</div></div>
                  ))}</div>
                ) : <p className="muted small" style={{ margin: 0 }}>No internal remarks.</p>}
              </div>
            </section>
          )}

          {staff && data.assignments.length > 0 && (
            <section className="card">
              <div className="card-head"><h3>Department assignments & reports</h3></div>
              <div className="table-wrap"><table className="table">
                <thead><tr><th>Department</th><th>Assigned</th><th>Due</th><th>ATR</th><th>Review</th></tr></thead>
                <tbody>{data.assignments.map((a) => (
                  <tr key={a.id}>
                    <td className="small"><strong>{a.department_name}</strong>{a.is_current && <span className="badge plain b-brand tiny" style={{ marginLeft: 6 }}>Current</span>}<div className="muted tiny">{a.officer_name || 'Any officer'}</div></td>
                    <td className="small">{fmtDate(a.assigned_at)}</td>
                    <td className="small">{fmtDate(a.due_date)}</td>
                    <td className="small" style={{ maxWidth: 260 }}>{a.atr_text ? <span title={a.atr_text}>{a.atr_text.slice(0, 90)}{a.atr_text.length > 90 ? '…' : ''}</span> : <span className="muted">—</span>}</td>
                    <td className="small"><span className={`badge plain ${a.review_status === 'accepted' ? 's-resolved' : a.review_status === 'pending_review' ? 'b-gold' : 'b-neutral'}`}>{a.review_status.replace('_', ' ')}</span>{a.review_remarks && <div className="muted tiny">{a.review_remarks}</div>}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            </section>
          )}

          <section className="card">
            <div className="card-head"><h3>Status history</h3><span className="muted small">{staff ? 'Full audit trail' : 'Public timeline'}</span></div>
            <div className="card-body"><Timeline items={data.history} showInternal={staff} /></div>
          </section>
        </div>

        <div className="stack">
          {role === 'cmo_admin' && <CmoActions data={data} reload={load} setAnalysis={setFreshAnalysis} />}
          {role === 'dept_officer' && <OfficerActions data={data} reload={load} />}
          {role === 'citizen' && <CitizenActions data={data} reload={load} />}
          {staff && data.feedback && (
            <Section title="Citizen feedback" icon="star">
              <div style={{ color: 'var(--gold-500)', fontSize: '1.3rem' }}>{'★'.repeat(data.feedback.rating)}<span style={{ color: 'var(--line)' }}>{'★'.repeat(5 - data.feedback.rating)}</span></div>
              {data.feedback.comments && <p className="small" style={{ margin: 0 }}>{data.feedback.comments}</p>}
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
