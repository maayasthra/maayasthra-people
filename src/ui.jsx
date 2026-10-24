import React from 'react';
import htm from 'htm';
import { STAT_C } from './data.js';

const h = htm.bind(React.createElement);
// A template with several top-level nodes becomes a fragment, so React does not ask for keys on static siblings.
export const html = (...args) => { const r = h(...args); return Array.isArray(r) ? React.createElement(React.Fragment, null, ...r) : r; };
export const first = e => e.name.split(' ')[0];
export const Switch = ({ on, set, label }) => html`<button type="button" className=${'sw' + (on ? ' on' : '')} role="switch" aria-checked=${on} aria-label=${label} onClick=${() => set(!on)}><i></i></button>`;

export function downloadCSV(name, rows) {
  const esc = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
  const blob = new Blob([rows.map(r => r.map(esc).join(',')).join('\n')], { type: 'text/csv' });
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- Icons ---------- */
const IC = {
  home:['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
  info:['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M12 11v5.5','M12 7.6v.2'],
  people:['M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20','M10 12a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z','M20 20v-1.5a3.5 3.5 0 0 0-2.5-3.35','M15.5 5.2a3.5 3.5 0 0 1 0 6.6'],
  calendar:['M4 6.5h16V20H4z','M4 10.5h16','M8 3.5v4','M16 3.5v4'],
  leaves:['M5 19c0-8 5-14 14-14 0 9-6 14-14 14z','M5 19 13 11'],
  requests:['M4 13l2.5-7h11L20 13v6H4z','M4 13h4.5l1 2h5l1-2H20'],
  settings:['M4 7h9','M17 7h3','M4 17h3','M11 17h9','M15 4.5v5','M9 14.5v5'],
  search:['M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z','M20 20l-4-4'],
  back:['M15 5l-7 7 7 7'],
  next:['M9 5l7 7-7 7'],
  check:['M5 12.5l4.5 4.5L19 7.5'],
  x:['M6 6l12 12','M18 6L6 18'],
  copy:['M9 9h10v11H9z','M5 15V4h10'],
  pin:['M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z','M12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z'],
  arrow:['M5 12h14','M13 6l6 6-6 6'],
  org:['M9 3h6v5H9z','M3 16h6v5H3z','M15 16h6v5h-6z','M12 8v4','M6 16v-4h12v4'],
  plus:['M12 5v14','M5 12h14'],
  edit:['M4 20h4L19 9l-4-4L4 16z','M13.5 6.5l4 4'],
  download:['M12 4v11','M7 11l5 5 5-5','M5 20h14'],
  sun:['M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z','M12 3v2','M12 19v2','M3 12h2','M19 12h2','M5.6 5.6l1.4 1.4','M17 17l1.4 1.4','M5.6 18.4 7 17','M17 7l1.4-1.4'],
  moon:['M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z'],
  bell:['M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z','M10 20a2 2 0 0 0 4 0'],
  megaphone:['M3 11v3a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z','M15 9a4 4 0 0 1 0 6','M18 6.5a8 8 0 0 1 0 11'],
  star:['M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.9 6.8 19.7l1-5.9L3.5 9.7l5.9-.8z'],
  user:['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z','M4.5 20a7.5 7.5 0 0 1 15 0'],
  logout:['M10 4H5v16h5','M15 8l4 4-4 4','M19 12H9'],
  cup:['M5 9h11v5a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z','M16 10h1.5a2 2 0 0 1 0 4H16','M8 4v2','M12 4v2'],
  heart:['M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z'],
  swap:['M5 8h13','M14 4l4 4-4 4','M19 16H6','M10 12l-4 4 4 4'],
  clock:['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M12 7v5l3 2'],
  chevL:['M15 5l-7 7 7 7'],
  chevR:['M9 5l7 7-7 7'],
  timer:['M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M12 9v4l2 2','M9 3h6'],
  attendance:['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z','M12 7v5l3 2'],
  hours:['M12 21a8 8 0 1 0 0-16 8 8 0 0 0 0 16z','M12 9v4l2 2','M9 3h6'],
  board:['M4 5h5v14H4z','M10 5h5v9h-5z','M16 5h4v6h-4z'],
  mytasks:['M5 7l2 2 3-3','M5 15l2 2 3-3','M13 8h6','M13 16h6'],
  team:['M5 20V11','M12 20V4','M19 20v-6'],
  flag:['M6 21V4','M6 5h11l-2 4 2 4H6'],
  comment:['M5 5h14v10H10l-4 4v-4H5z'],
  trash:['M5 7h14','M9 7V4h6v3','M7 7l1 13h8l1-13'],
  dots:['M6 12h.01','M12 12h.01','M18 12h.01'],
  sidebar:['M4 5h16v14H4z','M9 5v14'],
  filter:['M4 6h16','M7 12h10','M10 18h4'],
  eye:['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z','M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'],
  eyeoff:['M3 3l18 18','M10.6 5.7A9 9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3.2 3.9','M6.2 7.4A16 16 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.4-.7','M9.9 9.9a3 3 0 0 0 4.2 4.2'],
  tag:['M3.5 12.5V4.5h8l9 9-8 8z','M8 9h.01'],
  building:['M5 21V4h9v17','M14 9h5v12','M8 8h2','M8 12h2','M8 16h2'],
  jump:['M5 12h14','M13 6l6 6-6 6'],
  home2:['M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z']
};
export const Icon = ({ n, s = 18 }) => html`<svg width=${s} height=${s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">${IC[n].map((d,i) => html`<path key=${i} d=${d}/>`)}</svg>`;

/* ---------- Portraits (illustrated placeholders until real photos are uploaded) ---------- */
const SKIN = ['#F2CDAA','#E4B38C','#C98E62','#A9703F','#8B5A36','#6C422A'];
const HAIR = ['#17110D','#2A1C13','#3D2A1A','#5A3F28','#1C1C20','#7B7B82'];
const BGS = [['#2E3858','#141A2E'],['#4D2C1B','#1F120B'],['#2D3E3E','#121B1C'],['#3D2E49','#1A1222'],['#43392B','#1C1810'],['#303E2D','#131A12'],['#402C35','#1B1115'],['#2C3242','#12151C']];
const TOPS = ['#0E3594','#2B3140','#E8E4DC','#FF9F0A','#1E5E52','#3C2F4D','#47506A','#7A2E3A'];
let portraitId = 0;
export function Portrait({ e }) {
  if (e.photo) return html`<img src=${e.photo} alt=${'Photo of ' + e.name} style=${{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}/>`;
  const n = e.n, skin = SKIN[(n*5)%6], hc = HAIR[(n*7 + (n>20?1:0))%6], b = (n*3)%8, top = TOPS[(n*5+2)%8];
  const style = (e.g === 'f' ? ['long','bun','bob','long','curly'] : ['short','curly','crop','short','short'])[(n*3)%5];
  const beard = e.g === 'm' && n % 3 === 0, glasses = n % 4 === 1;
  const back = style === 'long' ? html`<path d="M30 56C28 28 72 28 70 56L73 102C60 106 40 106 27 102Z" fill=${hc}/>`
    : style === 'bob' ? html`<path d="M30 56C28 30 72 30 70 56L71 82C60 86 40 86 29 82Z" fill=${hc}/>`
    : style === 'bun' ? html`<circle cx="50" cy="29" r="8" fill=${hc}/>`
    : style === 'curly' ? html`<g fill=${hc}><circle cx="36" cy="42" r="10"/><circle cx="50" cy="35" r="11"/><circle cx="64" cy="42" r="10"/><circle cx="32" cy="54" r="8"/><circle cx="68" cy="54" r="8"/></g>` : null;
  const front = style === 'short' ? html`<path d="M32 55C30 30 70 30 68 55C63 46 56 43 50 43C44 43 37 46 32 55Z" fill=${hc}/>`
    : style === 'crop' ? html`<path d="M33 52C34 36 66 36 67 52C62 44 38 44 33 52Z" fill=${hc} opacity=".92"/>`
    : style === 'curly' ? html`<g fill=${hc}><circle cx="40" cy="41" r="8"/><circle cx="52" cy="37" r="9"/><circle cx="62" cy="42" r="8"/></g>`
    : html`<path d="M32 56C31 33 69 33 68 56C62 44 54 41 50 41C46 41 38 44 32 56Z" fill=${hc}/>`;
  const gid = 'pg' + (++portraitId);
  return html`<svg viewBox="0 0 100 125" preserveAspectRatio="xMidYMid slice" role="img" aria-label=${'Portrait of ' + e.name}>
    <defs><linearGradient id=${gid} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor=${BGS[b][0]}/><stop offset="1" stopColor=${BGS[b][1]}/></linearGradient></defs>
    <rect width="100" height="125" fill=${'url(#' + gid + ')'}/>
    <circle cx="50" cy="48" r="52" fill="#fff" opacity=".04"/>
    ${back}
    <path d="M8 125C8 100 26 90 50 90C74 90 92 100 92 125Z" fill=${top}/>
    <path d="M43 72H57V93Q50 99 43 93Z" fill=${skin}/>
    <path d="M43 72H57V93Q50 99 43 93Z" fill="#000" opacity=".12"/>
    <ellipse cx="33.5" cy="60" rx="2.6" ry="4" fill=${skin}/><ellipse cx="66.5" cy="60" rx="2.6" ry="4" fill=${skin}/>
    <ellipse cx="50" cy="58" rx="17" ry="21" fill=${skin}/>
    ${beard && html`<path d="M33 62C34 84 66 84 67 62C62 72 38 72 33 62Z" fill=${hc} opacity=".92"/>`}
    <circle cx="43" cy="59" r="1.7" fill="#1A1517"/><circle cx="57" cy="59" r="1.7" fill="#1A1517"/>
    <path d="M45 69Q50 72.5 55 69" stroke="#1A1517" strokeWidth="1.3" fill="none" opacity=".55" strokeLinecap="round"/>
    ${front}
    ${glasses && html`<g fill="none" stroke="#0b0b0b" strokeWidth="1.2" opacity=".85"><circle cx="43" cy="59" r="6"/><circle cx="57" cy="59" r="6"/><path d="M49 59h2"/></g>`}
  </svg>`;
}
export const Photo = ({ e }) => html`<div className="ph"><${Portrait} e=${e}/></div>`;
export const Av = ({ e, s = 40 }) => html`<span className="av" style=${{ width: s, height: s }}><${Portrait} e=${e}/></span>`;
export const Status = ({ s, ov }) => html`<span className=${'pill' + (ov ? ' ov' : '')} style=${{ '--c': STAT_C[s] }}><i></i>${s}</span>`;


const TONES = { blue: '#0A84FF', purple: '#BF5AF2', orange: '#FF9F0A', amber: '#FF375F', green: '#30D158', red: '#FF453A' };
export function Tile({ icon, label, value, sub, tone = 'blue', onClick, hot }) {
  const inner = html`<span className="tile-i" style=${{ '--c': TONES[tone] }}><${Icon} n=${icon} s=${20}/></span>
    <span className="tile-v"><b>${value}</b><span className="tile-l">${label}</span><small>${sub}</small></span>`;
  return onClick ? html`<button className=${'tile' + (hot ? ' hot' : '')} onClick=${onClick}>${inner}</button>` : html`<div className=${'tile' + (hot ? ' hot' : '')}>${inner}</div>`;
}

/* A page title with a small tinted icon */
const HI_C = { blue: '#0A84FF', purple: '#BF5AF2', green: '#30D158', orange: '#FF9F0A', pink: '#FF375F', red: '#FF453A' };
export const HI = ({ n, tone = 'blue' }) => html`<span className="h-i" style=${{ '--c': HI_C[tone] }}><${Icon} n=${n} s=${20}/></span>`;
/* A select with a leading icon, for compact filter rows */
export const Sel = ({ icon, id, value, onChange, label, children }) => html`<label className="sel-i" htmlFor=${id}><${Icon} n=${icon} s=${16}/><select id=${id} value=${value} onChange=${onChange} aria-label=${label} title=${label}>${children}</select></label>`;
