import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Icon from '../../components/Icon';
import { GrievanceTable, Loading, Pager } from '../../components/ui';
import { api, qs } from '../../lib/api';
import { useMeta } from '../../lib/meta';

const KEYS = ['q', 'status', 'district', 'category', 'priority', 'departmentId', 'overdue', 'escalated', 'atr', 'unassigned', 'sort', 'page'];
const TITLES = { atr: 'ATR review queue', overdue: 'Overdue grievances', unassigned: 'Unassigned grievances', escalated: 'Escalated grievances' };

export default function CmoGrievances() {
  const { districts, categories, statuses, priorities, departments } = useMeta();
  const [params, setParams] = useSearchParams();
  const f = Object.fromEntries(KEYS.map((k) => [k, params.get(k) || '']));
  const [data, setData] = useState(null);
  const [q, setQ] = useState(f.q);

  useEffect(() => {
    setData(null);
    api.get(`/grievances${qs({ ...f, page: f.page || 1, pageSize: 15, sort: f.sort || 'newest' })}`).then(setData).catch(() => setData({ items: [], total: 0, page: 1, pageSize: 15 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.toString()]);

  const update = (patch) => {
    const next = { ...f, ...patch, page: patch.page || '' };
    setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)));
  };
  const title = (f.atr && TITLES.atr) || (f.overdue && TITLES.overdue) || (f.unassigned && TITLES.unassigned) || (f.escalated && TITLES.escalated) || 'All grievances';
  const active = KEYS.filter((k) => !['sort', 'page'].includes(k) && f[k]).length;

  return (
    <>
      <div className="dash-title">
        <div><p className="muted" style={{ margin: 0 }}>CMO workspace</p><h1>{title}</h1></div>
        {active > 0 && <button className="btn btn-outline btn-sm" onClick={() => { setQ(''); setParams({}); }}><Icon name="x" size={14} />Clear filters ({active})</button>}
      </div>
      <div className="card">
        <form className="filters" onSubmit={(e) => { e.preventDefault(); update({ q }); }}>
          <div className="row" style={{ flexWrap: 'nowrap', gap: 6 }}>
            <input className="input" placeholder="Search reference or subject" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-primary" type="submit" aria-label="Search"><Icon name="search" size={16} /></button>
          </div>
          <select className="select" aria-label="Status" value={f.status} onChange={(e) => update({ status: e.target.value })}><option value="">All statuses</option>{statuses.map((s) => <option key={s}>{s}</option>)}</select>
          <select className="select" aria-label="District" value={f.district} onChange={(e) => update({ district: e.target.value })}><option value="">All districts</option>{districts.map((d) => <option key={d.code}>{d.name}</option>)}</select>
          <select className="select" aria-label="Category" value={f.category} onChange={(e) => update({ category: e.target.value })}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          <select className="select" aria-label="Priority" value={f.priority} onChange={(e) => update({ priority: e.target.value })}><option value="">All priorities</option>{priorities.map((p) => <option key={p}>{p}</option>)}</select>
          <select className="select" aria-label="Department" value={f.departmentId} onChange={(e) => update({ departmentId: e.target.value })}><option value="">All departments</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>
        </form>
        <div className="chips">
          <button className={`chip ${f.overdue ? 'on' : ''}`} onClick={() => update({ overdue: f.overdue ? '' : 'true' })}>Overdue</button>
          <button className={`chip ${f.escalated ? 'on' : ''}`} onClick={() => update({ escalated: f.escalated ? '' : 'true' })}>Escalated</button>
          <button className={`chip ${f.atr === 'pending_review' ? 'on' : ''}`} onClick={() => update({ atr: f.atr ? '' : 'pending_review' })}>ATR awaiting review</button>
          <button className={`chip ${f.unassigned ? 'on' : ''}`} onClick={() => update({ unassigned: f.unassigned ? '' : 'true' })}>Unassigned</button>
          <span style={{ marginLeft: 'auto' }} />
          <label className="small muted row" style={{ gap: 6 }}>Sort
            <select className="select" style={{ width: 'auto', padding: '5px 30px 5px 10px' }} value={f.sort || 'newest'} onChange={(e) => update({ sort: e.target.value })}>
              <option value="newest">Newest</option><option value="oldest">Oldest</option><option value="priority">Priority</option><option value="due">Due date</option><option value="updated">Recently updated</option>
            </select>
          </label>
        </div>
        {!data ? <Loading /> : (
          <>
            <GrievanceTable items={data.items} linkBase="/cmo/grievances" />
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => update({ page: String(p) })} />
          </>
        )}
      </div>
    </>
  );
}
