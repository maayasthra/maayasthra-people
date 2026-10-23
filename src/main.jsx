import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { html, Icon, Av } from './ui.jsx';
import { LEAVES0, HIST0, TODISO, TOD, DAY, isoOf, BY } from './data.js';
import { loadLeaves, persistLeaves } from './leave.js';
import { loadAttendance, mergeAtt, persistAtt } from './attendanceDb.js';
import { loadBoard, persistBoard, loadAnnouncements, persistAnnouncements, subscribeBoard, subscribeTables } from './tasksDb.js';
import { loadStaff } from './staff.js';
import { Login, SetPassword } from './screens/Login.jsx';
import { authEnabled, currentSession, resolveUser, onAuthChange, signOutAuth, isLinkFlow } from './auth.js';
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
import { loadAtt, saveAtt, setMe, checkOut, dayKey as dayKeyNow } from './attendance.js';
import { MyHours } from './screens/Hours.jsx';
import { AttendancePage } from './screens/AttendancePage.jsx';
import { TaskBoard } from './task/TaskBoard.jsx';
import { MyTasks } from './task/MyTasks.jsx';
import { TeamView } from './task/TeamView.jsx';
import { ProjectHours } from './task/ProjectHours.jsx';
import { CheckoutWarning } from './task/CheckoutWarning.jsx';
import { TaskDetail } from './task/TaskDetail.jsx';
import { isDoing, stopFor, loadTasks, saveTasks, loadCollapsed, saveCollapsed, loadCustom, saveCustom, loadLayout, saveLayout, loadView, saveView } from './tasks.js';
import { IS_DEMO } from './env.js';
import './styles.css';

const ALL = { board: 'Board', mytasks: 'My Tasks', timer: 'Project hours', team: 'Team', home: 'Home', people: 'People', org: 'Org chart', calendar: 'Calendar', attendance: 'Attendance', hours: 'My Hours', leaves: 'My Leaves', requests: 'Requests', settings: 'Settings' };
const SHORT = { mytasks: 'Mine', timer: 'Time', org: 'Org', leaves: 'Leaves', attendance: 'Hours', hours: 'Hours' };

const SEED_ANN = IS_DEMO ? [
  { id: 1, kind: 'holiday', title: 'Studio closed for Dussehra', body: 'The studio is closed on 20 October. Normal hours resume the next working day.', date: TODISO, by: 'Meera Iyer' },
  { id: 2, kind: 'reminder', title: 'Planning time off for Diwali?', body: 'Please send leave requests for the Diwali week early so the team can plan coverage.', date: isoOf(TOD - 2 * DAY), by: 'Meera Iyer' },
  { id: 3, kind: 'general', title: 'Keep your profile current', body: 'Add your phone number and an emergency contact from your profile. It takes a minute.', date: isoOf(TOD - 5 * DAY), by: 'Meera Iyer' }
] : [];

