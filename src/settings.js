/* Personal settings: sounds, volume, which reminders a person gets. Kept per person (in their saved preferences, so they follow
   them to any device) and read here by the code that plays sounds and fires reminders. Plain functions, no framework. */
export const DEFAULTS = { sound: true, volume: 'normal', taskPing: true, annChime: true, eodReminder: true };
export const VOLUMES = { low: 0.5, normal: 1, high: 1.6 };

// Anything stored that is the wrong type falls back to the default, so a bad value can never silence or break the app
export function normalize(raw) {
  const r = raw && typeof raw === 'object' ? raw : {}, out = { ...DEFAULTS };
  ['sound', 'taskPing', 'annChime', 'eodReminder'].forEach(k => { if (typeof r[k] === 'boolean') out[k] = r[k]; });
  if (typeof r.volume === 'string' && Object.prototype.hasOwnProperty.call(VOLUMES, r.volume)) out.volume = r.volume;
  return out;
}

let current = { ...DEFAULTS };
export const getSettings = () => current;
export const applySettings = raw => { current = normalize(raw); return current; };
export const volumeMult = () => VOLUMES[current.volume] || 1;
// Merge a change into the current settings
export const withChange = (base, patch) => normalize({ ...normalize(base), ...patch });
