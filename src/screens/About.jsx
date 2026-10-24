import { useState } from 'react';
import { html, Icon } from '../ui.jsx';
import { VERSION, BUILT, CHANGELOG, MODULES, ROLES } from '../about.js';

const fmtBuilt = d => d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getFullYear();

export function About() {
  const [copied, setCopied] = useState(false);
  const details = 'Maayasthra People v' + VERSION + ' · updated ' + fmtBuilt(BUILT) + ' · ' + (navigator.userAgent.match(/(Edg|Chrome|Firefox|Version)\/[\d.]+/) || ['browser'])[0];
  const copy = () => { try { navigator.clipboard.writeText(details).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); }, () => {}); } catch (x) {} };
  return html`<div className="ab">
    <section className="ab-hero">
      <span className="ab-mark" aria-hidden="true"></span>
      <div><h1>Maayasthra People</h1><p>One place for the team: people, leave, hours and tasks.</p>
        <div className="ab-chips"><span className="ab-v">Version ${VERSION}</span><span>Last updated ${fmtBuilt(BUILT)}</span></div></div>
    </section>

    <section className="ab-sec"><h2>What is inside</h2>
      <div className="ab-grid">${MODULES.map(([ic, t, d]) => html`<div className="ab-tile" key=${t}><span><${Icon} n=${ic} s=${20}/></span><b>${t}</b><p>${d}</p></div>`)}</div></section>

    <section className="ab-sec"><h2>What is new</h2>
      <div className="ab-log">${CHANGELOG.map((c, i) => html`<article className=${'ab-rel' + (i === 0 ? ' now' : '')} key=${c.version}>
        <header><b>${c.version}</b>${i === 0 && html`<span className="ab-latest">Latest</span>`}<time>${c.date}</time></header>
        <h3>${c.title}</h3>
        <ul>${c.items.map(x => html`<li key=${x}>${x}</li>`)}</ul></article>`)}</div></section>

    <section className="ab-sec"><h2>Who can do what</h2>
      <div className="ab-roles">${ROLES.map(([r, d]) => html`<div key=${r}><b>${r}</b><p>${d}</p></div>`)}</div></section>

    <section className="ab-sec ab-help"><div><h2>Something not working?</h2><p>Tell an admin what you were doing. Quote the version above so it is quick to find the cause.</p></div>
      <button className="btn sec2" onClick=${copy}><${Icon} n=${copied ? 'check' : 'copy'} s=${15}/> ${copied ? 'Copied' : 'Copy version details'}</button></section>

    <p className="ab-ft">Your data is kept in Maayasthra’s own database. Times follow India Standard Time.</p>
  </div>`;
}
