import { IS_DEMO } from './env.js';
/* Dates are live: today in the viewer's timezone */
const _now = new Date();
const TOD = Date.UTC(_now.getFullYear(), _now.getMonth(), _now.getDate()), DAY = 864e5;
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WDL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const pd = iso => { if (!iso) return 0; const [a,b,c] = iso.split('-').map(Number); return Date.UTC(a, b-1, c); };
const fmt = iso => { if (!iso) return '–'; const [a,b,c] = iso.split('-').map(Number); return c + ' ' + MON[b-1] + ' ' + a; };
const fmtDM = iso => { if (!iso) return '–'; const [,b,c] = iso.split('-').map(Number); return c + ' ' + MON[b-1]; };
const fmtDay = t => { const d = new Date(t); return WD[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
const nextOcc = iso => {
  if (!iso) return { days: 99999, t: 0, year: 0 };
  const [y,m,d] = iso.split('-').map(Number);
  let yr = new Date(TOD).getUTCFullYear(), t = Date.UTC(yr, m-1, d);
  if (t < TOD) { yr++; t = Date.UTC(yr, m-1, d); }
  return { days: Math.round((t - TOD) / DAY), t, year: yr };
};
const rel = n => n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : 'In ' + n + ' days';
const ago = iso => {
  const d = Math.round((TOD - pd(iso)) / DAY);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 14) return d + ' days ago';
  if (d < 60) return Math.round(d / 7) + ' weeks ago';
  return Math.round(d / 30) + ' months ago';
};
const tenure = join => {
  if (!join) return { total: 0, yrs: 0, mos: 0, days: 0 };
  const [y,m,d] = join.split('-').map(Number);
  const n = new Date(TOD);
  const total = (n.getUTCFullYear() - y) * 12 + (n.getUTCMonth() + 1 - m) - (n.getUTCDate() < d ? 1 : 0);
  return { total, yrs: Math.floor(total / 12), mos: total % 12, days: Math.round((TOD - pd(join)) / DAY) };
};
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const tenureText = join => {
  if (!join) return '–';
  const t = tenure(join);
  if (t.yrs > 0) return plural(t.yrs, 'year') + (t.mos ? ' ' + plural(t.mos, 'month') : '');
  if (t.mos > 0) return plural(t.mos, 'month');
  return plural(t.days, 'day');
};
const range = (a, b) => {
  if (a === b) return fmtDM(a);
  const [,m1,d1] = a.split('-').map(Number), [,m2,d2] = b.split('-').map(Number);
  return m1 === m2 ? d1 + '–' + d2 + ' ' + MON[m1-1] : fmtDM(a) + ' – ' + fmtDM(b);
};
const addMonths = (iso, n) => {
  if (!iso) return '';
  const [y,m,d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m-1+n, d));
  return t.getUTCFullYear() + '-' + String(t.getUTCMonth()+1).padStart(2,'0') + '-' + String(t.getUTCDate()).padStart(2,'0');
};

