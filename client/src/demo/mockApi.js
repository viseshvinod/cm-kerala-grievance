/**
 * DEMO MODE ONLY — an in-browser stand-in for the Express + PostgreSQL backend so the UI can be
 * previewed without a server. It mirrors the real API's routes, role scoping and workflow rules.
 * Data lives in memory and resets on reload. The real backend lives in /server.
 */

const DAY = 86400000;
const now = () => new Date().toISOString();

const DISTRICTS = [
  ['TVM', 'Thiruvananthapuram'], ['KLM', 'Kollam'], ['PTA', 'Pathanamthitta'], ['ALP', 'Alappuzha'], ['KTM', 'Kottayam'],
  ['IDK', 'Idukki'], ['EKM', 'Ernakulam'], ['TSR', 'Thrissur'], ['PKD', 'Palakkad'], ['MLP', 'Malappuram'],
  ['KKD', 'Kozhikode'], ['WYD', 'Wayanad'], ['KNR', 'Kannur'], ['KSD', 'Kasaragod'],
].map(([code, name]) => ({ code, name }));
const CATEGORIES = ['Roads & Infrastructure', 'Water Supply', 'Electricity', 'Healthcare', 'Education', 'Revenue & Land Records',
  'Police & Public Safety', 'Social Welfare & Pensions', 'Agriculture', 'Sanitation & Local Bodies', 'Public Transport',
  'Ration & Civil Supplies', 'Environment & Forest', 'Other'];
const STATUSES = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Reopened'];
const PRIORITIES = ['Low', 'Medium', 'High'];

const DEPTS = [
  ['PWD', 'Public Works Department', 'Construction and maintenance of state roads, bridges, culverts and government buildings.', 'road', ['Roads & Infrastructure'], 21, true],
  ['WRD', 'Water Resources Department', 'Drinking water supply, pipelines, irrigation canals and water quality through the state water authority.', 'droplet', ['Water Supply'], 10, true],
  ['PWR', 'Power Department', 'Electricity supply, transformers, power outages, metering and billing through the state electricity board.', 'bolt', ['Electricity'], 7, true],
  ['HFW', 'Health & Family Welfare Department', 'Government hospitals, primary health centres, medicines, ambulance services and public health programmes.', 'heart', ['Healthcare'], 7, true],
  ['GED', 'General Education Department', 'Government and aided schools, teachers, scholarships, mid-day meals and school infrastructure.', 'book', ['Education'], 15, true],
  ['REV', 'Revenue Department', 'Land records, survey, mutation, certificates, revenue recovery and disaster relief.', 'file', ['Revenue & Land Records'], 21, false],
  ['HOM', 'Home Department (Police)', 'Law and order, police station complaints, public safety, traffic and anti-narcotics enforcement.', 'shield', ['Police & Public Safety'], 7, true],
  ['SJD', 'Social Justice Department', 'Welfare pensions, disability support, senior citizens, and social security schemes.', 'users', ['Social Welfare & Pensions'], 15, false],
  ['AGR', 'Agriculture Development & Farmers Welfare', 'Farmer support, crop insurance, subsidies, fertiliser supply and Krishi Bhavan services.', 'leaf', ['Agriculture'], 15, false],
  ['LSG', 'Local Self Government Department', 'Panchayats and municipalities: waste management, sanitation, building permits and local roads.', 'home', ['Sanitation & Local Bodies'], 10, true],
  ['TRN', 'Transport Department', 'State road transport buses, routes, licensing, vehicle registration and road safety.', 'bus', ['Public Transport'], 15, false],
  ['FCS', 'Food & Civil Supplies Department', 'Ration cards, public distribution system, ration shops and price monitoring.', 'basket', ['Ration & Civil Supplies'], 10, false],
  ['FOR', 'Forest & Wildlife Department', 'Forest protection, human-wildlife conflict, tree felling permissions and environmental complaints.', 'tree', ['Environment & Forest'], 10, false],
  ['GAD', 'General Administration Department', 'Matters not covered by other departments; coordination and general public services.', 'building', ['Other'], 15, false],
];

