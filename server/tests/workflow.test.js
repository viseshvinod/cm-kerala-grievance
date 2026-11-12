const request = require('supertest');
const app = require('../src/app');
const { pool } = require('../src/db/pool');
const { migrate } = require('../src/db/migrate');
const { reset, seedAll } = require('../src/db/seed');

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex');

const login = async (email, password) => {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });
  expect(res.status).toBe(200);
  return agent;
};

beforeAll(async () => { await migrate(); await reset(); await seedAll(); });
afterAll(async () => { await pool.end(); });

describe('public API', () => {
  test('departments, stats and contact form', async () => {
    const d = await request(app).get('/api/departments');
    expect(d.status).toBe(200);
    expect(d.body.departments.length).toBeGreaterThanOrEqual(10);
    const s = await request(app).get('/api/stats/public');
    expect(s.body.total).toBeGreaterThan(0);
    const c = await request(app).post('/api/contact').send({ name: 'Test User', email: 't@example.com', subject: 'Hello', message: 'This is a test enquiry message.' });
    expect(c.status).toBe(201);
    const bad = await request(app).post('/api/contact').send({ name: 'x', email: 'nope' });
    expect(bad.status).toBe(400);
  });
});

describe('authentication & RBAC', () => {
  test('register validates input and rejects duplicates', async () => {
    const weak = await request(app).post('/api/auth/register').send({ name: 'A B', email: 'new@cmkportal.test', mobile: '123', password: 'short' });
    expect(weak.status).toBe(400);
    const ok = await request(app).post('/api/auth/register').send({ name: 'New Citizen', email: 'new@cmkportal.test', mobile: '9876543210', password: 'Passw0rd!' });
    expect(ok.status).toBe(201);
    expect(ok.body.user.role).toBe('citizen');
    const dup = await request(app).post('/api/auth/register').send({ name: 'New Citizen', email: 'NEW@cmkportal.test', mobile: '9876543210', password: 'Passw0rd!' });
    expect(dup.status).toBe(409);
  });
  test('wrong password and anonymous access are rejected', async () => {
    expect((await request(app).post('/api/auth/login').send({ email: 'admin@cmkportal.test', password: 'wrong' })).status).toBe(401);
    expect((await request(app).get('/api/grievances')).status).toBe(401);
  });
  test('citizens cannot reach CMO endpoints', async () => {
    const citizen = await login('citizen@cmkportal.test', 'Citizen@123');
    expect((await citizen.get('/api/admin/stats')).status).toBe(403);
  });
});

