import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import Icon from './Icon';
import { homeFor, useAuth } from '../lib/auth';
import { ROLE_LABELS } from '../lib/format';
import { DEMO } from '../lib/api';

export function ProtoBanner() {
  return (
    <div className="proto-banner">
      <strong>Recruitment prototype</strong> — not an official website and not affiliated with or endorsed by the Government of Kerala or the Chief Minister&apos;s Office. All data is fictional.
      {DEMO && <> <strong>Demo preview:</strong> runs entirely in your browser with an in-memory copy of the API — nothing is sent anywhere and data resets on reload.</>}
    </div>
  );
}

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="rgba(255,255,255,.1)" stroke="rgba(255,255,255,.25)" />
      <path d="M11 26c0-5.6 4-10 9-10s9 4.4 9 10" fill="none" stroke="#e9b949" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="20" cy="11" r="3" fill="#e9b949" />
      <path d="M9 30h22" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

function Header() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { setOpen(false); }, [location.pathname]);

  return (
    <header className="site-header">
      <div className="container">
        <Link to="/" className="brand" aria-label="CM Grievance Portal home">
          <BrandMark />
          <span className="brand-text"><strong>CM Grievance Portal</strong><span>Kerala · Public Grievance Redressal</span></span>
        </Link>
        <button className="menu-btn" aria-label="Toggle menu" aria-expanded={open} onClick={() => setOpen(!open)}><Icon name={open ? 'x' : 'menu'} size={24} /></button>
        <nav className={`nav ${open ? 'open' : ''}`} aria-label="Main">
          <NavLink to="/" end>Home</NavLink>
          <NavLink to="/about">About</NavLink>
          <NavLink to="/how-it-works">How it works</NavLink>
          <NavLink to="/departments">Departments</NavLink>
          <NavLink to="/track">Track</NavLink>
          <NavLink to="/faq">FAQ</NavLink>
          <NavLink to="/contact">Contact</NavLink>
          {user ? (
            <>
              <Link className="btn btn-gold btn-sm" to={homeFor(user.role)}><Icon name="grid" size={16} />Dashboard</Link>
              <button className="btn btn-ghost-light btn-sm" onClick={async () => { await logout(); navigate('/'); }}>Log out</button>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost-light btn-sm" to="/login">Log in</Link>
              <Link className="btn btn-gold btn-sm" to="/citizen/submit"><Icon name="plus" size={16} />Submit grievance</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div>
            <div className="row" style={{ marginBottom: 12 }}><BrandMark /><strong style={{ color: '#fff', fontFamily: 'var(--serif)', fontSize: '1.1rem' }}>CM Grievance Portal</strong></div>
            <p>A single window for citizens to raise public grievances with the Chief Minister&apos;s Office, track them transparently and receive updates until resolution.</p>
            <p className="tiny" style={{ opacity: .7 }}>Built as a recruitment machine-test prototype for WhiteMatrix Software Solutions. Not affiliated with any government body.</p>
          </div>
          <div><h4>Citizens</h4><Link to="/citizen/submit">Submit grievance</Link><Link to="/track">Track grievance</Link><Link to="/register">Create account</Link><Link to="/login">Log in</Link></div>
          <div><h4>Information</h4><Link to="/about">About the initiative</Link><Link to="/how-it-works">How it works</Link><Link to="/departments">Departments</Link><Link to="/faq">FAQ</Link></div>
          <div><h4>Help</h4><Link to="/contact">Contact us</Link><span className="small" style={{ display: 'block', marginTop: 6 }}>Helpdesk (demo): 1800-000-0000</span><span className="small">Mon–Sat, 10 AM – 5 PM</span></div>
        </div>
        <div className="footer-bottom"><span>© {new Date().getFullYear()} Recruitment prototype · Fictional data only</span><span>Accessible · Mobile-friendly · AI-assisted triage</span></div>
      </div>
    </footer>
  );
}

export function PublicLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <>
      <ProtoBanner />
      <Header />
      <main id="main"><Outlet /></main>
      <Footer />
    </>
  );
}

export function PageHero({ title, subtitle, crumb }) {
  return (
    <section className="page-hero">
      <div className="container">
        <div className="crumbs"><Link to="/">Home</Link> / {crumb || title}</div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </section>
  );
}

const NAV = {
  citizen: [
    { to: '/citizen', label: 'My dashboard', icon: 'grid', end: true },
    { to: '/citizen/submit', label: 'Submit grievance', icon: 'plus' },
    { to: '/track', label: 'Track by reference', icon: 'search' },
  ],
  cmo_admin: [
    { to: '/cmo', label: 'Overview', icon: 'grid', end: true },
    { to: '/cmo/grievances', label: 'All grievances', icon: 'list', end: true },
    { to: '/cmo/grievances?atr=pending_review', label: 'ATR review queue', icon: 'checkCircle', key: 'atr' },
    { to: '/cmo/grievances?overdue=true', label: 'Overdue', icon: 'clock', key: 'overdue' },
    { to: '/cmo/grievances?unassigned=true', label: 'Unassigned', icon: 'inbox', key: 'unassigned' },
    { to: '/cmo/enquiries', label: 'Contact enquiries', icon: 'mail' },
  ],
  dept_officer: [
    { to: '/officer', label: 'Assigned grievances', icon: 'inbox', end: true },
  ],
};

export function DashboardLayout({ role }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => { window.scrollTo(0, 0); }, [location.pathname]);
  const current = location.pathname + location.search;

  return (
    <>
      <ProtoBanner />
      <Header />
      <div className="dash">
        <aside className="sidebar" aria-label="Dashboard navigation">
          <div className="who">
            <strong>{user?.name}</strong>
            <span className="muted small">{user?.designation || ROLE_LABELS[user?.role]}</span>
            {user?.departmentName && <div className="tiny muted" style={{ marginTop: 4 }}>{user.departmentName}</div>}
          </div>
          <div className="side-label">Navigation</div>
          {NAV[role].map((n) => {
            const active = n.to.includes('?') ? current === n.to : (n.end ? location.pathname === n.to && !location.search : location.pathname.startsWith(n.to));
            return (
              <Link key={n.to} to={n.to} className={`side-link ${active ? 'active' : ''}`}>
                <Icon name={n.icon} size={17} />{n.label}
              </Link>
            );
          })}
          <div className="side-label">Account</div>
          <Link to="/" className="side-link"><Icon name="home" size={17} />Public website</Link>
          <button className="side-link" style={{ background: 'none', border: 0, width: '100%', cursor: 'pointer', font: 'inherit' }}
            onClick={async () => { await logout(); navigate('/login'); }}>
            <Icon name="logout" size={17} />Log out
          </button>
        </aside>
        <main className="dash-main" id="main"><Outlet /></main>
      </div>
    </>
  );
}
