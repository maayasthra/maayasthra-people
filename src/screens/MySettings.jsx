import { useState, useRef, useEffect } from 'react';
import { html, Icon, HI, Switch } from '../ui.jsx';
import { ThemeSwitch } from '../ThemeSwitch.jsx';
import { checkInSound, notifyState, askNotify } from '../alerts.js';
import { useCover, saveCover } from '../coverDb.js';

// One labelled setting. Defined outside the page so controls keep their focus while the page updates.
const Row = ({ title, desc, off, children }) => html`<div className=${'sr' + (off ? ' dim' : '')}><span><b>${title}</b>${desc && html`<span className="d">${desc}</span>`}</span><span className="sr-c">${children}</span></div>`;
const Block = ({ title, children }) => html`<section className="st-s ms-b"><h2 className="st-h">${title}</h2>${children}</section>`;

/* Settings every person can change for themselves. They are saved to the person's account, so they follow them to any device. */
export function MySettings({ user, role, st, change, reset, onPassword, onTour }) {
  const [perm, setPerm] = useState(notifyState()), [saved, setSaved] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const cover = useCover(user.n), timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const set = patch => { change(patch); setSaved(true); clearTimeout(timer.current); timer.current = setTimeout(() => setSaved(false), 1800); };
  const turnOn = async () => { setPerm(await askNotify()); };
  const useDefault = async () => { setBusy(true); setErr(''); try { await saveCover(user.n, ''); } catch (e) { setErr(e.message); } setBusy(false); };
  const permText = { granted: 'On', denied: 'Blocked in your browser settings', default: 'Off', unsupported: 'Not available in this browser' }[perm] || 'Off';
  return html`<div className="ms">
    <div className="pg-h"><div><h1><${HI} n="settings" tone="purple"/>My settings</h1><p>Saved to your account, so they follow you to any device.</p></div>
      <span className=${'saved ms-saved' + (saved ? ' on' : '')} role="status">${saved ? html`<${Icon} n="check" s=${16}/> Saved` : ''}</span></div>

    <${Block} title="Appearance">
      <${Row} title="Theme" desc="Light, dark, or match your device."><${ThemeSwitch}/><//>
    <//>

    <${Block} title="Sounds">
      <${Row} title="Sounds" desc="Check in and out, tasks, away time and board moves."><${Switch} on=${st.sound} set=${v => set({ sound: v })} label="Sounds"/><//>
      <${Row} title="Volume" off=${!st.sound}>
        <div className="seg" role="group" aria-label="Volume">${[['low', 'Low'], ['normal', 'Normal'], ['high', 'High']].map(([k, l]) => html`<button key=${k} disabled=${!st.sound} className=${st.volume === k ? 'on' : ''} onClick=${() => { set({ volume: k }); setTimeout(checkInSound, 60); }}>${l}</button>`)}</div>
        <button className="btn ghost sm" disabled=${!st.sound} onClick=${checkInSound}>Play a test</button><//>
      <${Row} title="New task ping" desc="A short sound when a task is given to you." off=${!st.sound}><${Switch} on=${st.taskPing} set=${v => set({ taskPing: v })} label="New task ping"/><//>
      <${Row} title="Announcement chime" desc="Announcements still appear on screen until you press Got it. This only controls the sound." off=${!st.sound}><${Switch} on=${st.annChime} set=${v => set({ annChime: v })} label="Announcement chime"/><//>
    <//>

    <${Block} title="Reminders">
      ${role === 'employee' && html`<${Row} title="End-of-day reminder" desc="A nudge 30 and 15 minutes before your shift ends, if your report is not sent yet."><${Switch} on=${st.eodReminder} set=${v => set({ eodReminder: v })} label="End-of-day reminder"/><//>`}
      <${Row} title="Desktop notifications" desc="Show alerts outside the browser window. They only work while Maayasthra People is open in a tab."><span className=${'ms-st ' + perm}>${permText}</span>${(perm === 'default') && html`<button className="btn sec2 sm" onClick=${turnOn}>Turn on</button>`}<//>
    <//>

    <${Block} title="Home cover">
      <${Row} title="Cover picture" desc=${cover ? 'You are using your own picture. Change it from the Home page.' : 'You are using the default cover. Change it from the Home page.'}>${cover ? html`<button className="btn sec2 sm" disabled=${busy} onClick=${useDefault}>${busy ? 'Saving…' : 'Use the default'}</button>` : null}<//>
      ${err && html`<div className="lg-err" role="alert" style=${{ margin: '8px 0 0' }}>${err}</div>`}
    <//>

    <${Block} title="Account">
      <${Row} title="Password" desc="Change the password you sign in with."><button className="btn sec2 sm" onClick=${onPassword}><${Icon} n="lock" s=${15}/> Change password</button><//>
      <${Row} title="Tour" desc="Walk through the app again."><button className="btn sec2 sm" onClick=${onTour}><${Icon} n="info" s=${15}/> Take the tour</button><//>
    <//>

    <div className="ms-f"><button className="btn ghost sm" onClick=${() => { reset(); setSaved(true); clearTimeout(timer.current); timer.current = setTimeout(() => setSaved(false), 1800); }}>Reset sounds and reminders</button></div>
  </div>`;
}
