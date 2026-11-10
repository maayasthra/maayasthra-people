import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { html, Icon } from './ui.jsx';

/* A step-by-step walkthrough of the workspace for someone new. It points at real parts of the page,
   can be skipped at any point, and can be run again from the account menu. */
const seen = sels => { for (const s of sels) for (const el of document.querySelectorAll(s)) { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); if (r.width > 8 && r.height > 8 && cs.visibility !== 'hidden' && cs.display !== 'none') return el; } return null; };

function stepsFor(name, role) {
  const mgr = role === 'admin' || role === 'pm';
  const s = [
    { title: 'Welcome to Maayasthra, ' + name, body: 'Here is a quick tour of your workspace. It takes about a minute, and you can skip it at any time.' },
    { sel: ['.tiles'], title: 'Your home page', body: role === 'admin' ? 'Home gives you the day at a glance: who is in, who is away, and what is waiting for you to review.' : 'Home gives you the day at a glance: your leave balances, what you are working on, and what the team is up to.' },
    { sel: ['.ck-d', '.ck-m'], title: 'Check in and out', body: mgr ? 'Check in when you start your day and check out when you finish. Your hours are kept automatically.' : 'Check in when you start your day. When you check out you write a short end-of-day report of what you worked on.' },
    { sel: ['.side .nav', '.bnav'], title: 'Find your way around', body: role === 'admin' ? 'Announcements, Members, the Org chart, Calendar, Attendance, leave Requests and Settings are all here.' : 'Announcements, the Calendar, the Org chart and your hours are here. Members, leaves and requests are shown greyed out for now: only admins can open them.' },
    { sel: ['.side .apps2', '.hdr-b .apps2', '.apps2'], title: 'Two apps in one', body: mgr ? 'People is for the team, leave and attendance. Task is the Kanban board, your own tasks, end-of-day reports and the team view.' : 'People is for the team, leave and attendance. Task is where your tasks live. Start one when you begin it, and finish it when it is done.' },
    { sel: ['.ps'], title: 'Finish your profile', body: 'Add a photo, a line about you, your phone number and an emergency contact. This card goes away once everything is filled in.' },
    { sel: ['.nf-b'], title: 'Notifications', body: 'The bell tells you when a new task is given to you, and reminds you to write your end-of-day report before you finish.' },
    { sel: ['.hdr .qs', '.qs'], title: 'Search', body: 'Find a colleague, a page or a task from anywhere. Press the slash key to jump straight to it.' },
    { sel: ['.tr-me'], title: 'Your account', body: 'View or edit your profile, switch between light and dark, change your password, and take this tour again whenever you like.' },
    { title: 'You are all set', body: 'That is everything. If you get stuck, ask an admin, and quote the version number in About.' }
  ];
  return s;
}

export function Tour({ name, role, onClose }) {
  const [i, setI] = useState(0), [box, setBox] = useState(null), [size, setSize] = useState({ w: innerWidth, h: innerHeight });
  const steps = useRef(null);
  if (steps.current === null) steps.current = stepsFor(name, role).filter(s => !s.sel || seen(s.sel));
  const list = steps.current, st = list[i], last = i === list.length - 1;
  const card = useRef(null);

  const measure = () => {
    setSize({ w: innerWidth, h: innerHeight });
    const el = st.sel ? seen(st.sel) : null;
    if (!el) { setBox(null); return; }
    const r = el.getBoundingClientRect();
    setBox({ x: r.left, y: r.top, w: r.width, h: r.height });
  };
  useLayoutEffect(() => {
    const el = st.sel ? seen(st.sel) : null;
    if (el) { const r = el.getBoundingClientRect(); if (r.top < 70 || r.bottom > innerHeight - 70) el.scrollIntoView({ block: 'center', behavior: 'instant' in window ? 'auto' : 'auto' }); }
    measure();
    // The page may still be scrolling for a moment, so keep following the target until it settles
    let n = 0; const t = setInterval(() => { measure(); if (++n > 14) clearInterval(t); }, 60);
    return () => clearInterval(t);
  }, [i]);
  useEffect(() => {
    const f = () => measure();
    addEventListener('resize', f); addEventListener('scroll', f, true);
    const k = ev => { if (ev.key === 'Escape') onClose(false); else if (ev.key === 'ArrowRight' || ev.key === 'Enter') { if (!(ev.target && /BUTTON/.test(ev.target.tagName) && ev.key === 'Enter')) next(); } else if (ev.key === 'ArrowLeft') setI(v => Math.max(0, v - 1)); };
    document.addEventListener('keydown', k);
    return () => { removeEventListener('resize', f); removeEventListener('scroll', f, true); document.removeEventListener('keydown', k); };
  });
  useEffect(() => { if (card.current) { const b = card.current.querySelector('.btn.pri'); b && b.focus({ preventScroll: true }); } }, [i]);

  const next = () => { if (last) onClose(true); else setI(v => v + 1); };
  const pad = 8, vw = size.w, vh = size.h, cw = Math.min(360, vw - 24);
  let pos = { left: Math.round((vw - cw) / 2), top: Math.round(vh / 2 - 110) };
  if (box) {
    const below = box.y + box.h + pad + 16, ch = 210;
    if (vw < 700) pos = { left: Math.round((vw - cw) / 2), top: box.y + box.h / 2 > vh / 2 ? Math.max(12, box.y - pad - ch - 12) : Math.min(vh - ch - 12, below) };
    else if (below + ch < vh) pos = { left: Math.min(vw - cw - 16, Math.max(16, box.x + box.w / 2 - cw / 2)), top: below };
    else if (box.y - pad - 16 - ch > 0) pos = { left: Math.min(vw - cw - 16, Math.max(16, box.x + box.w / 2 - cw / 2)), top: box.y - pad - 16 - ch };
    else pos = { left: box.x + box.w + 24 + cw < vw ? box.x + box.w + 24 : Math.max(16, box.x - cw - 24), top: Math.max(16, Math.min(vh - ch - 16, box.y)) };
  }

  return html`<div className="tour" role="presentation">
    ${box ? html`<div className="tour-spot" style=${{ left: box.x - pad, top: box.y - pad, width: box.w + pad * 2, height: box.h + pad * 2 }}></div>` : html`<div className="tour-dim"></div>`}
    <div className="tour-card" ref=${card} role="dialog" aria-modal="true" aria-labelledby="tour-t" aria-describedby="tour-b" style=${{ left: pos.left, top: pos.top, width: cw }}>
      <div className="tour-top"><span className="tour-n">${i === 0 ? 'Quick tour' : 'Step ' + i + ' of ' + (list.length - 2)}</span>
        ${!last && html`<button className="tour-x" onClick=${() => onClose(false)} aria-label="Skip the tour" title="Skip the tour"><${Icon} n="x" s=${15}/></button>`}</div>
      <h2 id="tour-t">${st.title}</h2>
      <p id="tour-b">${st.body}</p>
      <div className="tour-dots" aria-hidden="true">${list.map((_, k) => html`<i key=${k} className=${k === i ? 'on' : k < i ? 'done' : ''}></i>`)}</div>
      <div className="tour-a">
        ${last ? html`<span></span>` : html`<button className="btn ghost sm" onClick=${() => onClose(false)}>Skip tour</button>`}
        <span className="tour-b">${i > 0 && !last && html`<button className="btn sec2 sm" onClick=${() => setI(v => v - 1)}>Back</button>`}
          <button className="btn pri sm" onClick=${next}>${i === 0 ? 'Start the tour' : last ? 'Finish' : 'Next'}</button></span>
      </div>
    </div></div>`;
}
