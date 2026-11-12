// Reference data shared by API validation, AI prompting and the seed script.

const DISTRICTS = [
  { code: 'TVM', name: 'Thiruvananthapuram' }, { code: 'KLM', name: 'Kollam' },
  { code: 'PTA', name: 'Pathanamthitta' },     { code: 'ALP', name: 'Alappuzha' },
  { code: 'KTM', name: 'Kottayam' },           { code: 'IDK', name: 'Idukki' },
  { code: 'EKM', name: 'Ernakulam' },          { code: 'TSR', name: 'Thrissur' },
  { code: 'PKD', name: 'Palakkad' },           { code: 'MLP', name: 'Malappuram' },
  { code: 'KKD', name: 'Kozhikode' },          { code: 'WYD', name: 'Wayanad' },
  { code: 'KNR', name: 'Kannur' },             { code: 'KSD', name: 'Kasaragod' },
];

const CATEGORIES = [
  'Roads & Infrastructure', 'Water Supply', 'Electricity', 'Healthcare', 'Education',
  'Revenue & Land Records', 'Police & Public Safety', 'Social Welfare & Pensions',
  'Agriculture', 'Sanitation & Local Bodies', 'Public Transport', 'Ration & Civil Supplies',
  'Environment & Forest', 'Other',
];

const STATUSES = ['Submitted', 'Under Review', 'In Progress', 'Resolved', 'Reopened'];
const PRIORITIES = ['Low', 'Medium', 'High'];
const ROLES = ['citizen', 'cmo_admin', 'dept_officer'];

const districtByName = new Map(DISTRICTS.map((d) => [d.name, d]));

module.exports = { DISTRICTS, CATEGORIES, STATUSES, PRIORITIES, ROLES, districtByName };
