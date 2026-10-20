const TOD = Date.UTC(2026, 9, 19), DAY = 864e5;
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const WD = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const WDL = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const pd = iso => { const [a,b,c] = iso.split('-').map(Number); return Date.UTC(a, b-1, c); };
const fmt = iso => { const [a,b,c] = iso.split('-').map(Number); return c + ' ' + MON[b-1] + ' ' + a; };
const fmtDM = iso => { const [,b,c] = iso.split('-').map(Number); return c + ' ' + MON[b-1]; };
const fmtDay = t => { const d = new Date(t); return WD[d.getUTCDay()] + ' ' + d.getUTCDate() + ' ' + MON[d.getUTCMonth()]; };
const nextOcc = iso => {
  const [y,m,d] = iso.split('-').map(Number);
  let yr = 2026, t = Date.UTC(yr, m-1, d);
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
  const [y,m,d] = join.split('-').map(Number);
  const total = (2026 - y) * 12 + (10 - m) - (19 < d ? 1 : 0);
  return { total, yrs: Math.floor(total / 12), mos: total % 12, days: Math.round((TOD - pd(join)) / DAY) };
};
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
const tenureText = join => {
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
  const [y,m,d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m-1+n, d));
  return t.getUTCFullYear() + '-' + String(t.getUTCMonth()+1).padStart(2,'0') + '-' + String(t.getUTCDate()).padStart(2,'0');
};

/* ---------- People ---------- */
// n, name, gender, role, department, joined, born, status, manager n, city
const RAW = [
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
];
const EMP = RAW.map(r => ({ n:r[0], name:r[1], g:r[2], role:r[3], dept:r[4], join:r[5], dob:r[6], status:r[7], mgr:r[8], city:r[9] }));
[...EMP].sort((a,b) => pd(a.join) - pd(b.join) || a.n - b.n).forEach((e,i) => { e.empId = 'MAY-' + String(i+1).padStart(3,'0'); });
EMP.forEach(e => { e.email = e.name.toLowerCase().replace(/[^a-z ]/g,'').replace(' ','.') + '@maayasthra.com'; });
const BY = {}; EMP.forEach(e => BY[e.n] = e);
const DEPTS = [...new Set(EMP.map(e => e.dept))].sort();
const STATUSES = ['Full-time','Probation','Contract','On leave'];
const STAT_C = { 'Full-time':'#46D39A', 'Probation':'#E8B93F', 'Contract':'#9DB4F5', 'On leave':'#B79BF2' };

// role changes: [date, title], first entry is the role on joining
const PATH = {
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
};

