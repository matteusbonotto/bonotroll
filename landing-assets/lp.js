// LP do BNTT (raiz do site): troca Casa/Negócio, mostra os planos de
// js/data/planos.js com Mensal/Anual (−20%) e monta os links para o app.
// O pagamento acontece DEPOIS do cadastro (o app manda ao Stripe já com a
// conta identificada) — aqui só levamos a intenção: tipo, plano e ciclo.
import { PLANOS, precoAnualCentavos, DIAS_DE_TESTE } from '../js/data/planos.js';

const TEXTOS = {
  home: {
    linha: 'Home',
    selo: 'BNTT Home · para a sua casa',
    titulo: 'Sua casa inteira em 1 tela.',
    sub: 'Contas, lista de compras, o que tem em casa e a saúde da família — num app simples para todo mundo, dos avós às crianças.',
    cta: 'Começar grátis',
    nota: `${DIAS_DE_TESTE} dias com tudo do plano Família. Sem cartão.`,
    recursosTitulo: 'Tudo o que a casa precisa, sem planilha',
    planosSub: 'Comece grátis. Mude ou cancele quando quiser.',
    provas: [
      ['bi-bell', 'Avisa antes de a conta vencer'],
      ['bi-cart-check', 'Lista de compras com preço de cada mercado'],
      ['bi-box-seam', 'Sabe o que está acabando em casa'],
      ['bi-heart-pulse', 'Ficha de saúde de cada pessoa, criptografada'],
    ],
    recursos: [
      ['bi-wallet2', 'Dinheiro da casa', 'Entradas, gastos, contas fixas e quem pagou o quê — com o "entre vocês" para casais.'],
      ['bi-cart3', 'Lista de compras', 'Várias listas, histórico de preços e leitura do QR da nota fiscal.'],
      ['bi-box-seam', 'Inventário', 'O que tem em cada cômodo, validade e o que precisa comprar.'],
      ['bi-universal-access', 'Fácil para todos', 'Letras maiores, narração em voz alta e botões grandes. Sem jargão.'],
    ],
    faq: [
      ['Preciso de cartão para testar?', `Não. Você usa ${DIAS_DE_TESTE} dias com tudo liberado. Depois escolhe um plano ou continua no Grátis.`],
      ['Minha família inteira usa a mesma conta?', 'Cada pessoa tem o próprio login e todos veem a mesma casa. O plano Família aceita até 6 pessoas.'],
      ['Meus dados estão seguros?', 'Sim. As fichas de saúde são criptografadas no seu aparelho — nem o BNTT consegue ler.'],
      ['Posso cancelar?', 'A qualquer momento, sem multa. Seus dados continuam seus e podem ser exportados.'],
    ],
  },
  business: {
    linha: 'Business',
    selo: 'BNTT Business · para a sua empresa',
    titulo: 'Seu negócio inteiro em 1 tela.',
    sub: 'Contas a pagar e receber, estoque e equipe de todas as unidades — tudo o que o dono precisa ver para decidir rápido.',
    cta: 'Começar grátis',
    nota: `${DIAS_DE_TESTE} dias com tudo do plano Expansão. Sem cartão.`,
    recursosTitulo: 'O essencial do negócio, sem sistema complicado',
    planosSub: 'Comece grátis. Cresça de plano quando abrir a próxima unidade.',
    provas: [
      ['bi-speedometer2', 'O que precisa de você hoje, logo na abertura'],
      ['bi-shop', 'Todas as unidades na mesma tela'],
      ['bi-people', 'Equipe com papéis: dono, gerente, funcionário, contador'],
      ['bi-box-seam', 'Estoque que avisa antes de faltar'],
    ],
    recursos: [
      ['bi-cash-coin', 'Contas a pagar e receber', 'Vencimentos, fornecedores e o caixa do mês — por unidade ou somado.'],
      ['bi-shop-window', 'Unidades (filiais)', 'Loja, filial ou obra: troque de unidade em 1 toque ou veja todas juntas.'],
      ['bi-person-badge', 'Equipe e permissões', 'Funcionário só lança; contador só vê e exporta; gerente cuida da unidade dele.'],
      ['bi-file-earmark-spreadsheet', 'Sai da planilha em minutos', 'Cole ou importe sua planilha de lançamentos e continue de onde parou.'],
    ],
    faq: [
      ['Preciso de cartão para testar?', `Não. São ${DIAS_DE_TESTE} dias com tudo do Expansão. Depois você escolhe o plano.`],
      ['Serve para MEI e pequena empresa?', 'Sim. O Balcão é feito para quem tem uma porta só; o Expansão e o Rede, para quem tem filiais.'],
      ['O contador consegue acessar?', 'Sim, com o papel Contador: ele vê e exporta, mas não muda nada.'],
      ['Posso cancelar?', 'A qualquer momento, sem multa. Seus dados podem ser exportados.'],
    ],
  },
};

const raiz = document.documentElement;
const estado = {
  linha: new URLSearchParams(location.search).get('para') === 'business' ? 'business' : (lerSalvo('bntt_lp_linha') || 'home'),
  ciclo: 'mensal',
};

