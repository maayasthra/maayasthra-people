import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { html, Icon, Av } from './ui.jsx';
import { LEAVES0, HIST0, ROLEMAP, BY, TODISO, TOD, DAY, isoOf } from './data.js';
import { Login } from './screens/Login.jsx';
import { Home } from './screens/Home.jsx';
import { People, EmployeeForm } from './screens/People.jsx';
import { Profile } from './screens/Profile.jsx';
import { OrgChart } from './screens/OrgChart.jsx';
import { CalendarView } from './screens/Calendar.jsx';
import { MyLeaves } from './screens/Leaves.jsx';
import { Requests } from './screens/Requests.jsx';
import { Settings } from './screens/Settings.jsx';
import './styles.css';

const ALL = { home: 'Home', people: 'People', org: 'Org chart', calendar: 'Calendar', leaves: 'My Leaves', requests: 'Requests', settings: 'Settings' };
const ICON = { home: 'home', people: 'people', org: 'org', calendar: 'calendar', leaves: 'leaves', requests: 'requests', settings: 'settings' };
const SHORT = { org: 'Org', leaves: 'Leaves' };

const SEED_ANN = [
  { id: 1, title: 'Keep your profile current', body: 'Add your phone number and an emergency contact from your profile page. It takes a minute.', date: TODISO, by: 'Meera Iyer' },
  { id: 2, title: 'Planning time off for Diwali?', body: 'Please send leave requests for the Diwali week early so the team can plan coverage.', date: isoOf(TOD - 2 * DAY), by: 'Meera Iyer' }
];

function readTheme() { try { return localStorage.getItem('mp-theme') || 'dark'; } catch (x) { return 'dark'; } }