function journey(e) {
  const out = [];
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

const EVENTS = [
  { id:'e1', date:'2026-10-22', time:'4:00 PM', kind:'Studio', title:'Design Crit Live', where:'Google Meet', desc:'Three teams put work in progress on screen and get direct feedback from Rohan and Arjun. Bring one thing you are unsure about.' },
  { id:'e2', date:'2026-10-30', time:'3:00 PM', kind:'Studio', title:'Studio Showcase: Q3 Work', where:'Google Meet', desc:'Finished projects from the quarter, presented by the people who made them.' },
  { id:'e3', date:'2026-11-06', time:'6:30 PM', kind:'Culture', title:'Diwali Celebration', where:'Online, all studio', desc:'A relaxed evening call with games, a gift reveal and a short note from Aarav.' },
  { id:'e4', date:'2026-11-13', time:'11:00 AM', kind:'Company', title:'All-hands: Planning 2027', where:'Google Meet', desc:'Priorities for next year, new hires and the roadmap for the studio.' },
  { id:'e5', date:'2026-12-11', end:'2026-12-13', time:'All day', kind:'Company', title:'Annual Offsite', where:'Pondicherry', desc:'Three days together in person. Travel and stay details follow from People & Ops.' }
];

const LEAVES0 = [
  { id:1, emp:9,  type:'Casual leave', from:'2026-10-28', to:'2026-10-30', days:3,  reason:'Family function in Kochi.', sent:'2 days ago' },
  { id:2, emp:14, type:'Annual leave', from:'2026-11-09', to:'2026-11-20', days:10, reason:'Travelling over the Diwali break.', sent:'Yesterday' },
  { id:3, emp:15, type:'Sick leave',   from:'2026-10-20', to:'2026-10-20', days:1,  reason:'Medical appointment.', sent:'Today' },
  { id:4, emp:20, type:'Comp-off',     from:'2026-10-23', to:'2026-10-23', days:1,  reason:'Weekend shoot support on 10 Oct.', sent:'3 days ago' }
];

/* ---------- Calendar and leave data ---------- */
const MONL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const TODISO = '2026-10-19';
const isoOf = t => { const d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth()+1).padStart(2,'0') + '-' + String(d.getUTCDate()).padStart(2,'0'); };
// Sample holiday list, to be replaced with the company's confirmed calendar
const HOL = {
  '2026-01-01':"New Year's Day",'2026-01-26':'Republic Day','2026-03-04':'Holi','2026-04-03':'Good Friday','2026-05-01':'May Day',
  '2026-08-15':'Independence Day','2026-10-02':'Gandhi Jayanti','2026-10-20':'Dussehra','2026-11-08':'Diwali','2026-11-09':'Diwali break',
  '2026-11-24':'Guru Nanak Jayanti','2026-12-25':'Christmas','2027-01-01':"New Year's Day",'2027-01-26':'Republic Day'
};
const TEAM_LEAVES = [
  { emp:12, type:'Annual leave', from:'2026-10-19', to:'2026-10-21' },
  { emp:36, type:'Medical leave', from:'2026-10-05', to:'2026-11-02' },
  { emp:25, type:'Casual leave', from:'2026-10-26', to:'2026-10-27' },
  { emp:17, type:'Annual leave', from:'2026-11-02', to:'2026-11-06' },
  { emp:26, type:'Casual leave', from:'2026-11-24', to:'2026-11-25' },
  { emp:23, type:'Annual leave', from:'2026-12-21', to:'2026-12-31' }
];
const LEAVE_TYPES = [['Annual leave',18],['Casual leave',8],['Sick leave',8],['Comp-off',2]];
const HIST0 = [
  { id:101, emp:2, type:'Annual leave', from:'2026-08-10', to:'2026-08-13', days:4, reason:'Trip to Munnar.', state:'approved', past:true },
  { id:102, emp:2, type:'Casual leave', from:'2026-05-22', to:'2026-05-22', days:1, reason:'Personal errand.', state:'approved', past:true },
  { id:103, emp:2, type:'Casual leave', from:'2026-03-16', to:'2026-03-16', days:1, reason:'Home repairs.', state:'approved', past:true },
  { id:111, emp:9, type:'Annual leave', from:'2026-06-08', to:'2026-06-11', days:4, reason:'Family trip.', state:'approved', past:true },
  { id:112, emp:9, type:'Casual leave', from:'2026-02-13', to:'2026-02-13', days:1, reason:'Passport appointment.', state:'approved', past:true }
];
const ADMINS = [1, 2, 26];
const DEMO_PW = 'maayasthra';
const workDays = (a, b) => {
  let days = 0, wk = 0; const hol = [];
  for (let t = pd(a); t <= pd(b); t += DAY) {
    const w = new Date(t).getUTCDay(), k = isoOf(t);
    if (w === 0 || w === 6) wk++; else if (HOL[k]) hol.push(HOL[k]); else days++;
  }
  return { days, wk, hol };
};

const searchPeople = q => {
  const t = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!t.length) return EMP;
  return EMP.filter(e => { const s = (e.name + ' ' + e.role + ' ' + e.dept + ' ' + e.city + ' ' + e.empId).toLowerCase(); return t.every(x => s.includes(x)); });
};

export { TOD, DAY, MON, WD, WDL, pd, fmt, fmtDM, fmtDay, nextOcc, rel, ago, tenure, plural, tenureText, range, addMonths, RAW, EMP, BY, DEPTS, STATUSES, STAT_C, PATH, journey, EVENTS, LEAVES0, MONL, TODISO, isoOf, HOL, TEAM_LEAVES, LEAVE_TYPES, HIST0, ADMINS, DEMO_PW, workDays, searchPeople };
