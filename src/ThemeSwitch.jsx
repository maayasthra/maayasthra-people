import { html, Icon } from './ui.jsx';
import { useTheme } from './theme.js';

const OPTS = [['system', 'system', 'Match this device'], ['light', 'sun', 'Light'], ['dark', 'moon', 'Dark']];

// Three small buttons: follow the device, light, dark
export function ThemeSwitch() {
  const [pref, setPref] = useTheme();
  return html`<div className="th" role="group" aria-label="Appearance">${OPTS.map(([k, ic, label]) => html`<button key=${k} type="button" className=${pref === k ? 'on' : ''} aria-pressed=${pref === k} aria-label=${label} title=${label} onClick=${() => setPref(k)}><${Icon} n=${ic} s=${15}/></button>`)}</div>`;
}
