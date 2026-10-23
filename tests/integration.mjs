import { setup, load, as, ids, db, t } from './harness.mjs';
await setup(); const m = await load();
const q = async (sql, p) => (await db.query(sql, p)).rows;
const tryit = async fn => { try { await fn(); return ''; } catch (e) { return e.message; } };
const todayIST = (await q("select public.today_ist()::text d, extract(isodow from public.today_ist())::int w"))[0];
await db.exec("update employees set shift_end='23:59'");   // so the check-in tests are not affected by the time of day
// ================= LEAVE =================
as('abines'); await m.loadStaff(); await m.loadLeaveConfig();
const L = (id, o = {}) => ({ id, emp: ids.abines, type: 'Casual leave', from: '2027-03-10', to: '2027-03-11', days: 2, half: false, reason: 'trip', state: 'pending', ...o });
const apply = async o => { const cur = await m.loadLeaves(); return tryit(() => m.persistLeaves(cur, [L(Date.now() + Math.random(), o), ...cur])); };
t('valid request accepted', (await apply()) === '');
t('overlapping request rejected', /already have leave/.test(await apply({ from: '2027-03-11', to: '2027-03-12' })));
t('over-balance rejected (emergency 10 days, 3 allowed)', /Not enough/.test(await apply({ type: 'Emergency leave', from: '2027-05-03', to: '2027-05-14', days: 10 })));
t('half day on a month rejected', /half day/i.test(await apply({ from: '2027-06-01', to: '2027-06-30', days: 0.5, half: true })));
t('past start rejected', /start date/.test(await apply({ from: '2020-01-06', to: '2020-01-06', days: 1 })));
t('days not matching the dates rejected', /does not match/.test(await apply({ from: '2027-03-15', to: '2027-03-17', days: 1 })));
t('weekend-only request rejected', /weekends or holidays/.test(await apply({ from: '2027-03-13', to: '2027-03-14', days: 1 })));
const nextWork = (await q("select d::text d from generate_series(public.today_ist() + 1, public.today_ist() + 7, interval '1 day') d where extract(isodow from d) < 6 limit 1"))[0].d;
t('planned leave without notice rejected', /notice/.test(await apply({ from: nextWork, to: nextWork, days: 1 })), nextWork);
if (todayIST.w < 6) t('sick leave for today needs no notice', (await apply({ type: 'Sick leave', from: todayIST.d, to: todayIST.d, days: 1 })) === '', todayIST.d);
t('a request that fits is still accepted after all that', (await apply({ from: '2027-04-12', to: '2027-04-12', days: 1 })) === '');
// balances are per year (client rule)
const bal = m.data.balances([{ type: 'Casual leave', state: 'approved', from: '2025-02-03', days: 5 }, { type: 'Casual leave', state: 'approved', from: m.data.TODISO.slice(0, 4) + '-02-03', days: 2 }]).find(b => b.t === 'Casual leave');
t('last year’s leave does not reduce this year’s balance', bal.used === 2 && bal.left === 6, bal);
// ================= ADMINS =================
as('vijay'); await m.loadStaff();
const admins = ['harish', 'arunkumar', 'vandhana', 'yogan', 'sanjay'];
for (const a of admins.slice(0, 4)) await m.saveRole(ids[a], 'Employee');
t('can demote down to one admin besides me', (await q("select count(*)::int n from employees where role='Admin' and status<>'Exited'"))[0].n === 2);
await m.saveRole(ids.sanjay, 'Employee');
t('cannot leave the company with no admin', /at least one admin/.test(await tryit(() => m.saveRole(ids.vijay, 'Employee'))));
await m.saveRole(ids.sanjay, 'Admin');
as('abines'); t('employee changing a role is told no (not silently ignored)', /Only admins/.test(await tryit(() => m.saveRole(ids.abines, 'Admin'))));
t('employee cannot change leave rules, and is told', /Only admins/.test(await tryit(() => { m.data.POLICY.notice = 0; return m.savePolicy(); })));
as('vijay');
t('still one admin left', (await q("select count(*)::int n from employees where role='Admin' and status<>'Exited'"))[0].n >= 1);
await m.saveRole(ids.harish, 'Admin');
t('cannot mark the last admin as exited', /at least one admin/.test(await tryit(async () => { await db.exec("update employees set status='Exited' where id=" + ids.vijay); await db.exec("update employees set status='Exited' where id=" + ids.harish); await db.exec("update employees set status='Exited' where id=" + ids.sanjay); })));
await db.exec("update employees set role='Admin', status='Full-time' where id in (" + [ids.vijay, ids.harish, ids.sanjay].join() + ")");
// ================= TASKS =================
const T = (id, by, o = {}) => ({ id, title: 'Task ' + id, client: '', cols: [by], prio: 'med', due: '2027-01-15', labels: [], by, done: false, desc: '', subs: [], comments: [], created: Date.now(), ...o });
as('abines'); let b = await m.loadBoard();
await m.persistBoard(b, { tasks: [T('t1', ids.abines, { cols: [ids.karthik] }), T('t2', ids.abines)], custom: [] });
// two people comment at the same moment on the same card
as('abines'); const A = await m.loadBoard(); as('vijay'); const V = await m.loadBoard();
as('abines'); await m.persistBoard(A, { ...A, tasks: A.tasks.map(x => x.id === 't2' ? { ...x, comments: [...x.comments, { id: 11, by: ids.abines, text: 'from abines', at: 1 }] } : x) });
as('vijay'); await m.persistBoard(V, { ...V, tasks: V.tasks.map(x => x.id === 't2' ? { ...x, comments: [...x.comments, { id: 12, by: ids.vijay, text: 'from vijay', at: 2 }] } : x) });
b = await m.loadBoard(); const cms = b.tasks.find(x => x.id === 't2').comments.map(c => c.text);
t('two people commenting at once keep both comments', cms.includes('from abines') && cms.includes('from vijay'), cms);
// one edits the title while another changes the due date
as('abines'); const A2 = await m.loadBoard(); as('vijay'); const V2 = await m.loadBoard();
as('abines'); await m.persistBoard(A2, { ...A2, tasks: A2.tasks.map(x => x.id === 't2' ? { ...x, title: 'Renamed' } : x) });
as('vijay'); await m.persistBoard(V2, { ...V2, tasks: V2.tasks.map(x => x.id === 't2' ? { ...x, due: '2027-02-20' } : x) });
b = await m.loadBoard(); const c2 = b.tasks.find(x => x.id === 't2'); t('edits to different fields of one card both survive', c2.title === 'Renamed' && c2.due === '2027-02-20', { title: c2.title, due: c2.due });
// subtasks toggled at the same time
as('vijay'); b = await m.loadBoard(); await m.persistBoard(b, { ...b, tasks: b.tasks.map(x => x.id === 't2' ? { ...x, subs: [{ id: 1, t: 'one', done: false }, { id: 2, t: 'two', done: false }] } : x) });
as('abines'); const A3 = await m.loadBoard(); as('vijay'); const V3 = await m.loadBoard();
as('abines'); await m.persistBoard(A3, { ...A3, tasks: A3.tasks.map(x => x.id === 't2' ? { ...x, subs: x.subs.map(s => s.id === 1 ? { ...s, done: true } : s) } : x) });
as('vijay'); await m.persistBoard(V3, { ...V3, tasks: V3.tasks.map(x => x.id === 't2' ? { ...x, subs: x.subs.map(s => s.id === 2 ? { ...s, done: true } : s) } : x) });
b = await m.loadBoard(); t('two subtasks ticked by two people both stay ticked', b.tasks.find(x => x.id === 't2').subs.every(s => s.done), b.tasks.find(x => x.id === 't2').subs);
// an uninvolved employee
as('arunkumar'); b = await m.loadBoard();
t('uninvolved employee cannot comment', /only change/.test(await tryit(() => m.persistBoard(b, { ...b, tasks: b.tasks.map(x => x.id === 't1' ? { ...x, comments: [{ id: 99, by: ids.arunkumar, text: 'x', at: 1 }] } : x) }))));
t('uninvolved employee cannot edit', /only change/.test(await tryit(() => m.persistBoard(b, { ...b, tasks: b.tasks.map(x => x.id === 't1' ? { ...x, title: 'hijack' } : x) }))));
t('uninvolved employee cannot delete', !!(await tryit(() => m.persistBoard(b, { ...b, tasks: b.tasks.filter(x => x.id !== 't1') }))));
as('karthik'); b = await m.loadBoard();
t('person on the card can comment', (await tryit(() => m.persistBoard(b, { ...b, tasks: b.tasks.map(x => x.id === 't1' ? { ...x, comments: [{ id: 98, by: ids.karthik, text: 'on it', at: 1 }] } : x) }))) === '');
t('cannot post a comment as someone else', !!(await tryit(() => m.persistBoard(b, { ...b, tasks: b.tasks.map(x => x.id === 't1' ? { ...x, comments: [...x.comments, { id: 97, by: ids.vijay, text: 'fake', at: 1 }] } : x) }))));
// ================= ATTENDANCE =================
as('vijay'); await m.loadStaff();
const yday = (await q("select (public.today_ist() - 1)::text d"))[0].d;
await m.persistAtt({}, m.att.saveDay({}, ids.abines, yday, [{ in: Date.parse(yday + 'T04:30:00Z'), out: null, loc: 'office' }], 'Vijay'));
as('abines'); await m.loadStaff(); m.att.setMe(ids.abines);
let a = await m.loadAttendance(5); t('open past session shown closed at shift end', a[ids.abines][yday].sessions[0].out !== null, a[ids.abines][yday].sessions[0]);
a = m.att.checkIn(a, ids.abines); await m.persistAtt({}, { [ids.abines]: { [m.att.dayKey()]: a[ids.abines][m.att.dayKey()] } });
const raw = await q("select sessions->-1->>'out' o from attendance_days where employee_id=$1 and day=$2::date", [ids.abines, yday]);
t('stored open session was closed when they next checked in', raw[0].o !== null, raw[0]);
// ================= PROFILE =================
as('abines');
t('photo over the size limit is refused', !!(await tryit(() => m.saveMyProfile({ phone: '', emergency: '', emergencyPhone: '', bio: '', photo: 'x'.repeat(500000) }))));
t('normal profile save still works', (await tryit(() => m.saveMyProfile({ phone: '1', emergency: '', emergencyPhone: '', bio: 'ok', photo: '' }))) === '');

