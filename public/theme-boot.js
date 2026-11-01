(function () {
  var p = 'dark';
  try { var v = localStorage.getItem('mp-theme'); if (v === 'light' || v === 'dark' || v === 'system') p = v; } catch (e) {}
  var t = p === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : p;
  document.documentElement.setAttribute('data-theme', t);
  var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'light' ? '#F2F2F7' : '#000000');
})();
