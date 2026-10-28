import { html, Icon } from '../ui.jsx';

// What a new person is asked to fill in. They can all be changed by the person themselves.
export const SETUP = [
  { k: 'photo', label: 'Add your photo', done: u => !!u.photo },
  { k: 'bio', label: 'Write a line about you', done: u => !!(u.bio || '').trim() },
  { k: 'phone', label: 'Add your phone number', done: u => !!(u.phone || '').trim() },
  { k: 'emergency', label: 'Add an emergency contact', done: u => !!(u.emergency || '').trim() && !!(u.emergencyPhone || '').trim() }
];

// A reminder on the home page until the profile is filled in. It goes away on its own once everything is done.
export function ProfileSetup({ user, openForm }) {
  const done = SETUP.filter(s => s.done(user)).length;
  if (done === SETUP.length) return null;
  const pct = Math.round(done / SETUP.length * 100);
  return html`<section className="ps" aria-label="Finish setting up your profile">
    <div className="ps-h">
      <div><h2>Finish setting up your profile</h2><p>${done === 0 ? 'Help the team get to know you. It takes a minute.' : done + ' of ' + SETUP.length + ' done. Nearly there.'}</p></div>
      <button className="btn pri sm" onClick=${() => openForm(user.n)}>${done === 0 ? 'Get started' : 'Continue'}</button>
    </div>
    <div className="ps-p"><div className="ps-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${pct} aria-label="Profile completion"><i style=${{ width: pct + '%' }}></i></div><b>${pct}%</b></div>
    <div className="ps-l">${SETUP.map(s => { const d = s.done(user); return html`<button key=${s.k} className=${'ps-i' + (d ? ' on' : '')} onClick=${() => !d && openForm(user.n)} disabled=${d}><span className="ps-ck"><${Icon} n="check" s=${12}/></span>${s.label}</button>`; })}</div>
  </section>`;
}