/* Two clear buttons switch between the apps. The active one is filled with its own colour. */
function AppSwitch({ app, setApp }) {
  return html`<div className="apps2" role="tablist" aria-label="Apps">${[['people', 'People', 'people', '#0A84FF'], ['task', 'Task', 'board', '#BF5AF2']].map(([k, l, ic, c]) => html`<button key=${k} role="tab" aria-selected=${app === k} className=${app === k ? 'on' : ''} style=${{ '--c': c }} onClick=${() => setApp(k)}><${Icon} n=${ic} s=${20}/><span>${l}</span></button>`)}</div>`;
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
      <${Av} e=${user} s=${32}/><span className="tr-n"><b>${user.name}</b><span>${role === 'admin' ? 'Admin' : role === 'pm' ? 'Project manager' : 'Employee'}</span></span></button>
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
  const [leaves, setLeavesRaw] = useState(() => [...LEAVES0.map(l => ({ ...l, state: 'pending' })), ...HIST0]);
  const leavesRef = useRef(leaves), [syncErr, setSyncErr] = useState(''), saving = useRef({ leave: 0, att: 0 });
  const applyLeaves = l => { leavesRef.current = l; setLeavesRaw(l); };
  // Screens change the list as before. In the live app each change is saved to the database, then the list is re-read.
  const setLeaves = fn => {
    const prev = leavesRef.current, next = typeof fn === 'function' ? fn(prev) : fn;
    applyLeaves(next);
    if (IS_DEMO) return;
    saving.current.leave++;
    persistLeaves(prev, next).then(loadLeaves)
      .catch(e => { setSyncErr(e.message || 'Could not save. Try again.'); return loadLeaves(); })
      .then(l => { if (l) applyLeaves(l); }).catch(() => {}).finally(() => { saving.current.leave--; });
  };
  const [outAsk, setOutAsk] = useState(false);
  const [ann, setAnnRaw] = useState(SEED_ANN);
  const annRef = useRef(ann);
  const applyAnn = a => { annRef.current = a; setAnnRaw(a); };
  const setAnn = fn => {
    const prev = annRef.current, next = typeof fn === 'function' ? fn(prev) : fn;
    applyAnn(next);
    if (IS_DEMO) return;
    persistAnnouncements(prev, next, auth && auth.user.n).then(loadAnnouncements).then(applyAnn)
      .catch(e => { setSyncErr(e.message || 'Could not save. Try again.'); return loadAnnouncements().then(applyAnn); }).catch(() => {});
  };
  const [pf, setPf] = useState({ q: '', dept: 'All', city: 'All', sort: 'name', former: false });
  const [ver, setVer] = useState(0);
  const [att, setAttRaw] = useState(() => IS_DEMO ? loadAtt() : {});
  const attRef = useRef(att);
  const applyAtt = a => { attRef.current = a; setAttRaw(a); };
  // Check-ins and hour edits are saved to the database in the live app, then the recent days are re-read.
  const setAtt = fn => {
    const prev = attRef.current, next = typeof fn === 'function' ? fn(prev) : fn;
    applyAtt(next);
    if (IS_DEMO) return;
    saving.current.att++;
    persistAtt(prev, next).then(() => loadAttendance(3)).then(f => applyAtt(mergeAtt(attRef.current, f)))
      .catch(e => { setSyncErr(e.message || 'Could not save. Try again.'); return loadAttendance(120).then(applyAtt); }).catch(() => {}).finally(() => { saving.current.att--; });
  };
  const [sOpen, setSOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [booting, setBooting] = useState(authEnabled), [linkFlow, setLinkFlow] = useState(isLinkFlow);
  const [app, setAppState] = useState('people');
  const [tasks, setTasksRaw] = useState(() => IS_DEMO ? loadTasks() : []), [collapsed, setCollapsed] = useState(loadCollapsed);
  const [focus, setFocus] = useState(null);
  const [taskSel, setTaskSel] = useState(null), [tq, setTq] = useState('');
  const [tf, setTf] = useState(loadView), [custom, setCustomRaw] = useState(() => IS_DEMO ? loadCustom() : []), [layout, setLayoutRaw] = useState(() => IS_DEMO ? loadLayout() : { order: [], hidden: [] });
  const board = useRef(null);
  const who = useRef({ mgr: false, me: 0 });
  who.current = { mgr: !!auth && (auth.role === 'admin' || auth.role === 'pm'), me: auth ? auth.user.n : 0 };
  if (!board.current) board.current = { tasks, custom, layout, saved: { tasks, custom, layout }, timer: 0, flying: false, dirty: false };
  const [navHidden, setNavHidden] = useState(() => { try { return localStorage.getItem('mp-nav') === '1'; } catch (x) { return false; } });
  const bump = () => setVer(v => v + 1);
  useEffect(() => { if (IS_DEMO) saveAtt(att); }, [att]);
  // A tab left open overnight still shows yesterday. Once it is a new day and nothing is waiting to be saved, start fresh.
  useEffect(() => {
    if (IS_DEMO) return;
    const day = TODISO, chk = () => { const b = board.current; if (dayKeyNow() !== day && !b.dirty && !b.flying && !saving.current.leave && !saving.current.att) window.location.reload(); };
    const t = setInterval(chk, 60000); document.addEventListener('visibilitychange', chk);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', chk); };
  }, []);
  useEffect(() => {
    if (IS_DEMO) return;
    if (!auth) { applyAtt({}); return; }
    let ok = true;
    const fresh = days => loadAttendance(days).then(f => { if (ok) applyAtt(days > 10 ? f : mergeAtt(attRef.current, f)); }).catch(e => { if (ok && days > 10) setSyncErr(e.message); });
    fresh(120);
    const lv = () => { if (!saving.current.leave) loadLeaves().then(l => { if (ok && !saving.current.leave && JSON.stringify(l) !== JSON.stringify(leavesRef.current)) applyLeaves(l); }).catch(() => {}); };
    const at = () => { if (!saving.current.att) fresh(3); };
    let tm = 0; const poke = () => { clearTimeout(tm); tm = setTimeout(() => { at(); lv(); }, 300); };
    // The staff list (photos, names, new people, roles) is refreshed whenever anyone changes it, and every few minutes as a backup.
    let sm = 0, lastStaff = Date.now(); const staffNow = () => { lastStaff = Date.now(); loadStaff().then(() => { if (ok) bump(); }).catch(() => {}); };
    const unsubStaff = subscribeTables('mp-staff', ['employees'], () => { clearTimeout(sm); sm = setTimeout(staffNow, 400); });
    const staffTick = setInterval(staffNow, 300000);
    const unsub = subscribeTables('mp-live', ['attendance_days', 'leave_requests'], poke);
    const t = setInterval(() => { at(); lv(); }, 60000), vis = () => { if (!document.hidden) { at(); lv(); if (Date.now() - lastStaff > 60000) staffNow(); } };
    document.addEventListener('visibilitychange', vis);
    return () => { ok = false; unsub(); unsubStaff(); clearTimeout(sm); clearInterval(staffTick); clearTimeout(tm); clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [auth]);
  useEffect(() => {
    if (IS_DEMO) return;
    if (!auth) { applyLeaves([]); return; }
    let ok = true;
    loadLeaves().then(l => { if (ok) applyLeaves(l); }).catch(e => { if (ok) setSyncErr(e.message); });
    return () => { ok = false; };
  }, [auth]);
  // Restore a saved session on load, and follow sign-outs from other tabs
  useEffect(() => {
    if (!authEnabled) return;
    let live = true;
    (async () => {
      if (!isLinkFlow()) {
        const sess = await currentSession();
        if (sess && live) { const r = await resolveUser(sess); if (r.user && live) { setMe(r.user.n); setAuth({ user: r.user, role: r.role }); } else if (r.error) signOutAuth(); }
      }
      if (live) setBooting(false);
    })();
    const sub = onAuthChange((ev, sess) => { if (ev === 'SIGNED_OUT') setAuth(null); if (ev === 'PASSWORD_RECOVERY') setLinkFlow(true); });
    return () => { live = false; sub.unsubscribe(); };
  }, []);
  // The board is shared. Changes are saved half a second after the last edit, and other people's changes arrive live.
  const flush = async () => {
    const b = board.current; if (b.flying) return;
    b.flying = true; b.dirty = false;
    const snap = { tasks: b.tasks, custom: b.custom, layout: b.layout };
    try { await persistBoard(b.saved, snap, who.current); b.saved = snap; }
    catch (e) { setSyncErr(e.message || 'Could not save. Try again.'); b.dirty = false; await refreshBoard(true); }
    finally { b.flying = false; if (b.dirty) queueSave(); }
  };
  const queueSave = () => { const b = board.current; b.dirty = true; clearTimeout(b.timer); b.timer = setTimeout(flush, 500); };
  const setTasks = fn => { const b = board.current; b.tasks = typeof fn === 'function' ? fn(b.tasks) : fn; setTasksRaw(b.tasks); if (!IS_DEMO) queueSave(); };
  const setCustom = fn => { const b = board.current; b.custom = typeof fn === 'function' ? fn(b.custom) : fn; setCustomRaw(b.custom); if (!IS_DEMO) queueSave(); };
  const setLayout = fn => { const b = board.current; b.layout = typeof fn === 'function' ? fn(b.layout) : fn; setLayoutRaw(b.layout); if (!IS_DEMO) queueSave(); };
  const refreshBoard = async force => {
    const b = board.current; if (!force && (b.dirty || b.flying)) return;
    try {
      const f = await loadBoard(), a = await loadAnnouncements();
      if (!force && (b.dirty || b.flying)) return;
      if (JSON.stringify(f.tasks) !== JSON.stringify(b.tasks) || JSON.stringify(f.custom) !== JSON.stringify(b.custom)) { b.tasks = f.tasks; b.custom = f.custom; setTasksRaw(f.tasks); setCustomRaw(f.custom); }
      if (JSON.stringify(f.layout) !== JSON.stringify(b.layout)) { b.layout = f.layout; setLayoutRaw(f.layout); }
      b.saved = { tasks: f.tasks, custom: f.custom, layout: f.layout };
      if (JSON.stringify(a) !== JSON.stringify(annRef.current)) applyAnn(a);
    } catch (e) { if (force) setSyncErr(e.message); }
  };
  useEffect(() => {
    if (IS_DEMO) return;
    const b = board.current;
    if (!auth) { clearTimeout(b.timer); Object.assign(b, { tasks: [], custom: [], layout: { order: [], hidden: [] }, saved: { tasks: [], custom: [], layout: { order: [], hidden: [] } }, dirty: false }); setTasksRaw([]); setCustomRaw([]); setLayoutRaw({ order: [], hidden: [] }); applyAnn([]); return; }
    refreshBoard(true);
    let t = 0; const poke = () => { clearTimeout(t); t = setTimeout(() => refreshBoard(false), 300); };
    const unsub = subscribeBoard(poke), poll = setInterval(() => refreshBoard(false), 45000), vis = () => { if (!document.hidden) refreshBoard(false); };
    document.addEventListener('visibilitychange', vis);
    return () => { unsub(); clearInterval(poll); clearTimeout(t); document.removeEventListener('visibilitychange', vis); };
  }, [auth]);
  useEffect(() => { if (IS_DEMO) saveTasks(tasks); }, [tasks]);
  useEffect(() => { saveCollapsed(collapsed); }, [collapsed]);
  useEffect(() => { if (IS_DEMO) saveCustom(custom); }, [custom]);
  useEffect(() => { if (IS_DEMO) saveLayout(layout); }, [layout]);
  useEffect(() => { saveView(tf); }, [tf]);
  useEffect(() => { try { localStorage.setItem('mp-nav', navHidden ? '1' : '0'); } catch (x) {} }, [navHidden]);

  if (booting) return html`<div className="boot"><span className="mark"></span></div>`;
  if (!auth && linkFlow) return html`<${SetPassword} onDone=${(user, role) => { setMe(user.n); setLinkFlow(false); setNav({ view: 'home' }); setAuth({ user, role }); }}/>`;
  if (!auth) return html`<${Login} onLogin=${(user, role) => { setMe(user.n); setNav({ view: 'home' }); setAuth({ user, role }); window.scrollTo({ top: 0 }); }}/>`;
  // The live record, so a change to your own details (shift times, name) shows straight away
  const user = (!IS_DEMO && BY[auth.user.n]) || auth.user, role = auth.role;
  const peopleKeys = role === 'admin' ? ['home', 'people', 'org', 'calendar', 'attendance', 'leaves', 'requests', 'settings'] : ['home', 'people', 'org', 'calendar', 'hours', 'leaves'];
  // Admins and project managers get the whole task app. Everyone else gets only their own tasks.
  const isMgr = role === 'admin' || role === 'pm';
  // Checking out ends the day's task timers. If any are running, show them first.
  const running = tasks.filter(t => isDoing(t, user.n));
  const stopMyTimers = at => setTasks(ts => ts.map(t => isDoing(t, user.n) ? { ...t, time: stopFor(t.time, user.n, at) } : t));
  const requestOut = () => { if (running.length) setOutAsk(true); else setAtt(a => checkOut(a, user.n)); };
  const confirmOut = () => { setOutAsk(false); setAtt(a => checkOut(a, user.n)); stopMyTimers(Date.now()); };
  const autoOut = at => { setAtt(a => checkOut(a, user.n, at)); stopMyTimers(at); };
  const keys = app === 'task' ? (isMgr ? ['board', 'mytasks', 'timer', 'team'] : ['mytasks']) : peopleKeys;
  const setApp = a => { setAppState(a); setNav({ view: a === 'task' ? (isMgr ? 'board' : 'mytasks') : 'home' }); setTaskSel(null); setSOpen(false); window.scrollTo({ top: 0 }); };
  const openTask = (id, ctx) => setTaskSel({ id, ctx });
  const goTask = id => { setAppState('task'); setNav({ view: 'mytasks' }); setTaskSel(id ? { id } : null); window.scrollTo({ top: 0 }); };
  const top = () => window.scrollTo({ top: 0 });
  const go = v => { setNav({ view: v }); setTaskSel(null); setMoreOpen(false); top(); };
  const open = (id, tab) => { setNav(p => ({ view: 'profile', id, tab: typeof tab === 'string' ? tab : undefined, from: p.view === 'profile' ? p.from : p.view === 'form' ? 'people' : p.view })); top(); };
  const openForm = id => { setNav(p => ({ view: 'form', id, from: p.view === 'profile' ? p.from : p.view })); top(); };
  const back = () => { setNav({ view: nav.from || 'people' }); top(); };
  const formDone = id => { if (id) { setNav(p => ({ view: 'profile', id, from: p.from || 'people' })); } else go('people'); top(); };
  const signOut = () => { signOutAuth(); setAuth(null); setAppState('people'); setTaskSel(null); setNav({ view: 'home' }); top(); };
  const mob = app === 'task' ? keys : role === 'admin' ? ['home', 'people', 'attendance', 'requests', 'more'] : ['home', 'people', 'hours', 'leaves', 'more'];
  const more = keys.filter(k => !mob.includes(k));
  const active = nav.view === 'profile' || nav.view === 'form' ? (nav.from || 'people') : nav.view;
  const pending = role === 'admin' ? leaves.filter(l => !l.past && l.state === 'pending').length : 0;

  const home = html`<${Home} role=${role} user=${user} leaves=${leaves} setLeaves=${setLeaves} ann=${ann} setAnn=${setAnn} att=${att} setAtt=${setAtt} onOut=${requestOut} tasks=${tasks} goTask=${goTask} go=${go} openForm=${openForm} open=${open}/>`;
  const taskScreen = nav.view === 'timer' && isMgr ? html`<${ProjectHours} tasks=${tasks} user=${user} role=${role}/>`
    : nav.view === 'mytasks' || !isMgr ? html`<${MyTasks} tasks=${tasks} setTasks=${setTasks} user=${user} tq=${tq} openTask=${openTask}/>`
    : nav.view === 'team' && isMgr ? html`<${TeamView} tasks=${tasks} onPick=${n => { setTf(f => ({ ...f, dept: 'All' })); setFocus(n); go('board'); }}/>`
    : html`<${TaskBoard} tasks=${tasks} setTasks=${setTasks} user=${user} role=${role} tf=${tf} setTf=${setTf} tq=${tq} openTask=${openTask} focus=${focus} collapsed=${collapsed} setCollapsed=${setCollapsed} custom=${custom} setCustom=${setCustom} layout=${layout} setLayout=${setLayout}/>`;
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
  return html`<div className=${'app' + (navHidden ? ' no-side' : '')}>
    <aside className="side">${brand}
      <${AppSwitch} app=${app} setApp=${setApp}/>
      <nav className="nav" aria-label="Main">${keys.map(k => html`<button key=${k} className=${'nav-b' + (active === k ? ' on' : '')} onClick=${() => go(k)} aria-current=${active === k ? 'page' : undefined}>
        <${Icon} n=${k}/>${ALL[k]}${k === 'requests' && pending > 0 && html`<span className="cnt">${pending}</span>`}</button>`)}</nav>
    </aside>
    <div className="col">
      <header className="hdr"><button className="ib nav-t" onClick=${() => setNavHidden(h => !h)} aria-label=${navHidden ? 'Show the navigation bar' : 'Hide the navigation bar'} title=${navHidden ? 'Show the navigation bar' : 'Hide the navigation bar'}><${Icon} n="sidebar" s=${18}/></button><div className="hdr-b"><${AppSwitch} app=${app} setApp=${setApp}/></div>
        <div className=${'hs' + (sOpen ? ' open' : '')}>${app === 'task' ? html`<div className="qs"><${Icon} n="search"/><input id="quick-search" className="qs-in" value=${tq} placeholder="Search tasks" onChange=${ev => setTq(ev.target.value)} aria-label="Search tasks"/></div>` : html`<${QuickSearch} open=${id => { setSOpen(false); open(id); }}/>`}</div>
        <button className="ib hs-b" onClick=${() => { setSOpen(o => !o); setTimeout(() => { const el = document.getElementById('quick-search'); if (el) el.focus(); }, 30); }} aria-label="Search"><${Icon} n="search" s=${17}/></button>
        <div className="ck-d"><${CheckWidget} user=${user} att=${att} setAtt=${setAtt} onOut=${requestOut} onAutoOut=${autoOut}/></div>
        <${TopRight} user=${user} role=${role} open=${open} openForm=${openForm} signOut=${signOut}/></header>
      <div className="ck-m"><${CheckWidget} user=${user} att=${att} setAtt=${setAtt} onOut=${requestOut} onAutoOut=${autoOut}/></div>
      <main className="main" key=${app + nav.view + (nav.id || '')}>${screen}</main>
      ${syncErr && html`<div className="sync-err" role="alert"><span>${syncErr}</span><button onClick=${() => setSyncErr('')} aria-label="Dismiss">Dismiss</button></div>`}
    </div>
    ${outAsk && html`<${CheckoutWarning} running=${running} me=${user.n} onConfirm=${confirmOut} onCancel=${() => setOutAsk(false)}/>`}
    ${taskSel && html`<${TaskDetail} key=${taskSel.id} id=${taskSel.id} ctx=${taskSel.ctx} tasks=${tasks} setTasks=${setTasks} user=${user} role=${role} leaves=${leaves} custom=${custom} close=${() => setTaskSel(null)}/>`}
    <nav className="bnav" style=${{ gridTemplateColumns: 'repeat(' + mob.length + ', 1fr)' }} aria-label="Main">${mob.map(k => k === 'more'
      ? html`<button key=${k} className=${more.includes(active) || moreOpen ? 'on' : ''} onClick=${() => setMoreOpen(o => !o)} aria-expanded=${moreOpen}><${Icon} n="dots" s=${22}/>More</button>`
      : html`<button key=${k} className=${active === k && !moreOpen ? 'on' : ''} onClick=${() => go(k)}><${Icon} n=${k} s=${22}/>${SHORT[k] || ALL[k]}${k === 'requests' && pending > 0 && html`<span className="cnt">${pending}</span>`}</button>`)}</nav>
    ${moreOpen && html`<div className="mo-bg" onClick=${() => setMoreOpen(false)}></div><div className="mo" role="menu">${more.map(k => html`<button key=${k} role="menuitem" className=${active === k ? 'on' : ''} onClick=${() => go(k)}><${Icon} n=${k} s=${22}/>${ALL[k]}${k === 'requests' && pending > 0 && html`<span className="cnt">${pending}</span>`}</button>`)}</div>`}
  </div>`;
}

createRoot(document.getElementById('root')).render(html`<${App}/>`);