const TEMPLATES = [
  ['PWD', 'Roads & Infrastructure', 'High', 'Dangerous potholes on main road near school', 'The main road in front of the government LP school has several deep potholes that fill with water during rain. Two-wheeler riders have fallen this month and children walk on this road every day. Request urgent repair before someone is seriously injured.'],
  ['PWD', 'Roads & Infrastructure', 'Medium', 'Road resurfacing work abandoned halfway', 'Resurfacing of the 2 km stretch connecting our ward to the town was started four months ago but the contractor has left after removing the old tar. The road is now full of loose gravel and dust.'],
  ['WRD', 'Water Supply', 'High', 'No drinking water supply for 12 days', 'Our area has not received piped drinking water for the last 12 days. Many elderly residents depend entirely on the tap connection. We have complained at the local section office but no tanker or repair has been arranged.'],
  ['WRD', 'Water Supply', 'Medium', 'Pipeline leak wasting water on roadside', 'A major pipeline has been leaking near the bus stop for three weeks. Thousands of litres of water are wasted daily and the road is getting damaged.'],
  ['WRD', 'Water Supply', 'High', 'Muddy and foul-smelling tap water', 'The tap water supplied in our colony for the past week is brown and has a bad smell. Several children have stomach problems. Please test the water quality urgently.'],
  ['PWR', 'Electricity', 'Medium', 'Frequent power cuts every evening', 'There are power cuts of 2-3 hours almost every evening in our locality for the last month. Students are unable to study and small shops are losing business.'],
  ['PWR', 'Electricity', 'High', 'Electric post leaning dangerously over footpath', 'An electric post near the market is leaning badly after a vehicle hit it and the lines are hanging low over the footpath. This is very dangerous for pedestrians.'],
  ['PWR', 'Electricity', 'Low', 'Incorrect electricity bill amount', 'My bi-monthly electricity bill shows an amount almost four times higher than usual though consumption has not changed. Request correction of the bill.'],
  ['HFW', 'Healthcare', 'High', 'No doctor available at primary health centre at night', 'The primary health centre in our panchayat has had no doctor on night duty for the past month. Last week a patient with chest pain had to be taken 25 km to the taluk hospital.'],
  ['HFW', 'Healthcare', 'Medium', 'Essential medicines out of stock at taluk hospital', 'Diabetes and blood pressure medicines have been out of stock at the taluk hospital pharmacy for three weeks. Poor patients are forced to buy from private shops.'],
  ['GED', 'Education', 'Medium', 'School building roof leaking in classrooms', 'The roof of the government UP school leaks in three classrooms. Students are being shifted to the verandah during rain.'],
  ['GED', 'Education', 'Low', 'Scholarship amount not credited', 'My daughter was selected for the merit scholarship last academic year but the amount has not been credited yet.'],
  ['REV', 'Revenue & Land Records', 'Low', 'Land mutation application pending for eight months', 'I applied for mutation of inherited land eight months ago at the village office. The application is still pending without any reason given.'],
  ['HOM', 'Police & Public Safety', 'High', 'Drug peddling near college campus', 'Students report that drugs are being sold openly near the college bus stop in the evenings. Request regular police patrolling in the area.'],
  ['SJD', 'Social Welfare & Pensions', 'High', 'Widow pension stopped without notice', 'My widowed mother, aged 72, has not received her welfare pension for five months. She has no other income.'],
  ['AGR', 'Agriculture', 'Medium', 'Crop insurance claim not settled', 'My paddy crop was destroyed by unseasonal rain and I submitted the crop insurance claim through the Krishi Bhavan. The claim has not been settled after five months.'],
  ['LSG', 'Sanitation & Local Bodies', 'Medium', 'Garbage not collected for two weeks', 'Household waste has not been collected in our ward for over two weeks. Waste is piling up by the roadside and stray dogs are scattering it.'],
  ['LSG', 'Sanitation & Local Bodies', 'High', 'Sewage overflowing into residential lane', 'The drainage near our lane is blocked and sewage is overflowing onto the road. Mosquito breeding has increased and two people in the lane have dengue.'],
  ['TRN', 'Public Transport', 'Low', 'Bus service on rural route cancelled', 'The only state transport bus service on our rural route was cancelled two months ago. Students now walk 4 km to the main road.'],
  ['FCS', 'Ration & Civil Supplies', 'Medium', 'Ration shop not distributing full quota', 'The ration shop in our area gives less rice than our entitled quota and often says stock is over.'],
  ['FOR', 'Environment & Forest', 'High', 'Wild elephants entering farmland at night', 'A herd of wild elephants has been entering our farmland near the forest border almost every night, destroying crops. Residents are afraid to go out after dark.'],
  ['GAD', 'Other', 'Low', 'Suggestion for online appointment at government offices', 'I would like to suggest an online token system for appointments at village and taluk offices to reduce long queues.'],
];

/* ------------------------------------------------------------------ state */
const db = { users: [], departments: [], grievances: [], history: [], assignments: [], attachments: [], remarks: [], feedback: [], enquiries: [], ai: [] };
let session = null;
const seq = {};
const nextId = (t) => { seq[t] = (seq[t] || 0) + 1; return seq[t]; };
let seed = 20261112;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rand() * a.length)];
const ALPHA = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const genRef = (district, d = new Date()) => {
  const code = DISTRICTS.find((x) => x.name === district)?.code || 'KER';
  let s = ''; for (let i = 0; i < 6; i += 1) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return `CMK-${String(d.getFullYear()).slice(-2)}-${code}-${s}`;
};
const pw = {}; // email -> password (demo only)

class E extends Error { constructor(status, message, details) { super(message); this.status = status; this.details = details; } }
const fail = (s, m, d) => { throw new E(s, m, d); };

/* ------------------------------------------------------------------ AI (labelled offline fallback, same as server) */
const LEX = {
  'Roads & Infrastructure': ['road', 'pothole', 'bridge', 'culvert', 'footpath', 'highway', 'tar', 'construction', 'drainage'],
  'Water Supply': ['water', 'pipe', 'tap', 'drinking', 'leak', 'well', 'tanker', 'contaminated'],
  Electricity: ['electricity', 'power', 'current', 'transformer', 'voltage', 'meter', 'bill', 'outage', 'streetlight'],
  Healthcare: ['hospital', 'doctor', 'medicine', 'health', 'phc', 'clinic', 'ambulance', 'nurse', 'patient', 'fever'],
  Education: ['school', 'teacher', 'student', 'college', 'scholarship', 'exam', 'classroom'],
  'Revenue & Land Records': ['land', 'survey', 'mutation', 'village', 'certificate', 'tax', 'encroachment'],
  'Police & Public Safety': ['police', 'theft', 'harassment', 'fir', 'violence', 'drug', 'threat', 'crime', 'snatching'],
  'Social Welfare & Pensions': ['pension', 'welfare', 'disability', 'widow', 'elderly', 'allowance'],
  Agriculture: ['farmer', 'crop', 'paddy', 'fertiliser', 'krishi', 'harvest', 'subsidy'],
  'Sanitation & Local Bodies': ['waste', 'garbage', 'sewage', 'panchayat', 'municipality', 'mosquito', 'dumping'],
  'Public Transport': ['bus', 'ksrtc', 'transport', 'route', 'conductor', 'licence'],
  'Ration & Civil Supplies': ['ration', 'rice', 'kerosene', 'supplyco', 'pds'],
  'Environment & Forest': ['forest', 'tree', 'wildlife', 'elephant', 'pollution', 'quarry', 'sand'],
};
const HIGH = ['danger', 'urgent', 'emergency', 'death', 'injur', 'accident', 'collapse', 'flood', 'fire', 'child', 'pregnant', 'elderly', 'disabled', 'unsafe', 'dengue', 'no water'];
const STOP = new Set('the and for with from this that are was were have has had not but our your their there into very been about after please'.split(' '));
const tok = (t) => (t || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(ing|ed|es|s)$/, ''));
function similar(text, excludeId, district) {
  const docs = db.grievances.filter((g) => g.id !== excludeId).map((g) => ({ g, t: tok(`${g.subject} ${g.description}`) }));
  const q = tok(text); const N = docs.length + 1; const df = {};
  [q, ...docs.map((d) => d.t)].forEach((d) => new Set(d).forEach((w) => { df[w] = (df[w] || 0) + 1; }));
  const vec = (ts) => { const tf = {}; ts.forEach((w) => { tf[w] = (tf[w] || 0) + 1; }); const v = {}; Object.entries(tf).forEach(([w, c]) => { v[w] = (1 + Math.log(c)) * Math.log(1 + N / df[w]); }); return v; };
  const cos = (a, b) => { let d = 0, na = 0, nb = 0; for (const k in a) { na += a[k] ** 2; if (b[k]) d += a[k] * b[k]; } for (const k in b) nb += b[k] ** 2; return na && nb ? d / Math.sqrt(na * nb) : 0; };
  const qv = vec(q);
  return docs.map(({ g, t }) => { let s = cos(qv, vec(t)); if (g.district === district) s = Math.min(1, s * 1.1); return { id: g.id, reference_no: g.reference_no, subject: g.subject, status: g.status, district: g.district, score: +s.toFixed(3) }; })
    .filter((r) => r.score >= 0.42).sort((a, b) => b.score - a.score).slice(0, 3);
}
function analyse({ subject, description, district }, userId, grievanceId) {
  const text = `${subject || ''} ${description || ''}`.toLowerCase();
  let best = 'Other'; let bs = 0;
  Object.entries(LEX).forEach(([c, ws]) => { const s = ws.filter((w) => text.includes(w)).length; if (s > bs) { best = c; bs = s; } });
  const dept = db.departments.find((d) => d.categories.includes(best)) || db.departments.find((d) => d.code === 'GAD');
  const result = {
    category: best, department_code: dept.code, priority: HIGH.some((c) => text.includes(c)) ? 'High' : /suggest|enquiry|information/.test(text) ? 'Low' : 'Medium',
    summary: (description || subject).replace(/\s+/g, ' ').split(/(?<=[.!?])\s/)[0].slice(0, 220),
    rationale: 'Demo preview uses the offline fallback. The deployed app calls a live LLM (Gemini / OpenAI-compatible / Claude).',
    keywords: Object.values(LEX).flat().filter((w) => text.includes(w)).slice(0, 5), confidence: +Math.min(0.5, 0.15 + bs * 0.1).toFixed(2),
  };
  const duplicates = similar(`${subject} ${description}`, grievanceId, district);
  const row = { id: nextId('ai'), requested_by: userId, grievance_id: grievanceId || null, provider: 'fallback', model: null, is_fallback: true, result, duplicates, latency_ms: 1, created_at: now(), hash: `${subject}\n${description}\n${district || ''}` };
  db.ai.push(row);
  return { analysisId: row.id, provider: 'fallback', model: null, isFallback: true, latencyMs: 1, ...result, department: { id: dept.id, code: dept.code, name: dept.name }, duplicates, createdAt: row.created_at };
}

