/* What an admin should see before approving a leave. Pure functions (no app imports) so they can be tested.
   l is the request, e the person, bal their balance for that type ({ left, total }), peers the first names of colleagues in the same
   department who are also out, hol the holidays inside the dates. */
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
export const joinNames = n => n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' and ' + n[n.length - 1];
export const hasWarning = items => items.some(i => i.tone === 'warn' || i.tone === 'bad');

export function approveItems({ l, e, bal, peers = [], hol = [] }) {
  const out = [], kind = String(l.type || 'leave').toLowerCase().replace(' leave', '');
  if (bal) {
    const left = bal.left - l.days;
    if (left < 0) out.push({ tone: 'bad', text: 'Goes over their ' + kind + ' balance by ' + plural(-left, 'day') + ' (' + bal.left + ' left of ' + bal.total + ').' });
    else if (left === 0) out.push({ tone: 'warn', text: 'Uses all of their remaining ' + kind + ' days (' + bal.left + ' left of ' + bal.total + ').' });
    else out.push({ tone: 'ok', text: left + ' of ' + bal.total + ' ' + kind + ' days left after this.' });
  }
  if (peers.length) out.push({ tone: 'warn', text: joinNames(peers) + (peers.length === 1 ? ' is' : ' are') + ' also out in ' + e.dept + ' on these dates.' });
  else out.push({ tone: 'ok', text: 'No one else in ' + e.dept + ' is out.' });
  if (hol.length) out.push({ tone: 'ok', text: 'Skips ' + joinNames(hol) + '.' });
  if (!l.half && l.days >= 5) out.push({ tone: 'warn', text: plural(l.days, 'day') + ' is a long leave.' });
  return out;
}