function App() {
  const [nav, setNav] = useState({ view: 'home' });
  const [auth, setAuth] = useState(null);
  const [leaves, setLeaves] = useState(() => [...LEAVES0.map(l => ({ ...l, state: 'pending' })), ...HIST0]);
  const [ann, setAnn] = useState(SEED_ANN);
  const [presence, setPresence] = useState({});
  const [pf, setPf] = useState({ q: '', dept: 'All', status: 'All', city: 'All', sort: 'name', view: 'grid' });
  const [ver, setVer] = useState(0);
  const [theme, setTheme] = useState(readTheme);
  const bump = () => setVer(v => v + 1);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('mp-theme', theme); } catch (x) {}
  }, [theme]);

  if (!auth) return html`<${Login} onLogin=${(user, role) => { setNav({ view: 'home' }); setAuth({ user, role }); window.scrollTo({ top: 0 }); }}/>`;
  const user = auth.user, role = auth.role;
  const isMgr = role !== 'admin' && ROLEMAP[user.n] === 'Manager';
  const keys = role === 'admin' ? ['home', 'people', 'org', 'calendar', 'leaves', 'requests', 'settings'] : isMgr ? ['home', 'people', 'org', 'calendar', 'leaves', 'requests'] : ['home', 'people', 'org', 'calendar', 'leaves'];
  const top = () => window.scrollTo({ top: 0 });
  const go = v => { setNav({ view: v }); top(); };
  const open = id => { setNav(p => ({ view: 'profile', id, from: p.view === 'profile' ? p.from : p.view === 'form' ? 'people' : p.view })); top(); };
  const openForm = id => { setNav(p => ({ view: 'form', id, from: p.view === 'profile' ? p.from : p.view })); top(); };
  const back = () => { setNav({ view: nav.from || 'people' }); top(); };
  const formDone = id => { if (id) { setNav(p => ({ view: 'profile', id, from: p.from || 'people' })); } else go('people'); top(); };
  const signOut = () => { setAuth(null); setNav({ view: 'home' }); top(); };
  const active = nav.view === 'profile' || nav.view === 'form' ? (nav.from || 'people') : nav.view;
  const all = leaves.filter(l => !l.past && l.emp !== user.n);
  const mgrPending = isMgr ? all.filter(l => l.state === 'pending' && BY[l.emp] && BY[l.emp].mgr === user.n).length : 0;
  const pending = role === 'admin' ? all.filter(l => l.state === 'pending').length : 0;
  const badge = role === 'admin' ? pending : mgrPending;

  const screen = nav.view === 'home' ? html`<${Home} role=${role} user=${user} isMgr=${isMgr} leaves=${leaves} setLeaves=${setLeaves} ann=${ann} setAnn=${setAnn} presence=${presence} setPresence=${setPresence} go=${go} openForm=${openForm} open=${open}/>`
    : nav.view === 'people' ? html`<${People} pf=${pf} setPf=${setPf} open=${open} openForm=${openForm} role=${role} ver=${ver}/>`
    : nav.view === 'org' ? html`<${OrgChart} open=${open} user=${user} key=${ver}/>`
    : nav.view === 'profile' ? html`<${Profile} key=${nav.id + '-' + ver} id=${nav.id} from=${nav.from} back=${back} open=${open} openForm=${openForm} user=${user} role=${role} leaves=${leaves} ver=${ver}/>`
    : nav.view === 'form' ? html`<${EmployeeForm} key=${'f' + nav.id} id=${nav.id} role=${role} user=${user} done=${formDone} bump=${bump}/>`
    : nav.view === 'calendar' ? html`<${CalendarView} leaves=${leaves} open=${open} key=${ver}/>`
    : nav.view === 'leaves' ? html`<${MyLeaves} leaves=${leaves} setLeaves=${setLeaves} user=${user} key=${ver}/>`
    : nav.view === 'requests' && keys.includes('requests') ? html`<${Requests} role=${role} user=${user} leaves=${leaves} setLeaves=${setLeaves} open=${open}/>`
    : nav.view === 'settings' && role === 'admin' ? html`<${Settings} onChange=${bump}/>`
    : html`<${Home} role=${role} user=${user} isMgr=${isMgr} leaves=${leaves} setLeaves=${setLeaves} ann=${ann} setAnn=${setAnn} presence=${presence} setPresence=${setPresence} go=${go} openForm=${openForm} open=${open}/>`;

  const brand = html`<div className="brand"><span className="mark"></span><span className="brand-t"><b>Maayasthra</b><span>People</span></span></div>`;
  const themeSeg = html`<div className="seg" role="group" aria-label="Theme"><button className=${theme === 'dark' ? 'on' : ''} onClick=${() => setTheme('dark')}>Dark</button><button className=${theme === 'light' ? 'on' : ''} onClick=${() => setTheme('light')}>Light</button></div>`;
  return html`<div className="app">
    <aside className="side">${brand}
      <nav className="nav" aria-label="Main">${keys.map(k => html`<button key=${k} className=${'nav-b' + (active === k ? ' on' : '')} onClick=${() => go(k)} aria-current=${active === k ? 'page' : undefined}>
        <${Icon} n=${ICON[k]}/>${ALL[k]}${k === 'requests' && badge > 0 && html`<span className="cnt">${badge}</span>`}</button>`)}</nav>
      <div className="side-foot">
        ${themeSeg}
        <button className="me" onClick=${() => open(user.n)} aria-label="Open your profile"><${Av} e=${user} s=${36}/><span><b>${user.name}</b><span>${role === 'admin' ? 'HR and Admin' : isMgr ? 'Manager' : 'Employee'}</span></span></button>
        <button className="btn ghost sm" style=${{ margin: '0 12px' }} onClick=${signOut}>Sign out</button></div>
    </aside>
    <div className="col">
      <div className="topbar">${brand}<div style=${{ display: 'flex', gap: 8, alignItems: 'center' }}>${themeSeg}<button className="btn ghost sm" onClick=${signOut}>Sign out</button></div></div>
      <main className="main" key=${nav.view + (nav.id || '')}>${screen}</main>
    </div>
    <nav className="bnav" style=${{ gridTemplateColumns: 'repeat(' + keys.length + ', 1fr)' }} aria-label="Main">${keys.map(k => html`<button key=${k} className=${active === k ? 'on' : ''} onClick=${() => go(k)}>
      <${Icon} n=${ICON[k]} s=${21}/>${SHORT[k] || ALL[k]}${k === 'requests' && badge > 0 && html`<span className="cnt">${badge}</span>`}</button>`)}</nav>
  </div>`;
}

createRoot(document.getElementById('root')).render(html`<${App}/>`);
