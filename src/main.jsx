import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { html, Icon, Av } from './ui.jsx';
import { LEAVES0, HIST0, TODISO, TOD, DAY, isoOf } from './data.js';
import { Login } from './screens/Login.jsx';
import { Home } from './screens/Home.jsx';
import { People, EmployeeForm } from './screens/People.jsx';
import { Profile } from './screens/Profile.jsx';
import { OrgChart } from './screens/OrgChart.jsx';
import { CalendarView } from './screens/Calendar.jsx';
import { MyLeaves } from './screens/Leaves.jsx';
import { Requests } from './screens/Requests.jsx';
import { Settings } from './screens/Settings.jsx';
import { QuickSearch } from './QuickSearch.jsx';
import { CheckWidget } from './Attendance.jsx';
import { loadAtt, saveAtt, setMe } from './attendance.js';
import { MyHours } from './screens/Hours.jsx';
import { AttendancePage } from './screens/AttendancePage.jsx';
import { TaskBoard } from './task/TaskBoard.jsx';
import { MyTasks } from './task/MyTasks.jsx';
import { TeamView } from './task/TeamView.jsx';
import { TaskDetail } from './task/TaskDetail.jsx';
import { loadTasks, saveTasks, loadCollapsed, saveCollapsed } from './tasks.js';
import './styles.css';

const ALL = { board: 'Board', mytasks: 'My Tasks', team: 'Team', home: 'Home', people: 'People', org: 'Org chart', calendar: 'Calendar', attendance: 'Attendance', hours: 'My Hours', leaves: 'My Leaves', requests: 'Requests', settings: 'Settings' };
const SHORT = { mytasks: 'Mine', org: 'Org', leaves: 'Leaves', attendance: 'Hours', hours: 'Hours' };

const SEED_ANN = [
  { id: 1, kind: 'holiday', title: 'Studio closed for Dussehra', body: 'The studio is closed on 20 October. Normal hours resume the next working day.', date: TODISO, by: 'Meera Iyer' },
  { id: 2, kind: 'reminder', title: 'Planning time off for Diwali?', body: 'Please send leave requests for the Diwali week early so the team can plan coverage.', date: isoOf(TOD - 2 * DAY), by: 'Meera Iyer' },
  { id: 3, kind: 'general', title: 'Keep your profile current', body: 'Add your phone number and an emergency contact from your profile. It takes a minute.', date: isoOf(TOD - 5 * DAY), by: 'Meera Iyer' }
];

/* Two clear buttons switch between the apps */
function AppSwitch({ app, setApp }) {
  return html`<div className="apps2" role="tablist" aria-label="Apps">${[['people', 'People', 'people'], ['task', 'Task', 'board']].map(([k, l, ic]) => html`<button key=${k} role="tab" aria-selected=${app === k} className=${app === k ? 'on' : ''} onClick=${() => setApp(k)}><${Icon} n=${ic} s=${20}/>${l}</button>`)}</div>`;
}
const Brand = () => html`<div className="brand"><span className="mark"></span><span className="brand-t"><b>Maayasthra</b><span>Workspace</span></span></div>`;

function TopRight({ user, role, open, openForm, signOut }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const f = ev => { if (ref.current && !ref.current.contains(ev.target)) setMenu(false); };
    const k = ev => { if (ev.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', f); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); };
  }, [menu]);
  return html`<div className="tr" ref=${ref}>
    <button className="tr-me" onClick=${() => setMenu(m => !m)} aria-haspopup="menu" aria-expanded=${menu} aria-label="Account menu">
      <${Av} e=${user} s=${32}/><span className="tr-n"><b>${user.name}</b><span>${role === 'admin' ? 'Admin' : 'Employee'}</span></span></button>
    ${menu && html`<div className="menu" role="menu">
      <div className="menu-h"><b>${user.name}</b><span>${user.email}</span></div>
      <button role="menuitem" onClick=${() => { setMenu(false); open(user.n); }}><${Icon} n="user" s=${16}/> View profile</button>
      <button role="menuitem" onClick=${() => { setMenu(false); openForm(user.n); }}><${Icon} n="edit" s=${16}/> Edit profile</button>
      <button role="menuitem" className="menu-o" onClick=${() => { setMenu(false); signOut(); }}><${Icon} n="logout" s=${16}/> Sign out</button></div>`}
  </div>`;
}