/* ---------- People ---------- */
// n, name, gender, role, department, joined, born, status, manager n, city
const RAW = IS_DEMO ? [
[1,'Aarav Menon','m','Founder & Creative Director','Creative','2014-04-07','1983-03-14','Full-time',0,'Chennai'],
[2,'Meera Iyer','f','Head of People & Operations','People & Ops','2017-06-12','1988-11-02','Full-time',1,'Bengaluru'],
[3,'Rohan Kapoor','m','Design Director','Design','2016-02-01','1985-07-23','Full-time',1,'Mumbai'],
[4,'Ananya Krishnan','f','Head of Strategy','Strategy','2018-09-03','1990-10-21','Full-time',1,'Chennai'],
[5,'Vikram Nair','m','Head of Technology','Engineering','2017-01-16','1987-12-09','Full-time',1,'Kochi'],
[6,'Kavya Reddy','f','Head of Motion','Motion','2019-03-18','1991-05-30','Full-time',1,'Hyderabad'],
[7,'Imran Sheikh','m','Head of Production','Production','2018-11-05','1986-10-24','Full-time',1,'Pune'],
[8,'Priya Raman','f','Client Partnerships Lead','Client Services','2019-08-26','1989-08-14','Full-time',1,'Delhi NCR'],
[9,'Dev Malhotra','m','Senior Designer','Design','2020-10-21','1992-04-18','Full-time',3,'Delhi NCR'],
[10,'Sneha Pillai','f','Brand Designer','Design','2021-07-12','1994-10-23','Full-time',3,'Kochi'],
[11,'Arjun Bhat','m','Art Director','Creative','2019-05-20','1990-01-27','Full-time',1,'Bengaluru'],
[12,'Tara Fernandes','f','Copywriter','Creative','2022-01-10','1995-09-09','Full-time',11,'Goa'],
[13,'Nikhil Joshi','m','Motion Designer','Motion','2021-10-25','1993-06-06','Full-time',6,'Pune'],
[14,'Zara Qureshi','f','3D Artist','Motion','2023-04-03','1996-02-12','Full-time',6,'Mumbai'],
[15,'Harish Subramanian','m','Frontend Developer','Engineering','2022-08-08','1994-11-15','Full-time',5,'Coimbatore'],
[16,'Lakshmi Narayanan','f','Full-stack Developer','Engineering','2023-11-20','1997-03-03','Full-time',5,'Chennai'],
[17,'Aditya Rao','m','UX Designer','Design','2022-03-14','1993-12-28','Full-time',3,'Bengaluru'],
[18,'Ishita Banerjee','f','UI Designer','Design','2024-02-05','1998-10-29','Full-time',3,'Kolkata'],
[19,'Siddharth Verma','m','Producer','Production','2020-06-01','1991-07-17','Full-time',7,'Mumbai'],
[20,'Mira Thomas','f','Project Manager','Production','2021-09-13','1992-11-04','Full-time',7,'Kochi'],
[21,'Karthik Sundaram','m','Strategist','Strategy','2022-10-31','1994-02-20','Full-time',4,'Chennai'],
[22,'Nandini Das','f','Research Lead','Strategy','2020-01-27','1990-08-08','Full-time',4,'Kolkata'],
[23,'Rahul Chawla','m','Account Manager','Client Services','2021-04-19','1990-05-05','Full-time',8,'Delhi NCR'],
[24,'Pooja Mehta','f','Account Executive','Client Services','2024-06-17','1998-12-01','Full-time',8,'Ahmedabad'],
[25,'Faisal Ahmed','m','Illustrator','Creative','2023-01-23','1995-10-20','Full-time',11,'Hyderabad'],
[26,'Diya Kulkarni','f','HR Associate','People & Ops','2023-07-10','1996-04-22','Full-time',2,'Pune'],
[27,'Gautam Pillai','m','Finance Manager','People & Ops','2019-12-02','1987-06-25','Full-time',2,'Chennai'],
[28,'Rhea Saxena','f','Content Strategist','Strategy','2025-03-10','1996-01-14','Full-time',4,'Delhi NCR'],
[29,'Aisha Khan','f','Interaction Designer','Design','2026-09-14','1997-05-21','Probation',3,'Bengaluru'],
[30,'Tejas Patil','m','Junior Developer','Engineering','2026-10-05','1999-08-30','Probation',5,'Pune'],
[31,'Naina Bose','f','Motion Designer','Motion','2026-08-17','1998-09-26','Probation',6,'Kolkata'],
[32,'Yash Gupta','m','Video Editor','Production','2026-07-20','1996-03-11','Full-time',7,'Delhi NCR'],
[33,'Sana Mirza','f','Visual Designer','Design','2026-10-12','1995-07-07','Contract',3,'Hyderabad'],
[34,'Omkar Deshpande','m','Sound Designer','Motion','2020-09-14','1991-02-02','Full-time',6,'Mumbai'],
[35,'Revathi Chandran','f','Senior Copywriter','Creative','2020-11-09','1992-10-30','Full-time',11,'Chennai'],
[36,'Anil Prasad','m','DevOps Engineer','Engineering','2021-02-22','1989-09-12','On leave',5,'Bengaluru'],
[37,'Shreya Nambiar','f','Design Researcher','Strategy','2023-09-04','1996-12-17','Full-time',4,'Kochi'],
[38,'Kabir Singh','m','Senior Developer','Engineering','2019-10-28','1990-04-04','Full-time',5,'Chandigarh'],
[39,'Leela Menon','f','Studio Coordinator','Production','2022-05-16','1994-10-19','Full-time',7,'Chennai'],
[40,'Jai Arora','m','Art Director','Creative','2018-02-12','1989-01-19','Full-time',1,'Jaipur']
] : [];
const EMP = RAW.map(r => ({ n:r[0], name:r[1], g:r[2], role:r[3], dept:r[4], join:r[5], dob:r[6], status:r[7], mgr:r[8], city:r[9], phone:'', emergency:'', emergencyPhone:'', bio:'', photo:'', shiftStart:'10:00', shiftEnd:'18:00' }));
[...EMP].sort((a,b) => pd(a.join) - pd(b.join) || a.n - b.n).forEach((e,i) => { e.empId = 'M-' + (i+1); });
const emailFor = name => name.toLowerCase().replace(/[^a-z ]/g,'').trim().replace(/\s+/g,'.') + '@maayasthra.com';
EMP.forEach(e => { e.email = emailFor(e.name); });
const BY = {}; EMP.forEach(e => BY[e.n] = e);
const DEPTS = [...new Set(EMP.map(e => e.dept))].sort();
const STATUSES = ['Full-time','Probation','Contract','On leave','Exited'];
const STAT_C = { 'Full-time':'#30D158', 'Probation':'#FF9F0A', 'Contract':'#0A84FF', 'On leave':'#BF5AF2', 'Exited':'#8E8E93' };

