import { useState } from 'react';
import { html, Icon } from '../ui.jsx';
import { fmtH, hoursOf } from '../eodDb.js';
import { pd } from '../data.js';

const label = iso => new Date(pd(iso)).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

/* One report (or several days) as a table that pastes cleanly into Gmail, Docs, Sheets and Slack, plus a plain-text twin with aligned columns.
   Project lines are bold, subtasks semibold and indented, descriptions regular. */
export function eodTable(days) {
  const th = 'border:1px solid #d4d4d4;padding:6px 10px;background:#f5f5f5;text-align:left;font-weight:700', td = 'border:1px solid #d4d4d4;padding:6px 10px;vertical-align:top';
  let h = '', t = '';
  days.forEach((d, n) => {
    const hrs = d.total > 0;
    const cols = hrs ? 3 : 2;
    h += '<table style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:13px;margin:0 0 14px"><thead>'
      + '<tr><th colspan="' + cols + '" style="' + th + '">' + esc(label(d.day)) + (hrs ? ' &nbsp;·&nbsp; ' + esc(fmtH(d.total)) : '') + '</th></tr>'
      + '<tr><th style="' + th + '">Project / task</th><th style="' + th + '">What I did</th>' + (hrs ? '<th style="' + th + ';text-align:right">Time</th>' : '') + '</tr></thead><tbody>';
    t += (n ? '\n' : '') + label(d.day) + (hrs ? '  ·  ' + fmtH(d.total) : '') + '\n' + '-'.repeat(60) + '\n';
    d.rows.forEach(r => {
      h += '<tr><td style="' + td + ';font-weight:700">' + esc(r.project) + '</td><td style="' + td + '">' + esc(r.desc) + '</td>' + (hrs ? '<td style="' + td + ';text-align:right;font-weight:700;white-space:nowrap">' + esc(fmtH(hoursOf(r))) + '</td>' : '') + '</tr>';
      t += (hrs ? (r.project + ' ').padEnd(44, ' ') + fmtH(hoursOf(r)).padStart(8) : r.project) + '\n' + (r.desc ? '   ' + r.desc.replace(/\n/g, '\n   ') + '\n' : '');
      (r.subs || []).forEach(s => {
        h += '<tr><td style="' + td + ';padding-left:28px;font-weight:600">' + esc(s.title) + '</td><td style="' + td + '">' + esc(s.desc) + '</td>' + (hrs ? '<td style="' + td + ';text-align:right;font-weight:600;white-space:nowrap">' + esc(fmtH(Number(s.hours) || 0)) + '</td>' : '') + '</tr>';
        t += (hrs ? ('   - ' + s.title + ' ').padEnd(44, ' ') + fmtH(Number(s.hours) || 0).padStart(8) : '   - ' + s.title) + '\n' + (s.desc ? '     ' + s.desc.replace(/\n/g, '\n     ') + '\n' : '');
      });
    });
    h += '</tbody></table>';
  });
  return { html: h, text: t.trimEnd() };
}

async function copy(days) {
  const { html: h, text } = eodTable(days);
  if (navigator.clipboard && window.ClipboardItem) {
    try { await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([h], { type: 'text/html' }), 'text/plain': new Blob([text], { type: 'text/plain' }) })]); return; } catch (x) { /* fall through to the older way */ }
  }
  // Older browsers: select a hidden copy of the table and copy that
  const box = document.createElement('div'); box.innerHTML = h; box.style.cssText = 'position:fixed;left:-9999px;top:0;white-space:pre-wrap';
  document.body.appendChild(box); const sel = window.getSelection(), range = document.createRange(); range.selectNodeContents(box); sel.removeAllRanges(); sel.addRange(range);
  const ok = document.execCommand('copy'); sel.removeAllRanges(); box.remove(); if (!ok) throw new Error('copy failed');
}

export function CopyEod({ days, text = 'Copy', small = true }) {
  const [st, setSt] = useState('');
  const go = async ev => { ev.stopPropagation(); try { await copy(days); setSt('ok'); } catch (x) { setSt('err'); } setTimeout(() => setSt(''), 2000); };
  return html`<button className=${'btn sec2' + (small ? ' sm' : '')} onClick=${go} disabled=${!days.length} aria-live="polite"><${Icon} n=${st === 'ok' ? 'check' : 'copy'} s=${15}/>${st === 'ok' ? 'Copied' : st === 'err' ? 'Could not copy' : text}</button>`;
}
