// Aplica o tema salvo ANTES do CSS carregar (era um <script> inline no
// index.html; virou arquivo em 2026-10-04 para a CSP não precisar de
// 'unsafe-inline' em script-src). Script clássico, síncrono, de propósito.
(function () {
  // Endereço antigo (GitHub Pages) -> novo (Firebase). Desde 2026-10-04 o
  // fonte não traz mais a configuração do banco (vem do build do Firebase),
  // então o GitHub Pages caía no modo demonstração e o login dava "Failed to
  // fetch". Quem ainda abre o endereço antigo é levado ao novo.
  if (/\.github\.io$/i.test(location.hostname)) {
    location.replace('https://bnttapp.web.app/' + location.search + location.hash);
    return;
  }
  var salvo = localStorage.getItem('bonotto_theme');
  if (salvo === 'dark' || salvo === 'light') document.documentElement.setAttribute('data-bs-theme', salvo);
  // Tamanho do texto (Perfil → Preferências, 2026-10-04): escala o rem do app inteiro.
  // Valor em % (87,5 a 150) desde a versão A−/A+; nomes antigos ainda valem.
  var bruto = localStorage.getItem('bonotto_tamanho_texto');
  var escala = { grande: 112.5, 'muito-grande': 125 }[bruto] || Number(bruto);
  if (escala >= 87.5 && escala <= 150 && escala !== 100) document.documentElement.style.fontSize = escala + '%';
})();