// role changes: [date, title], first entry is the role on joining
const PATH = IS_DEMO ? {
  2:[['2017-06-12','HR Executive'],['2020-04-01','People Partner'],['2023-04-01','Head of People & Operations']],
  3:[['2016-02-01','Senior Designer'],['2018-04-01','Design Lead'],['2021-01-01','Design Director']],
  4:[['2018-09-03','Strategist'],['2021-07-01','Senior Strategist'],['2024-01-01','Head of Strategy']],
  5:[['2017-01-16','Developer'],['2020-06-01','Tech Lead'],['2023-01-01','Head of Technology']],
  6:[['2019-03-18','Motion Designer'],['2022-05-01','Motion Lead'],['2025-01-01','Head of Motion']],
  7:[['2018-11-05','Producer'],['2022-02-01','Head of Production']],
  8:[['2019-08-26','Account Manager'],['2023-04-01','Client Partnerships Lead']],
  9:[['2020-10-21','Designer'],['2023-04-01','Senior Designer']],
  13:[['2021-10-25','Junior Motion Designer'],['2023-10-01','Motion Designer']],
  19:[['2020-06-01','Assistant Producer'],['2022-09-01','Producer']],
  22:[['2020-01-27','Researcher'],['2023-01-01','Research Lead']],
  38:[['2019-10-28','Developer'],['2022-07-01','Senior Developer']]
} : {};

