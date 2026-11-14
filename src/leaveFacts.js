import { BY, awayList, balances, workDays, range, fmtDay, pd, plural } from './data.js';
import { approveItems, hasWarning } from './leaveCheck.js';

// The facts around one leave request, from the full list of leaves
export function leaveFacts(l, all) {
  const e = BY[l.emp], away = awayList(all);
  const peers = [...new Set(away.filter(a => a.emp !== e.n && BY[a.emp] && BY[a.emp].dept === e.dept && l.from <= a.to && l.to >= a.from).map(a => BY[a.emp].name.split(' ')[0]))];
  const bal = balances(all.filter(x => x.emp === e.n)).find(b => b.t === l.type);
  return { l, e, bal, peers, hol: workDays(l.from, l.to).hol };
}
const when = l => (l.from === l.to ? fmtDay(pd(l.from)) : range(l.from, l.to)) + ' · ' + (l.half ? 'Half day' : plural(l.days, 'day')) + ' · ' + l.type;

// The two dialogs for deciding a leave
export function leaveDialog(l, all, state) {
  const f = leaveFacts(l, all), first = f.e.name.split(' ')[0];
  if (state === 'approved') { const items = approveItems(f); return { title: 'Approve this leave?', icon: hasWarning(items) ? 'alert' : 'check', body: f.e.name + ' · ' + when(l), quote: l.reason || '', items, confirm: 'Approve leave' }; }
  return { title: 'Decline this leave?', icon: 'alert', danger: true, body: f.e.name + ' · ' + when(l), items: [{ tone: 'bad', text: first + ' will be told it was declined. This cannot be undone from here.' }], confirm: 'Decline leave' };
}
