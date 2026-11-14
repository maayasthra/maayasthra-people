import { html, Icon } from './ui.jsx';

/* The filter row used above lists across the portal: a search box, any number of dropdowns, and a Clear link that appears once
   something is set. groups: [{ label, value, set, options: [[key, label], ...] }]; the first option of each is its "no filter" value. */
export const matches = (term, ...fields) => { const t = String(term || '').trim().toLowerCase(); return !t || fields.some(f => String(f || '').toLowerCase().includes(t)); };

export function FilterBar({ q, setQ, placeholder = 'Search', groups = [], shown, total, noun = 'results' }) {
  const active = (q || '').trim() !== '' || groups.some(g => g.value !== g.options[0][0]);
  const clear = () => { setQ(''); groups.forEach(g => g.set(g.options[0][0])); };
  return html`<div className="flt" role="search">
    ${setQ && html`<div className="flt-s"><${Icon} n="search" s=${16}/><input className="inp" type="search" value=${q} placeholder=${placeholder} aria-label=${placeholder} onChange=${ev => setQ(ev.target.value)}/></div>`}
    ${groups.map(g => html`<label className="flt-g" key=${g.label}><span className="sr">${g.label}</span>
      <select className="inp" value=${g.value} aria-label=${g.label} onChange=${ev => g.set(ev.target.value)}>${g.options.map(([k, l]) => html`<option key=${k} value=${k}>${l}</option>`)}</select></label>`)}
    ${active && html`<button className="flt-c" onClick=${clear}>Clear</button>`}
    ${active && shown !== undefined && html`<span className="flt-n" role="status">${shown} of ${total} ${noun}</span>`}
  </div>`;
}
