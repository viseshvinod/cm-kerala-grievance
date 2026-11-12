/* eslint-disable no-await-in-loop */
/**
 * Seeds FICTIONAL sample data for demonstration. No real citizens, officers or grievances.
 * Run: npm run seed          (only if empty)
 *      npm run seed -- --reset   (drop all data and reseed)
 */
const bcrypt = require('bcryptjs');
const { pool, withTransaction } = require('./pool');
const { migrate } = require('./migrate');
const { DISTRICTS } = require('../constants');
const { generateReference } = require('../services/reference');

const DAY = 86400000;

const DEPARTMENTS = [
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
  ['PWD', 'Roads & Infrastructure', 'Medium', 'Road resurfacing work abandoned halfway', 'Resurfacing of the 2 km stretch connecting our ward to the town was started four months ago but the contractor has left after removing the old tar. The road is now full of loose gravel and dust, causing difficulty for residents and autorickshaws.'],
  ['PWD', 'Roads & Infrastructure', 'High', 'Culvert damaged after heavy rain', 'The culvert near the junction cracked during last week\'s heavy rain and a portion has caved in. Heavy vehicles still use it. It could collapse completely and cut off access for nearly 200 families.'],
  ['WRD', 'Water Supply', 'High', 'No drinking water supply for 12 days', 'Our area has not received piped drinking water for the last 12 days. Many elderly residents depend entirely on the tap connection. We have complained at the local section office but no tanker or repair has been arranged.'],
  ['WRD', 'Water Supply', 'Medium', 'Pipeline leak wasting water on roadside', 'A major pipeline has been leaking near the bus stop for three weeks. Thousands of litres of water are wasted daily and the road is getting damaged. Low pressure in houses at the end of the line.'],
  ['WRD', 'Water Supply', 'High', 'Muddy and foul-smelling tap water', 'The tap water supplied in our colony for the past week is brown and has a bad smell. Several children have stomach problems. Please test the water quality and fix the source urgently.'],
  ['PWR', 'Electricity', 'Medium', 'Frequent power cuts every evening', 'There are power cuts of 2-3 hours almost every evening in our locality for the last month. Students are unable to study and small shops are losing business. Voltage is also very low when supply returns.'],
  ['PWR', 'Electricity', 'High', 'Electric post leaning dangerously over footpath', 'An electric post near the market is leaning badly after a vehicle hit it and the lines are hanging low over the footpath. This is very dangerous for pedestrians, especially during rain.'],
  ['PWR', 'Electricity', 'Low', 'Incorrect electricity bill amount', 'My bi-monthly electricity bill shows an amount almost four times higher than usual though consumption has not changed. Meter reading seems to be wrongly entered. Request correction of the bill.'],
  ['HFW', 'Healthcare', 'High', 'No doctor available at primary health centre at night', 'The primary health centre in our panchayat has had no doctor on night duty for the past month. Last week a patient with chest pain had to be taken 25 km to the taluk hospital. Please ensure night duty staff.'],
  ['HFW', 'Healthcare', 'Medium', 'Essential medicines out of stock at taluk hospital', 'Diabetes and blood pressure medicines have been out of stock at the taluk hospital pharmacy for three weeks. Poor patients are forced to buy from private medical shops.'],
  ['HFW', 'Healthcare', 'Medium', 'Ambulance service not responding', 'Called the ambulance helpline twice for my elderly father but no ambulance came for over an hour. Finally took a private taxi. Please look into the availability of ambulances in our area.'],
  ['GED', 'Education', 'Medium', 'School building roof leaking in classrooms', 'The roof of the government UP school leaks in three classrooms. Students are being shifted to the verandah during rain. Request repair of the roof before the monsoon intensifies.'],
  ['GED', 'Education', 'Low', 'Scholarship amount not credited', 'My daughter was selected for the merit scholarship last academic year but the amount has not been credited yet. The school says it is pending at the district office.'],
  ['GED', 'Education', 'Medium', 'Shortage of teachers in higher secondary school', 'Our government higher secondary school has no permanent mathematics and physics teachers since the beginning of the year. Students preparing for board exams are severely affected.'],
  ['REV', 'Revenue & Land Records', 'Low', 'Land mutation application pending for eight months', 'I applied for mutation of land inherited from my late father eight months ago at the village office. Despite multiple visits, the application is still pending without any reason given.'],
  ['REV', 'Revenue & Land Records', 'Medium', 'Flood relief assistance not received', 'My house was damaged in the floods and the assessment was completed, but the relief assistance has not been received even after six months.'],
  ['HOM', 'Police & Public Safety', 'High', 'Drug peddling near college campus', 'Students report that drugs are being sold openly near the college bus stop in the evenings. Parents are very worried. Request regular police patrolling in the area.'],
  ['HOM', 'Police & Public Safety', 'Medium', 'Complaint at police station not acted upon', 'I filed a complaint about a mobile phone theft at the local station a month ago but have not received any update or receipt number. Request follow-up.'],
  ['SJD', 'Social Welfare & Pensions', 'High', 'Widow pension stopped without notice', 'My widowed mother, aged 72, has not received her welfare pension for five months. She has no other income. The panchayat office says there is a technical issue with Aadhaar linking.'],
  ['SJD', 'Social Welfare & Pensions', 'Medium', 'Disability certificate renewal delayed', 'My son has 60% locomotor disability. The renewal of his disability certificate is pending for four months and his benefits are stopped as a result.'],
  ['AGR', 'Agriculture', 'Medium', 'Crop insurance claim not settled', 'My paddy crop was destroyed by unseasonal rain and I submitted the crop insurance claim with photographs through the Krishi Bhavan. The claim has not been settled after five months.'],
  ['AGR', 'Agriculture', 'Low', 'Subsidised fertiliser not available at Krishi Bhavan', 'Subsidised fertiliser is unavailable at our Krishi Bhavan during the sowing season. Farmers are forced to buy at higher prices from private dealers.'],
  ['LSG', 'Sanitation & Local Bodies', 'Medium', 'Garbage not collected for two weeks', 'Household waste has not been collected in our ward for over two weeks. Waste is piling up by the roadside and stray dogs are scattering it. There is a risk of disease outbreak.'],
  ['LSG', 'Sanitation & Local Bodies', 'High', 'Sewage overflowing into residential lane', 'The drainage near our lane is blocked and sewage is overflowing onto the road and into compounds. Mosquito breeding has increased and two people in the lane have dengue.'],
  ['TRN', 'Public Transport', 'Low', 'Bus service on rural route cancelled', 'The only state transport bus service on our rural route was cancelled two months ago. Students and daily workers now have to walk 4 km to the main road.'],
  ['TRN', 'Public Transport', 'Low', 'Driving licence not received after test', 'I passed my driving test six weeks ago but the licence card has not been delivered. The RTO office asks me to wait without giving any status.'],
  ['FCS', 'Ration & Civil Supplies', 'Medium', 'Ration shop not distributing full quota', 'The ration shop in our area gives less rice than our entitled quota and often says stock is over. Many families below the poverty line are affected.'],
  ['FCS', 'Ration & Civil Supplies', 'Low', 'Ration card correction pending', 'I applied online to add my newborn child\'s name to the ration card three months ago. Application status still shows pending verification.'],
  ['FOR', 'Environment & Forest', 'High', 'Wild elephants entering farmland at night', 'A herd of wild elephants has been entering our farmland near the forest border almost every night, destroying banana and coconut crops. Residents are afraid to go out after dark. Request solar fencing and rapid response team.'],
  ['FOR', 'Environment & Forest', 'Medium', 'Illegal sand mining from river bank', 'Illegal sand mining is happening at night from the river bank near the temple ghat. The bank is eroding and nearby houses are at risk.'],
  ['GAD', 'Other', 'Low', 'Suggestion for online appointment at government offices', 'I would like to suggest an online token system for appointments at village and taluk offices to reduce long queues, especially for senior citizens.'],
];

