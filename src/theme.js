import { useEffect, useState } from 'react';

/* Light and dark. The choice (light, dark or follow the device) is kept in this browser.
   public/theme-boot.js applies it before the page paints so there is no flash. */
const KEY = 'mp-theme';
const DEFAULT = 'system';
const COLORS = { dark: '#0A0A0A', light: '#FAFAFA' };
const query = () => typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: light)') : null;

export function getPref() {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' || v === 'system' ? v : DEFAULT; } catch (x) { return DEFAULT; }
}
export const resolve = pref => pref === 'system' ? (query() && query().matches ? 'light' : 'dark') : pref;

export function applyTheme(pref = getPref()) {
  const t = resolve(pref), root = document.documentElement;
  root.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', COLORS[t]);
  return t;
}
export function setPref(pref) {
  try { localStorage.setItem(KEY, pref); } catch (x) { /* private window: the choice lasts until the tab closes */ }
  applyTheme(pref);
  window.dispatchEvent(new Event('mp-theme'));
}

// The current choice, kept in step when it changes anywhere on the page, in another tab, or in the device setting
export function useTheme() {
  const [pref, setP] = useState(getPref);
  useEffect(() => {
    const sync = () => { setP(getPref()); applyTheme(); };
    const q = query();
    window.addEventListener('mp-theme', sync); window.addEventListener('storage', sync);
    if (q && q.addEventListener) q.addEventListener('change', sync);
    return () => { window.removeEventListener('mp-theme', sync); window.removeEventListener('storage', sync); if (q && q.removeEventListener) q.removeEventListener('change', sync); };
  }, []);
  return [pref, setPref];
}
