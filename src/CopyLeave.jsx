import { useState } from 'react';
import { html, Icon } from './ui.jsx';
import { leaveText, copyText } from './leaveCopy.js';
import { BY } from './data.js';

// A button that copies one leave request as text, ready to paste into WhatsApp
export function CopyLeave({ l, all, label = true }) {
  const [st, setSt] = useState('');
  const go = async () => { const ok = await copyText(leaveText(l, all)); setSt(ok ? 'done' : 'fail'); setTimeout(() => setSt(''), 2200); };
  return html`<button className=${'btn ghost sm cpy' + (st === 'done' ? ' ok' : '')} onClick=${go} title="Copy this request as text" aria-label=${'Copy the leave request of ' + (BY[l.emp] ? BY[l.emp].name : 'this person')}><${Icon} n=${st === 'done' ? 'check' : 'copy'} s=${15}/>${label ? (st === 'done' ? 'Copied' : st === 'fail' ? 'Could not copy' : 'Copy') : ''}</button>`;
}