const CITIZENS = [
  ['Anjali Menon', 'citizen@cmkportal.test', '9847000001'],
  ['Rahul Nair', 'rahul.nair@cmkportal.test', '9847000002'],
  ['Fathima Beevi', 'fathima.b@cmkportal.test', '9847000003'],
  ['Joseph Varghese', 'joseph.v@cmkportal.test', '9847000004'],
  ['Lakshmi Pillai', 'lakshmi.p@cmkportal.test', '9847000005'],
  ['Mohammed Ashraf', 'ashraf.m@cmkportal.test', '9847000006'],
  ['Sreeja Krishnan', 'sreeja.k@cmkportal.test', '9847000007'],
  ['Thomas Kurian', 'thomas.k@cmkportal.test', '9847000008'],
];

// Deterministic PRNG so the demo data is identical on every deploy.
let seed = 20261112;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

async function hasData() {
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM departments');
  return rows[0].n > 0;
}

async function reset() {
  await pool.query(`TRUNCATE feedback, remarks, department_assignments, attachments, grievance_history, ai_analyses,
                    grievances, contact_enquiries, users, departments RESTART IDENTITY CASCADE`);
}

async function seedAll() {
  await withTransaction(async (c) => {
    const depts = {};
    for (const [code, name, description, icon, categories, sla, featured] of DEPARTMENTS) {
      const { rows } = await c.query(
        `INSERT INTO departments (code, name, description, icon, categories, sla_days, is_featured)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, sla_days`,
        [code, name, description, icon, categories, sla, featured],
      );
      depts[code] = rows[0];
    }

    const hash = (p) => bcrypt.hashSync(p, 10);
    const adminHash = hash('Admin@123');
    const officerHash = hash('Officer@123');
    const citizenHash = hash('Citizen@123');

    const admins = [];
    for (const [name, email, designation] of [
      ['Priya Raghavan', 'admin@cmkportal.test', 'Grievance Cell Officer, CMO'],
      ['Arun Das', 'cmo.reviewer@cmkportal.test', 'Additional Secretary (Grievances), CMO'],
    ]) {
      const { rows } = await c.query(
        "INSERT INTO users (name, email, mobile, password_hash, role, designation) VALUES ($1,$2,'9400000000',$3,'cmo_admin',$4) RETURNING id, role",
        [name, email, adminHash, designation],
      );
      admins.push(rows[0]);
    }

    const officers = {};
    const officerNames = ['Suresh Kumar', 'Deepa Mohan', 'Vinod Chandran', 'Asha Thomas', 'Bijoy Mathew', 'Nisha Rajan', 'Hari Prasad',
      'Reshma Nair', 'Manoj Paul', 'Shalini George', 'Ajith Kumar', 'Remya Suresh', 'Gopakumar V', 'Divya Sasi'];
    let i = 0;
    for (const code of Object.keys(depts)) {
      const { rows } = await c.query(
        `INSERT INTO users (name, email, mobile, password_hash, role, department_id, designation)
         VALUES ($1,$2,$3,$4,'dept_officer',$5,$6) RETURNING id, role, department_id`,
        [officerNames[i], `${code.toLowerCase()}.officer@cmkportal.test`, `94000000${String(i + 10).padStart(2, '0')}`,
          officerHash, depts[code].id, `Nodal Grievance Officer, ${depts[code].name}`],
      );
      officers[code] = rows[0];
      i += 1;
    }

    const citizens = [];
    for (const [name, email, mobile] of CITIZENS) {
      const { rows } = await c.query(
        "INSERT INTO users (name, email, mobile, password_hash, role) VALUES ($1,$2,$3,$4,'citizen') RETURNING id, role",
        [name, email, mobile, citizenHash],
      );
      citizens.push(rows[0]);
    }

    const now = Date.now();
    const total = 56;
    // stage: 0 submitted,1 reviewed,2 forwarded,3 in progress,4 ATR pending,5 resolved,6 resolved+feedback,7 reopened, 8 ATR returned
    const stagePlan = [0, 0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 6, 6, 6, 6, 6, 6, 7, 8];

    for (let n = 0; n < total; n += 1) {
      const [deptCode, category, priority, subject, description] = TEMPLATES[n % TEMPLATES.length];
      const district = pick(DISTRICTS).name;
      const citizen = n < 6 ? citizens[0] : pick(citizens);
      const stage = n < 6 ? [0, 3, 4, 6, 5, 2][n] : pick(stagePlan);
      const ageDays = stage === 0 ? rand() * 6 : [5, 6, 7].includes(stage) ? 8 + rand() * 170 : 3 + rand() * (rand() < 0.35 ? 60 : 14);
      let t = now - ageDays * DAY;
      const step = () => { t = Math.min(now - 3600000, t + (0.2 + rand() * Math.min(3, Math.max(0.5, ageDays / 10))) * DAY); return new Date(t); };
      const created = new Date(t);
      const dept = depts[deptCode];
      const officer = officers[deptCode];
      const admin = pick(admins);
      const aiPriority = rand() < 0.85 ? priority : 'Medium';
      const ref = generateReference(district, created);

      const { rows: aRows } = await c.query(
        `INSERT INTO ai_analyses (requested_by, input_hash, provider, model, is_fallback, result, latency_ms, created_at)
         VALUES ($1, md5($2) || md5($2), 'sample-data', NULL, FALSE, $3, NULL, $4) RETURNING id`,
        [citizen.id, description, { category, department_code: deptCode, priority: aiPriority, summary: `${subject}. ${description.split('. ')[0]}.`, rationale: 'Sample data', keywords: [], confidence: 0.8 }, created],
      );

      const { rows: gRows } = await c.query(
        `INSERT INTO grievances (reference_no, citizen_id, district, category, subject, description, priority, status, due_date,
                                 ai_analysis_id, ai_summary, ai_suggested_category, ai_suggested_priority, ai_suggested_department_id,
                                 ai_category_accepted, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,'Medium','Submitted',$7,$8,$9,$4,$10,$11,TRUE,$12,$12) RETURNING id`,
        [ref, citizen.id, district, category, subject, description, new Date(created.getTime() + 15 * DAY), aRows[0].id,
          `${subject}. ${description.split('. ')[0]}.`, aiPriority, dept.id, created],
      );
      const gid = gRows[0].id;
      await c.query('UPDATE ai_analyses SET grievance_id = $1 WHERE id = $2', [gid, aRows[0].id]);

      const hist = async (action, from, to, actor, remarks, at, isPublic = true) => c.query(
        `INSERT INTO grievance_history (grievance_id, action, from_status, to_status, remarks, is_public, actor_id, actor_role, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [gid, action, from, to, remarks, isPublic, actor?.id || null, actor?.role || null, at],
      );
      const remark = async (actor, visibility, body, at) => c.query(
        'INSERT INTO remarks (grievance_id, author_id, author_role, visibility, body, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [gid, actor.id, actor.role, visibility, body, at],
      );

      await hist('submitted', null, 'Submitted', citizen, `Grievance submitted online. Reference ${ref} generated.`, created);
      let status = 'Submitted';
      const upd = {};

      if (stage >= 1) {
        const at = step();
        await hist('reviewed', 'Submitted', 'Under Review', admin, "Grievance taken up for review by the Chief Minister's Office.", at);
        status = 'Under Review'; upd.priority = priority;
      }
      let assignmentId;
      if (stage >= 2) {
        const at = step();
        const due = new Date(at.getTime() + dept.sla_days * DAY);
        const { rows } = await c.query(
          `INSERT INTO department_assignments (grievance_id, department_id, officer_id, assigned_by, instructions, assigned_at, due_date)
           VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
          [gid, dept.id, officer.id, admin.id, 'Please verify on site and submit an action-taken report within the SLA.', at, due],
        );
        assignmentId = rows[0].id;
        await hist('forwarded', 'Under Review', 'Under Review', admin, `Forwarded to ${dept.name}. Target date: ${due.toISOString().slice(0, 10)}.`, at);
        upd.department_id = dept.id; upd.due_date = due;
      }
      if (stage >= 3) {
        const at = step();
        await hist('investigation_started', 'Under Review', 'In Progress', officer, 'Department has started investigating the grievance.', at);
        const at2 = step();
        const msg = 'Site inspection completed by the field team. Work order is being prepared.';
        await remark(officer, 'public', msg, at2);
        await hist('progress_update', 'In Progress', 'In Progress', officer, msg, at2);
        status = 'In Progress';
      }
      if (stage >= 4) {
        const at = step();
        const atr = `Field inspection carried out. The issue reported ("${subject.toLowerCase()}") has been verified and corrective action completed by the concerned section. Photographs and completion certificate kept on file.`;
        await c.query(
          "UPDATE department_assignments SET atr_text = $2, atr_submitted_by = $3, atr_submitted_at = $4, review_status = 'pending_review' WHERE id = $1",
          [assignmentId, atr, officer.id, at],
        );
        await hist('atr_submitted', 'In Progress', 'In Progress', officer, 'Department submitted its action-taken report to the CMO for verification.', at);
      }
      if (stage === 8) {
        const at = step();
        await c.query("UPDATE department_assignments SET review_status = 'returned', reviewed_by = $2, reviewed_at = $3, review_remarks = $4 WHERE id = $1",
          [assignmentId, admin.id, at, 'Please attach photographs of completed work and confirm with the complainant.']);
        await hist('atr_returned', 'In Progress', 'In Progress', admin, 'Action-taken report returned to department: please attach evidence of completed work.', at, false);
      }
      if (stage >= 5 && stage <= 7) {
        const at = step();
        await c.query("UPDATE department_assignments SET review_status = 'accepted', reviewed_by = $2, reviewed_at = $3, review_remarks = 'Verified.' WHERE id = $1", [assignmentId, admin.id, at]);
        const msg = 'The department has completed the required action and the CMO has verified the report. Your grievance is resolved.';
        await hist('resolved', 'In Progress', 'Resolved', admin, msg, at);
        await remark(admin, 'public', msg, at);
        status = 'Resolved'; upd.resolved_at = at;
        if (stage === 6) {
          const rating = pick([5, 5, 4, 4, 4, 3]);
          await c.query('INSERT INTO feedback (grievance_id, citizen_id, rating, comments, created_at) VALUES ($1,$2,$3,$4,$5)',
            [gid, citizen.id, rating, rating >= 4 ? 'Issue was fixed. Thank you for the quick action.' : 'Resolved, but took longer than expected.', step()]);
        }
        if (stage === 7) {
          const at2 = step();
          await c.query('UPDATE department_assignments SET is_current = FALSE WHERE id = $1', [assignmentId]);
          await hist('reopened', 'Resolved', 'Reopened', citizen, 'Reopened by citizen: The problem has started again within a week of the repair.', at2);
          status = 'Reopened'; upd.resolved_at = null; upd.reopen_count = 1;
          upd.due_date = new Date(at2.getTime() + 15 * DAY);
        }
      }
      if (n % 9 === 4 && status !== 'Resolved') {
        const at = step();
        await c.query('UPDATE grievances SET is_escalated = TRUE, escalated_at = $2 WHERE id = $1', [gid, at]);
        await hist('escalated', status, status, admin, 'Escalated by CMO: SLA breached, department to prioritise.', at, false);
        upd.priority = 'High';
      }
      const sets = ['status = $2', 'updated_at = $3'];
      const vals = [gid, status, new Date(t)];
      for (const [k, v] of Object.entries(upd)) { vals.push(v); sets.push(`${k} = $${vals.length}`); }
      await c.query(`UPDATE grievances SET ${sets.join(', ')} WHERE id = $1`, vals);
    }

    await c.query(
      `INSERT INTO contact_enquiries (name, email, subject, message, status, created_at) VALUES
        ('Kiran Babu', 'kiran.b@example.com', 'Unable to upload PDF', 'I am getting an error while attaching a 7 MB scanned PDF to my grievance. What is the size limit?', 'new', now() - interval '2 days'),
        ('Meera Iyer', 'meera.i@example.com', 'Language support', 'Will the portal support Malayalam in the future? My parents are not comfortable with English.', 'read', now() - interval '5 days')`,
    );
  });
}

async function seedIfEmpty() {
  if (await hasData()) return false;
  await seedAll();
  console.log('Seeded fictional demo data');
  return true;
}

module.exports = { seedIfEmpty, seedAll, reset };

if (require.main === module) {
  (async () => {
    await migrate();
    if (process.argv.includes('--reset')) { await reset(); await seedAll(); console.log('Database reset and reseeded'); } else if (!(await seedIfEmpty())) console.log('Data already present; use --reset to reseed');
    await pool.end();
  })().catch((e) => { console.error(e); process.exit(1); });
}
