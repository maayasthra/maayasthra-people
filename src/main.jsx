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
import './styles.css';

const ALL = { home: 'Home', people: 'People', org: 'Org chart', calendar: 'Calendar', leaves: 'My Leaves', requests: 'Requests', settings: 'Settings' };
const SHORT = { org: 'Org', leaves: 'Leaves' };

const SEED_ANN = [
  { id: 1, kind: 'holiday', title: 'Studio closed for Dussehra', body: 'The studio is closed on 20 October. Normal hours resume the next working day.', date: TODISO, by: 'Meera Iyer' },
  { id: 2, kind: 'reminder', title: 'Planning time off for Diwali?', body: 'Please send leave requests for the Diwali week early so the team can plan coverage.', date: isoOf(TOD - 2 * DAY), by: 'Meera Iyer' },
  { id: 3, kind: 'general', title: 'Keep your profile current', body: 'Add your phone number and an emergency contact from your profile. It takes a minute.', date: isoOf(TOD - 5 * DAY), by: 'Meera Iyer' }
];

function readTheme() { try { return localStorage.getItem('mp-theme') || 'dark'; } catch (x) { return 'dark'; } }

function TopRight({ user, role, theme, setTheme, open, openForm, signOut }) {
  const [menu, setMenu] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const f = ev => { if (ref.current && !ref.current.contains(ev.target)) setMenu(false); };
    const k = ev => { if (ev.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', f); document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', f); document.removeEventListener('keydown', k); };
  }, [menu]);
  const dark = theme === 'dark';
  return html`<div className="tr" ref=${ref}>
    <button className="ib" onClick=${() => setTheme(dark ? 'light' : 'dark')} aria-label=${dark ? 'Switch to light mode' : 'Switch to dark mode'} title=${dark ? 'Light mode' : 'Dark mode'}><${Icon} n=${dark ? 'sun' : 'moon'} s=${17}/></button>
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
  const [theme, setTheme] = useState(readTheme);
  const [sOpen, setSOpen] = useState(false);
  const bump = () => setVer(v => v + 1);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('mp-theme', theme); } catch (x) {}
  }, [theme]);

  if (!auth) return html`<${Login} onLogin=${(user, role) => { setNav({ view: 'home' }); setAuth({ user, role }); window.scrollTo({ top: 0 }); }}/>`;
  const user = auth.user, role = auth.role;
  const keys = role === 'admin' ? ['home', 'people', 'org', 'calendar', 'leaves', 'requests', 'settings'] : ['home', 'people', 'org', 'calendar', 'leaves'];
  const top = () => window.scrollTo({ top: 0 });
  const go = v => { setNav({ view: v }); top(); };
  const open = id => { setNav(p => ({ view: 'profile', id, from: p.view === 'profile' ? p.from : p.view === 'form' ? 'people' : p.view })); top(); };
  const openForm = id => { setNav(p => ({ view: 'form', id, from: p.view === 'profile' ? p.from : p.view })); top(); };
  const back = () => { setNav({ view: nav.from || 'people' }); top(); };
  const formDone = id => { if (id) { setNav(p => ({ view: 'profile', id, from: p.from || 'people' })); } else go('people'); top(); };
  const signOut = () => { setAuth(null); setNav({ view: 'home' }); top(); };
  const active = nav.view === 'profile' || nav.view === 'form' ? (nav.from || 'people') : nav.view;
  const pending = role === 'admin' ? leaves.filter(l => !l.past && l.emp !== user.n && l.state === 'pending').length : 0;

  const home = html`<${Home} role=${role} user=${user} leaves=${leaves} setLeaves=${setLeaves} ann=${ann} setAnn=${setAnn} go=${go} openForm=${openForm} open=${open}/>`;
  const screen = nav.view === 'home' ? home
    : nav.view === 'people' ? html`<${People} pf=${pf} setPf=${setPf} open=${open} openForm=${openForm} role=${role} ver=${ver}/>`
    : nav.view === 'org' ? html`<${OrgChart} open=${open} user=${user} key=${ver}/>`
    : nav.view === 'profile' ? html`<${Profile} key=${nav.id + '-' + ver} id=${nav.id} from=${nav.from} back=${back} open=${open} openForm=${openForm} user=${user} role=${role} leaves=${leaves} ver=${ver}/>`
    : nav.view === 'form' ? html`<${EmployeeForm} key=${'f' + nav.id} id=${nav.id} role=${role} user=${user} done=${formDone} bump=${bump}/>`
    : nav.view === 'calendar' ? html`<${CalendarView} leaves=${leaves} open=${open} key=${ver}/>`
    : nav.view === 'leaves' ? html`<${MyLeaves} leaves=${leaves} setLeaves=${setLeaves} user=${user} key=${ver}/>`
    : nav.view === 'requests' && role === 'admin' ? html`<${Requests} user=${user} leaves=${leaves} setLeaves=${setLeaves} open=${open}/>`
    : nav.view === 'settings' && role === 'admin' ? html`<${Settings} onChange=${bump}/>`
    : home;

  const brand = html`<div className="brand"><span className="mark"></span><span className="brand-t"><b>Maayasthra</b><span>People</span></span></div>`;
  return html`<div className="app">
    <aside className="side">${brand}
      <nav className="nav" aria-label="Main">${keys.map(k => html`<button key=${k} className=${'nav-b' + (active === k ? ' on' : '')} onClick=${() => go(k)} aria-current=${active === k ? 'page' : undefined}>
        <${Icon} n=${k}/>${ALL[k]}${k === 'requests' && pending > 0 && html`<span className="cnt">${pending}</span>`}</button>`)}</nav>
    </aside>
    <div className="col">
      <header className="hdr"><div className="hdr-b">${brand}</div>
        <div className=${'hs' + (sOpen ? ' open' : '')}><${QuickSearch} open=${id => { setSOpen(false); open(id); }}/></div>
        <button className="ib hs-b" onClick=${() => { setSOpen(o => !o); setTimeout(() => { const el = document.getElementById('quick-search'); if (el) el.focus(); }, 30); }} aria-label="Search people"><${Icon} n="search" s=${17}/></button>
        <${TopRight} user=${user} role=${role} theme=${theme} setTheme=${setTheme} open=${open} openForm=${openForm} signOut=${signOut}/></header>
      <main className="main" key=${nav.view + (nav.id || '')}>${screen}</main>
    </div>
    <nav className="bnav" style=${{ gridTemplateColumns: 'repeat(' + keys.length + ', 1fr)' }} aria-label="Main">${keys.map(k => html`<button key=${k} className=${active === k ? 'on' : ''} onClick=${() => go(k)}>
      <${Icon} n=${k} s=${21}/>${SHORT[k] || ALL[k]}${k === 'requests' && pending > 0 && html`<span className="cnt">${pending}</span>`}</button>`)}</nav>
  </div>`;
}

createRoot(document.getElementById('root')).render(html`<${App}/>`);
