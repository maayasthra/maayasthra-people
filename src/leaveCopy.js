import { BY, pd, fmtDay, plural, range, workDays, awayList, balances } from './data.js';
import { dayKey } from './attendance.js';

/* The text of a leave request, ready to paste into WhatsApp or an email: who, what kind, which days, why,
   how many days are left, who else is out and whether the request has been decided. */
const longDate = iso => fmtDay(pd(iso)) + ' ' + iso.slice(0, 4);
const dm = iso => { const d = new Date(pd(iso)); return d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]; };

export function leaveText(l, all) {
  const e = BY[l.emp]; if (!e) return '';
  const when = l.from === l.to ? longDate(l.from) : range(l.from, l.to) + ' ' + l.to.slice(0, 4);
  const days = l.half ? 'Half day' : plural(l.days, 'day');
  const peers = [...new Set(awayList(all).filter(a => a.emp !== e.n && BY[a.emp] && BY[a.emp].dept === e.dept && l.from <= a.to && l.to >= a.from).map(a => BY[a.emp].name))];
  const bal = balances(all.filter(x => x.emp === e.n)).find(b => b.t === l.type);
  const hol = workDays(l.from, l.to).hol;
  const who = l.by ? ' by ' + l.by : '', on = l.at ? ' on ' + dm(dayKey(l.at)) : '';
  const status = l.state === 'approved' ? '\u2705 *Approved*' + who + on : l.state === 'declined' ? '\u274C *Declined*' + who + on : '\u23F3 *Pending approval*';
  // WhatsApp bold is *text*; each fact starts with a symbol so the lines stay lined up in its proportional font
  const lines = [
    '\uD83D\uDCCB *LEAVE REQUEST*',
    '',
    '\uD83D\uDC64 *Name:* ' + e.name + (e.dept ? ' (' + e.dept + ')' : ''),
    '\uD83C\uDFF7\uFE0F *Type:* ' + l.type,
    '\uD83D\uDCC5 *Dates:* ' + when,
    '\u23F1\uFE0F *Duration:* ' + days,
    '\uD83D\uDCAC *Reason:* ' + (l.reason && l.reason.trim() ? l.reason.trim() : '_Not given_')
  ];
  if (bal) lines.push('\uD83D\uDCCA *Balance:* ' + Math.max(bal.left - (l.state === 'pending' ? l.days : 0), 0) + ' of ' + bal.total + ' ' + l.type.toLowerCase().replace(' leave', '') + ' days left' + (l.state === 'pending' ? ' after this' : ''));
  lines.push('\uD83D\uDC65 *Team:* ' + (peers.length ? peers.join(' and ') + (peers.length === 1 ? ' is' : ' are') + ' also out in that time' : 'No one else in ' + (e.dept || 'the team') + ' is out'));
  if (hol.length) lines.push('\uD83C\uDF89 *Holidays:* Skips ' + hol.join(', '));
  lines.push('', status);
  return lines.join('\n');
}

export async function copyText(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (x) { /* fall back below */ }
  try {
    const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); document.body.removeChild(t); return ok;
  } catch (x) { return false; }
}
