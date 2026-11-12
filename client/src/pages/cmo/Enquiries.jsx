import { useEffect, useState } from 'react';
import { Loading, useToast } from '../../components/ui';
import { api } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';

export default function Enquiries() {
  const [items, setItems] = useState(null);
  const toast = useToast();
  const load = () => api.get('/admin/enquiries').then((d) => setItems(d.enquiries));
  useEffect(() => { load(); }, []);
  const setStatus = async (id, status) => { await api.patch(`/admin/enquiries/${id}`, { status }); toast('Enquiry updated'); load(); };

  return (
    <>
      <div className="dash-title"><div><p className="muted" style={{ margin: 0 }}>Public website</p><h1>Contact enquiries</h1></div></div>
      <div className="card">
        {!items ? <Loading /> : items.length === 0 ? <div className="empty">No enquiries yet.</div> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Received</th><th>From</th><th>Subject & message</th><th>Status</th></tr></thead>
            <tbody>{items.map((e) => (
              <tr key={e.id}>
                <td className="small" style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(e.created_at)}</td>
                <td className="small"><strong>{e.name}</strong><div className="muted">{e.email}</div></td>
                <td className="small" style={{ maxWidth: 480 }}><strong>{e.subject}</strong><div className="muted">{e.message}</div></td>
                <td><select className="select" style={{ width: 'auto', padding: '5px 30px 5px 10px' }} value={e.status} onChange={(ev) => setStatus(e.id, ev.target.value)} aria-label="Status">
                  <option value="new">New</option><option value="read">Read</option><option value="closed">Closed</option>
                </select></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
    </>
  );
}