describe('end-to-end grievance workflow', () => {
  let citizen; let admin; let officer; let other; let id; let ref; let waterDeptId;

  beforeAll(async () => {
    citizen = await login('citizen@cmkportal.test', 'Citizen@123');
    admin = await login('admin@cmkportal.test', 'Admin@123');
    officer = await login('wrd.officer@cmkportal.test', 'Officer@123');
    other = await login('pwd.officer@cmkportal.test', 'Officer@123');
    const d = await request(app).get('/api/departments');
    waterDeptId = d.body.departments.find((x) => x.code === 'WRD').id;
  });

  test('AI assistant returns reviewable suggestions', async () => {
    const res = await citizen.post('/api/ai/analyze').send({
      subject: 'No drinking water', district: 'Kollam',
      description: 'There has been no drinking water from the tap in our colony for 10 days. Elderly residents are suffering.',
    });
    expect(res.status).toBe(200);
    expect(res.body.analysis).toMatchObject({ category: 'Water Supply', priority: 'High', isFallback: true });
    expect(res.body.analysis.department.code).toBe('WRD');
  });

  test('citizen submits a grievance with an attachment and gets a reference', async () => {
    const res = await citizen.post('/api/grievances')
      .field('district', 'Kollam').field('category', 'Water Supply')
      .field('subject', 'No drinking water for 10 days')
      .field('description', 'There has been no drinking water from the tap in our colony for 10 days. Elderly residents are suffering.')
      .attach('attachments', PNG, { filename: 'photo.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    ({ id, reference_no: ref } = res.body.grievance);
    expect(ref).toMatch(/^CMK-\d{2}-KLM-/);
    expect(res.body.grievance.attachments).toHaveLength(1);
  });

  test('spoofed file types are rejected', async () => {
    const res = await citizen.post('/api/grievances')
      .field('district', 'Kollam').field('category', 'Water Supply').field('subject', 'Bad file test')
      .field('description', 'This upload claims to be a PNG but it is actually plain text content.')
      .attach('attachments', Buffer.from('MZ not really a png'), { filename: 'evil.png', contentType: 'image/png' });
    expect(res.status).toBe(415);
  });

  test('public tracker shows status without personal data', async () => {
    const res = await request(app).get(`/api/track/${ref}`);
    expect(res.status).toBe(200);
    expect(res.body.grievance.status).toBe('Submitted');
    expect(JSON.stringify(res.body)).not.toMatch(/citizen@cmkportal/);
  });

  test('officer cannot act before assignment; other department cannot see it', async () => {
    expect((await officer.post(`/api/grievances/${id}/start`).send({})).status).toBe(403);
  });

  test('CMO reviews and forwards to department', async () => {
    expect((await admin.post(`/api/grievances/${id}/review`).send({ priority: 'High' })).body.grievance.status).toBe('Under Review');
    const fwd = await admin.post(`/api/grievances/${id}/forward`).send({ departmentId: waterDeptId, instructions: 'Restore supply and report.' });
    expect(fwd.status).toBe(200);
    expect(fwd.body.grievance.department_id).toBe(waterDeptId);
    expect((await other.get(`/api/grievances/${id}`)).status).toBe(404);
  });

  test('citizen cannot jump the workflow', async () => {
    expect((await citizen.post(`/api/grievances/${id}/review-atr`).send({ decision: 'accept' })).status).toBe(403);
    expect((await citizen.post(`/api/grievances/${id}/feedback`).send({ rating: 5 })).status).toBe(409);
  });

  test('officer investigates, updates and submits an ATR', async () => {
    expect((await officer.post(`/api/grievances/${id}/start`).send({})).body.grievance.status).toBe('In Progress');
    expect((await officer.post(`/api/grievances/${id}/progress`).send({ remarks: 'Pump motor replaced at the overhead tank.', visibility: 'public' })).status).toBe(200);
    const atr = await officer.post(`/api/grievances/${id}/atr`)
      .field('report', 'Pump motor replaced, supply restored on all lines. Verified with residents.')
      .attach('attachment', PNG, { filename: 'atr.png', contentType: 'image/png' });
    expect(atr.status).toBe(200);
    expect((await officer.post(`/api/grievances/${id}/atr`).field('report', 'Second report should not be allowed now.')).status).toBe(409);
  });

  test('CMO returns, officer resubmits, CMO accepts → Resolved', async () => {
    expect((await admin.post(`/api/grievances/${id}/review-atr`).send({ decision: 'return' })).status).toBe(400); // remarks required
    expect((await admin.post(`/api/grievances/${id}/review-atr`).send({ decision: 'return', remarks: 'Please attach meter reading.' })).status).toBe(200);
    expect((await officer.post(`/api/grievances/${id}/atr`).field('report', 'Meter reading attached; supply normal for 3 days.')).status).toBe(200);
    const ok = await admin.post(`/api/grievances/${id}/review-atr`).send({ decision: 'accept', publicMessage: 'Water supply has been restored.' });
    expect(ok.body.grievance.status).toBe('Resolved');
  });

  test('citizen sees public remarks but not internal ones, can reopen, and history is complete', async () => {
    const detail = await citizen.get(`/api/grievances/${id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.remarks.every((r) => r.visibility === 'public')).toBe(true);
    expect(detail.body.attachments.every((a) => a.kind === 'evidence')).toBe(true);
    const fileRes = await citizen.get(`/api/grievances/${id}/attachments/${detail.body.attachments[0].id}`);
    expect(fileRes.status).toBe(200);
    expect(fileRes.headers['content-type']).toMatch(/image\/png/);

    expect((await citizen.post(`/api/grievances/${id}/reopen`).send({ reason: 'Supply stopped again after two days.' })).body.grievance.status).toBe('Reopened');

    const staffView = await admin.get(`/api/grievances/${id}`);
    const actions = staffView.body.history.map((h) => h.action);
    expect(actions).toEqual(['submitted', 'reviewed', 'forwarded', 'investigation_started', 'progress_update', 'atr_submitted', 'atr_returned', 'atr_submitted', 'resolved', 'reopened']);
    expect(staffView.body.history.every((h) => h.created_at && h.actor_role)).toBe(true);
  });

  test('reopened grievance can be re-forwarded, resolved and rated', async () => {
    await admin.post(`/api/grievances/${id}/escalate`).send({ reason: 'Repeat complaint' }).expect(200);
    await admin.post(`/api/grievances/${id}/forward`).send({ departmentId: waterDeptId }).expect(200);
    await officer.post(`/api/grievances/${id}/start`).send({}).expect(200);
    await officer.post(`/api/grievances/${id}/atr`).field('report', 'Permanent fix: new pipeline laid on the affected stretch.').expect(200);
    await admin.post(`/api/grievances/${id}/review-atr`).send({ decision: 'accept' }).expect(200);
    await citizen.post(`/api/grievances/${id}/feedback`).send({ rating: 4, comments: 'Fixed now' }).expect(200);
    expect((await citizen.post(`/api/grievances/${id}/feedback`).send({ rating: 4 })).status).toBe(409);
  });

  test('CMO dashboard statistics and filters reflect stored data', async () => {
    const s = await admin.get('/api/admin/stats');
    expect(s.status).toBe(200);
    expect(s.body.kpi.total).toBeGreaterThan(50);
    expect(s.body.byDistrict.length).toBeGreaterThan(0);
    expect(s.body.trend).toHaveLength(6);
    const f = await admin.get('/api/grievances?district=Kollam&status=Resolved&category=Water%20Supply');
    expect(f.body.items.some((g) => g.id === id)).toBe(true);
    const o = await admin.get('/api/grievances?overdue=true');
    expect(o.status).toBe(200);
  });
});
