/* Icon-only buttons get a tooltip from their accessible name, so every icon says what it does on hover. */
const mark = el => {
  if (el.nodeType !== 1) return;
  const list = el.matches && el.matches('button[aria-label]') ? [el, ...el.querySelectorAll('button[aria-label]')] : el.querySelectorAll ? el.querySelectorAll('button[aria-label]') : [];
  list.forEach(b => { if (!b.hasAttribute('title') && !b.textContent.trim()) b.setAttribute('title', b.getAttribute('aria-label')); });
};
export function startTooltips() {
  if (typeof MutationObserver === 'undefined' || typeof document === 'undefined') return;
  mark(document.body);
  new MutationObserver(list => list.forEach(m => m.addedNodes.forEach(mark))).observe(document.body, { childList: true, subtree: true });
}
