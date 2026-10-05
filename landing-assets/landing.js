// BNTT — landing page (raiz do site). Visual original + Casa/Negócio e
// planos Mensal/Anual. Os planos vêm de js/data/planos.js (mesma fonte do
// app e do Stripe). O pagamento acontece depois do cadastro, dentro do app
// (já com a conta identificada) — aqui só levamos a escolha: linha, plano
// e forma de pagamento.
import { PLANOS, precoAnualCentavos, DIAS_DE_TESTE } from '../js/data/planos.js';

const ICONES = {
  linhas: '<path d="M3 12h18M3 6h18M3 18h18" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  sacola: '<path d="M4 5h16l-1.5 12.5a2 2 0 0 1-2 1.5H7.5a2 2 0 0 1-2-1.5L4 5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 5V4a4 4 0 0 1 8 0v1" stroke="currentColor" stroke-width="1.6"/>',
  casa: '<path d="M4 21V9l8-6 8 6v12" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 21v-7h6v7" stroke="currentColor" stroke-width="1.6"/>',
  alerta: '<path d="M12 9v4m0 4h.01M10.3 3.86 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.86a2 2 0 0 0-3.4 0Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
  loja: '<path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="1.6"/>',
  check: '<path d="M5 12.5l4.2 4.2L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
};

const CONTEUDO = {
  home: {
    linha: 'Home',
    kicker: 'BNTT Home',
    titulo: ['Seu dinheiro.', 'Sua casa.', 'Sob controle.'],
    tagline: 'Controle financeiro doméstico',
    sub: 'O financeiro da casa, a lista de compras, o inventário e a saúde da família em um só lugar — simples para todo mundo, dos avós às crianças.',
    micro: `${DIAS_DE_TESTE} dias com tudo do plano Família. Sem cartão.`,
    dorTitulo: 'Sua vida doméstica está espalhada em apps demais.',
    dorLead: 'Financeiro numa planilha, compras num app, a casa na cabeça. Cada tarefa doméstica ganhou o próprio aplicativo — e nenhum deles se fala.',
    dores: [
      ['linhas', 'Um app pra dividir a conta com quem mora com você'],
      ['sacola', 'Outro pra anotar a lista de compras'],
      ['casa', 'Uma planilha (ou a memória) pra saber o que tem em casa'],
      ['alerta', 'E nenhum deles conversa com o outro'],
    ],
    dorFecho: 'No fim do mês, ninguém sabe exatamente quanto sobrou, o que falta comprar ou o que já venceu na geladeira.',
    solTitulo: 'Cada letra do BNTT organiza uma parte da sua vida financeira.',
    pilares: [
      ['B', 'Balanço', 'Uma visão clara do seu dinheiro: receitas, despesas, saldos e orçamento do mês.'],
      ['N', 'Necessidades', 'Lista de compras e inventário da casa — o que precisa ser comprado ou reposto, antes de faltar.'],
      ['T', 'Transações', 'Contas, cartões, parcelas e recorrências, com aviso antes de vencer.'],
      ['T', 'Tranquilidade', 'Tudo num lugar só — e a ficha de saúde de cada pessoa pronta para uma emergência.'],
    ],
    passos: [
      ['Crie sua conta e chame quem mora com você', 'Cada pessoa tem o próprio acesso, e todos veem a mesma casa.'],
      ['Junte financeiro, compras e casa', 'Cadastre as contas, a lista e os cômodos — ou traga sua planilha em minutos.'],
      ['Veja tudo se atualizar sozinho', 'Saldo, lista e estoque se ajustam a cada ação. Sem retrabalho, sem planilha paralela.'],
    ],
    planosTitulo: 'Comece grátis. Cresça quando precisar.',
    planosLead: `Toda conta começa com ${DIAS_DE_TESTE} dias do Família. Depois, você escolhe o plano — ou continua no grátis.`,
    faq: [
      ['Preciso de cartão para testar?', `Não. Você usa ${DIAS_DE_TESTE} dias com tudo liberado. Depois escolhe um plano ou continua no Grátis.`],
      ['É só pra casais?', 'Não. Tem plano para quem mora sozinho, para casais e para a família inteira — até 6 pessoas na mesma casa.'],
      ['O BNTT é seguro?', 'Sim. Os dados de cada casa ficam isolados, e as fichas de saúde são criptografadas no seu aparelho.'],
      ['Funciona no celular?', 'Sim. Roda direto do navegador, pode ser instalado na tela inicial e continua funcionando com a internet instável.'],
      ['Posso cancelar?', 'A qualquer momento, sem multa. Seus dados continuam seus e podem ser exportados.'],
    ],
    ctaTitulo: 'Sua casa em ordem a partir de hoje.',
  },
  business: {
    linha: 'Business',
    kicker: 'BNTT Business',
    titulo: ['Seu caixa.', 'Sua empresa.', 'Sob controle.'],
    tagline: 'O negócio inteiro em 1 tela',
    sub: 'Contas a pagar e receber, estoque, equipe e filiais num só lugar — tudo o que o dono precisa ver para decidir rápido.',
    micro: `${DIAS_DE_TESTE} dias com tudo do plano Expansão. Sem cartão.`,
    dorTitulo: 'Seu negócio está espalhado em sistemas demais.',
    dorLead: 'O caixa numa planilha, o estoque num caderno, a equipe no WhatsApp. Cada parte da empresa ganhou a própria ferramenta — e nenhuma delas se fala.',
    dores: [
      ['linhas', 'Uma planilha pras contas a pagar'],
      ['sacola', 'Outra pro estoque — sempre desatualizada'],
      ['loja', 'Cada filial com o próprio controle'],
      ['alerta', 'E nenhuma visão do todo na hora de decidir'],
    ],
    dorFecho: 'No fim do mês, o dono não sabe exatamente quanto entrou, o que falta repor ou qual unidade está dando lucro.',
    solTitulo: 'Cada letra do BNTT organiza uma parte do seu negócio.',
    pilares: [
      ['B', 'Balanço', 'O caixa do mês por unidade ou somado: o que entrou, o que saiu e o que sobrou.'],
      ['N', 'Necessidades', 'Compras e estoque que avisam antes de faltar — em todas as unidades.'],
      ['T', 'Transações', 'Contas a pagar e a receber, fornecedores, cartões e parcelas, com aviso de vencimento.'],
      ['T', 'Tranquilidade', 'Equipe com papéis claros: o funcionário lança, o contador consulta, o dono vê tudo.'],
    ],
    passos: [
      ['Crie a conta da empresa', 'Cadastre suas unidades — loja, filial ou obra — e convide a equipe.'],
      ['Traga o que já existe', 'Cole ou importe sua planilha de lançamentos e continue de onde parou.'],
      ['Decida olhando 1 tela só', 'O que precisa de você hoje aparece primeiro, por unidade ou de todas juntas.'],
    ],
    planosTitulo: 'Comece grátis. Cresça com o seu negócio.',
    planosLead: `Toda conta começa com ${DIAS_DE_TESTE} dias do Expansão. Mude de plano quando abrir a próxima unidade.`,
    faq: [
      ['Preciso de cartão para testar?', `Não. São ${DIAS_DE_TESTE} dias com tudo do Expansão. Depois você escolhe o plano.`],
      ['Serve para MEI e pequena empresa?', 'Sim. O Balcão é feito para quem tem uma porta só; o Expansão e o Rede, para quem tem filiais.'],
      ['O contador consegue acessar?', 'Sim, com o papel Contador: ele consulta e exporta, mas não muda nada.'],
      ['E se um funcionário errar um lançamento?', 'O funcionário só mexe no que ele mesmo lançou. Dono e gerente corrigem qualquer coisa.'],
      ['Posso cancelar?', 'A qualquer momento, sem multa. Seus dados podem ser exportados.'],
    ],
    ctaTitulo: 'Sua empresa em 1 tela a partir de hoje.',
  },
};