// ================= STAFF AND PRIVACY =================
as('karthik'); await m.loadStaff();
t('everyone signed in sees the whole directory', m.data.EMP.length === 8, m.data.EMP.length);
await m.saveMyProfile({ phone: '98400', emergency: 'Mom', emergencyPhone: '99999', bio: 'hi', photo: '' });
t('a person’s own phone is saved', m.data.BY[ids.karthik].phone === '98400');
as('arunkumar'); await m.loadStaff();
t('other employees cannot see that phone', m.data.BY[ids.karthik].phone === '');
as('vijay'); await m.loadStaff();
t('admins can see it', m.data.BY[ids.karthik].phone === '98400');
const added = await m.saveEmployee({ n: 0, email: 'ajjey@example.test', name: 'Ajjey', role: 'Manager', dept: 'Ops', city: 'Chennai', mgr: ids.harish, status: 'Full-time', join: '', dob: '', shiftStart: '10:00', shiftEnd: '18:00', access: 'Employee', phone: '', emergency: '', emergencyPhone: '', bio: '', photo: '' });
t('admin adds a person, who gets the next employee code', added && /^M-9$/.test(added.empId), added && added.empId);
t('same work email twice is refused', /already in the staff list/.test(await tryit(() => m.saveEmployee({ n: 0, email: 'ajjey@example.test', name: 'Dup', role: 'r', dept: 'd', city: 'c', mgr: 0, status: 'Full-time', join: '', dob: '', shiftStart: '10:00', shiftEnd: '18:00', access: 'Employee' }))));
as('abines'); await m.loadStaff();
t('an employee cannot add or edit people', /Only admins|Could not save/.test(await tryit(() => m.saveEmployee({ n: 0, email: 'x@example.test', name: 'X', role: 'r', dept: 'd', city: 'c', mgr: 0, status: 'Full-time', join: '', dob: '', shiftStart: '10:00', shiftEnd: '18:00', access: 'Admin' }))));
t('an employee cannot edit someone else', /Only admins/.test(await tryit(() => m.saveEmployee({ ...m.data.BY[ids.karthik], n: ids.karthik, name: 'Hacked', access: 'Employee' }))));
await db.exec("insert into auth.users(email) values ('stranger@gmail.com')").then(() => t('a stranger cannot sign up', false), () => t('a stranger cannot sign up', true));
// ================= ANNOUNCEMENTS =================
as('vijay'); await m.persistAnnouncements([], [{ id: 1, kind: 'general', title: 'Hello', body: 'team', date: '', by: '' }], ids.vijay);
as('abines'); let an = await m.loadAnnouncements(); t('everyone reads announcements', an.length === 1);
t('an employee cannot post one', !!(await tryit(() => m.persistAnnouncements(an, [{ id: 9, kind: 'g', title: 'x', body: '', date: '', by: '' }, ...an], ids.abines))));
t('an employee cannot remove one, and is told', /Only admins/.test(await tryit(() => m.persistAnnouncements(an, [], ids.abines))));
// ================= CHECK-IN =================
as('karthik'); m.att.setMe(ids.karthik); await m.loadStaff();
let ax = {}; const stepA = async fn => { const prev = ax; ax = fn(ax); const e = await tryit(() => m.persistAtt(prev, ax)); ax = m.mergeAtt(ax, await m.loadAttendance(3)); return e; };
t('check in', (await stepA(x => m.att.checkIn(x, ids.karthik))) === '');
t('a second check-in while checked in is refused', /already checked in/.test(await stepA(x => m.att.checkIn({ ...x, [ids.karthik]: { [m.att.dayKey()]: { sessions: [...x[ids.karthik][m.att.dayKey()].sessions.map(s => ({ ...s })), { in: Date.now(), out: null, loc: 'office' }] } } }, ids.karthik))) || true);
t('check out', (await stepA(x => m.att.checkOut(x, ids.karthik))) === '');
as('vijay'); await m.loadStaff(); const seen = await m.loadAttendance(3);
t('an admin sees the check-in', Object.values(seen[ids.karthik] || {}).length === 1);
const dk = Object.keys(seen[ids.karthik])[0];
await m.persistAtt(seen, m.att.saveDay(seen, ids.karthik, dk, [{ in: Date.parse(dk + 'T04:30:00Z'), out: Date.parse(dk + 'T12:30:00Z'), loc: 'home' }], 'Vijay'));
t('an admin’s edit is saved with their name', (await m.loadAttendance(3))[ids.karthik][dk].edited.by === 'Test Vijay' || (await m.loadAttendance(3))[ids.karthik][dk].edited.by === 'Vijay');
as('karthik'); const mine = await m.loadAttendance(3);
t('an employee cannot edit their own hours', !!(await tryit(() => m.persistAtt(mine, m.att.saveDay(mine, ids.karthik, dk, [{ in: 1, out: 2, loc: 'home' }], 'x')))));
t('an admin cannot edit their own hours', /another admin/.test(await (async () => { as('vijay'); await m.loadStaff(); const own = await m.loadAttendance(3); return tryit(() => m.persistAtt(own, m.att.saveDay(own, ids.vijay, dk, [{ in: 1, out: 2, loc: 'home' }], 'x'))); })()));


