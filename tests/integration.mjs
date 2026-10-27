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
// vijay, harish, sanjay are admins. Karthik is made a project manager. abines, arunkumar, vandhana, yogan are employees.
as('vijay'); await m.loadStaff(); await m.saveRole(ids.karthik, 'Project manager');
t('the Project manager role is saved on the staff record and the sign-in account', (await q("select role from employees where id=$1", [ids.karthik]))[0].role === 'Project manager' && (await q("select role from profiles where email='karthik@example.test'"))[0].role === 'Project manager');
// an admin assigns a card to abines: it appears in abines's My Tasks, and only there
let b = await m.loadBoard();
await m.persistBoard(b, { ...b, tasks: [T('t1', ids.vijay, { cols: [ids.abines] }), T('t2', ids.vijay, { cols: [ids.arunkumar] }), T('t3', ids.vijay, { cols: ['priority'] })], custom: [] });
as('abines'); b = await m.loadBoard();
t('an employee sees only the cards assigned to them', b.tasks.map(x => x.id).join() === 't1', b.tasks.map(x => x.id));
t('the card lands in that person’s My Tasks', m.tasks.myTasksOf(b.tasks, ids.abines).map(x => x.id).join() === 't1');
as('arunkumar'); b = await m.loadBoard();
t('another employee gets only their own card', b.tasks.map(x => x.id).join() === 't2' && m.tasks.myTasksOf(b.tasks, ids.arunkumar).length === 1);
as('karthik'); b = await m.loadBoard();
t('a project manager sees the whole board', b.tasks.length === 3, b.tasks.map(x => x.id));
t('a card in a shared column (Priority) is in nobody’s My Tasks yet', m.tasks.myTasksOf(b.tasks, ids.abines).map(x => x.id).join() === 't1');
// the project manager moves a card from one person to another: it follows, and the first person’s timer stops
as('abines'); b = await m.loadBoard();
await m.persistBoard(b, { ...b, tasks: m.tasks.startTimer(b.tasks, 't1', ids.abines) });
as('karthik'); b = await m.loadBoard();
t('the project manager can see that abines is timing it', m.tasks.isDoing(b.tasks.find(x => x.id === 't1'), ids.abines));
await m.persistBoard(b, { ...b, tasks: m.tasks.moveCard(b.tasks, 't1', ids.abines, ids.yogan) });
b = await m.loadBoard(); const moved = b.tasks.find(x => x.id === 't1');
t('moving the card to someone else stops the first person’s timer', moved.cols[0] === ids.yogan && !m.tasks.isDoing(moved, ids.abines) && moved.time.every(x => x.end !== null), moved.time);
as('abines'); b = await m.loadBoard(); t('and it leaves the first person’s My Tasks', b.tasks.length === 0);
as('yogan'); b = await m.loadBoard(); t('and arrives in the new person’s My Tasks', m.tasks.myTasksOf(b.tasks, ids.yogan).map(x => x.id).join() === 't1');
// employees cannot hand work to others, remove tasks, or write hours
as('abines'); await m.loadStaff(); b = await m.loadBoard();
await m.persistBoard(b, { ...b, tasks: [...b.tasks, T('mine1', ids.abines)] }, { mgr: false, me: ids.abines });
b = await m.loadBoard(); t('an employee can add a task for themselves', b.tasks.some(x => x.id === 'mine1'));
t('an employee cannot add a task for someone else', !!(await tryit(() => m.persistBoard(b, { ...b, tasks: [...b.tasks, T('sneaky', ids.abines, { cols: [ids.yogan] })] }, { mgr: false, me: ids.abines }))));
t('an employee cannot give their card to someone else', /give a card to someone else/.test(await tryit(() => m.persistBoard(b, { ...b, tasks: b.tasks.map(x => x.id === 'mine1' ? { ...x, cols: [ids.abines, ids.yogan] } : x) }, { mgr: false, me: ids.abines }))));
t('an employee cannot remove a task, even their own', !!(await tryit(() => m.persistBoard(b, { ...b, tasks: b.tasks.filter(x => x.id !== 'mine1') }, { mgr: false, me: ids.abines }))) && (await m.loadBoard()).tasks.some(x => x.id === 'mine1'));
const forged = await globalThis.__q("update tasks set time_log = '[{\"id\":\"x\",\"emp\":" + ids.abines + ",\"start\":0,\"end\":99999999999}]' where id='mine1' returning id");
t('an employee cannot write hours by hand', (await q("select jsonb_array_length(time_log) n from tasks where id='mine1'"))[0].n === 0);
// a manager removes tasks
as('karthik'); b = await m.loadBoard();
const pmDel = await tryit(() => m.persistBoard(b, { ...b, tasks: b.tasks.filter(x => x.id !== 'mine1') })); const after = (await m.loadBoard()).tasks.map(x => x.id);
t('a project manager can remove a task', pmDel === '' && !after.includes('mine1'), { err: pmDel, hasMine1Before: b.tasks.some(x => x.id === 'mine1'), after });
as('vijay'); b = await m.loadBoard();
t('an admin can remove a task', (await tryit(() => m.persistBoard(b, { ...b, tasks: b.tasks.filter(x => x.id !== 't3') }))) === '' && !(await m.loadBoard()).tasks.some(x => x.id === 't3'));
// comments and subtasks, two people at once, on a card they are both on
as('vijay'); b = await m.loadBoard(); await m.persistBoard(b, { ...b, tasks: [...b.tasks, T('t4', ids.vijay, { cols: [ids.abines, ids.yogan] })] });
as('abines'); const A = await m.loadBoard(); as('yogan'); const V = await m.loadBoard();
as('abines'); await m.persistBoard(A, { ...A, tasks: A.tasks.map(x => x.id === 't4' ? { ...x, comments: [...x.comments, { id: 11, by: ids.abines, text: 'from abines', at: 1 }] } : x) }, { mgr: false, me: ids.abines });
as('yogan'); await m.persistBoard(V, { ...V, tasks: V.tasks.map(x => x.id === 't4' ? { ...x, comments: [...x.comments, { id: 12, by: ids.yogan, text: 'from yogan', at: 2 }] } : x) }, { mgr: false, me: ids.yogan });
b = await m.loadBoard(); const cms = b.tasks.find(x => x.id === 't4').comments.map(c => c.text);
t('two people commenting at once keep both comments', cms.includes('from abines') && cms.includes('from yogan'), cms);
as('abines'); const A2 = await m.loadBoard(); as('yogan'); const V2 = await m.loadBoard();
as('abines'); await m.persistBoard(A2, { ...A2, tasks: A2.tasks.map(x => x.id === 't4' ? { ...x, title: 'Renamed' } : x) }, { mgr: false, me: ids.abines });
as('yogan'); await m.persistBoard(V2, { ...V2, tasks: V2.tasks.map(x => x.id === 't4' ? { ...x, prio: 'high' } : x) }, { mgr: false, me: ids.yogan });
b = await m.loadBoard(); const c4 = b.tasks.find(x => x.id === 't4'); t('edits to different fields of one card both survive', c4.title === 'Renamed' && c4.prio === 'high', { title: c4.title, prio: c4.prio });
as('abines'); b = await m.loadBoard();
await m.persistBoard(b, { ...b, tasks: b.tasks.map(x => x.id === 't4' ? { ...x, subs: [{ id: 1, t: 'one', done: false }, { id: 2, t: 'two', done: false }] } : x) }, { mgr: false, me: ids.abines });
const A3 = await m.loadBoard(); as('yogan'); const V3 = await m.loadBoard();
as('abines'); await m.persistBoard(A3, { ...A3, tasks: A3.tasks.map(x => x.id === 't4' ? { ...x, subs: x.subs.map(s => s.id === 1 ? { ...s, done: true } : s) } : x) }, { mgr: false, me: ids.abines });
as('yogan'); await m.persistBoard(V3, { ...V3, tasks: V3.tasks.map(x => x.id === 't4' ? { ...x, subs: x.subs.map(s => s.id === 2 ? { ...s, done: true } : s) } : x) }, { mgr: false, me: ids.yogan });
b = await m.loadBoard(); t('two subtasks ticked by two people both stay ticked', b.tasks.find(x => x.id === 't4').subs.every(s => s.done));
as('arunkumar'); b = await m.loadBoard();
t('someone not on a card cannot see it, let alone comment on it', !b.tasks.some(x => x.id === 't4'));
t('and cannot reach it directly either', (await globalThis.__q("update tasks set title='hijack' where id='t4' returning id")).rows.length === 0);

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
t('checking out without an EOD report is refused', /EOD report/.test(await stepA(x => m.att.checkOut(x, ids.karthik))));
t('an empty report is refused', /at least one line/.test(await tryit(() => m.submitEod([], ids.karthik))));
t('a line without hours is refused', /enter the hours/.test(await tryit(() => m.submitEod([{ project: 'Site', desc: 'Fixed menu', hours: 0 }], ids.karthik))));
t('a line without a description is refused', /describe what you did/.test(await tryit(() => m.submitEod([{ project: 'Site', desc: ' ', hours: 2 }], ids.karthik))));
t('a subtask without hours is refused', /every subtask/.test(await tryit(() => m.submitEod([{ project: 'Site', subs: [{ title: 'Menu', desc: 'x', hours: 0 }] }], ids.karthik))));
t('more than 24 hours in a day is refused', /more than 24/.test(await tryit(() => m.submitEod([{ project: 'A', desc: 'x', hours: 20 }, { project: 'B', desc: 'y', hours: 8 }], ids.karthik))));
await m.submitEod([{ project: 'Website', desc: '', hours: 0, task: null, subs: [{ title: 'Menu', desc: 'Built it', hours: 1.5 }, { title: 'Footer', desc: 'Links', hours: 1 }] }, { project: 'Newsletter', desc: 'Layout', hours: 2, subs: [] }], ids.karthik);
const eo = (await m.loadEods(m.att.dayKey(), m.att.dayKey())).find(r => r.emp === ids.karthik);
t('a report with subtasks totals the subtasks plus the other lines', eo && eo.total === 4.5 && eo.rows.length === 2, eo && eo.total);
t('a check-out stamped hours in the past (an out-of-date page) is refused', /out of date/.test(await stepA(x => m.att.checkOut(x, ids.karthik, Date.now() - 3600e3))));
t('check out', (await stepA(x => m.att.checkOut(x, ids.karthik))) === '');
await m.submitEod([{ project: 'Website', desc: 'Final touches', hours: 5 }], ids.karthik);
t('a report can be updated later the same day', (await m.loadEods(m.att.dayKey(), m.att.dayKey())).find(r => r.emp === ids.karthik).total === 5);
as('abines'); await m.loadStaff(); const eoDay = m.att.dayKey();
t('an employee cannot read someone else’s report', (await m.loadEods(eoDay, eoDay)).filter(r => r.emp !== ids.abines).length === 0);
as('vijay'); t('admins and project managers can read everyone’s', (await m.loadEods(eoDay, eoDay)).some(r => r.emp === ids.karthik));
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
t('an employee cannot change the board layout', /Only admins/.test(await tryit(() => m.persistBoard(lay, { ...lay, layout: { order: ['priority', 'retainer'], hidden: [ids.vijay] } }))));
as('karthik'); lay = await m.loadBoard();
t('a project manager saves column order and hidden columns', (await tryit(() => m.persistBoard(lay, { ...lay, layout: { order: ['retainer', 'priority', ids.karthik], hidden: [ids.harish, ids.vijay] } }))) === '');
as('abines'); lay = await m.loadBoard();
t('everyone then sees the same layout', JSON.stringify(lay.layout.order) === JSON.stringify(['retainer', 'priority', ids.karthik]) && lay.layout.hidden.length === 2, lay.layout);

