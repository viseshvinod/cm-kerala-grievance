import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Icon from '../../components/Icon';
import { Alert, Button, Field } from '../../components/ui';
import { fieldErrors } from '../../lib/api';
import { homeFor, useAuth } from '../../lib/auth';

const DEMO = [
  ['Citizen', 'citizen@cmkportal.test', 'Citizen@123'],
  ['CMO Administrator', 'admin@cmkportal.test', 'Admin@123'],
  ['Officer · Water Resources', 'wrd.officer@cmkportal.test', 'Officer@123'],
  ['Officer · Public Works', 'pwd.officer@cmkportal.test', 'Officer@123'],
];

export function Login() {
  const { login, user } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  if (user) return <Navigate to={from || homeFor(user.role)} replace />;

  const doLogin = async (email, password) => {
    setLoading(true); setError('');
    try {
      const u = await login(email, password);
      navigate(from && from.startsWith(homeFor(u.role)) ? from : homeFor(u.role), { replace: true });
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card stack">
        <form className="card card-body stack" onSubmit={(e) => { e.preventDefault(); doLogin(form.email, form.password); }}>
          <div><h2 style={{ marginBottom: 4 }}>Log in</h2><p className="muted small" style={{ margin: 0 }}>Citizens, CMO administrators and department officers sign in here.</p></div>
          {error && <Alert kind="error">{error}</Alert>}
          <Field label="Email" htmlFor="l-email"><input id="l-email" type="email" autoComplete="username" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></Field>
          <Field label="Password" htmlFor="l-pw"><input id="l-pw" type="password" autoComplete="current-password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></Field>
          <Button loading={loading} type="submit" className="btn-primary btn-block">Log in</Button>
          <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>New citizen? <Link to="/register" state={{ from }}>Create an account</Link></p>
        </form>
        <div className="card card-body demo-creds stack">
          <div className="row" style={{ gap: 8 }}><Icon name="lock" size={16} /><strong>Demo accounts (test data only)</strong></div>
          {DEMO.map(([label, email, pw]) => (
            <button key={email} type="button" onClick={() => doLogin(email, pw)} disabled={loading}>
              <span><strong>{label}</strong><br /><span className="muted mono tiny">{email}</span></span>
              <span className="muted mono tiny">{pw}</span>
            </button>
          ))}
          <p className="tiny muted" style={{ margin: 0 }}>Every department has an officer: <span className="mono">&lt;code&gt;.officer@cmkportal.test</span> (e.g. hfw, pwr, lsg), password <span className="mono">Officer@123</span>.</p>
        </div>
      </div>
    </div>
  );
}

export function Register() {
  const { register, user } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (user) return <Navigate to={homeFor(user.role)} replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (form.password !== form.confirm) { setErrors({ confirm: 'Passwords do not match' }); return; }
    setLoading(true); setErrors({}); setError('');
    try {
      await register({ name: form.name, email: form.email, mobile: form.mobile, password: form.password });
      navigate(location.state?.from || '/citizen', { replace: true });
    } catch (err) { setErrors(fieldErrors(err)); setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="auth-wrap">
      <form className="card card-body stack auth-card" style={{ maxWidth: 520 }} onSubmit={submit} noValidate>
        <div><h2 style={{ marginBottom: 4 }}>Create a citizen account</h2><p className="muted small" style={{ margin: 0 }}>Use fictional details — this is a prototype.</p></div>
        {error && !Object.keys(errors).length && <Alert kind="error">{error}</Alert>}
        <Field label="Full name" error={errors.name} htmlFor="r-name"><input id="r-name" className="input" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={!!errors.name} /></Field>
        <div className="form-grid">
          <Field label="Email" error={errors.email} htmlFor="r-email"><input id="r-email" type="email" autoComplete="email" className="input" value={form.email} onChange={set('email')} aria-invalid={!!errors.email} /></Field>
          <Field label="Mobile number" error={errors.mobile} hint="10-digit Indian mobile" htmlFor="r-mob"><input id="r-mob" inputMode="tel" autoComplete="tel" className="input" value={form.mobile} onChange={set('mobile')} aria-invalid={!!errors.mobile} /></Field>
          <Field label="Password" error={errors.password} hint="Min 8 characters, letters and numbers" htmlFor="r-pw"><input id="r-pw" type="password" autoComplete="new-password" className="input" value={form.password} onChange={set('password')} aria-invalid={!!errors.password} /></Field>
          <Field label="Confirm password" error={errors.confirm} htmlFor="r-pw2"><input id="r-pw2" type="password" autoComplete="new-password" className="input" value={form.confirm} onChange={set('confirm')} aria-invalid={!!errors.confirm} /></Field>
        </div>
        <Button loading={loading} type="submit" className="btn-primary btn-block">Create account</Button>
        <p className="small muted" style={{ margin: 0, textAlign: 'center' }}>Already registered? <Link to="/login">Log in</Link></p>
      </form>
    </div>
  );
}

export function NotFound() {
  return (
    <div className="auth-wrap"><div className="empty"><h2>Page not found</h2><p>The page you are looking for does not exist.</p><Link className="btn btn-primary" to="/">Go home</Link></div></div>
  );
}
