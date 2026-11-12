import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageHero } from '../../components/Layouts';
import { TrackBox } from './Home';
import { Alert, Loading, PriorityBadge, StatusBadge, StatusStepper, Timeline } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDate } from '../../lib/format';

export default function Track() {
  const { ref } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!ref) { setData(null); setError(''); return; }
    setLoading(true); setError('');
    api.get(`/track/${encodeURIComponent(ref)}`).then(setData).catch((e) => { setData(null); setError(e.message); }).finally(() => setLoading(false));
  }, [ref]);

  const g = data?.grievance;
  return (
    <>
      <PageHero title="Track a grievance" subtitle="Check live status using your reference number. No login required." crumb="Track" />
      <section className="section-sm"><div className="container stack" style={{ maxWidth: 900 }}>
        <div className="card card-body"><TrackBox compact /></div>
        {loading && <Loading />}
        {error && <Alert kind="error">{error}</Alert>}
        {g && (
          <>
            <div className="card">
              <div className="card-head">
                <div><div className="mono small muted">{g.reference_no}</div><h3 style={{ marginTop: 2 }}>{g.subject}</h3></div>
                <StatusBadge status={g.status} />
              </div>
              <div className="card-body stack">
                <StatusStepper status={g.status} />
                <dl className="kv">
                  <dt>District</dt><dd>{g.district}</dd>
                  <dt>Category</dt><dd>{g.category}</dd>
                  <dt>Assigned department</dt><dd>{g.department_name || 'Awaiting assignment by CMO'}</dd>
                  <dt>Priority</dt><dd><PriorityBadge priority={g.priority} /></dd>
                  <dt>Submitted on</dt><dd>{fmtDate(g.created_at)}</dd>
                  <dt>{g.status === 'Resolved' ? 'Resolved on' : 'Target date'}</dt><dd>{fmtDate(g.status === 'Resolved' ? g.resolved_at : g.due_date)}</dd>
                </dl>
              </div>
            </div>
            <div className="card"><div className="card-head"><h3>Status history</h3></div><div className="card-body"><Timeline items={data.history} /></div></div>
            <p className="small muted">Are you the complainant? <Link to="/login">Log in</Link> to see officer remarks, give feedback or reopen.</p>
          </>
        )}
        {!ref && <p className="muted small">Your reference number was shown after submission and is also listed in your citizen dashboard.</p>}
      </div></section>
    </>
  );
}