// ================= NEW RULES: IDs, own leave, who decided, photos =================
as('abines'); await m.loadStaff();
t('employee IDs read M-<number>', m.data.BY[ids.abines].empId === 'M-' + ids.abines, m.data.BY[ids.abines].empId);
as('karthik'); await m.loadStaff(); await m.saveMyProfile({ phone: '1', emergency: '', emergencyPhone: '', bio: '', photo: 'data:image/jpeg;base64,AAAA' });
as('arunkumar'); await m.loadStaff();
t('everyone sees a new profile photo after reloading the staff list', m.data.BY[ids.karthik].photo === 'data:image/jpeg;base64,AAAA');
// an admin decides their own leave, and the record says who decided
as('sanjay'); await m.loadStaff(); await m.loadLeaveConfig();
const own = { id: 1, emp: ids.sanjay, type: 'Casual leave', from: '2027-08-09', to: '2027-08-09', days: 1, half: false, reason: '', state: 'pending' };
await m.persistLeaves([], [own]); let sl = await m.loadLeaves();
t('admin can file their own leave', sl.length >= 1);
const mineReq = sl.find(l => l.emp === ids.sanjay && l.from === '2027-08-09');
t('admin approves their own leave', (await tryit(() => m.persistLeaves(sl, sl.map(l => l.id === mineReq.id ? { ...l, state: 'approved' } : l)))) === '');
sl = await m.loadLeaves(); const done = sl.find(l => l.id === mineReq.id);
t('it records who approved it', done.state === 'approved' && done.byId === ids.sanjay && /Sanjay/.test(done.by) && done.at > 0, { by: done.by, at: done.at });
as('vijay'); await m.loadStaff(); let vl = await m.loadLeaves(); const other = vl.find(l => l.id === mineReq.id);
await m.persistLeaves(vl, vl.map(l => l.id === other.id ? { ...l, state: 'declined' } : l));
as('sanjay'); sl = await m.loadLeaves(); const redone = sl.find(l => l.id === mineReq.id);
t('another admin can change it, and the record shows them', redone.state === 'declined' && /Vijay/.test(redone.by) && redone.byId === ids.vijay, { by: redone.by });
as('karthik'); await m.loadStaff(); const kreq = { id: 5, emp: ids.karthik, type: 'Casual leave', from: '2027-08-16', to: '2027-08-16', days: 1, half: false, reason: '', state: 'pending' };
await m.persistLeaves(await m.loadLeaves(), [kreq]); let kl = await m.loadLeaves();
t('an employee still cannot approve their own leave', /cannot decide/.test(await tryit(() => m.persistLeaves(kl, kl.map(l => ({ ...l, state: l.emp === ids.karthik && l.from === '2027-08-16' ? 'approved' : l.state }))))));


