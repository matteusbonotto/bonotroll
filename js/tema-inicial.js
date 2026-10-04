// Aplica o tema salvo ANTES do CSS carregar (era um <script> inline no
// index.html; virou arquivo em 2026-10-04 para a CSP não precisar de
// 'unsafe-inline' em script-src). Script clássico, síncrono, de propósito.
(function () {
  var salvo = localStorage.getItem('bonotto_theme');
  if (salvo === 'dark' || salvo === 'light') document.documentElement.setAttribute('data-bs-theme', salvo);
})();
