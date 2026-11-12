import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import Icon from '../../components/Icon';
import { GrievanceTable, Loading } from '../../components/ui';
import { api } from '../../lib/api';

const STATUS_COLORS = { Submitted: '#2563eb', 'Under Review': '#d97706', 'In Progress': '#7c3aed', Resolved: '#15803d', Reopened: '#dc2626' };
const C = { resolved: '#157a65', pending: '#e9b949', overdue: '#dc2626', submitted: '#0b4f42' };
const axis = { fontSize: 12, fill: '#5f6d69' };

function Kpi({ label, value, icon, tone = '', sub, to }) {
  const body = (
    <div className={`card kpi ${tone}`}>
      <div className="label"><Icon name={icon} size={16} />{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
  return to ? <Link to={to} className="kpi-link">{body}</Link> : body;
}

export default function CmoDashboard() {
  const [s, setS] = useState(null);
  const [recent, setRecent] = useState(null);
  const [view, setView] = useState('chart');

  useEffect(() => {
    api.get('/admin/stats').then(setS);
    api.get('/grievances?sort=priority&status=Submitted&pageSize=6').then((d) => setRecent(d.items));
  }, []);

  if (!s) return <Loading />;
  const k = s.kpi;
  const rate = k.total ? Math.round((k.resolved / k.total) * 100) : 0;
  const deptData = s.byDepartment.filter((d) => d.total > 0).map((d) => ({ ...d, short: d.code })).sort((a, b) => b.total - a.total);

  return (
    <>
      <div className="dash-title">
        <div><p className="muted" style={{ margin: 0 }}>Chief Minister&apos;s Office</p><h1>Grievance overview</h1></div>
        <Link to="/cmo/grievances" className="btn btn-primary"><Icon name="list" size={16} />All grievances</Link>
      </div>

      <div className="grid grid-4">
        <Kpi label="Total grievances" value={k.total} icon="inbox" sub={`${k.last_7_days} in the last 7 days`} to="/cmo/grievances" />
        <Kpi label="Pending" value={k.pending} icon="clock" tone="accent-amber" sub={`${k.new_submissions} new · ${k.unassigned} unassigned`} to="/cmo/grievances?status=Submitted" />
        <Kpi label="Resolved" value={k.resolved} icon="checkCircle" tone="accent-green" sub={`${rate}% resolution · avg ${k.avg_resolution_days} days`} to="/cmo/grievances?status=Resolved" />
        <Kpi label="Overdue" value={k.overdue} icon="alert" tone="accent-red" sub={`${k.escalated} escalated`} to="/cmo/grievances?overdue=true" />
      </div>

      <div className="grid grid-3" style={{ marginTop: 20 }}>
        <Kpi label="ATRs awaiting your review" value={k.atr_pending} icon="file" to="/cmo/grievances?atr=pending_review" />
        <Kpi label="Citizen satisfaction" value={`${s.feedback.avg_rating || '—'} / 5`} icon="star" sub={`${s.feedback.responses} feedback responses`} />
        <Kpi label="AI assistant" value={`${s.ai.category_agreement_pct ?? '—'}%`} icon="sparkles"
          sub={`category agreement · ${s.ai.live_model} live / ${s.ai.fallback} fallback analyses`} />
      </div>

      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <section className="card">
          <div className="card-head"><h3>Monthly trend</h3><span className="muted small">Last 6 months</span></div>
          <div className="card-body chart-box">
            <ResponsiveContainer>
              <LineChart data={s.trend} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#ecf0ef" vertical={false} />
                <XAxis dataKey="month" tick={axis} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="submitted" name="Submitted" stroke={C.submitted} strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="resolved" name="Resolved" stroke={C.pending} strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h3>By status</h3></div>
          <div className="card-body chart-box">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={s.byStatus} dataKey="count" nameKey="status" innerRadius={62} outerRadius={100} paddingAngle={2} stroke="#fff" strokeWidth={2}>
                  {s.byStatus.map((e) => <Cell key={e.status} fill={STATUS_COLORS[e.status]} />)}
                </Pie>
                <Tooltip />
                <Legend iconType="circle" layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-head">
          <h3>District-wise grievances</h3>
          <div className="tab-row" style={{ margin: 0, border: 0 }}>
            <button className={view === 'chart' ? 'on' : ''} onClick={() => setView('chart')}>Chart</button>
            <button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button>
          </div>
        </div>
        {view === 'chart' ? (
          <div className="card-body" style={{ height: 330 }}>
            <ResponsiveContainer>
              <BarChart data={s.byDistrict} margin={{ top: 8, right: 8, left: -16, bottom: 40 }}>
                <CartesianGrid stroke="#ecf0ef" vertical={false} />
                <XAxis dataKey="district" tick={{ ...axis, fontSize: 11 }} angle={-35} textAnchor="end" interval={0} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f5f7f6' }} />
                <Legend iconType="circle" verticalAlign="top" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
                <Bar dataKey="resolved" name="Resolved" stackId="a" fill={C.resolved} />
                <Bar dataKey="pending" name="Pending" stackId="a" fill={C.pending} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>District</th><th className="num">Total</th><th className="num">Pending</th><th className="num">Resolved</th><th className="num">Overdue</th></tr></thead>
            <tbody>{s.byDistrict.map((d) => (
              <tr key={d.district}><td><Link to={`/cmo/grievances?district=${encodeURIComponent(d.district)}`}>{d.district}</Link></td><td className="num">{d.total}</td><td className="num">{d.pending}</td><td className="num">{d.resolved}</td><td className="num" style={{ color: d.overdue ? 'var(--red)' : undefined }}>{d.overdue}</td></tr>
            ))}</tbody>
          </table></div>
        )}
      </section>

      <div className="grid grid-2" style={{ marginTop: 20 }}>
        <section className="card">
          <div className="card-head"><h3>Department performance</h3><span className="muted small">Resolved vs pending</span></div>
          <div className="card-body" style={{ height: 360 }}>
            <ResponsiveContainer>
              <BarChart data={deptData} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
                <CartesianGrid stroke="#ecf0ef" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={axis} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="short" width={44} interval={0} tick={axis} axisLine={false} tickLine={false} />
                <Tooltip labelFormatter={(l) => deptData.find((d) => d.short === l)?.name || l} cursor={{ fill: '#f5f7f6' }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="resolved" name="Resolved" stackId="a" fill={C.resolved} />
                <Bar dataKey="pending" name="Pending" stackId="a" fill={C.pending} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h3>Department response monitor</h3></div>
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Department</th><th className="num">Open</th><th className="num">Overdue</th><th className="num">ATR due</th><th className="num">Avg days</th></tr></thead>
            <tbody>{s.byDepartment.map((d) => (
              <tr key={d.id}>
                <td className="small"><Link to={`/cmo/grievances?departmentId=${d.id}`}>{d.name}</Link></td>
                <td className="num">{d.pending}</td>
                <td className="num" style={{ color: d.overdue ? 'var(--red)' : undefined, fontWeight: d.overdue ? 700 : 400 }}>{d.overdue}</td>
                <td className="num">{d.atr_pending ? <Link to={`/cmo/grievances?atr=pending_review&departmentId=${d.id}`}>{d.atr_pending}</Link> : 0}</td>
                <td className="num">{d.avg_days || '—'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 20 }}>
        <div className="card-head"><h3>New submissions awaiting review</h3><Link to="/cmo/grievances?status=Submitted" className="small">View all</Link></div>
        {recent ? <GrievanceTable items={recent} linkBase="/cmo/grievances" showDept={false} empty="No new submissions. All caught up." /> : <Loading />}
      </section>
    </>
  );
}
