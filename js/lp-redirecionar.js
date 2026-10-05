// A raiz (/) é a LP desde 2026-10-05; o app mora em /app. Quem já usa o BNTT
// não pode cair na LP: este script (clássico, síncrono, no <head>) leva
// direto ao app quem
//   - abriu pelo app instalado (PWA instalado antes, com start_url antigo);
//   - chegou por link de demonstração (?demo=…) ou de rota do app (#/…);
//   - voltou de um e-mail do login (confirmação/recuperação de senha);
//   - já tem sessão salva neste aparelho (Supabase ou demonstração).
// ?ver=lp força a LP (ex.: botão "Ver planos" de dentro do app).
(function () {
  var busca = location.search;
  var hash = location.hash;
  if (/[?&]ver=lp\b/.test(busca)) return;
  var instalado = (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  var linkDoApp = /[?&](demo|code|token_hash|type)=/.test(busca) || /^#\/|access_token=|error_description=/.test(hash);
  var temSessao = false;
  try {
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if ((/^sb-.*-auth-token$/.test(k) && localStorage.getItem(k)) || k === 'bonotto_force_demo') { temSessao = true; break; }
    }
  } catch (e) { /* sem armazenamento: mostra a LP */ }
  if (instalado || linkDoApp || temSessao) location.replace('/app' + busca + hash);
})();
