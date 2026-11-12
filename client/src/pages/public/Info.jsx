import { Link } from 'react-router-dom';
import Icon from '../../components/Icon';
import { PageHero } from '../../components/Layouts';
import { useMeta } from '../../lib/meta';

export function About() {
  return (
    <>
      <PageHero title="About the initiative" subtitle="A citizen-first channel connecting people directly with the Chief Minister's Office." />
      <section className="section-sm"><div className="container stack">
        <div className="grid grid-2">
          <div className="card card-body"><div className="eyebrow">Purpose</div><h3>Why this portal exists</h3>
            <p className="muted">Citizens often do not know which office handles their problem, or how to follow up once they have complained. This portal gives every resident of Kerala one place to raise a public grievance with the Chief Minister&apos;s Office, and makes sure it reaches the department that can act on it.</p></div>
          <div className="card card-body"><div className="eyebrow">Vision</div><h3>Responsive, transparent governance</h3>
            <p className="muted">A state where no public grievance goes unheard, every complaint has an owner and a deadline, and citizens can see exactly what is being done about it.</p></div>
        </div>
        <div className="card card-body"><div className="eyebrow">Mission</div><h3>What we commit to</h3>
          <p className="muted">To receive, route and resolve public grievances within defined timelines, using technology — including AI-assisted triage — to help officials act faster, while keeping every decision in human hands.</p></div>
        <div className="card card-body"><div className="eyebrow">Objectives</div><h3>Objectives</h3>
          <div className="grid grid-3" style={{ marginTop: 8 }}>
            {[
              ['target', 'Single window', 'One portal for grievances across all departments and all 14 districts.'],
              ['clock', 'Time-bound redressal', 'Department-specific service levels with overdue tracking and escalation.'],
              ['eye', 'Transparency', 'Reference numbers, live status and a full public timeline for every grievance.'],
              ['sparkles', 'Smarter routing', 'AI suggests category, department and priority so officials triage faster.'],
              ['checkCircle', 'Verified closure', 'CMO verifies each action-taken report before a grievance is closed.'],
              ['message', 'Citizen feedback', 'Rate the resolution or reopen a grievance if the problem persists.'],
            ].map(([i, t, b]) => (<div key={t}><div className="row" style={{ gap: 8 }}><Icon name={i} /><strong>{t}</strong></div><p className="muted small">{b}</p></div>))}
          </div></div>
        <div className="alert alert-warn">This website is a recruitment prototype built for a software engineering assessment. It is not operated, authorised or endorsed by the Government of Kerala or the Chief Minister&apos;s Office, and contains only fictional data.</div>
      </div></section>
    </>
  );
}