const raiz = document.documentElement;
const reduzirMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const lerSalvo = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const salvar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } };
const estado = {
  linha: new URLSearchParams(location.search).get('para') === 'business' ? 'business' : (lerSalvo('bntt_lp_linha') === 'business' ? 'business' : 'home'),
  ciclo: 'mensal',
};

const reais = (centavos) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svg = (nome, attrs = '') => `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" ${attrs}>${ICONES[nome]}</svg>`;
const linkDoApp = (extra = {}) => `./app?${new URLSearchParams({ cadastro: '1', tipo: estado.linha, ...extra })}`;

function plano(p) {
  const gratis = p.mensal === 0;
  const anual = estado.ciclo === 'anual' && !gratis;
  const porMes = anual ? Math.round(precoAnualCentavos(p.mensal) / 12) : p.mensal;
  const nota = gratis ? 'Para sempre, com limites'
    : anual ? `${reais(precoAnualCentavos(p.mensal))} por ano · economize ${reais(p.mensal * 12 - precoAnualCentavos(p.mensal))}`
    : 'Cobrado todo mês';
  const href = gratis ? linkDoApp() : linkDoApp({ plano: p.id, ciclo: estado.ciclo });
  return `<article class="lp-plan${p.recomendado ? ' lp-plan--featured' : ''}" aria-label="Plano ${esc(p.nome)}">
    ${p.recomendado ? '<span class="lp-plan__ribbon">Mais escolhido</span>' : ''}
    <h3>${esc(p.nome)}</h3>
    <p class="lp-plan__pitch">${esc(p.chamada)}</p>
    <p class="lp-plan__price"><strong>${gratis ? 'R$ 0' : reais(porMes)}</strong>${gratis ? '' : '<span>/mês</span>'}</p>
    <p class="lp-plan__note">${esc(nota)}</p>
    <ul>${p.destaques.map((d) => `<li>${svg('check')}<span>${esc(d)}</span></li>`).join('')}</ul>
    <a class="lp-btn${p.recomendado ? '' : ' lp-btn--ghost'}" href="${href}" data-plano="${p.id}">${gratis ? 'Começar grátis' : `Assinar ${esc(p.nome)}`}</a>
  </article>`;
}

