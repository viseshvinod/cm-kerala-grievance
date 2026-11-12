import { createContext, useCallback, useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { fileUrl } from '../lib/api';
import { ACTION_LABELS, fmtDateTime, fmtSize, relTime } from '../lib/format';

const slug = (s) => String(s || '').toLowerCase().replace(/\s+/g, '-');

export const StatusBadge = ({ status }) => <span className={`badge s-${slug(status)}`}>{status}</span>;
export const PriorityBadge = ({ priority }) => <span className={`badge plain p-${slug(priority)}`}>{priority}</span>;
export const Spinner = () => <span className="spinner" role="status" aria-label="Loading" />;
export const Loading = () => <div className="loading-block"><Spinner /></div>;

export function Field({ label, error, hint, children, className = '', htmlFor }) {
  return (
    <div className={`field ${className}`}>
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {error ? <span className="error" role="alert">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function Alert({ kind = 'info', children }) {
  const icon = { error: 'alert', success: 'checkCircle', warn: 'alert', info: 'eye' }[kind];
  return <div className={`alert alert-${kind}`} role={kind === 'error' ? 'alert' : 'status'}><Icon name={icon} size={18} /><div>{children}</div></div>;
}

export function Button({ loading, children, className = 'btn-primary', ...rest }) {
  return (
    <button className={`btn ${className}`} disabled={loading || rest.disabled} {...rest}>
      {loading && <Spinner />}{children}
    </button>
  );
}

const STEPS = ['Submitted', 'Under Review', 'In Progress', 'Resolved'];
export function StatusStepper({ status }) {
  const idx = status === 'Reopened' ? 0 : STEPS.indexOf(status);
  return (
    <div className="stepper" aria-label={`Current status: ${status}`}>
      {STEPS.map((s, i) => (
        <div key={s} className={`st ${i < idx || status === 'Resolved' ? 'done' : ''} ${i === idx && status !== 'Resolved' ? 'current' : ''}`}>
          <div className="bar" />{s}
        </div>
      ))}
      <div className={`st ${status === 'Reopened' ? 'current' : ''}`}><div className="bar" />Reopened</div>
    </div>
  );
}

export function Timeline({ items, showInternal }) {
  if (!items?.length) return <p className="muted">No activity yet.</p>;
  return (
    <ol className="timeline">
      {[...items].reverse().map((h) => (
        <li key={h.id || `${h.action}-${h.created_at}`}>
          <span className={`dot ${h.is_public === false ? 'internal' : ''}`} />
          <div className="t-head">
            <strong>{ACTION_LABELS[h.action] || h.action}</strong>
            {h.from_status !== h.to_status && <StatusBadge status={h.to_status} />}
            {showInternal && h.is_public === false && <span className="badge plain b-neutral">Internal</span>}
          </div>
          <div className="t-meta">{fmtDateTime(h.created_at)} · {h.actor_name || h.actor || 'System'}{h.actor_role && showInternal ? ` (${h.actor_role.replace('_', ' ')})` : ''}</div>
          {h.remarks && <div className="t-body">{h.remarks}</div>}
        </li>
      ))}
    </ol>
  );
}

export function Attachments({ grievanceId, items }) {
  if (!items?.length) return <p className="muted small">No attachments.</p>;
  return (
    <div className="row">
      {items.map((a) => (
        <a key={a.id} className="file-chip" href={fileUrl(grievanceId, a.id)} target="_blank" rel="noreferrer">
          <Icon name={a.mime_type === 'application/pdf' ? 'file' : 'paperclip'} size={16} />
          <span>{a.original_name}</span>
          <span className="muted tiny">{fmtSize(a.size_bytes)}{a.kind === 'atr' ? ' · ATR' : ''}</span>
        </a>
      ))}
    </div>
  );
}

export function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pager">
      <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total}` : '0 results'}</span>
      <div className="row">
        <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
        <span>Page {page} / {pages}</span>
        <button className="btn btn-outline btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}

export function GrievanceTable({ items, linkBase, showDept = true, empty = 'No grievances found.' }) {
  const navigate = useNavigate();
  if (!items.length) return <div className="empty"><Icon name="inbox" size={32} /><p>{empty}</p></div>;
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr>
          <th>Reference</th><th>Subject</th><th>District</th>{showDept && <th>Department</th>}<th>Priority</th><th>Status</th><th>Updated</th>
        </tr></thead>
        <tbody>
          {items.map((g) => (
            <tr key={g.id} className="clickable" onClick={(e) => { if (!e.target.closest('a')) navigate(`${linkBase}/${g.id}`); }}>
              <td><Link to={`${linkBase}/${g.id}`} className="mono small">{g.reference_no}</Link></td>
              <td className="subject" title={g.subject}>
                <Link to={`${linkBase}/${g.id}`} style={{ color: 'inherit' }}>{g.subject}</Link>
                <div className="row" style={{ gap: 6, marginTop: 2 }}>
                  {g.is_overdue && <span className="badge plain b-danger tiny">Overdue</span>}
                  {g.is_escalated && <span className="badge plain p-high tiny">Escalated</span>}
                  {g.atr_status === 'pending_review' && <span className="badge plain b-gold tiny">ATR awaiting review</span>}
                  {g.atr_status === 'returned' && <span className="badge plain b-neutral tiny">ATR returned</span>}
                </div>
              </td>
              <td className="small">{g.district}</td>
              {showDept && <td className="small">{g.department_name || <span className="muted">Not assigned</span>}</td>}
              <td><PriorityBadge priority={g.priority} /></td>
              <td><StatusBadge status={g.status} /></td>
              <td className="small muted" title={fmtDateTime(g.updated_at)}>{relTime(g.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- toast */
const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const show = useCallback((message, kind = 'ok') => {
    setToast({ message, kind, id: Date.now() });
    setTimeout(() => setToast((t) => (t && Date.now() - t.id >= 3900 ? null : t)), 4000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast && <div className={`toast ${toast.kind === 'error' ? 'error' : ''}`} role="status">{toast.message}</div>}
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