export function HowItWorks() {
  const steps = [
    ['Submit your grievance', 'Register or log in, then describe your issue — choose your district and category, add a clear subject and description, and optionally attach a photo or PDF (up to 5 MB each).', 'send'],
    ['AI assistant analyses it', 'As you type, the AI Grievance Assistant suggests a category, the responsible department and an urgency level, writes a short summary for the CMO, and flags similar complaints. You can accept or ignore its suggestions.', 'sparkles'],
    ['Get your reference number', 'A unique reference such as CMK-26-TVM-7K3F9Q is generated immediately. Use it to track progress any time — no login needed.', 'flag'],
    ["CMO review", "Officials at the Chief Minister's Office review the grievance, confirm priority and category, and check AI-flagged duplicates. Status becomes Under Review.", 'eye'],
    ['Forwarded to department', 'The CMO assigns the grievance to the responsible department (and optionally a specific officer) with a target date based on the department\'s service level.', 'building'],
    ['Investigation & action', 'The department officer starts investigating (status In Progress), posts progress updates and finally submits an action-taken report with supporting documents.', 'search'],
    ['CMO verifies & closes', 'The CMO reviews the report. If satisfactory, the grievance is marked Resolved and you are notified; otherwise it goes back to the department.', 'checkCircle'],
    ['Your feedback', 'Rate the resolution. If the problem was not actually solved, reopen the grievance within 30 days — it returns to the CMO for fresh action.', 'star'],
  ];
  return (
    <>
      <PageHero title="How it works" subtitle="Submission → CMO review → department assignment → action → verified resolution." />
      <section className="section-sm"><div className="container">
        <div className="card card-body" style={{ marginBottom: 20 }}>
          <h3>Status you will see</h3>
          <div className="grid grid-4" style={{ marginTop: 8 }}>
            {[['Submitted', 's-submitted', 'Received and awaiting CMO review'], ['Under Review', 's-under-review', 'Being reviewed by the CMO / assigned to department'], ['In Progress', 's-in-progress', 'Department is acting on it'], ['Resolved', 's-resolved', 'Action verified by the CMO'], ['Reopened', 's-reopened', 'Citizen reported the issue persists']].map(([s, c, d]) => (
              <div key={s}><span className={`badge ${c}`}>{s}</span><p className="small muted" style={{ marginTop: 6 }}>{d}</p></div>
            ))}
          </div>
        </div>
        <div className="steps">
          {steps.map(([t, b, i], n) => (
            <div className="card step" key={t}>
              <div className="step-num">{n + 1}</div>
              <div><h3 className="row" style={{ gap: 8 }}><Icon name={i} />{t}</h3><p className="muted" style={{ margin: 0 }}>{b}</p></div>
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 24 }}><Link className="btn btn-primary btn-lg" to="/citizen/submit">Submit a grievance</Link><Link className="btn btn-outline btn-lg" to="/faq">Read FAQs</Link></div>
      </div></section>
    </>
  );
}

export function Departments() {
  const { departments } = useMeta();
  return (
    <>
      <PageHero title="Departments" subtitle="Grievances are routed to these departments (sample list for the prototype)." />
      <section className="section-sm"><div className="container">
        <div className="grid grid-3">
          {departments.map((d) => (
            <div className="card dept-card" key={d.id}>
              <div className="row between"><div className="feature" style={{ padding: 0 }}><div className="ico" style={{ margin: 0 }}><Icon name={d.icon} size={22} /></div></div><span className="mono tiny muted">{d.code}</span></div>
              <h3 style={{ margin: '6px 0 0' }}>{d.name}</h3>
              <p className="muted small" style={{ margin: 0 }}>{d.description}</p>
              <div className="meta">
                <span className="badge plain b-brand">Target {d.sla_days} days</span>
                {d.categories.map((c) => <span key={c} className="badge plain b-neutral">{c}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div></section>
    </>
  );
}

const FAQS = [
  ['Who can submit a grievance?', 'Any resident can register with a name, email, mobile number and password and submit grievances about public services in Kerala.'],
  ['What kinds of issues can I raise?', 'Issues about public infrastructure, water supply, electricity, healthcare, education, revenue and land records, policing, welfare pensions, agriculture, sanitation, transport, ration supplies, environment and other public services. Matters pending before courts or private disputes are not handled here.'],
  ['Do I need to know which department handles my issue?', 'No. Just describe the problem. The AI assistant suggests the category and department, and CMO officials make the final routing decision.'],
  ['What is the reference number and where do I find it?', 'A unique ID like CMK-26-EKM-7K3F9Q is shown immediately after submission and listed in your dashboard. Use it on the Track page — no login required.'],
  ['What files can I attach?', 'Up to three JPG, PNG, WEBP or PDF files, each up to 5 MB. Files are checked to make sure their content matches their type.'],
  ['How long will it take?', "Each department has a target time (between 7 and 21 days). If it is exceeded, the grievance is flagged as overdue on the CMO dashboard and can be escalated."],
  ['What do the statuses mean?', 'Submitted → Under Review (CMO reviewing / assigned to department) → In Progress (department acting) → Resolved. Reopened means the citizen reported the issue persists.'],
  ['Can I reopen a resolved grievance?', 'Yes, within 30 days of resolution, from your dashboard, with a short explanation. It goes back to the CMO for fresh action.'],
  ['Does AI decide my case?', 'No. AI only suggests category, department, priority and a summary, and flags possible duplicates. Officials review and decide every action.'],
  ['Is my personal information visible to others?', 'No. The public tracker shows only status, department and public updates — never your name, phone or email. Departments see your details only when your grievance is assigned to them.'],
];

export function Faq() {
  return (
    <>
      <PageHero title="Frequently asked questions" subtitle="Everything you need to know about submitting and tracking grievances." crumb="FAQ" />
      <section className="section-sm"><div className="container" style={{ maxWidth: 860 }}>
        <div className="card card-body faq">
          {FAQS.map(([q, a], i) => (<details key={q} open={i === 0}><summary>{q}</summary><p>{a}</p></details>))}
        </div>
        <p className="muted" style={{ marginTop: 16 }}>Still have questions? <Link to="/contact">Contact us</Link>.</p>
      </div></section>
    </>
  );
}