/* ------------------------------------------------------------------ seed */
function seedAll() {
  DEPTS.forEach(([code, name, description, icon, categories, sla_days, is_featured]) => db.departments.push({ id: nextId('d'), code, name, description, icon, categories, sla_days, is_featured }));
  const dByCode = Object.fromEntries(db.departments.map((d) => [d.code, d]));
  const mk = (name, email, role, extra = {}) => { const u = { id: nextId('u'), name, email, mobile: extra.mobile || '9400000000', role, department_id: null, designation: null, ...extra }; db.users.push(u); return u; };
  const admins = [mk('Priya Raghavan', 'admin@cmkportal.test', 'cmo_admin', { designation: 'Grievance Cell Officer, CMO' }), mk('Arun Das', 'cmo.reviewer@cmkportal.test', 'cmo_admin', { designation: 'Additional Secretary (Grievances), CMO' })];
  admins.forEach((a) => { pw[a.email] = 'Admin@123'; });
  const names = ['Suresh Kumar', 'Deepa Mohan', 'Vinod Chandran', 'Asha Thomas', 'Bijoy Mathew', 'Nisha Rajan', 'Hari Prasad', 'Reshma Nair', 'Manoj Paul', 'Shalini George', 'Ajith Kumar', 'Remya Suresh', 'Gopakumar V', 'Divya Sasi'];
  const officers = {};
  db.departments.forEach((d, i) => { const e = `${d.code.toLowerCase()}.officer@cmkportal.test`; officers[d.code] = mk(names[i], e, 'dept_officer', { department_id: d.id, designation: `Nodal Grievance Officer, ${d.name}` }); pw[e] = 'Officer@123'; });
  const citizens = [['Anjali Menon', 'citizen@cmkportal.test'], ['Rahul Nair', 'rahul.nair@cmkportal.test'], ['Fathima Beevi', 'fathima.b@cmkportal.test'], ['Joseph Varghese', 'joseph.v@cmkportal.test'], ['Lakshmi Pillai', 'lakshmi.p@cmkportal.test']]
    .map(([n, e], i) => { pw[e] = 'Citizen@123'; return mk(n, e, 'citizen', { mobile: `984700000${i + 1}` }); });

  const plan = [0, 0, 0, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6, 7, 8];
  const t0 = Date.now();
  for (let n = 0; n < 44; n += 1) {
    const [code, category, priority, subject, description] = TEMPLATES[n % TEMPLATES.length];
    const district = pick(DISTRICTS).name; const citizen = n < 6 ? citizens[0] : pick(citizens);
    const stage = n < 6 ? [0, 3, 4, 6, 5, 2][n] : pick(plan);
    const age = stage === 0 ? rand() * 6 : [5, 6, 7].includes(stage) ? 8 + rand() * 170 : 3 + rand() * (rand() < 0.35 ? 60 : 14);
    let t = t0 - age * DAY;
    const step = () => { t = Math.min(t0 - 3600000, t + (0.2 + rand() * Math.min(3, Math.max(0.5, age / 10))) * DAY); return new Date(t).toISOString(); };
    const created = new Date(t).toISOString(); const dept = dByCode[code]; const off = officers[code]; const admin = pick(admins);
    const aiP = rand() < 0.85 ? priority : 'Medium';
    const ai = { id: nextId('ai'), requested_by: citizen.id, provider: 'sample-data', model: null, is_fallback: false, result: { category, department_code: code, priority: aiP, summary: `${subject}. ${description.split('. ')[0]}.`, rationale: 'Sample data', keywords: [], confidence: 0.8 }, duplicates: [], latency_ms: null, created_at: created };
    db.ai.push(ai);
    const g = { id: nextId('g'), reference_no: genRef(district, new Date(created)), citizen_id: citizen.id, district, category, subject, description, priority: 'Medium', status: 'Submitted', department_id: null, is_escalated: false, escalated_at: null, due_date: new Date(new Date(created).getTime() + 15 * DAY).toISOString(), resolved_at: null, reopen_count: 0, ai_analysis_id: ai.id, ai_summary: ai.result.summary, ai_suggested_category: category, ai_suggested_priority: aiP, ai_suggested_department_id: dept.id, created_at: created, updated_at: created };
    ai.grievance_id = g.id; db.grievances.push(g);
    const H = (action, from, to, actor, remarks, at, isPublic = true) => db.history.push({ id: nextId('h'), grievance_id: g.id, action, from_status: from, to_status: to, remarks, is_public: isPublic, actor_id: actor?.id, actor_role: actor?.role, created_at: at });
    const R = (actor, visibility, body, at) => db.remarks.push({ id: nextId('r'), grievance_id: g.id, author_id: actor.id, author_role: actor.role, visibility, body, created_at: at });
    H('submitted', null, 'Submitted', citizen, `Grievance submitted online. Reference ${g.reference_no} generated.`, created);
    let a;
    if (stage >= 1) { H('reviewed', 'Submitted', 'Under Review', admin, "Grievance taken up for review by the Chief Minister's Office.", step()); g.status = 'Under Review'; g.priority = priority; }
    if (stage >= 2) {
      const at = step(); const due = new Date(new Date(at).getTime() + dept.sla_days * DAY).toISOString();
      a = { id: nextId('a'), grievance_id: g.id, department_id: dept.id, officer_id: off.id, assigned_by: admin.id, instructions: 'Please verify on site and submit an action-taken report within the SLA.', is_current: true, assigned_at: at, due_date: due, atr_text: null, atr_attachment_id: null, atr_submitted_by: null, atr_submitted_at: null, review_status: 'awaiting_atr', reviewed_by: null, reviewed_at: null, review_remarks: null };
      db.assignments.push(a); H('forwarded', 'Under Review', 'Under Review', admin, `Forwarded to ${dept.name}. Target date: ${due.slice(0, 10)}.`, at);
      g.department_id = dept.id; g.due_date = due;
    }
    if (stage >= 3) { H('investigation_started', 'Under Review', 'In Progress', off, 'Department has started investigating the grievance.', step()); const at = step(); const m = 'Site inspection completed by the field team. Work order is being prepared.'; R(off, 'public', m, at); H('progress_update', 'In Progress', 'In Progress', off, m, at); g.status = 'In Progress'; }
    if (stage >= 4) { const at = step(); Object.assign(a, { atr_text: `Field inspection carried out. The issue reported ("${subject.toLowerCase()}") has been verified and corrective action completed by the concerned section.`, atr_submitted_by: off.id, atr_submitted_at: at, review_status: 'pending_review' }); H('atr_submitted', 'In Progress', 'In Progress', off, 'Department submitted its action-taken report to the CMO for verification.', at); }
    if (stage === 8) { const at = step(); Object.assign(a, { review_status: 'returned', reviewed_by: admin.id, reviewed_at: at, review_remarks: 'Please attach photographs of completed work and confirm with the complainant.' }); H('atr_returned', 'In Progress', 'In Progress', admin, 'Action-taken report returned to department: please attach evidence.', at, false); }
    if (stage >= 5 && stage <= 7) {
      const at = step(); Object.assign(a, { review_status: 'accepted', reviewed_by: admin.id, reviewed_at: at, review_remarks: 'Verified.' });
      const m = 'The department has completed the required action and the CMO has verified the report. Your grievance is resolved.';
      H('resolved', 'In Progress', 'Resolved', admin, m, at); R(admin, 'public', m, at); g.status = 'Resolved'; g.resolved_at = at;
      if (stage === 6) { const r = pick([5, 5, 4, 4, 4, 3]); db.feedback.push({ grievance_id: g.id, citizen_id: citizen.id, rating: r, comments: r >= 4 ? 'Issue was fixed. Thank you for the quick action.' : 'Resolved, but took longer than expected.', created_at: step() }); }
      if (stage === 7) { const at2 = step(); a.is_current = false; H('reopened', 'Resolved', 'Reopened', citizen, 'Reopened by citizen: The problem has started again within a week of the repair.', at2); g.status = 'Reopened'; g.resolved_at = null; g.reopen_count = 1; g.due_date = new Date(new Date(at2).getTime() + 15 * DAY).toISOString(); }
    }
    if (n % 9 === 4 && g.status !== 'Resolved') { const at = step(); g.is_escalated = true; g.escalated_at = at; g.priority = 'High'; H('escalated', g.status, g.status, admin, 'Escalated by CMO: SLA breached, department to prioritise.', at, false); }
    g.updated_at = new Date(t).toISOString();
  }
  db.enquiries.push({ id: nextId('e'), name: 'Kiran Babu', email: 'kiran.b@example.com', subject: 'Unable to upload PDF', message: 'I am getting an error while attaching a 7 MB scanned PDF. What is the size limit?', status: 'new', created_at: new Date(t0 - 2 * DAY).toISOString() });
}
seedAll();

