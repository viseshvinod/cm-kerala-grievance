import { useState } from 'react';
import Icon from '../../components/Icon';
import { PageHero } from '../../components/Layouts';
import { Alert, Button, Field } from '../../components/ui';
import { api, fieldErrors } from '../../lib/api';

const empty = { name: '', email: '', subject: '', message: '' };

export default function Contact() {
  const [form, setForm] = useState(empty);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true); setErrors({}); setStatus(null);
    try {
      await api.post('/contact', form);
      setForm(empty);
      setStatus({ kind: 'success', msg: 'Thank you. Your enquiry has been recorded and our helpdesk will respond by email.' });
    } catch (err) {
      setErrors(fieldErrors(err));
      setStatus({ kind: 'error', msg: err.message });
    } finally { setLoading(false); }
  };

  return (
    <>
      <PageHero title="Contact us" subtitle="Questions about the portal? Send us a message. To raise a grievance, please use Submit Grievance instead." />
      <section className="section-sm"><div className="container grid" style={{ gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)' }}>
        <form className="card card-body stack" onSubmit={submit} noValidate>
          <h3>Send an enquiry</h3>
          {status && <Alert kind={status.kind}>{status.msg}</Alert>}
          <div className="form-grid">
            <Field label="Full name" error={errors.name} htmlFor="c-name"><input id="c-name" className="input" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} required /></Field>
            <Field label="Email" error={errors.email} htmlFor="c-email"><input id="c-email" type="email" className="input" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} required /></Field>
            <Field label="Subject" error={errors.subject} className="full" htmlFor="c-sub"><input id="c-sub" className="input" value={form.subject} onChange={set('subject')} aria-invalid={!!errors.subject} required /></Field>
            <Field label="Message" error={errors.message} className="full" htmlFor="c-msg"><textarea id="c-msg" className="textarea" value={form.message} onChange={set('message')} aria-invalid={!!errors.message} required /></Field>
          </div>
          <div><Button loading={loading} type="submit"><Icon name="send" size={16} />Send message</Button></div>
        </form>
        <aside className="stack">
          <div className="card card-body"><h3>Helpdesk (demo)</h3>
            <p className="row small" style={{ gap: 8 }}><Icon name="phone" size={16} />1800-000-0000 (toll free)</p>
            <p className="row small" style={{ gap: 8 }}><Icon name="mail" size={16} />helpdesk@cmkportal.test</p>
            <p className="row small" style={{ gap: 8, margin: 0 }}><Icon name="clock" size={16} />Mon–Sat, 10:00 AM – 5:00 PM</p></div>
          <div className="card card-body"><h3>Address (fictional)</h3><p className="muted small" style={{ margin: 0 }}>Public Grievance Cell<br />Prototype Secretariat Building<br />Thiruvananthapuram, Kerala 695000</p></div>
        </aside>
      </div></section>
      <style>{'@media (max-width: 800px){ .section-sm .container.grid{ grid-template-columns: 1fr !important; } }'}</style>
    </>
  );
}