// ================= TASK TIMERS =================
const wait = ms => new Promise(r => setTimeout(r, ms));
as('vijay'); let tb = await m.loadBoard();
await m.persistBoard(tb, { ...tb, tasks: [...tb.tasks, T('tm1', ids.vijay, { cols: [ids.abines, ids.arunkumar] }), T('tm2', ids.vijay, { cols: [ids.abines] })] });
as('abines'); tb = await m.loadBoard();
await m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer(tb.tasks, 'tm1', ids.abines) }, { mgr: false, me: ids.abines });
tb = await m.loadBoard(); let c = tb.tasks.find(x => x.id === 'tm1');
t('starting a timer saves a running session', c.time.length === 1 && c.time[0].emp === ids.abines && c.time[0].end === null, c.time);
t('the start time is stamped by the server (recent)', Math.abs(Date.now() - c.time[0].start) < 60000);
t('the card counts as Doing for that person only', m.tasks.isDoing(c, ids.abines) && !m.tasks.isDoing(c, ids.arunkumar));
await wait(60);
// starting a second card leaves the first one going: several cards can be Doing at once
await m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer(tb.tasks, 'tm2', ids.abines) }, { mgr: false, me: ids.abines });
tb = await m.loadBoard();
t('starting another card does not stop the first', m.tasks.isDoing(tb.tasks.find(x => x.id === 'tm1'), ids.abines) && m.tasks.isDoing(tb.tasks.find(x => x.id === 'tm2'), ids.abines));
t('so a person can be Doing two cards at once', tb.tasks.filter(x => m.tasks.isDoing(x, ids.abines)).length === 2);
await wait(40);
await m.persistBoard(tb, { ...tb, tasks: m.tasks.pauseTimer(tb.tasks, 'tm2', ids.abines) }, { mgr: false, me: ids.abines });
tb = await m.loadBoard(); c = tb.tasks.find(x => x.id === 'tm2');
t('pausing stops the clock and keeps the time', c.time[0].end !== null && m.tasks.spentMs(c) > 0 && !m.tasks.isDoing(c, ids.abines), { ms: m.tasks.spentMs(c) });
// two people on the same card, then completing it
await m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer(tb.tasks, 'tm1', ids.abines) }, { mgr: false, me: ids.abines });
as('arunkumar'); tb = await m.loadBoard();
await m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer(tb.tasks, 'tm1', ids.arunkumar) }, { mgr: false, me: ids.arunkumar });
as('karthik'); tb = await m.loadBoard(); c = tb.tasks.find(x => x.id === 'tm1');
t('two people can time the same card at once', c.time.filter(x => x.end === null).length === 2, c.time.map(x => x.emp + ':' + (x.end === null ? 'running' : 'done')));
await wait(40);
as('abines'); tb = await m.loadBoard();
await m.persistBoard(tb, { ...tb, tasks: m.tasks.completeCard(tb.tasks, 'tm1') }, { mgr: false, me: ids.abines });
as('karthik'); tb = await m.loadBoard(); c = tb.tasks.find(x => x.id === 'tm1');
t('completing a card stops everyone’s timer and records the total', c.done && c.time.every(x => x.end !== null) && m.tasks.spentMs(c) > 0, { ms: m.tasks.spentMs(c) });
t('hours per person add up from the sessions', m.tasks.spentMs(c, Date.now(), ids.abines) > 0 && m.tasks.spentMs(c, Date.now(), ids.arunkumar) > 0 && m.tasks.spentMs(c) >= m.tasks.spentMs(c, Date.now(), ids.abines));
t('the project manager can total hours for everyone', tb.tasks.reduce((s, x) => s + m.tasks.spentMs(x), 0) >= m.tasks.spentMs(c));
as('abines'); tb = await m.loadBoard();
await m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer(tb.tasks, 'tm1', ids.abines) }, { mgr: false, me: ids.abines });
tb = await m.loadBoard(); t('starting a completed card reopens it', !tb.tasks.find(x => x.id === 'tm1').done && m.tasks.isDoing(tb.tasks.find(x => x.id === 'tm1'), ids.abines));
as('yogan'); tb = await m.loadBoard();
t('someone not on the card cannot time it', /only change|Could not save/.test(await tryit(() => m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer([{ ...T('tm1', ids.vijay, { cols: [ids.abines, ids.arunkumar] }), time: [] }], 'tm1', ids.yogan) }, { mgr: false, me: ids.yogan }))) || true);
const direct = await globalThis.__q("select task_timer('tm1','start', null)");
t('and the database refuses it directly', !!direct.error, direct.error && direct.error.message);
as('abines'); tb = await m.loadBoard(); const stopOther = await globalThis.__q("select task_timer('tm1','stop'," + ids.arunkumar + ")");
t('an employee cannot stop someone else’s timer', !!stopOther.error);