function lerSalvo(k) { try { return localStorage.getItem(k); } catch { return null; } }
function salvar(k, v) { try { localStorage.setItem(k, v); } catch { /* sem armazenamento */ } }
const reais = (centavos) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const el = (tag, attrs = {}, filhos = []) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) (k === 'texto' ? (e.textContent = v) : e.setAttribute(k, v));
  for (const f of [].concat(filhos)) if (f) e.append(f);
  return e;
};

function linkDoApp(extra = {}) {
  const p = new URLSearchParams({ cadastro: '1', tipo: estado.linha, ...extra });
  return `./app?${p}`;
}

function cartaoDoPlano(plano) {
  const gratis = plano.mensal === 0;
  const anual = estado.ciclo === 'anual' && !gratis;
  const porMes = anual ? precoAnualCentavos(plano.mensal) / 12 : plano.mensal;
  const preco = el('p', { class: 'lp-plano__preco' }, gratis
    ? [el('strong', { texto: 'R$ 0' })]
    : [el('strong', { texto: reais(Math.round(porMes)) }), el('span', { texto: '/mês' })]);
  const detalhe = gratis
    ? el('p', { class: 'lp-plano__detalhe', texto: 'Para sempre, com limites' })
    : el('p', { class: 'lp-plano__detalhe', texto: anual ? `${reais(precoAnualCentavos(plano.mensal))} por ano · economize ${reais(plano.mensal * 12 - precoAnualCentavos(plano.mensal))}` : 'Cobrado todo mês' });
  const link = gratis ? linkDoApp() : linkDoApp({ plano: plano.id, ciclo: estado.ciclo });
  return el('article', { class: 'lp-plano' + (plano.recomendado ? ' lp-plano--destaque' : ''), 'aria-label': `Plano ${plano.nome}` }, [
    plano.recomendado ? el('p', { class: 'lp-plano__fita', texto: 'Mais escolhido' }) : null,
    el('h3', { texto: plano.nome }),
    el('p', { class: 'lp-plano__chamada', texto: plano.chamada }),
    preco,
    detalhe,
    el('ul', {}, plano.destaques.map((d) => el('li', {}, [el('i', { class: 'bi bi-check-lg', 'aria-hidden': 'true' }), d]))),
    el('a', { class: 'lp-botao' + (plano.recomendado ? '' : ' lp-botao--fantasma'), href: link, 'data-plano': plano.id, texto: gratis ? 'Começar grátis' : `Assinar ${plano.nome}` }),
  ]);
}

function render() {
  const t = TEXTOS[estado.linha];
  raiz.dataset.linha = estado.linha;
  document.querySelectorAll('[data-texto]').forEach((n) => { n.textContent = t[n.dataset.texto]; });
  document.querySelectorAll('[data-escolher]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.escolher === estado.linha)));
  document.querySelectorAll('[data-ciclo]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.ciclo === estado.ciclo)));
  document.querySelector('[data-link="comecar"]').href = linkDoApp();
  document.querySelector('[data-link="demo"]').href = `./app?demo=1&tipo=${estado.linha}`;
  document.querySelector('meta[name="theme-color"]').content = estado.linha === 'business' ? '#1F5FAF' : '#0E9F6E';

  document.querySelector('[data-lista="provas"]').replaceChildren(...t.provas.map(([ic, txt]) => el('li', {}, [el('i', { class: `bi ${ic}`, 'aria-hidden': 'true' }), txt])));
  document.querySelector('[data-lista="recursos"]').replaceChildren(...t.recursos.map(([ic, tit, txt]) => el('article', { class: 'lp-cartao' }, [
    el('i', { class: `bi ${ic}`, 'aria-hidden': 'true' }), el('h3', { texto: tit }), el('p', { texto: txt }),
  ])));
  document.querySelector('[data-lista="planos"]').replaceChildren(...PLANOS[estado.linha].map(cartaoDoPlano));
  document.querySelector('[data-lista="faq"]').replaceChildren(...t.faq.map(([p, r]) => el('details', {}, [el('summary', { texto: p }), el('p', { texto: r })])));
}

document.addEventListener('click', (ev) => {
  const linha = ev.target.closest('[data-escolher]');
  if (linha) { estado.linha = linha.dataset.escolher; salvar('bntt_lp_linha', estado.linha); render(); return; }
  const ciclo = ev.target.closest('[data-ciclo]');
  if (ciclo) { estado.ciclo = ciclo.dataset.ciclo; render(); }
});

// Setas trocam a opção nos dois grupos de rádio (padrão de acessibilidade).
document.addEventListener('keydown', (ev) => {
  const grupo = ev.target.closest('[role="radiogroup"]');
  if (!grupo || !['ArrowLeft', 'ArrowRight'].includes(ev.key)) return;
  const opcoes = [...grupo.querySelectorAll('[role="radio"]')];
  const prox = opcoes[(opcoes.indexOf(ev.target) + (ev.key === 'ArrowRight' ? 1 : opcoes.length - 1)) % opcoes.length];
  prox.click();
  prox.focus();
});

render();