function render() {
  const c = CONTEUDO[estado.linha];
  raiz.dataset.linha = estado.linha;
  document.querySelector('meta[name="theme-color"]').content = estado.linha === 'business' ? '#090D14' : '#0A0F0D';
  document.querySelectorAll('[data-texto]').forEach((n) => { if (c[n.dataset.texto] !== undefined) n.textContent = c[n.dataset.texto]; });
  document.querySelectorAll('[data-escolher]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.escolher === estado.linha)));
  document.querySelectorAll('[data-ciclo]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.ciclo === estado.ciclo)));
  document.querySelectorAll('[data-link="comecar"]').forEach((a) => { a.href = linkDoApp(); });
  document.querySelectorAll('[data-link="demo"]').forEach((a) => { a.href = `./app?demo=1&tipo=${estado.linha}`; });

  const lista = (nome, html) => { document.querySelector(`[data-lista="${nome}"]`).innerHTML = html; };
  lista('titulo', c.titulo.map((t) => `<span>${esc(t)}</span>`).join(''));
  lista('dores', c.dores.map(([ic, t]) => `<li class="lp-pains__item lp-reveal"><span class="lp-pains__icon">${svg(ic)}</span><span>${esc(t)}</span></li>`).join(''));
  lista('pilares', c.pilares.map(([l, t, d]) => `<article class="lp-card lp-reveal"><span class="lp-card__letter" aria-hidden="true">${l}</span><h3>${esc(t)}</h3><p>${esc(d)}</p></article>`).join(''));
  lista('passos', c.passos.map(([t, d], i) => `<li class="lp-steps__item lp-reveal"><span class="lp-steps__number">0${i + 1}</span><div><h3>${esc(t)}</h3><p>${esc(d)}</p></div></li>`).join(''));
  lista('planos', PLANOS[estado.linha].map(plano).join(''));
  lista('faq', c.faq.map(([p, r]) => `<details class="lp-faq__item lp-reveal"><summary>${esc(p)}</summary><p>${esc(r)}</p></details>`).join(''));
  observarReveals();
}

/* Nav: fundo sólido depois de rolar */
const nav = document.getElementById('lp-nav');
const atualizarNav = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
atualizarNav();
window.addEventListener('scroll', atualizarNav, { passive: true });

/* Scroll-reveal (inclui o que é redesenhado ao trocar Casa/Negócio) */
const observador = 'IntersectionObserver' in window
  ? new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-visible'); observador.unobserve(e.target); } });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' })
  : null;
function observarReveals() {
  document.querySelectorAll('.lp-reveal:not(.is-visible)').forEach((el) => {
    // O que já está na tela aparece na hora (ex.: trocar de linha no meio da página).
    const r = el.getBoundingClientRect();
    if (!observador || (r.top < window.innerHeight && r.bottom > 0)) el.classList.add('is-visible');
    else observador.observe(el);
  });
}

/* Parallax sutil no hero (sem prefers-reduced-motion) */
if (!reduzirMovimento) {
  const brilho = document.querySelector('.lp-hero__glow:not(.lp-hero__glow--cta)');
  const marca = document.querySelector('.lp-hero__watermark');
  let agendado = false;
  window.addEventListener('scroll', () => {
    if (agendado) return;
    agendado = true;
    requestAnimationFrame(() => {
      const y = window.scrollY;
      if (brilho) brilho.style.transform = `translateY(${y * 0.18}px)`;
      if (marca) marca.style.transform = `translateY(calc(-50% + ${y * 0.08}px))`;
      agendado = false;
    });
  }, { passive: true });
}

/* Escolhas: Casa/Negócio e Mensal/Anual (clique e setas do teclado) */
document.addEventListener('click', (ev) => {
  const linha = ev.target.closest('[data-escolher]');
  if (linha) { estado.linha = linha.dataset.escolher; salvar('bntt_lp_linha', estado.linha); render(); return; }
  const ciclo = ev.target.closest('[data-ciclo]');
  if (ciclo) { estado.ciclo = ciclo.dataset.ciclo; render(); }
});
document.addEventListener('keydown', (ev) => {
  const grupo = ev.target.closest('[role="radiogroup"]');
  if (!grupo || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
  const opcoes = [...grupo.querySelectorAll('[role="radio"]')];
  const proxima = opcoes[(opcoes.indexOf(ev.target) + (ev.key === 'ArrowRight' ? 1 : opcoes.length - 1)) % opcoes.length];
  proxima.click();
  proxima.focus();
});

render();
