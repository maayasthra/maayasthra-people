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
  delivered: { label: 'Ready to download', tone: 'ready' },
  downloaded: { label: 'Downloaded', tone: 'ok' },
  declined: { label: 'Declined', tone: 'err' },
  cancelled: { label: 'Cancelled', tone: 'mute' }
};
// A request is still live (cannot be asked for again) while it is requested or delivered
export const isOpen = r => r.status === 'requested' || r.status === 'delivered';
export const fmtSize = b => b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB';

// If a file's name mentions a month (and maybe a year), does it match the month that was asked for? Returns a short message when it clearly does not.
const NAMES = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function fileMonthMismatch(fileName, monthIso) {
  const base = String(fileName || '').replace(/\.[a-z0-9]+$/i, '').toLowerCase();
  const m = base.match(/(?:^|[^a-z])(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?![a-z])[^a-z0-9]*((?:19|20)\d\d)?/);
  if (!m) return '';
  const want = Number(monthIso.slice(5, 7)) - 1, got = NAMES.indexOf(m[1].slice(0, 3)), yr = m[2] ? Number(m[2]) : null;
  if (got !== want) return 'The file name says ' + (m[1][0].toUpperCase() + m[1].slice(1)) + (yr ? ' ' + yr : '') + ', but this request is for ' + monthLabel(monthIso) + '.';
  if (yr && yr !== Number(monthIso.slice(0, 4))) return 'The file name says ' + yr + ', but this request is for ' + monthLabel(monthIso) + '.';
  return '';
}