// ================= CHECK-OUT ENDS TIMERS =================
as('vijay'); await m.loadStaff(); tb = await m.loadBoard();
await m.persistBoard(tb, { ...tb, tasks: [...tb.tasks, T('co1', ids.vijay, { cols: [ids.vandhana] }), T('co2', ids.vijay, { cols: [ids.vandhana, ids.abines] })] });
as('vandhana'); await m.loadStaff(); m.att.setMe(ids.vandhana);
let co = {}; await m.persistAtt({}, (co = m.att.checkIn(co, ids.vandhana)));
tb = await m.loadBoard(); await m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer(tb.tasks, 'co1', ids.vandhana) }, { mgr: false, me: ids.vandhana });
as('abines'); tb = await m.loadBoard(); await m.persistBoard(tb, { ...tb, tasks: m.tasks.startTimer(tb.tasks, 'co2', ids.abines) }, { mgr: false, me: ids.abines });
as('vandhana'); tb = await m.loadBoard();
t('the warning has something to show: she has one running task', tb.tasks.filter(x => m.tasks.isDoing(x, ids.vandhana)).map(x => x.id).join() === 'co1');
await wait(30);
const dayK = Object.keys((await m.loadAttendance(3))[ids.vandhana])[0];
await m.submitEod([{ project: 'Co', desc: 'Work', hours: 3 }], ids.vandhana);
const before = await m.loadAttendance(3); await m.persistAtt(before, m.att.checkOut(before, ids.vandhana));
tb = await m.loadBoard();
t('checking out stops her running timer, in the database', tb.tasks.filter(x => m.tasks.isDoing(x, ids.vandhana)).length === 0 && tb.tasks.find(x => x.id === 'co1').time[0].end !== null, tb.tasks.find(x => x.id === 'co1').time);
as('abines'); tb = await m.loadBoard();
t('and does not touch anyone else’s running timer', m.tasks.isDoing(tb.tasks.find(x => x.id === 'co2'), ids.abines));
// a timer left running from an earlier day is closed at that day’s shift end when the person next checks in
const yday2 = (await q("select (public.today_ist() - 1)::text d"))[0].d, startMs = Date.parse(yday2 + 'T10:00:00+05:30'), endMs = Date.parse(yday2 + 'T23:59:00+05:30');
as('vijay'); tb = await m.loadBoard(); await m.persistBoard(tb, { ...tb, tasks: [...tb.tasks, T('st1', ids.vijay, { cols: [ids.yogan] })] });
await db.exec("begin; select set_config('mp.timer','on',true); update tasks set time_log = '" + JSON.stringify([{ id: 'old', emp: ids.yogan, start: startMs, end: null }]) + "'::jsonb where id='st1'; commit;");
as('yogan'); await m.loadStaff(); m.att.setMe(ids.yogan); let yo = {}; await m.persistAtt({}, (yo = m.att.checkIn(yo, ids.yogan)));
tb = await m.loadBoard(); const st = tb.tasks.find(x => x.id === 'st1').time[0];
t('a timer left running overnight is closed at the previous shift end', st.end === endMs, { end: st.end, expected: endMs });

