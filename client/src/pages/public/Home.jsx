import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { api } from '../../lib/api';
import { useMeta } from '../../lib/meta';

export function TrackBox({ compact }) {
  const [ref, setRef] = useState('');
  const navigate = useNavigate();
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (ref.trim()) navigate(`/track/${ref.trim().toUpperCase()}`); }}>
      {!compact && <h3 style={{ marginBottom: 4 }}>Track your grievance</h3>}
      {!compact && <p className="muted small">Enter the reference number you received after submission.</p>}
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <label htmlFor="trackref" className="sr-only">Reference number</label>
        <input id="trackref" className="input mono" placeholder="CMK-26-TVM-7K3F9Q" value={ref} onChange={(e) => setRef(e.target.value)} />
        <button className="btn btn-primary" type="submit"><Icon name="search" size={16} />Track</button>
      </div>
    </form>
  );
}

export default function Home() {
  const [stats, setStats] = useState(null);
  const { departments } = useMeta();
  useEffect(() => { api.get('/stats/public').then(setStats).catch(() => {}); }, []);
  const featured = departments.filter((d) => d.is_featured).slice(0, 6);
  const rate = stats?.total ? Math.round((stats.resolved / stats.total) * 100) : 0;

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <div className="eyebrow" style={{ color: 'var(--gold-500)' }}>Chief Minister&apos;s Public Grievance Redressal</div>
            <h1>Your voice, heard directly by the Chief Minister&apos;s Office.</h1>
            <p className="lead">Raise a grievance about roads, water, electricity, healthcare, education or any public service. The CMO reviews it, routes it to the right department and keeps you updated until it is resolved.</p>
            <div className="hero-actions">
              <Link to="/citizen/submit" className="btn btn-gold btn-lg"><Icon name="plus" />Submit a grievance</Link>
              <Link to="/track" className="btn btn-ghost-light btn-lg"><Icon name="search" />Track status</Link>
            </div>
            <div className="hero-badges">
              <span><Icon name="shield" size={16} />Secure & confidential</span>
              <span><Icon name="sparkles" size={16} />AI-assisted routing</span>
              <span><Icon name="clock" size={16} />Time-bound action</span>
            </div>
          </div>
          <div className="hero-card"><TrackBox /></div>
        </div>
      </section>

      <div className="container stat-strip">
        <div className="card grid grid-4" style={{ gap: 0 }}>
          {[
            [stats?.total ?? '—', 'Grievances received'],
            [stats?.resolved ?? '—', `Resolved (${rate}%)`],
            [stats ? `${stats.avg_resolution_days} days` : '—', 'Average resolution time'],
            [stats?.departments ?? '—', 'Departments connected'],
          ].map(([v, l]) => (
            <div className="stat" key={l}><div className="value">{v}</div><div className="label">{l}</div></div>
          ))}
        </div>
        <p className="tiny muted" style={{ marginTop: 8 }}>Live figures from the prototype database (fictional sample data).</p>
      </div>

      <section className="section">
        <div className="container">
          <div className="eyebrow">How it works</div>
          <h2>From complaint to resolution in five transparent steps</h2>
          <div className="grid grid-4" style={{ marginTop: 24 }}>
            {[
              ['send', 'Submit', 'Describe the issue, pick your district and attach a photo or document.'],
              ['sparkles', 'AI triage', 'Our assistant suggests the category, department and urgency for officials.'],
              ['building', 'CMO routes', "The Chief Minister's Office reviews and forwards it to the right department."],
              ['checkCircle', 'Action & closure', 'The department acts, reports back, and the CMO verifies before closing.'],
            ].map(([icon, title, body]) => (
              <div className="card feature" key={title}><div className="ico"><Icon name={icon} size={22} /></div><h3>{title}</h3><p className="muted small" style={{ margin: 0 }}>{body}</p></div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}><Link to="/how-it-works" className="btn btn-outline">See the full process <Icon name="arrowRight" size={16} /></Link></div>
        </div>
      </section>

      <section className="section" style={{ background: '#fff', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div><div className="eyebrow">Featured departments</div><h2 style={{ margin: 0 }}>Connected to the departments that matter</h2></div>
            <Link to="/departments" className="btn btn-outline">All departments <Icon name="arrowRight" size={16} /></Link>
          </div>
          <div className="grid grid-3" style={{ marginTop: 24 }}>
            {featured.map((d) => (
              <div className="card dept-card" key={d.id}>
                <div className="feature" style={{ padding: 0 }}><div className="ico"><Icon name={d.icon} size={22} /></div></div>
                <h3 style={{ margin: 0 }}>{d.name}</h3>
                <p className="muted small" style={{ margin: 0 }}>{d.description}</p>
                <div className="meta"><span className="badge plain b-brand">Target: {d.sla_days} days</span></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container grid grid-2" style={{ alignItems: 'center' }}>
          <div>
            <div className="eyebrow">Built on accountability</div>
            <h2>Every step is recorded. Every grievance is traceable.</h2>
            <p className="muted">Each status change is logged with who acted and when. Departments must submit an action-taken report, and the CMO verifies it before a grievance is closed. If you are not satisfied, you can reopen it.</p>
            <ul className="muted" style={{ paddingLeft: 18 }}>
              <li>Unique reference number for every grievance</li>
              <li>Service-level targets with overdue alerts and escalation</li>
              <li>Feedback after resolution, reviewed by the CMO</li>
            </ul>
          </div>
          <div className="card card-body" style={{ background: 'var(--brand-800)', color: '#fff', border: 0 }}>
            <h3 style={{ color: '#fff' }}>Ready to raise an issue?</h3>
            <p style={{ opacity: .85 }}>Create a free account with your mobile number and email, then submit your grievance in under three minutes.</p>
            <div className="row"><Link to="/register" className="btn btn-gold">Create account</Link><Link to="/login" className="btn btn-ghost-light">I already have one</Link></div>
          </div>
        </div>
      </section>
    </>
  );
}
