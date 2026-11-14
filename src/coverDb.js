import { useState, useEffect } from 'react';
import { supabase } from './auth.js';
import { IS_DEMO } from './env.js';

/* The Home page cover picture. One for everyone; admins change it. '' means the built-in default. In demo mode it lives in this browser. */
const KEY = n => 'mp-cover-' + n;
let cache = { n: null, v: null };       // remembered between visits to Home so the picture does not flash
const subs = new Set();
const publish = (n, v) => { cache = { n, v }; subs.forEach(f => f(n, v)); };
export const MAX_COVER_BYTES = 2 * 1024 * 1024;

export async function loadCover(n) {
  if (IS_DEMO) { try { return localStorage.getItem(KEY(n)) || ''; } catch (x) { return ''; } }
  const { data, error } = await supabase.from('employee_covers').select('image').maybeSingle();
  if (error) throw new Error('Could not load your cover.');
  return data ? data.image || '' : '';
}

export async function saveCover(n, image) {
  if (IS_DEMO) { try { image ? localStorage.setItem(KEY(n), image) : localStorage.removeItem(KEY(n)); } catch (x) { throw new Error('That picture is too large to keep in this browser.'); } publish(n, image); return; }
  const { error } = await supabase.rpc('set_my_cover', { p_image: image });
  if (error) throw new Error(/Not allowed|not a picture|too large/.test(error.message) ? error.message : 'Could not save your cover. Check your connection and try again.');
  publish(n, image);
}

// My cover; null until it has loaded once for this person
export function useCover(n) {
  const [v, setV] = useState(cache.n === n ? cache.v : null);
  useEffect(() => {
    let live = true; const f = (who, val) => { if (who === n) setV(val); };
    subs.add(f); setV(cache.n === n ? cache.v : null);
    loadCover(n).then(c => { if (live) publish(n, c); }).catch(() => { if (live && cache.n !== n) publish(n, ''); });
    return () => { live = false; subs.delete(f); };
  }, [n]);
  return v;
}

// Shrink a chosen picture to a wide banner (at most 1600 px across) that loads quickly. Resolves to a JPEG data URL.
export function prepareCover(file) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) { reject(new Error('Choose a picture file, like a JPG or PNG.')); return; }
    if (file.size > MAX_COVER_BYTES) { reject(new Error('That picture is over 2 MB. Choose a smaller one.')); return; }
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let W = 1600, q = 0.82, out = '';
      for (let i = 0; i < 6; i++) {
        const sc = Math.min(1, W / img.width), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * sc)); c.height = Math.max(1, Math.round(img.height * sc));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        out = c.toDataURL('image/jpeg', q);
        if (out.length <= 600000) break;
        W = Math.round(W * 0.8); q = Math.max(0.6, q - 0.06);
      }
      out.length <= 650000 ? resolve(out) : reject(new Error('That picture is too detailed. Try a simpler one.'));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That picture could not be opened. Try a JPG or PNG.')); };
    img.src = url;
  });
}
