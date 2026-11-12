import { useEffect, useState } from 'react';
import Icon from '../../components/Icon';
import { GrievanceTable, Loading, Pager } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { useAuth } from '../../lib/auth';

const TABS = [
  ['New assignments', { status: 'Under Review' }],
  ['In progress', { status: 'In Progress' }],
  ['ATR returned', { atr: 'returned' }],
  ['Awaiting CMO', { atr: 'pending_review' }],
  ['Overdue', { overdue: 'true' }],
  ['Resolved', { status: 'Resolved' }],
  ['All', {}],
];

export default function OfficerDashboard() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [tab, setTab] = useState(0);
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);

  useEffect(() => { api.get('/grievances/summary').then(setS); }, []);
  useEffect(() => { setList(null); api.get(`/grievances${qs({ ...TABS[tab][1], page, pageSize: 12, sort: 'due' })}`).then(setList); }, [tab, page]);

  return (
    <>
      <div className="dash-title"><div><p className="muted" style={{ margin: 0 }}>{user.departmentName}</p><h1>Assigned grievances</h1></div></div>
      {!s ? <Loading /> : (
        <div className="grid grid-4" style={{ marginBottom: 20 }}>
          <div className="card kpi"><div className="label"><Icon name="inbox" size={16} />New assignments</div><div className="value">{s.new_assignments}</div><div className="sub">Forwarded by CMO, not started</div></div>
          <div className="card kpi accent-amber"><div className="label"><Icon name="search" size={16} />In progress</div><div className="value">{s.in_progress}</div><div className="sub">{s.atr_returned} ATR returned for rework</div></div>
          <div className="card kpi"><div className="label"><Icon name="file" size={16} />Awaiting CMO review</div><div className="value">{s.atr_pending}</div></div>
          <div className="card kpi accent-red"><div className="label"><Icon name="alert" size={16} />Overdue</div><div className="value">{s.overdue}</div><div className="sub">{s.resolved} resolved to date</div></div>
        </div>
      )}
      <div className="card">
        <div className="chips">
          {TABS.map(([label], i) => <button key={label} className={`chip ${tab === i ? 'on' : ''}`} onClick={() => { setTab(i); setPage(1); }}>{label}</button>)}
        </div>
        {!list ? <Loading /> : (
          <>
            <GrievanceTable items={list.items} linkBase="/officer/grievances" showDept={false} empty="Nothing here right now." />
            {list.total > 0 && <Pager page={list.page} pageSize={list.pageSize} total={list.total} onPage={setPage} />}
          </>
        )}
      </div>
    </>
  );
}