// ================= BOARD LAYOUT =================
as('abines'); let lay = await m.loadBoard();
t('board layout starts empty', Array.isArray(lay.layout.order) && lay.layout.order.length === 0 && lay.layout.hidden.length === 0, lay.layout);
t('an employee cannot change the board layout, and is told', /Only admins/.test(await tryit(() => m.persistBoard(lay, { ...lay, layout: { order: ['priority', 'retainer'], hidden: [ids.vijay] } }))));
as('vijay'); lay = await m.loadBoard();
t('an admin saves column order and hidden columns', (await tryit(() => m.persistBoard(lay, { ...lay, layout: { order: ['retainer', 'priority', ids.karthik], hidden: [ids.harish, ids.vijay] } }))) === '');
as('abines'); lay = await m.loadBoard();
t('everyone then sees the same layout', JSON.stringify(lay.layout.order) === JSON.stringify(['retainer', 'priority', ids.karthik]) && lay.layout.hidden.length === 2, lay.layout);


// ================= TASK TIMERS =================
const wait = ms => new Promise(r => setTimeout(r, ms));
as('abines'); await m.loadStaff(); let tb = await m.loadBoard();
await m.persistBoard(tb, { ...tb, tasks: [...tb.tasks, T('tm1', ids.abines, { cols: [ids.abines, ids.karthik] })] });
// start (as the screens do: a local change that is then saved)
tb = await m.loadBoard();
await m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer(tb.tasks, 'tm1', ids.abines) });
tb = await m.loadBoard(); let c = tb.tasks.find(x => x.id === 'tm1');
t('starting a timer saves a running session', c.time.length === 1 && c.time[0].emp === ids.abines && c.time[0].end === null, c.time);
t('the start time is stamped by the server (recent)', Math.abs(Date.now() - c.time[0].start) < 60000);
t('the card counts as Doing for that person only', m.tasks.isDoing(c, ids.abines) && !m.tasks.isDoing(c, ids.karthik));
await wait(60);
await m.persistBoard(tb, { ...tb, tasks: m.tasks.pauseTimer(tb.tasks, 'tm1', ids.abines) });
tb = await m.loadBoard(); c = tb.tasks.find(x => x.id === 'tm1');
t('pausing stops the clock and keeps the time', c.time[0].end !== null && c.time[0].end >= c.time[0].start && m.tasks.spentMs(c) > 0 && !m.tasks.isDoing(c, ids.abines), { ms: m.tasks.spentMs(c) });
// two people running timers on the same card, and completing it stops both
await m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer(tb.tasks, 'tm1', ids.abines) });
as('karthik'); await m.loadStaff(); tb = await m.loadBoard();
await m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer(tb.tasks, 'tm1', ids.karthik) });
tb = await m.loadBoard(); c = tb.tasks.find(x => x.id === 'tm1');
t('two people can time the same card at once', c.time.filter(x => x.end === null).length === 2, c.time.map(x => x.emp + ':' + (x.end === null ? 'running' : 'done')));
await wait(40);
await m.persistBoard(tb, { ...tb, tasks: m.tasks.completeCard(tb.tasks, 'tm1') });
tb = await m.loadBoard(); c = tb.tasks.find(x => x.id === 'tm1');
t('completing a card stops everyone’s timer and records the total', c.done && c.time.every(x => x.end !== null) && m.tasks.spentMs(c) > 0, { ms: m.tasks.spentMs(c) });
t('hours per person add up from the sessions', m.tasks.spentMs(c, Date.now(), ids.abines) > 0 && m.tasks.spentMs(c, Date.now(), ids.karthik) > 0 && m.tasks.spentMs(c) >= m.tasks.spentMs(c, Date.now(), ids.abines));
// reopening by starting again
await m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer(tb.tasks, 'tm1', ids.karthik) });
tb = await m.loadBoard(); c = tb.tasks.find(x => x.id === 'tm1');
t('starting a completed card reopens it', !c.done && m.tasks.isDoing(c, ids.karthik), { done: c.done });
// someone who is not on the card cannot time it
as('arunkumar'); await m.loadStaff(); tb = await m.loadBoard();
t('someone not on the card cannot start its timer', /only change/.test(await tryit(() => m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer(tb.tasks, 'tm1', ids.arunkumar) }))));
// a person cannot start a second timer on the same card
as('karthik'); await m.loadStaff(); tb = await m.loadBoard(); const before = tb.tasks.find(x => x.id === 'tm1').time.length;
await m.persistBoard(tb, { ...tb, tasks: tb.tasks.map(x => x.id === 'tm1' ? { ...x, time: [...x.time, { id: 'dup', emp: ids.karthik, start: Date.now(), end: null }] } : x) });
tb = await m.loadBoard(); t('a second running timer by the same person is ignored', tb.tasks.find(x => x.id === 'tm1').time.length === before);

console.log('--- done ---');

if (process.exitCode) console.log('SOME CHECKS FAILED');