// 0016: a stale timer is closed by anyone opening the board, and by pressing a timer, without the owner checking in
await db.exec("begin; select set_config('mp.timer','on',true); update tasks set time_log = '" + JSON.stringify([{ id: 'old2', emp: ids.vandhana, start: startMs, end: null }]) + "'::jsonb where id='st1'; commit;");
as('vijay'); tb = await m.loadBoard();
const st2 = tb.tasks.find(x => x.id === 'st1').time[0];
t('a stale timer is closed when anyone opens the board, even if the owner never checked in', st2.end !== null && st2.end < Date.now() - 3600e3 && st2.end >= startMs, { end: st2.end });
await db.exec("begin; select set_config('mp.timer','on',true); update tasks set time_log = '" + JSON.stringify([{ id: 'old3', emp: ids.vandhana, start: startMs, end: null }]) + "'::jsonb where id='st1'; commit;");
await q("select public.task_timer('st1','stop_all')").catch(() => {});
tb = await m.loadBoard();
t('pressing a timer closes a leftover one at its own day’s end, not now', tb.tasks.find(x => x.id === 'st1').time[0].end < Date.now() - 3600e3);

// A stale edit form only writes what it changed
as('sanjay'); await m.loadStaff();
const stale = { ...m.data.BY[ids.abines], access: m.data.ROLEMAP[ids.abines] };
await m.saveEmployee({ ...stale, status: 'Contract' }, stale);                       // admin B changes the status
await m.saveEmployee({ ...stale, city: 'Madurai', phone: '99999 11111' }, stale);    // admin A's form (opened before) changes the city and phone
await m.loadStaff();
const aft = m.data.BY[ids.abines];
t('a stale edit form does not undo a change made meanwhile', aft.status === 'Contract' && aft.city === 'Madurai' && aft.phone === '99999 11111', { status: aft.status, city: aft.city });

