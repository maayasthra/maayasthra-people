import { useEffect, useState } from 'react';
import { IS_DEMO } from './env.js';

/* A tab left open keeps running the code it loaded. This notices when a newer build has been deployed, so people can refresh. */
const mine = typeof __BUILD_DATE__ !== 'undefined' ? __BUILD_DATE__ : null;
export function useUpdateAvailable() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (IS_DEMO || !mine) return;
    let live = true;
    const check = () => fetch('/version.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(v => { if (live && v && v.built && v.built !== mine) setReady(true); }).catch(() => {});
    const t = setInterval(check, 300000), vis = () => { if (!document.hidden) check(); };
    document.addEventListener('visibilitychange', vis); check();
    return () => { live = false; clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, []);
  return ready;
}
