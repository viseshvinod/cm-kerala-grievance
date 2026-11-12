import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { GrievanceTable, Loading, Pager } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { useAuth } from '../../lib/auth';

export default function CitizenDashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [list, setList] = useState(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => { api.get('/grievances/summary').then(setSummary); }, []);
  useEffect(() => { api.get(`/grievances${qs({ status, page, pageSize: 10, sort: 'updated' })}`).then(setList); }, [status, page]);

  const cards = summary ? [
    ['Total submitted', summary.total, 'inbox', ''],
    ['Pending', summary.pending, 'clock', 'accent-amber'],
    ['Resolved', summary.resolved, 'checkCircle', 'accent-green'],
    ['Reopened', summary.reopened, 'refresh', 'accent-red'],
  ] : [];

  return (
    <>
      <div className="dash-title">
        <div><p className="muted" style={{ margin: 0 }}>Namaskaram,</p><h1>{user.name}</h1></div>
        <Link to="/citizen/submit" className="btn btn-primary"><Icon name="plus" size={16} />New grievance</Link>
      </div>
      {!summary ? <Loading /> : (
        <div className="grid grid-4" style={{ marginBottom: 20 }}>
          {cards.map(([l, v, i, c]) => (
            <div className={`card kpi ${c}`} key={l}><div className="label"><Icon name={i} size={16} />{l}</div><div className="value">{v}</div></div>
          ))}
        </div>
      )}
      <div className="card">
        <div className="card-head"><h3>My grievances</h3></div>
        <div className="chips">
          {['', 'Submitted', 'Under Review', 'In Progress', 'Resolved', 'Reopened'].map((s) => (
            <button key={s || 'all'} className={`chip ${status === s ? 'on' : ''}`} onClick={() => { setStatus(s); setPage(1); }}>{s || 'All'}</button>
          ))}
        </div>
        {!list ? <Loading /> : (
          <>
            <GrievanceTable items={list.items} linkBase="/citizen/grievances" empty="You have not submitted any grievances yet." />
            {list.total > 0 && <Pager page={list.page} pageSize={list.pageSize} total={list.total} onPage={setPage} />}
          </>
        )}
      </div>
    </>
  );
}
