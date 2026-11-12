import { Link } from 'react-router-dom';
import Icon from './Icon';
import { PriorityBadge } from './ui';

/** Normalises an ai_analyses DB row or an /ai/analyze response into one shape. */
export function normaliseAnalysis(a, departments = []) {
  if (!a) return null;
  if (a.result) {
    const dept = departments.find((d) => d.code === a.result.department_code);
    return {
      provider: a.provider, model: a.model, isFallback: a.is_fallback, latencyMs: a.latency_ms,
      category: a.result.category, priority: a.result.priority, summary: a.result.summary,
      rationale: a.result.rationale, keywords: a.result.keywords || [], confidence: a.result.confidence,
      department: dept ? { id: dept.id, code: dept.code, name: dept.name } : { code: a.result.department_code, name: a.result.department_code },
      duplicates: a.duplicates || [],
    };
  }
  return a;
}

const providerLabel = (a) => {
  if (a.provider === 'sample-data') return 'Sample data (seeded)';
  if (a.isFallback) return 'Fallback heuristic — AI unavailable';
  return `${a.provider[0].toUpperCase()}${a.provider.slice(1)} · ${a.model}`;
};

export default function AiPanel({ analysis, title = 'AI Grievance Assistant', actions, duplicateLinkBase, audience = 'citizen' }) {
  if (!analysis) return null;
  const pct = Math.round((analysis.confidence || 0) * 100);
  return (
    <section className="card ai-panel" aria-live="polite">
      <div className="card-head">
        <div className="row"><span className="ai-tag"><Icon name="sparkles" size={14} />AI suggestion</span><h3>{title}</h3></div>
        <span className={`badge plain ${analysis.isFallback ? 'b-gold' : 'b-neutral'} tiny`} title={analysis.latencyMs ? `${analysis.latencyMs} ms` : undefined}>
          {providerLabel(analysis)}
        </span>
      </div>
      <div className="card-body stack">
        {analysis.isFallback && analysis.provider !== 'sample-data' && (
          <div className="alert alert-warn small"><Icon name="alert" size={16} /><div>The AI model could not be reached, so these are <strong>keyword-based fallback</strong> suggestions. Please check them carefully.</div></div>
        )}
        <div className="ai-grid">
          <div className="ai-cell"><div className="k">Category</div><div className="v">{analysis.category}</div></div>
          <div className="ai-cell"><div className="k">Department</div><div className="v">{analysis.department?.name || '—'}</div></div>
          <div className="ai-cell"><div className="k">Priority</div><div className="v"><PriorityBadge priority={analysis.priority} /></div></div>
        </div>
        <div>
          <div className="small muted" style={{ fontWeight: 600 }}>{audience === 'citizen' ? 'Summary the CMO will see' : 'Summary for the CMO'}</div>
          <p style={{ margin: '4px 0 0' }}>{analysis.summary}</p>
        </div>
        {analysis.rationale && <p className="small muted" style={{ margin: 0 }}><strong>Why:</strong> {analysis.rationale}</p>}
        <div>
          <div className="row between small muted"><span>Model confidence</span><span>{pct}%</span></div>
          <div className="confidence"><span style={{ width: `${pct}%` }} /></div>
        </div>
        {analysis.duplicates?.length > 0 && (
          <div className="stack" style={{ marginTop: 8 }}>
            <div className="small" style={{ fontWeight: 650, color: 'var(--red)' }}><Icon name="copy" size={14} /> Possible duplicates — for human review</div>
            {analysis.duplicates.map((d) => (
              <div key={d.id} className="dup-item">
                <span>
                  {duplicateLinkBase ? <Link to={`${duplicateLinkBase}/${d.id}`} className="mono">{d.reference_no}</Link> : <span className="mono">{d.reference_no}</span>}
                  {' '}· {d.subject || 'Similar complaint'} {d.district && <span className="muted">({d.district})</span>}
                </span>
                <span className="muted">{Math.round(d.score * 100)}% similar</span>
              </div>
            ))}
            {audience === 'citizen' && <p className="tiny muted" style={{ margin: 0 }}>Similar complaints already exist. You can still submit — the CMO will review and may link them.</p>}
          </div>
        )}
        {actions}
        <p className="tiny muted" style={{ margin: 0 }}><Icon name="lock" size={12} /> AI only suggests. {audience === 'citizen' ? 'You choose the category; the CMO decides priority and department.' : 'Final decisions are made by CMO staff.'}</p>
      </div>
    </section>
  );
}