function App() {
  const [nav, setNav] = useState({ view: 'home' });
  const [auth, setAuth] = useState(null);
  const [leaves, setLeaves] = useState(() => [...LEAVES0.map(l => ({ ...l, state: 'pending' })), ...HIST0]);
  const [ann, setAnn] = useState(SEED_ANN);
  const [pf, setPf] = useState({ q: '', dept: 'All', city: 'All', sort: 'name', former: false });
  const [ver, setVer] = useState(0);
  const [att, setAtt] = useState(loadAtt);
  const [sOpen, setSOpen] = useState(false);
  const [app, setAppState] = useState('people');
  const [tasks, setTasks] = useState(loadTasks), [collapsed, setCollapsed] = useState(loadCollapsed);
  const [focus, setFocus] = useState(null);
  const [taskSel, setTaskSel] = useState(null), [tq, setTq] = useState('');
  const [tf, setTf] = useState({ dept: 'All', hideEmpty: false });
  const bump = () => setVer(v => v + 1);
  useEffect(() => { saveAtt(att); }, [att]);
  useEffect(() => { saveTasks(tasks); }, [tasks]);
  useEffect(() => { saveCollapsed(collapsed); }, [collapsed]);

  if (!auth) return html`<${Login} onLogin=${(user, role) => { setMe(user.n); setNav({ view: 'home' }); setAuth({ user, role }); window.scrollTo({ top: 0 }); }}/>`;
  const user = auth.user, role = auth.role;
  const peopleKeys = role === 'admin' ? ['home', 'people', 'org', 'calendar', 'attendance', 'leaves', 'requests', 'settings'] : ['home', 'people', 'org', 'calendar', 'hours', 'leaves'];
  const keys = app === 'task' ? (role === 'admin' ? ['board', 'mytasks', 'team'] : ['board', 'mytasks']) : peopleKeys;
  const setApp = a => { setAppState(a); setNav({ view: a === 'task' ? 'board' : 'home' }); setTaskSel(null); setSOpen(false); window.scrollTo({ top: 0 }); };
  const openTask = (id, ctx) => setTaskSel({ id, ctx });
  const goTask = id => { setAppState('task'); setNav({ view: 'mytasks' }); setTaskSel(id ? { id } : null); window.scrollTo({ top: 0 }); };
  const top = () => window.scrollTo({ top: 0 });
  const go = v => { setNav({ view: v }); setTaskSel(null); top(); };
  const open = (id, tab) => { setNav(p => ({ view: 'profile', id, tab: typeof tab === 'string' ? tab : undefined, from: p.view === 'profile' ? p.from : p.view === 'form' ? 'people' : p.view })); top(); };
  const openForm = id => { setNav(p => ({ view: 'form', id, from: p.view === 'profile' ? p.from : p.view })); top(); };
  const back = () => { setNav({ view: nav.from || 'people' }); top(); };
  const formDone = id => { if (id) { setNav(p => ({ view: 'profile', id, from: p.from || 'people' })); } else go('people'); top(); };
  const signOut = () => { setAuth(null); setNav({ view: 'home' }); top(); };
  const active = nav.view === 'profile' || nav.view === 'form' ? (nav.from || 'people') : nav.view;
  const pending = role === 'admin' ? leaves.filter(l => !l.past && l.emp !== user.n && l.state === 'pending').length : 0;

  const home = html`<${Home} role=${role} user=${user} leaves=${leaves} setLeaves=${setLeaves} ann=${ann} setAnn=${setAnn} att=${att} setAtt=${setAtt} tasks=${tasks} goTask=${goTask} go=${go} openForm=${openForm} open=${open}/>`;
  const taskScreen = nav.view === 'mytasks' ? html`<${MyTasks} tasks=${tasks} setTasks=${setTasks} user=${user} tq=${tq} openTask=${openTask}/>`
    : nav.view === 'team' && role === 'admin' ? html`<${TeamView} tasks=${tasks} onPick=${n => { setTf(f => ({ ...f, dept: 'All' })); setFocus(n); go('board'); }}/>`
    : html`<${TaskBoard} tasks=${tasks} setTasks=${setTasks} user=${user} role=${role} tf=${tf} setTf=${setTf} tq=${tq} openTask=${openTask} focus=${focus} collapsed=${collapsed} setCollapsed=${setCollapsed}/>`;
  const screen = app === 'task' ? taskScreen : nav.view === 'home' ? home
    : nav.view === 'people' ? html`<${People} pf=${pf} setPf=${setPf} open=${open} openForm=${openForm} role=${role} ver=${ver}/>`
    : nav.view === 'org' ? html`<${OrgChart} open=${open} user=${user} key=${ver}/>`
    : nav.view === 'profile' ? html`<${Profile} key=${nav.id + '-' + ver + (nav.tab || '')} id=${nav.id} tab=${nav.tab} from=${nav.from} back=${back} open=${open} openForm=${openForm} user=${user} role=${role} leaves=${leaves} att=${att} setAtt=${setAtt} ver=${ver}/>`
    : nav.view === 'form' ? html`<${EmployeeForm} key=${'f' + nav.id} id=${nav.id} role=${role} user=${user} done=${formDone} bump=${bump}/>`
    : nav.view === 'calendar' ? html`<${CalendarView} leaves=${leaves} open=${open} key=${ver}/>`
    : nav.view === 'attendance' && role === 'admin' ? html`<${AttendancePage} att=${att} leaves=${leaves} open=${open} user=${user}/>`
    : nav.view === 'hours' ? html`<${MyHours} user=${user} att=${att} setAtt=${setAtt} leaves=${leaves}/>`
    : nav.view === 'leaves' ? html`<${MyLeaves} leaves=${leaves} setLeaves=${setLeaves} user=${user} key=${ver}/>`
    : nav.view === 'requests' && role === 'admin' ? html`<${Requests} user=${user} leaves=${leaves} setLeaves=${setLeaves} open=${open}/>`
    : nav.view === 'settings' && role === 'admin' ? html`<${Settings} onChange=${bump}/>`
    : home;

  const brand = html`<${Brand}/>`;
  return html`<div className="app">
    <aside className="side">${brand}
      <${AppSwitch} app=${app} setApp=${setApp}/>
      <nav className="nav" aria-label="Main">${keys.map(k => html`<button key=${k} className=${'nav-b' + (active === k ? ' on' : '')} onClick=${() => go(k)} aria-current=${active === k ? 'page' : undefined}>
        <${Icon} n=${k}/>${ALL[k]}${k === 'requests' && pending > 0 && html`<span className="cnt">${pending}</span>`}</button>`)}</nav>
    </aside>
    <div className="col">
      <header className="hdr"><div className="hdr-b"><${AppSwitch} app=${app} setApp=${setApp}/></div>
        <div className=${'hs' + (sOpen ? ' open' : '')}>${app === 'task' ? html`<div className="qs"><${Icon} n="search"/><input id="quick-search" className="qs-in" value=${tq} placeholder="Search tasks" onChange=${ev => setTq(ev.target.value)} aria-label="Search tasks"/></div>` : html`<${QuickSearch} open=${id => { setSOpen(false); open(id); }}/>`}</div>
        <button className="ib hs-b" onClick=${() => { setSOpen(o => !o); setTimeout(() => { const el = document.getElementById('quick-search'); if (el) el.focus(); }, 30); }} aria-label="Search"><${Icon} n="search" s=${17}/></button>
        <${CheckWidget} user=${user} att=${att} setAtt=${setAtt}/>
        <${TopRight} user=${user} role=${role} open=${open} openForm=${openForm} signOut=${signOut}/></header>
      <main className="main" key=${app + nav.view + (nav.id || '')}>${screen}</main>
    </div>
    ${taskSel && html`<${TaskDetail} key=${taskSel.id} id=${taskSel.id} ctx=${taskSel.ctx} tasks=${tasks} setTasks=${setTasks} user=${user} role=${role} leaves=${leaves} close=${() => setTaskSel(null)}/>`}
    <nav className="bnav" style=${{ gridTemplateColumns: 'repeat(' + keys.length + ', 1fr)' }} aria-label="Main">${keys.map(k => html`<button key=${k} className=${active === k ? 'on' : ''} onClick=${() => go(k)}>
      <${Icon} n=${k} s=${21}/>${SHORT[k] || ALL[k]}${k === 'requests' && pending > 0 && html`<span className="cnt">${pending}</span>`}</button>`)}</nav>
  </div>`;
}

createRoot(document.getElementById('root')).render(html`<${App}/>`);