/* ------------------------------------------------------------------ helpers */
const userById = (id) => db.users.find((u) => u.id === id);
const deptById = (id) => db.departments.find((d) => d.id === id);
const pub = (u) => u && ({ id: u.id, name: u.name, email: u.email, mobile: u.mobile, role: u.role, departmentId: u.department_id, departmentName: deptById(u.department_id)?.name || null, designation: u.designation });
const isOverdue = (g) => g.status !== 'Resolved' && new Date(g.due_date) < new Date();
const current = (gid) => db.assignments.find((a) => a.grievance_id === gid && a.is_current);
const need = (...roles) => { if (!session) fail(401, 'Authentication required'); if (roles.length && !roles.includes(session.role)) fail(403, 'You do not have permission for this action'); return session; };
const scoped = (u) => db.grievances.filter((g) => (u.role === 'citizen' ? g.citizen_id === u.id : u.role === 'dept_officer' ? g.department_id === u.department_id : true));
const getScoped = (id, u) => scoped(u).find((g) => g.id === id) || fail(404, 'Grievance not found');
const hist = (g, action, from, to, actor, remarks, isPublic = true) => db.history.push({ id: nextId('h'), grievance_id: g.id, action, from_status: from, to_status: to, remarks, is_public: isPublic, actor_id: actor?.id, actor_role: actor?.role, created_at: now() });
const remark = (g, actor, visibility, body) => db.remarks.push({ id: nextId('r'), grievance_id: g.id, author_id: actor.id, author_role: actor.role, visibility, body, created_at: now() });
const setStatus = (g, s, extra = {}) => Object.assign(g, { status: s, updated_at: now() }, extra);
const allow = (g, list, what) => { if (!list.includes(g.status)) fail(409, `Cannot ${what} a grievance that is "${g.status}"`); };
const ownsDept = (g, u) => { if (u.role !== 'dept_officer' || g.department_id !== u.department_id) fail(403, 'This grievance is not assigned to your department'); };
const v = (cond, field, message, errs) => { if (!cond) errs.push({ field, message }); };
const check = (errs) => { if (errs.length) fail(400, 'Validation failed', errs); };
const listRow = (g) => ({ ...g, department_name: deptById(g.department_id)?.name || null, atr_status: current(g.id)?.review_status || null, is_overdue: isOverdue(g) });
const fdObj = (b) => (b instanceof FormData ? { fields: Object.fromEntries([...b.entries()].filter(([, x]) => typeof x === 'string')), files: [...b.entries()].filter(([, x]) => typeof x !== 'string') } : { fields: b || {}, files: [] });
const blobs = {};
window.__cmkDemoFiles = blobs;
const saveFile = (g, kind, file) => {
  if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) fail(415, 'Only JPG, PNG, WEBP images or PDF documents are allowed');
  if (file.size > 5 * 1048576) fail(413, 'File too large (max 5 MB)');
  const a = { id: nextId('f'), grievance_id: g.id, uploaded_by: session.id, kind, original_name: file.name, mime_type: file.type, size_bytes: file.size, created_at: now() };
  blobs[a.id] = URL.createObjectURL(file); db.attachments.push(a); return a;
};
export const attachmentUrl = (id) => blobs[id] || '#';

