// Aplica o tema salvo ANTES do CSS carregar (era um <script> inline no
// index.html; virou arquivo em 2026-10-04 para a CSP não precisar de
// 'unsafe-inline' em script-src). Script clássico, síncrono, de propósito.
(function () {
  var salvo = localStorage.getItem('bonotto_theme');
  if (salvo === 'dark' || salvo === 'light') document.documentElement.setAttribute('data-bs-theme', salvo);
  // Tamanho do texto (Perfil → Preferências, 2026-10-04): escala o rem do app inteiro.
  var escala = { grande: '112.5%', 'muito-grande': '125%' }[localStorage.getItem('bonotto_tamanho_texto')];
  if (escala) document.documentElement.style.fontSize = escala;
})();