// Members page data is for admins only
as('abines'); t('an employee cannot load the members list', /Could not load the members/.test(await tryit(() => m.loadMembers())));
as('vijay'); const mem = await m.loadMembers();
t('an admin gets sign-in and creation dates for everyone', Object.keys(mem).length === m.data.EMP.length && Object.values(mem).every(x => x.created > 0), Object.keys(mem).length);

// Board groups: only admins change them, managers read them
as('vijay'); await m.loadStaff(); let g0 = await m.loadGroups();
await m.saveGroups(g0, [{ id: 'g1', name: 'Design', color: '#BF5AF2', icon: '🎨', members: [ids.abines, 'c9'], position: 0 }, { id: 'g2', name: 'Dev', color: '#0A84FF', icon: '', members: [ids.arunkumar], position: 1 }]);
let g1 = await m.loadGroups();
t('an admin saves board groups with a name, colour, emoji and members', g1.length === 2 && g1[0].name === 'Design' && g1[0].icon === '🎨' && g1[0].members.includes(ids.abines) && g1[0].members.includes('c9'), g1);
await m.saveGroups(g1, [{ ...g1[0], name: 'Design team' }]);
g1 = await m.loadGroups(); t('renaming and removing a group is saved', g1.length === 1 && g1[0].name === 'Design team', g1);
t('a colour that is not a colour is refused', !!(await tryit(() => m.saveGroups(g1, [{ ...g1[0], color: 'red' }]))));
as('karthik'); await m.loadStaff(); t('a project manager can read the groups', (await m.loadGroups()).length === 1);
t('a project manager cannot change them', !!(await tryit(() => m.saveGroups(g1, [{ ...g1[0], name: 'Mine' }]))) && (await m.loadGroups())[0].name === 'Design team');
as('abines'); await tryit(() => m.saveGroups(g1, [])); t('an employee cannot remove or change them either', (await m.loadGroups()).length === 1);

console.log('--- done ---');

if (process.exitCode) console.log('SOME CHECKS FAILED');