/* ------------------------------------------------------------------ routes */
const routes = [];
const on = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`), fn });

on('GET', '/health', () => ({ ok: true }));
on('GET', '/auth/me', () => ({ user: pub(session) }));
on('POST', '/auth/login', ({ body }) => {
  const u = db.users.find((x) => x.email.toLowerCase() === String(body.email || '').trim().toLowerCase());
  if (!u || pw[u.email] !== body.password) fail(401, 'Invalid email or password');
  session = u; return { user: pub(u), token: 'demo' };
});
on('POST', '/auth/logout', () => { session = null; return { ok: true }; });
on('POST', '/auth/register', ({ body }) => {
  const e = []; const email = String(body.email || '').trim().toLowerCase();
  v((body.name || '').trim().length >= 2, 'name', 'Name is too short', e);
  v(/^\S+@\S+\.\S+$/.test(email), 'email', 'Enter a valid email', e);
  v(/^(\+91[\s-]?)?[6-9]\d{9}$/.test((body.mobile || '').trim()), 'mobile', 'Enter a valid 10-digit Indian mobile number', e);
  v((body.password || '').length >= 8 && /[A-Za-z]/.test(body.password) && /\d/.test(body.password), 'password', 'Password must be at least 8 characters with letters and numbers', e);
  check(e);
  if (db.users.some((u) => u.email.toLowerCase() === email)) fail(409, 'An account with this email already exists');
  const u = { id: nextId('u'), name: body.name.trim(), email, mobile: body.mobile.replace(/\D/g, '').slice(-10), role: 'citizen', department_id: null, designation: null };
  db.users.push(u); pw[email] = body.password; session = u; return { user: pub(u), token: 'demo' };
});
on('GET', '/meta', () => ({ districts: DISTRICTS, categories: CATEGORIES, statuses: STATUSES, priorities: PRIORITIES, ai: { provider: 'fallback', model: null, live: false } }));
on('GET', '/ai/status', () => ({ provider: 'fallback', model: null, live: false }));
on('GET', '/departments', () => ({ departments: db.departments.map((d) => ({ ...d, resolved_count: db.grievances.filter((g) => g.department_id === d.id && g.status === 'Resolved').length })) }));
const resDays = (gs) => { const r = gs.filter((g) => g.resolved_at); return r.length ? +(r.reduce((s, g) => s + (new Date(g.resolved_at) - new Date(g.created_at)) / DAY, 0) / r.length).toFixed(1) : 0; };
on('GET', '/stats/public', () => { const G = db.grievances; return { total: G.length, resolved: G.filter((g) => g.status === 'Resolved').length, pending: G.filter((g) => g.status !== 'Resolved').length, avg_resolution_days: resDays(G), departments: db.departments.length, districts: new Set(G.map((g) => g.district)).size }; });
on('GET', '/track/:ref', ({ params }) => {
  const ref = decodeURIComponent(params.ref).trim().toUpperCase();
  if (!/^CMK-\d{2}-[A-Z]{3}-[2-9A-Z]{6}$/.test(ref)) fail(400, 'Invalid reference number format (e.g. CMK-26-TVM-7K3F9Q)');
  const g = db.grievances.find((x) => x.reference_no === ref) || fail(404, 'No grievance found with this reference number');
  const { reference_no, district, category, subject, status, priority, created_at, updated_at, resolved_at, due_date } = g;
  return { grievance: { reference_no, district, category, subject, status, priority, created_at, updated_at, resolved_at, due_date, department_name: deptById(g.department_id)?.name || null },
    history: db.history.filter((h) => h.grievance_id === g.id && h.is_public).map((h) => ({ ...h, actor: { cmo_admin: 'CMO', dept_officer: 'Department', citizen: 'Citizen' }[h.actor_role] || 'System' })) };
});
on('POST', '/contact', ({ body }) => {
  const e = []; v((body.name || '').trim().length >= 2, 'name', 'Name is too short', e); v(/^\S+@\S+\.\S+$/.test(body.email || ''), 'email', 'Invalid email', e);
  v((body.subject || '').trim().length >= 3, 'subject', 'Subject is too short', e); v((body.message || '').trim().length >= 10, 'message', 'Message must be at least 10 characters', e); check(e);
  db.enquiries.unshift({ id: nextId('e'), ...body, status: 'new', created_at: now() }); return { ok: true };
});
on('POST', '/ai/analyze', ({ body }) => { const u = need('citizen', 'cmo_admin'); if ((body.description || '').trim().length < 20) fail(400, 'Describe the issue in at least 20 characters for AI analysis'); return { analysis: analyse(body, u.id) }; });

on('POST', '/grievances', ({ body }) => {
  const u = need('citizen'); const { fields: f, files } = fdObj(body); const e = [];
  v(DISTRICTS.some((d) => d.name === f.district), 'district', 'Select a district', e); v(CATEGORIES.includes(f.category), 'category', 'Select a category', e);
  v((f.subject || '').trim().length >= 5, 'subject', 'Subject must be at least 5 characters', e); v((f.description || '').trim().length >= 20, 'description', 'Please describe the issue in at least 20 characters', e); check(e);
  let ai = db.ai.find((x) => x.id === Number(f.aiAnalysisId) && x.requested_by === u.id && !x.grievance_id && x.hash === `${f.subject}\n${f.description}\n${f.district}`);
  if (!ai) { const r = analyse(f, u.id); ai = db.ai.find((x) => x.id === r.analysisId); }
  const g = { id: nextId('g'), reference_no: genRef(f.district), citizen_id: u.id, district: f.district, category: f.category, subject: f.subject.trim(), description: f.description.trim(), priority: 'Medium', status: 'Submitted', department_id: null, is_escalated: false, due_date: new Date(Date.now() + 15 * DAY).toISOString(), resolved_at: null, reopen_count: 0, ai_analysis_id: ai.id, ai_summary: ai.result.summary, ai_suggested_category: ai.result.category, ai_suggested_priority: ai.result.priority, ai_suggested_department_id: db.departments.find((d) => d.code === ai.result.department_code)?.id, created_at: now(), updated_at: now() };
  db.grievances.push(g); ai.grievance_id = g.id;
  const attachments = files.slice(0, 3).map(([, file]) => saveFile(g, 'evidence', file));
  hist(g, 'submitted', null, 'Submitted', u, `Grievance submitted online. Reference ${g.reference_no} generated.`);
  return { grievance: { id: g.id, reference_no: g.reference_no, status: g.status, created_at: g.created_at, attachments } };
});
on('GET', '/grievances/summary', () => {
  const u = need(); const G = scoped(u); const c = (fn) => G.filter(fn).length;
  const out = { total: G.length, submitted: c((g) => g.status === 'Submitted'), under_review: c((g) => g.status === 'Under Review'), in_progress: c((g) => g.status === 'In Progress'), resolved: c((g) => g.status === 'Resolved'), reopened: c((g) => g.status === 'Reopened'), pending: c((g) => g.status !== 'Resolved'), overdue: c(isOverdue), escalated: c((g) => g.is_escalated && g.status !== 'Resolved') };
  if (u.role === 'dept_officer') { const A = db.assignments.filter((a) => a.is_current && a.department_id === u.department_id); Object.assign(out, { atr_pending: A.filter((a) => a.review_status === 'pending_review').length, atr_returned: A.filter((a) => a.review_status === 'returned').length, new_assignments: A.filter((a) => db.grievances.find((g) => g.id === a.grievance_id).status === 'Under Review').length }); }
  return out;
});
on('GET', '/grievances', ({ query: q }) => {
  const u = need(); let G = scoped(u);
  if (q.status) G = G.filter((g) => g.status === q.status); if (q.district) G = G.filter((g) => g.district === q.district);
  if (q.category) G = G.filter((g) => g.category === q.category); if (q.priority) G = G.filter((g) => g.priority === q.priority);
  if (q.departmentId) G = G.filter((g) => g.department_id === Number(q.departmentId)); if (q.overdue === 'true') G = G.filter(isOverdue);
  if (q.escalated === 'true') G = G.filter((g) => g.is_escalated); if (q.unassigned) G = G.filter((g) => !g.department_id && g.status !== 'Resolved');
  if (q.atr) G = G.filter((g) => current(g.id)?.review_status === q.atr);
  if (q.q) { const s = q.q.toLowerCase(); G = G.filter((g) => g.reference_no.toLowerCase().includes(s) || g.subject.toLowerCase().includes(s)); }
  const pr = { High: 0, Medium: 1, Low: 2 }; const sort = q.sort || 'newest';
  const cmp = { newest: (a, b) => b.created_at.localeCompare(a.created_at), oldest: (a, b) => a.created_at.localeCompare(b.created_at), due: (a, b) => a.due_date.localeCompare(b.due_date), updated: (a, b) => b.updated_at.localeCompare(a.updated_at), priority: (a, b) => pr[a.priority] - pr[b.priority] || b.created_at.localeCompare(a.created_at) }[sort];
  G = [...G].sort(cmp); const page = Number(q.page) || 1; const size = Number(q.pageSize) || 20;
  return { items: G.slice((page - 1) * size, page * size).map(listRow), total: G.length, page, pageSize: size };
});
on('GET', '/grievances/:id', ({ params }) => {
  const u = need(); const g = getScoped(Number(params.id), u); const staff = u.role !== 'citizen'; const c = userById(g.citizen_id);
  const name = (id, role) => (staff ? userById(id)?.name : role === 'citizen' ? userById(id)?.name : role === 'cmo_admin' ? "Chief Minister's Office" : 'Department Officer');
  const ad = deptById(g.ai_suggested_department_id);
  return {
    grievance: { ...listRow(g), department_code: deptById(g.department_id)?.code, citizen_name: c.name, ...(staff ? { citizen_email: c.email, citizen_mobile: c.mobile } : {}), ai_suggested_department_name: ad?.name, ai_suggested_department_code: ad?.code },
    history: db.history.filter((h) => h.grievance_id === g.id && (staff || h.is_public)).map((h) => ({ ...h, actor_name: name(h.actor_id, h.actor_role) })),
    remarks: db.remarks.filter((r) => r.grievance_id === g.id && (staff || r.visibility === 'public')).map((r) => ({ ...r, author_name: name(r.author_id, r.author_role) })),
    attachments: db.attachments.filter((a) => a.grievance_id === g.id && (staff || a.kind === 'evidence')).map((a) => ({ ...a, uploaded_by_name: userById(a.uploaded_by)?.name })),
    assignments: staff ? db.assignments.filter((a) => a.grievance_id === g.id && (u.role !== 'dept_officer' || a.department_id === u.department_id)).reverse().map((a) => ({ ...a, department_name: deptById(a.department_id).name, officer_name: userById(a.officer_id)?.name, assigned_by_name: userById(a.assigned_by)?.name, atr_submitted_by_name: userById(a.atr_submitted_by)?.name })) : [],
    feedback: db.feedback.find((f) => f.grievance_id === g.id) || null,
    ai: db.ai.find((x) => x.id === g.ai_analysis_id) || null,
  };
});
const act = (path, roles, fn) => on('POST', `/grievances/:id/${path}`, ({ params, body }) => {
  const u = need(...roles); const g = db.grievances.find((x) => x.id === Number(params.id)) || fail(404, 'Grievance not found');
  if (u.role === 'citizen' && g.citizen_id !== u.id) fail(404, 'Grievance not found');
  fn(g, u, body); return { ok: true, grievance: { id: g.id, reference_no: g.reference_no, status: g.status, priority: g.priority, department_id: g.department_id, is_escalated: g.is_escalated } };
});
act('review', ['cmo_admin'], (g, u, b) => { allow(g, ['Submitted', 'Reopened'], 'start review of'); const f = g.status; setStatus(g, 'Under Review', b.priority ? { priority: b.priority } : {}); hist(g, 'reviewed', f, 'Under Review', u, b.remarks || "Grievance taken up for review by the Chief Minister's Office."); });
act('forward', ['cmo_admin'], (g, u, b) => {
  allow(g, ['Submitted', 'Under Review', 'Reopened', 'In Progress'], 'forward'); const d = deptById(Number(b.departmentId)) || fail(400, 'Unknown department');
  const prev = current(g.id); if (prev) { prev.is_current = false; if (prev.review_status !== 'accepted') prev.review_status = 'withdrawn'; }
  const due = new Date(Date.now() + (g.is_escalated ? Math.ceil(d.sla_days / 2) : d.sla_days) * DAY).toISOString();
  db.assignments.push({ id: nextId('a'), grievance_id: g.id, department_id: d.id, officer_id: b.officerId || null, assigned_by: u.id, instructions: b.instructions || null, is_current: true, assigned_at: now(), due_date: due, review_status: 'awaiting_atr' });
  const f = g.status; setStatus(g, 'Under Review', { department_id: d.id, due_date: due, ...(b.priority ? { priority: b.priority } : {}) });
  hist(g, prev ? 'reassigned' : 'forwarded', f, 'Under Review', u, `Forwarded to ${d.name}. Target date: ${due.slice(0, 10)}.`);
  if (b.instructions) remark(g, u, 'internal', `Instructions to department: ${b.instructions}`);
});
act('escalate', ['cmo_admin'], (g, u, b) => { allow(g, ['Submitted', 'Under Review', 'In Progress', 'Reopened'], 'escalate'); if (g.is_escalated) fail(409, 'Grievance is already escalated'); Object.assign(g, { is_escalated: true, escalated_at: now(), priority: 'High', updated_at: now() }); hist(g, 'escalated', g.status, g.status, u, `Escalated by CMO: ${b.reason}`, false); remark(g, u, 'internal', `ESCALATION: ${b.reason}`); });
act('review-atr', ['cmo_admin'], (g, u, b) => {
  const a = current(g.id); if (!a || a.review_status !== 'pending_review') fail(409, 'No action-taken report is awaiting review');
  if (b.decision === 'return' && !(b.remarks || '').trim()) fail(400, 'Validation failed', [{ field: 'remarks', message: 'Remarks are required when returning a report' }]);
  Object.assign(a, { review_status: b.decision === 'accept' ? 'accepted' : 'returned', reviewed_by: u.id, reviewed_at: now(), review_remarks: b.remarks || null });
  if (b.decision === 'accept') { const m = b.publicMessage || 'Action taken by the department has been verified by the CMO. Grievance resolved.'; setStatus(g, 'Resolved', { resolved_at: now() }); hist(g, 'resolved', 'In Progress', 'Resolved', u, m); remark(g, u, 'public', m); } else { hist(g, 'atr_returned', g.status, 'In Progress', u, `Action-taken report returned to department: ${b.remarks}`, false); setStatus(g, 'In Progress'); }
});
act('resolve', ['cmo_admin'], (g, u, b) => { allow(g, ['Submitted', 'Under Review', 'In Progress', 'Reopened'], 'resolve'); const f = g.status; setStatus(g, 'Resolved', { resolved_at: now() }); hist(g, 'resolved', f, 'Resolved', u, b.publicMessage); remark(g, u, 'public', b.publicMessage); });
act('start', ['dept_officer'], (g, u, b) => { ownsDept(g, u); allow(g, ['Under Review'], 'start investigation on'); const a = current(g.id); if (a && !a.officer_id) a.officer_id = u.id; setStatus(g, 'In Progress'); hist(g, 'investigation_started', 'Under Review', 'In Progress', u, b.remarks || 'Department has started investigating the grievance.'); });
act('progress', ['dept_officer'], (g, u, b) => { ownsDept(g, u); allow(g, ['In Progress'], 'update'); remark(g, u, b.visibility, b.remarks); hist(g, 'progress_update', g.status, g.status, u, b.remarks, b.visibility === 'public'); g.updated_at = now(); });
act('atr', ['dept_officer'], (g, u, body) => {
  ownsDept(g, u); allow(g, ['In Progress'], 'submit an action-taken report for'); const { fields, files } = fdObj(body);
  if ((fields.report || '').trim().length < 20) fail(400, 'Validation failed', [{ field: 'report', message: 'Action-taken report must be at least 20 characters' }]);
  const a = current(g.id); if (!a || !['awaiting_atr', 'returned'].includes(a.review_status)) fail(409, 'An action-taken report is already awaiting CMO review');
  const file = files[0]?.[1]; const att = file ? saveFile(g, 'atr', file) : null;
  Object.assign(a, { atr_text: fields.report, atr_attachment_id: att?.id || a.atr_attachment_id, atr_submitted_by: u.id, atr_submitted_at: now(), review_status: 'pending_review' });
  hist(g, 'atr_submitted', g.status, g.status, u, 'Department submitted its action-taken report to the CMO for verification.'); g.updated_at = now();
});
act('return', ['dept_officer'], (g, u, b) => { ownsDept(g, u); allow(g, ['Under Review', 'In Progress'], 'return'); const a = current(g.id); if (a) { a.is_current = false; a.review_status = 'withdrawn'; } const f = g.status; setStatus(g, 'Under Review', { department_id: null }); hist(g, 'returned_to_cmo', f, 'Under Review', u, `Returned to CMO by department: ${b.reason}`, false); remark(g, u, 'internal', `Returned to CMO: ${b.reason}`); });
act('reopen', ['citizen'], (g, u, b) => { allow(g, ['Resolved'], 'reopen'); if ((b.reason || '').trim().length < 10) fail(400, 'Please explain why in at least 10 characters'); const a = current(g.id); if (a) a.is_current = false; setStatus(g, 'Reopened', { resolved_at: null, reopen_count: g.reopen_count + 1, due_date: new Date(Date.now() + 15 * DAY).toISOString() }); db.feedback = db.feedback.filter((f) => f.grievance_id !== g.id); hist(g, 'reopened', 'Resolved', 'Reopened', u, `Reopened by citizen: ${b.reason}`); });
act('feedback', ['citizen'], (g, u, b) => { allow(g, ['Resolved'], 'give feedback on'); if (db.feedback.some((f) => f.grievance_id === g.id)) fail(409, 'Duplicate record'); db.feedback.push({ grievance_id: g.id, citizen_id: u.id, rating: b.rating, comments: b.comments || null, created_at: now() }); hist(g, 'feedback', g.status, g.status, u, `Citizen rated the resolution ${b.rating}/5${b.comments ? `: ${b.comments}` : ''}`, false); });
act('remarks', ['cmo_admin', 'dept_officer'], (g, u, b) => { if (u.role === 'dept_officer') ownsDept(g, u); remark(g, u, b.visibility, b.body); if (b.visibility === 'public') hist(g, 'remark', g.status, g.status, u, b.body); });
on('POST', '/grievances/:id/ai/reanalyse', ({ params }) => { const u = need('cmo_admin'); const g = getScoped(Number(params.id), u); const a = analyse(g, u.id, g.id); Object.assign(g, { ai_analysis_id: a.analysisId, ai_summary: a.summary, ai_suggested_category: a.category, ai_suggested_priority: a.priority, ai_suggested_department_id: a.department.id }); return { analysis: a }; });
on('PATCH', '/grievances/:id', ({ params, body }) => { const u = need('cmo_admin'); const g = getScoped(Number(params.id), u); const old = g.priority; Object.assign(g, body, { updated_at: now() }); hist(g, 'updated', g.status, g.status, u, `CMO updated ${body.priority ? `priority ${old} → ${body.priority}` : `category → ${body.category}`}`, false); return { ok: true }; });

on('GET', '/admin/stats', () => {
  need('cmo_admin'); const G = db.grievances; const res = (x) => x.status === 'Resolved';
  const grp = (key) => Object.values(G.reduce((m, g) => { const k = g[key]; (m[k] ||= { k, list: [] }).list.push(g); return m; }, {}));
  const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); return d; });
  const sameMonth = (iso, d) => iso && new Date(iso).getFullYear() === d.getFullYear() && new Date(iso).getMonth() === d.getMonth();
  const live = db.ai.filter((a) => a.provider !== 'sample-data');
  const withAi = G.filter((g) => g.ai_suggested_category);
  return {
    kpi: { total: G.length, pending: G.filter((g) => !res(g)).length, resolved: G.filter(res).length, overdue: G.filter(isOverdue).length, escalated: G.filter((g) => g.is_escalated && !res(g)).length, new_submissions: G.filter((g) => g.status === 'Submitted').length, unassigned: G.filter((g) => !g.department_id && !res(g)).length, last_7_days: G.filter((g) => Date.now() - new Date(g.created_at) < 7 * DAY).length, avg_resolution_days: resDays(G), atr_pending: db.assignments.filter((a) => a.is_current && a.review_status === 'pending_review').length },
    byStatus: grp('status').map(({ k, list }) => ({ status: k, count: list.length })),
    byDistrict: grp('district').map(({ k, list }) => ({ district: k, total: list.length, resolved: list.filter(res).length, pending: list.filter((g) => !res(g)).length, overdue: list.filter(isOverdue).length })).sort((a, b) => b.total - a.total),
    byDepartment: db.departments.map((d) => { const l = G.filter((g) => g.department_id === d.id); return { id: d.id, code: d.code, name: d.name, total: l.length, resolved: l.filter(res).length, pending: l.filter((g) => !res(g)).length, overdue: l.filter(isOverdue).length, avg_days: resDays(l), atr_pending: db.assignments.filter((a) => a.department_id === d.id && a.is_current && a.review_status === 'pending_review').length }; }).sort((a, b) => b.total - a.total),
    byCategory: grp('category').map(({ k, list }) => ({ category: k, count: list.length })),
    byPriority: grp('priority').map(({ k, list }) => ({ priority: k, count: list.length })),
    trend: months.map((m) => ({ month: m.toLocaleString('en', { month: 'short' }) + ' ' + String(m.getFullYear()).slice(-2), submitted: G.filter((g) => sameMonth(g.created_at, m)).length, resolved: G.filter((g) => sameMonth(g.resolved_at, m)).length })),
    ai: { analyses: live.length, live_model: 0, fallback: live.length, avg_latency_ms: 0, category_agreement_pct: withAi.length ? Math.round((100 * withAi.filter((g) => g.ai_suggested_category === g.category).length) / withAi.length) : null },
    feedback: { responses: db.feedback.length, avg_rating: db.feedback.length ? +(db.feedback.reduce((s, f) => s + f.rating, 0) / db.feedback.length).toFixed(2) : 0 },
  };
});
on('GET', '/admin/officers', ({ query: q }) => { need('cmo_admin'); return { officers: db.users.filter((u) => u.role === 'dept_officer' && (!q.departmentId || u.department_id === Number(q.departmentId))).map((u) => ({ ...u, department_name: deptById(u.department_id).name, open_cases: db.assignments.filter((a) => a.officer_id === u.id && a.is_current).length })) }; });
on('GET', '/admin/enquiries', () => { need('cmo_admin'); return { enquiries: db.enquiries }; });
on('PATCH', '/admin/enquiries/:id', ({ params, body }) => { need('cmo_admin'); const e = db.enquiries.find((x) => x.id === Number(params.id)) || fail(404, 'Enquiry not found'); e.status = body.status; return { ok: true }; });

export async function mockRequest(method, url, body) {
  await new Promise((r) => setTimeout(r, 120)); // feel like a network
  const [path, qs = ''] = url.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  for (const r of routes) {
    if (r.method !== method) continue;
    const m = path.match(r.re);
    if (m) {
      try { return { ok: true, data: JSON.parse(JSON.stringify(r.fn({ params: m.groups || {}, query, body }))) }; } catch (e) {
        if (e instanceof E) return { ok: false, status: e.status, data: { error: e.message, details: e.details } };
        console.error(e); return { ok: false, status: 500, data: { error: 'Internal error (demo)' } };
      }
    }
  }
  return { ok: false, status: 404, data: { error: 'Not found' } };
}
