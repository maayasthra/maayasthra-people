/* Exit motion for anything that pops up (menus, dialogs, drawers, panels). React removes these at once, so this puts the
   removed element back for a moment with a .leaving class, lets the CSS fade it out, then drops it for good. */
const SEL = '.menu,.cm,.nf-p,.qs-dd,.lm,.kt-menu,.df-p,.dlg,.dlg-bg,.sh,.sh-bg,.mo,.mo-bg';
const MS = 170;

export function startExitMotion() {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  new MutationObserver(list => {
    for (const m of list) {
      if (!m.removedNodes.length || !m.target.isConnected) continue;
      m.removedNodes.forEach(n => {
        if (n.nodeType !== 1 || n.classList.contains('leaving') || !n.matches(SEL)) return;
        const next = m.nextSibling && m.nextSibling.parentNode === m.target ? m.nextSibling : null;
        n.classList.add('leaving'); n.setAttribute('aria-hidden', 'true'); n.inert = true;
        try { m.target.insertBefore(n, next); } catch (x) { return; }
        setTimeout(() => { try { n.remove(); } catch (x) {} }, MS);
      });
    }
  }).observe(document.body, { childList: true, subtree: true });
}