function journey(e) {
  const out = [];
  if (!e.join) return out;
  const path = PATH[e.n] || [[e.join, e.role]];
  path.forEach((p, i) => out.push({
    date: p[0], hi: i > 0,
    title: i === 0 ? 'Joined Maayasthra' : 'Promoted to ' + p[1],
    note: i === 0 ? 'Started as ' + p[1] + ' in ' + e.dept + '.' : 'Previously ' + path[i-1][1] + '.'
  }));
  if (e.n !== 1 && e.status !== 'Contract') {
    const c = addMonths(e.join, e.status === 'Probation' ? 3 : 6);
    out.push(pd(c) <= TOD
      ? { date: c, title: 'Confirmed as a permanent member', note: 'Probation completed.' }
      : { date: c, up: true, title: 'Probation review', note: 'Scheduled with ' + (BY[e.mgr] ? BY[e.mgr].name : 'People & Ops') + '.' });
  }
  [1,3,5,10].forEach(y => {
    const d = addMonths(e.join, y * 12);
    if (pd(d) <= TOD) out.push({ date: d, hi: y >= 5, title: plural(y, 'year') + ' at Maayasthra', note: y >= 5 ? 'A long-service milestone.' : '' });
  });
  const nx = nextOcc(e.join), yrs = nx.year - Number(e.join.slice(0,4));
  if (yrs >= 1) {
    const d = new Date(nx.t);
    out.push({ date: d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0'), up: true, title: plural(yrs, 'year') + ' at Maayasthra', note: rel(nx.days) });
  }
  const seen = {};
  return out.filter(m => { const k = m.date + m.title; if (seen[k]) return false; seen[k] = 1; return true; })
            .sort((a,b) => pd(b.date) - pd(a.date));
}

const LEAVES0 = IS_DEMO ? [
  { id:1, emp:9,  type:'Casual leave', from:'2026-10-28', to:'2026-10-30', days:3,  reason:'Family function in Kochi.', sent:'2 days ago' },
  { id:2, emp:14, type:'Casual leave', from:'2026-11-09', to:'2026-11-20', days:10, reason:'Travelling over the Diwali break.', sent:'Yesterday' },
  { id:3, emp:15, type:'Sick leave',   from:'2026-10-20', to:'2026-10-20', days:1,  reason:'Medical appointment.', sent:'Today' },
  { id:4, emp:20, type:'Casual leave', from:'2026-10-23', to:'2026-10-23', days:1,  reason:'Personal errand.', sent:'3 days ago' }
] : [];

/* ---------- Calendar and leave data ---------- */
const MONL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const isoOf = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0'); };
const TODISO = isoOf(TOD);
// Sample holiday list, to be replaced with the company's confirmed calendar
const HOL = IS_DEMO ? {
  '2026-01-01':"New Year's Day",'2026-01-26':'Republic Day','2026-03-04':'Holi','2026-04-03':'Good Friday','2026-05-01':'May Day',
  '2026-08-15':'Independence Day','2026-10-02':'Gandhi Jayanti','2026-10-20':'Dussehra','2026-11-08':'Diwali','2026-11-09':'Diwali break',
  '2026-11-24':'Guru Nanak Jayanti','2026-12-25':'Christmas','2027-01-01':"New Year's Day",'2027-01-26':'Republic Day'
} : {};
const TEAM_LEAVES = IS_DEMO ? [
  { emp:12, type:'Casual leave', from:'2026-10-19', to:'2026-10-21' },
  { emp:36, type:'Medical leave', from:'2026-10-05', to:'2026-11-02' },
  { emp:25, type:'Casual leave', from:'2026-10-26', to:'2026-10-27' },
  { emp:17, type:'Casual leave', from:'2026-11-02', to:'2026-11-06' },
  { emp:26, type:'Casual leave', from:'2026-11-24', to:'2026-11-25' },
  { emp:23, type:'Casual leave', from:'2026-12-21', to:'2026-12-31' }
] : [];
// Leave rules. Edited from Settings, applied to every new request.
const POLICY = { allow: { 'Sick leave':8, 'Casual leave':8, 'Emergency leave':3 }, notice:3, half:true, note:false };
const leaveTypes = () => Object.entries(POLICY.allow);
// Each year starts fresh: only leave that starts this year counts against the allowance.
const balances = mine => leaveTypes().map(([t, total]) => {
  const yr = TODISO.slice(0, 4), thisYear = l => (l.from || '').slice(0, 4) === yr;
  const used = mine.filter(l => l.type === t && l.state === 'approved' && thisYear(l)).reduce((n, l) => n + l.days, 0);
  const pend = mine.filter(l => l.type === t && l.state === 'pending' && thisYear(l)).reduce((n, l) => n + l.days, 0);
  return { t, total, used, pend, left: total - used };
});
const HIST0 = IS_DEMO ? [
  { id:101, emp:2, type:'Casual leave', from:'2026-08-10', to:'2026-08-13', days:4, reason:'Trip to Munnar.', state:'approved', past:true },
  { id:102, emp:2, type:'Casual leave', from:'2026-05-22', to:'2026-05-22', days:1, reason:'Personal errand.', state:'approved', past:true },
  { id:103, emp:2, type:'Casual leave', from:'2026-03-16', to:'2026-03-16', days:1, reason:'Home repairs.', state:'approved', past:true },
  { id:111, emp:9, type:'Casual leave', from:'2026-06-08', to:'2026-06-09', days:2, reason:'Family trip.', state:'approved', past:true },
  { id:112, emp:9, type:'Casual leave', from:'2026-02-13', to:'2026-02-13', days:1, reason:'Passport appointment.', state:'approved', past:true }
] : [];
const ROLE_NAMES = ['Employee','Project manager','Admin'];
const ROLEMAP = {};
EMP.forEach(e => { ROLEMAP[e.n] = e.n <= 2 || e.n === 26 ? 'Admin' : e.n === 5 ? 'Project manager' : 'Employee'; });
// Working hours: admins start at 9:00, everyone else at 10:00, and the day ends at 18:00. Editable per person.
const defaultStart = role => role === 'Admin' ? '09:00' : '10:00';
EMP.forEach(e => { e.shiftStart = defaultStart(ROLEMAP[e.n]); });
const setRole = (n, role) => { const e = BY[n]; if (e && e.shiftStart === defaultStart(ROLEMAP[n])) e.shiftStart = defaultStart(role); ROLEMAP[n] = role; };
const fmtTime = hm => { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); return ((h + 11) % 12 + 1) + ':' + String(m).padStart(2, '0') + ' ' + (h < 12 ? 'AM' : 'PM'); };
const isAdminRole = e => ROLEMAP[e.n] === 'Admin';
const activeEmps = () => EMP.filter(e => e.status !== 'Exited');
const refreshDepts = () => { DEPTS.splice(0, DEPTS.length, ...[...new Set(EMP.map(e => e.dept))].sort()); };
const addEmployee = d => {
  const n = EMP.reduce((m, e) => Math.max(m, e.n), 0) + 1, idn = EMP.reduce((m, e) => Math.max(m, Number(String(e.empId).replace(/\D/g, '')) || 0), 0) + 1;
  const e = { phone:'', emergency:'', emergencyPhone:'', bio:'', photo:'', shiftStart:'10:00', shiftEnd:'18:00', ...d, n, empId:'M-' + idn, email: emailFor(d.name) };
  EMP.push(e); BY[n] = e; ROLEMAP[n] = 'Employee'; refreshDepts(); return e;
};
const updateEmployee = (n, patch) => { const e = BY[n]; Object.assign(e, patch); if (patch.name) e.email = emailFor(patch.name); refreshDepts(); return e; };
const awayList = leaves => [...TEAM_LEAVES, ...leaves.filter(l => l.state === 'approved').map(l => ({ emp:l.emp, type:l.type, from:l.from, to:l.to }))];
const isAway = (n, iso, away) => { const w = new Date(pd(iso)).getUTCDay(); return w !== 0 && w !== 6 && !HOL[iso] && away.some(l => l.emp === n && iso >= l.from && iso <= l.to); };
// Working days strictly between today and a start date, for the minimum-notice rule
const noticeDays = from => { let c = 0; for (let t = TOD + DAY; t < pd(from); t += DAY) { const w = new Date(t).getUTCDay(); if (w !== 0 && w !== 6 && !HOL[isoOf(t)]) c++; } return c; };
const DEMO_PW = IS_DEMO ? 'maayasthra' : '';
const workDays = (a, b) => {
  let days = 0, wk = 0; const hol = [];
  for (let t = pd(a); t <= pd(b); t += DAY) {
    const w = new Date(t).getUTCDay(), k = isoOf(t);
    if (w === 0 || w === 6) wk++; else if (HOL[k]) hol.push(HOL[k]); else days++;
  }
  return { days, wk, hol };
};

const searchPeople = (q, incl = false) => {
  const t = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const pool = incl ? EMP : activeEmps();
  if (!t.length) return pool;
  return pool.filter(e => { const s = (e.name + ' ' + e.role + ' ' + e.dept + ' ' + e.city + ' ' + e.empId).toLowerCase(); return t.every(x => s.includes(x)); });
};

export { TOD, DAY, MON, WD, WDL, pd, fmt, fmtDM, fmtDay, nextOcc, rel, ago, tenure, plural, tenureText, range, addMonths, EMP, BY, DEPTS, STATUSES, STAT_C, PATH, journey, LEAVES0, MONL, TODISO, isoOf, HOL, TEAM_LEAVES, POLICY, leaveTypes, balances, HIST0, ROLE_NAMES, ROLEMAP, isAdminRole, activeEmps, addEmployee, updateEmployee, defaultStart, setRole, fmtTime, emailFor, awayList, isAway, noticeDays, DEMO_PW, workDays, searchPeople };
