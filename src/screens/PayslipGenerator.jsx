import { useState, useEffect, useMemo, useRef } from 'react';
import { html, Icon, HI } from '../ui.jsx';
import { SAMPLE, parseText, applyOverrides, monthLabel, valid } from '../payslipGen/payslip.js';
import { Sheet } from '../payslipGen/Sheet.jsx';
import { downloadOne, downloadAll } from '../payslipGen/pdf.js';
import '../payslipGen/payslipGen.css';

/* Admin: turn pasted pay details into A4 payslip PDFs. Everything happens in this browser: nothing is sent anywhere or kept,
   so leaving the page clears it. Format and rules: payslip-generator-spec.md. */

const HINT = 'Employee Name - Designation - 27/01/26\n\nMay - 30k\nJun - 35k (base pay change)';

// Each editable field on a card: [key in the payslip, label, input type, step]
const FIELDS = [['salary', 'Monthly salary (₹)', 'number', '0.01'], ['amt', 'Amount paid (₹)', 'number', '0.01'], ['paid', 'Paid days', 'number', '0.5'], ['lop', 'LOP days', 'number', '0.5'],
  ['lwd', 'Last working day (optional)', 'date', ''], ['payDate', 'Pay date', 'date', '']];

function Card({ it, sel, busy, onSelect, onEdit, onDownload }) {
  return html`<article className=${'pgn-item' + (sel ? ' pgn-on' : '')}>
    <button type="button" className="pgn-head" onClick=${onSelect} aria-pressed=${sel}>
      <span className="pgn-who"><b>${it.name}</b><small>${monthLabel(it)} · ${it.designation}</small></span>
      <span className=${'pay-s ' + (it.flag ? 'warn' : 'ok')}><i></i>${it.flag ? 'Check' : 'Ready'}</span>
    </button>
    <div className="pgn-fields">${FIELDS.map(([k, label, type, step]) => html`<label key=${k} className=${type === 'date' ? 'dt' : undefined}>${label}
      <input className="inp" type=${type} value=${it[k]} step=${step || undefined} min=${type === 'number' ? '0' : undefined} inputMode=${type === 'number' ? 'decimal' : undefined} onChange=${ev => onEdit(k, ev.target.value)}/></label>`)}</div>
    <div className="pgn-foot">
      <span className=${'pgn-basis' + (it.flag ? ' warn' : '')}>${it.basis}</span>
      <button type="button" className="btn ghost sm" disabled=${busy || !valid(it)} onClick=${onDownload} title=${valid(it) ? undefined : 'Needs an amount, paid days and a pay date'}><${Icon} n="download" s=${15}/> Download PDF</button>
    </div>
  </article>`;
}

