/* Which months can be asked for on the Payslips page. Same rules as the database: only finished months, up to 12 back,
   and not before the person joined. Plain functions so they can be tested. Months are 'YYYY-MM-01' (the first day). */
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export const monthLabel = iso => SHORT[Number(iso.slice(5, 7)) - 1] + ' ' + iso.slice(0, 4);        // Oct 2026
export const monthLong = iso => LONG[Number(iso.slice(5, 7)) - 1] + ' ' + iso.slice(0, 4);          // October 2026
const firstOf = (y, m) => y + '-' + String(m).padStart(2, '0') + '-01';

// The months a person may ask for, newest first. todayIso is today's India date; joinIso (optional) is the day they joined.
export function requestableMonths(todayIso, joinIso) {
  let y = Number(todayIso.slice(0, 4)), m = Number(todayIso.slice(5, 7));
  const joinMonth = joinIso && /^\d{4}-\d{2}/.test(joinIso) ? joinIso.slice(0, 7) + '-01' : null, out = [];
  for (let i = 0; i < 12; i++) {
    m -= 1; if (m === 0) { m = 12; y -= 1; }
    const iso = firstOf(y, m);
    if (joinMonth && iso < joinMonth) break;
    out.push({ iso, label: monthLabel(iso) });
  }
  return out;
}

export const STATUS = {
  requested: { label: 'Requested', tone: 'warn' },
  delivered: { label: 'Delivered', tone: 'ok' },
  declined: { label: 'Declined', tone: 'err' },
  cancelled: { label: 'Cancelled', tone: 'mute' }
};
// A request is still live (cannot be asked for again) while it is requested or delivered
export const isOpen = r => r.status === 'requested' || r.status === 'delivered';
export const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB';