export function PayslipGenerator() {
  const [text, setText] = useState(SAMPLE), [read, setRead] = useState(SAMPLE);
  const [edits, setEdits] = useState({}), [sel, setSel] = useState(null), [busy, setBusy] = useState(false), [status, setStatus] = useState({ msg: '', kind: '' });
  const [scale, setScale] = useState(1), gridRef = useRef(null), rightRef = useRef(null), paperRef = useRef(null), clear = useRef(null);

  // Read the text a moment after typing stops
  useEffect(() => { const t = setTimeout(() => setRead(text), 250); return () => clearTimeout(t); }, [text]);
  const parsed = useMemo(() => parseText(read), [read]);
  const items = useMemo(() => applyOverrides(parsed.items, edits), [parsed, edits]);
  const cur = items.find(i => i.key === sel) || items[0] || null;
  const people = new Set(items.map(i => i.name.toLowerCase())).size, checks = items.filter(i => i.flag).length;

  // The paper is 595 px wide; scale it to the column so no white strip is left beside it (never larger than 1.4)
  useEffect(() => {
    const el = rightRef.current; if (!el) return;
    const fit = () => setScale(Math.min(1.4, el.clientWidth / 595));
    fit();
    if (!window.ResizeObserver) { window.addEventListener('resize', fit); return () => window.removeEventListener('resize', fit); }
    const ro = new ResizeObserver(fit); ro.observe(el); return () => ro.disconnect();
  }, []);
  useEffect(() => () => clearTimeout(clear.current), []);

  const say = (msg, kind = '') => { clearTimeout(clear.current); setStatus({ msg, kind }); if (kind === 'ok') clear.current = setTimeout(() => setStatus({ msg: '', kind: '' }), 7000); };
  const edit = (it, k, v) => setEdits(e => ({ ...e, [it.key]: { ...(e[it.key] || {}), [k]: v } }));
  const pick = it => { setSel(it.key); if (gridRef.current && gridRef.current.clientWidth <= 860 && rightRef.current) rightRef.current.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const run = async (first, job, done) => { if (busy) return; setBusy(true); say(first); try { say(await job(), 'ok'); } catch (x) { say(x.message || 'The file could not be created.', 'err'); } setBusy(false); };

  const one = it => run('Preparing ' + it.name + ', ' + monthLabel(it) + '…', async () => 'Saved ' + await downloadOne(it));
  const all = () => run('Creating payslip 1 of ' + items.length + '…', async () => { await downloadAll(items, (n, t) => say('Creating payslip ' + n + ' of ' + t + '…')); return 'Saved Payslips.zip with ' + items.length + ' payslip' + (items.length === 1 ? '' : 's'); });
  const allOk = items.length > 0 && items.every(valid);

  return html`<div className="pgn">
    <div className="pg-h"><div><h1><${HI} n="paygen" tone="orange"/>Make payslips</h1><p>Paste pay details, check each payslip, then download. Nothing is sent or saved: leaving this page clears it.</p></div></div>
    <div className="pgn-grid" ref=${gridRef}>
      <div className="pgn-left">
        <section className="pgn-panel" aria-labelledby="pgn-t1">
          <h2 id="pgn-t1">Pay details</h2>
          <p className="pgn-hint">One block per employee: <b>Name - Designation - joining date</b>, then one line per month, like <b>Jun - 35k (note)</b>.</p>
          <textarea className="inp pgn-ta" value=${text} onChange=${ev => setText(ev.target.value)} spellCheck="false" aria-label="Pay details" placeholder=${HINT}></textarea>
        </section>
        <section className="pgn-panel" aria-labelledby="pgn-t2">
          <h2 id="pgn-t2">Payslips</h2>
          <div className="pgn-sum">
            <div className="pgn-count" role="status">${items.length ? html`${items.length} payslip${items.length === 1 ? '' : 's'} <span>for ${people} employee${people === 1 ? '' : 's'}${checks ? ', ' + checks + ' to check' : ''}</span>` : 'No payslips yet'}</div>
            <button type="button" className="btn pri" disabled=${busy || !allOk} onClick=${all} title=${items.length && !allOk ? 'Every payslip needs an amount, paid days and a pay date' : undefined}><${Icon} n="download" s=${16}/> Download all (ZIP)</button>
          </div>
          <p className=${'pgn-status' + (status.kind ? ' ' + status.kind : '')} role=${status.kind === 'err' ? 'alert' : 'status'}>${status.msg}</p>
          ${items.length === 0 ? html`<div className="pgn-empty">Nothing to show yet. Paste details above, one block per employee.</div>`
            : html`<div className="pgn-list">${items.map(it => html`<${Card} key=${it.key} it=${it} sel=${cur && cur.key === it.key} busy=${busy} onSelect=${() => pick(it)} onEdit=${(k, v) => edit(it, k, v)} onDownload=${() => one(it)}/>`)}</div>`}
          ${parsed.ignored.length > 0 && html`<details className="pgn-ign"><summary>${parsed.ignored.length} line${parsed.ignored.length === 1 ? '' : 's'} not used</summary>
            <ul>${parsed.ignored.map((g, i) => html`<li key=${i}><code>${g.line}</code> (${g.why})</li>`)}</ul></details>`}
        </section>
      </div>
      <div className="pgn-right" ref=${rightRef}>
        <div className="pgn-paper" ref=${paperRef} style=${cur ? { width: Math.round(595 * scale), height: Math.round(842 * scale) } : undefined} aria-label=${cur ? 'Preview of the payslip for ' + cur.name : undefined}>
          ${cur ? html`<div className="pgn-scale" style=${{ transform: 'scale(' + scale + ')' }}><${Sheet} it=${cur}/></div>` : html`<div className="pgn-none" style=${{ display: 'block' }}>Paste pay details to see the payslips here.</div>`}
        </div>
      </div>
    </div>
  </div>`;
}
