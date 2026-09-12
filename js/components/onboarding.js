// Passo-a-passo interativo de onboarding (TASK-037/038 — RECONSTRUÇÃO,
// 2026-09-11) — substitui o tour de 5 slides só-de-leitura da rodada
// anterior. Feedback real de usuário de teste sobre a v1:
//
//   "e não é um tour... tem 5 passos, quero um passo a passo para a pessoa
//   fazer ao menos uma coisa de cada do zero. e ver os resultados e
//   entender como funciona e aprender como usar a ferramenta"
//
// Ou seja: a v1 (5 slides explicando cada tela) foi TESTADA e REJEITADA —
// não bastava ler, a pessoa precisava REALMENTE fazer uma ação em cada uma
// das 3 áreas principais (financeiro/compras/recursos) usando a interface
// de verdade, ver o resultado real acontecer, e só então entender.
//
// FORMATO NOVO: 5 passos, mas só o 1º (boas-vindas) e o último (conclusão)
// continuam sendo o modal cheio de sempre (tipo 'info', reaproveita
// .cg-modal-backdrop/.cg-modal igual à v1 — ver decisão de não usar lib de
// tour abaixo). Os 3 do meio (tipo 'acao') são um mecanismo NOVO: navegam
// sozinhos pra tela certa, DESTACAM o elemento real que a pessoa precisa
// clicar (spotlight: escurece o resto da tela, com um "buraco" recortado
// em volta do alvo — ver js/utils/spotlight.js pra geometria pura) e
// esperam a pessoa interagir DE VERDADE com a tela por baixo — nada de
// simulação, screenshot ou formulário fake. Só quando a AÇÃO REAL acontece
// (ver "Detecção de conclusão" abaixo) o passo libera "Continuar" e mostra
// o resultado real que aconteceu.
//
// DECISÃO DE ARQUITETURA (herdada da v1, ainda válida): reaproveita
// .cg-modal-backdrop/.cg-modal em vez de importar uma lib de tour (ex.
// driver.js/intro.js) — evita ter que sobrescrever o CSS inteiro de uma lib
// externa pra bater com os tokens do design system (mais risco de conflito
// de especificidade, ver CLAUDE.md "Armadilhas já conhecidas") E ganha de
// graça o Esc-fecha-e-devolve-foco já centralizado em setupOverlayBehavior
// (js/app.js) pra QUALQUER .cg-modal-backdrop visível.
//
// PASSO DE AÇÃO NÃO PODE ser um modal cheio de verdade, porque a pessoa
// PRECISA continuar enxergando e clicando na tela real por baixo (abrir o
// formulário de "Nova despesa", preencher, salvar) — ver o bloco de markup
// no fim de index.html (".cg-tour-spot-backdrop") e o comentário grande lá
// sobre como isso ainda se encaixa em setupOverlayBehavior sem reimplementar
// nada, inclusive o cuidado de ordem no DOM pra Esc nunca fechar o tour
// inteiro por engano quando o FORMULÁRIO REAL (aberto por cima do spotlight)
// é o que a pessoa queria fechar.
//
// DETECÇÃO DE CONCLUSÃO — cada passo de ação escuta um evento
// "cg:onboarding-acao" dedicado (detail: { area }), disparado só no momento
// exato em que a ação de verdade acontece:
//   - financeiro: transactionForm.js::save(), só no CREATE (nunca edição).
//   - compras: shoppingList.js::addItem(), sempre que adiciona (não tem
//     caminho de edição nessa função).
//   - recursos: resourcesView.js::salvarItem(), só no CREATE.
// Nunca detecta "concluído" por "a lista não está vazia" — o modo demo já
// vem com dado de exemplo (seed), então qualquer lista SEMPRE teria itens;
// um evento disparado no momento exato da ação é o único jeito confiável.
//
// PERFORMANCE (preocupação real levantada: "tá lento e travando") — o
// spotlight recalcula a posição do alvo em scroll/resize, mas SEMPRE via
// requestAnimationFrame (no máximo 1x por frame, nunca 1x por evento de
// scroll cru, que dispara dezenas de vezes por segundo) e SEMPRE remove os
// listeners ao trocar de passo/fechar o tour (_pararRecalculo) — nunca
// acumula um listener de scroll por passo visitado.
import { computeSpotlightGeometry } from '../utils/spotlight.js';

// `Alpine.nextTick(callback)` é a API global (documentada), diferente da
// mágica `this.$nextTick()` que só existe dentro de componentes registrados
// via Alpine.data() (com um elemento raiz de verdade por trás) — um store
// puro (Alpine.store(), como este) não tem esse contexto de elemento, então
// `this.$nextTick` aqui dentro seria `undefined`. Embrulha num Promise só
// pra poder usar `await`, sem depender de a própria Alpine.nextTick() já
// devolver uma promise (varia por versão/lib) — só precisa da garantia de
// "chama o callback depois do próximo tick de renderização", que a API
// global sempre dá.
function nextTick() {
  return new Promise((resolve) => Alpine.nextTick(resolve));
}

// v2 (não mais v1): a reconstrução muda tanto o formato que faz sentido
// mostrar o tour novo de novo pra quem já tinha visto (e rejeitado) a v1 —
// gente que já "dispensou" um tour-de-slides nunca teve a chance de ver
// este. tests/e2e e playwright.config.js usam esta MESMA chave pra
// pré-semear "já visto" e pular o tour nos testes que não são sobre ele.
const CHAVE_VISTO = 'bonotto_onboarding_v2_seen';

// Um objeto por área (não um array) — mais simples de indexar por
// passo.area do que procurar num array toda hora.
const AREAS = ['financeiro', 'compras', 'recursos'];
function estadoVazioPorArea() {
  return Object.fromEntries(AREAS.map((a) => [a, false]));
}

export function onboardingStore() {
  return {
    aberto: false,
    passoAtual: 0,
    concluido: estadoVazioPorArea(), // true assim que a AÇÃO REAL acontece nesta sessão do tour
    pulado: estadoVazioPorArea(), // true quando a pessoa clica "Pular esta etapa" (não fez a ação, mas também não trava mais o avanço)
    rectAlvo: null, // { top, left, width, height } do elemento real destacado, em px de viewport — null = sem spotlight visível agora
    telaAoAbrir: null, // $store.app.view de antes de abrir — devolve pra lá ao fechar/concluir, nunca deixa a pessoa "presa" numa tela que só visitou por causa do tour

    // Limpeza de passo (listener do evento de ação + listeners de
    // scroll/resize) — sempre uma função ou null, nunca acumula: toda troca
    // de passo chama a anterior antes de registrar a próxima.
    _pararEscutaAcao: null,
    _pararRecalculo: null,

    // 1 boas-vindas + 3 ações reais (financeiro/compras/recursos) + 1
    // encerramento. "alvoSeletor" sempre escopado por section[x-data^="..."]
    // (CLAUDE.md: as 7 telas ficam todas montadas ao mesmo tempo — um
    // seletor sem esse escopo arrisca pegar o elemento errado de uma tela
    // escondida, mesmo com um data-tour-alvo único, se algum dia se repetir
    // o mesmo atributo em duas telas por engano).
    passos: [
      {
        id: 'boas-vindas',
        tipo: 'info',
        icone: 'bi-house-heart-fill',
        titulo: 'Bem-vindo(a) ao Bõnotto!',
        texto: 'Aqui vocês dois controlam o dinheiro, a lista de compras e o que tem em casa — tudo num só lugar. Nos próximos passos você vai USAR a ferramenta de verdade: vamos te guiar pra registrar um gasto, um item de compra e um item de casa, um de cada vez, num teste rapidinho.',
      },
      {
        id: 'financeiro',
        tipo: 'acao',
        area: 'financeiro',
        view: 'home',
        alvoSeletor: 'section[x-data^="dashboardView"] [data-tour-alvo="nova-transacao"]',
        icone: 'bi-cash-coin',
        titulo: 'Registre um gasto de verdade',
        texto: 'Toque em "Nova despesa" e cadastre algo rápido — um cafézinho de R$ 10 já serve pra testar. É só um exemplo: dá pra editar ou apagar depois, em Transações.',
        textoResultado: 'Prontinho! Repare que o saldo do Início já mudou na hora, e esse lançamento também aparece em "Transações". Se a despesa for dividida com seu par, o "Entre vocês" mostra quem deve quanto.',
      },
      {
        id: 'compras',
        tipo: 'acao',
        area: 'compras',
        view: 'compras',
        alvoSeletor: 'section[x-data^="shoppingView"] [data-tour-alvo="novo-item-compra"]',
        icone: 'bi-cart3-fill',
        titulo: 'Adicione um item na lista',
        texto: 'Toque no botão "+" e coloque algo que precisa comprar — pode ser qualquer coisa, tipo "Leite".',
        textoResultado: 'Viu? O item já apareceu na lista e o total foi recalculado sozinho. Quando for ao mercado, é só marcar cada item como comprado — dá pra anotar o preço na hora, direto na lista.',
      },
      {
        id: 'recursos',
        tipo: 'acao',
        area: 'recursos',
        view: 'recursos',
        alvoSeletor: 'section[x-data^="resourcesView"] [data-tour-alvo="recursos-add-item"]',
        icone: 'bi-box-seam-fill',
        titulo: 'Cadastre algo que tem em casa',
        texto: 'Já te levamos pra dentro de um cômodo. Toque em "Item" e cadastre algo que exista aí de verdade — tipo "Sabonete" ou "Arroz".',
        textoResultado: 'Esse item já está guardado nesse cômodo. Quando a quantidade chegar a zero ou a validade vencer, ele aparece sozinho em "Sugestões de compra" — com um atalho pra já mandar direto pra lista de compras.',
      },
      {
        id: 'conclusao',
        tipo: 'info',
        icone: 'bi-check2-circle',
        titulo: 'Pronto pra usar de verdade!',
        texto: 'Você já fez o básico nas 3 áreas principais. Quiser rever isso depois, é só abrir Perfil e procurar "Rever tutorial" — e pra dúvida rápida, sem precisar refazer o passo a passo, tem um "Perguntas frequentes" logo ali do lado (e um "?" no topo da tela, em qualquer lugar do app).',
      },
    ],

    get passo() {
      return this.passos[this.passoAtual];
    },
    get ultimoPasso() {
      return this.passoAtual === this.passos.length - 1;
    },
    // Um passo de ação "resolvido" tanto por ter feito a ação de verdade
    // quanto por ter escolhido pular ele — os dois liberam "Continuar" do
    // mesmo jeito, só o texto mostrado muda (resultado real vs. nada).
    get passoResolvido() {
      const p = this.passo;
      return p.tipo === 'acao' && (this.concluido[p.area] || this.pulado[p.area]);
    },
    // Style pronto pra `:style` (Alpine aceita objeto direto, já usado em
    // outros pontos do app) — números convertidos em px aqui, não espalhado
    // pelo template do index.html.
    get spotlightStyles() {
      if (!this.rectAlvo) return null;
      const g = computeSpotlightGeometry(this.rectAlvo, 8);
      const px = (n) => `${n}px`;
      return {
        hole: { top: px(g.hole.top), left: px(g.hole.left), width: px(g.hole.width), height: px(g.hole.height) },
        dims: {
          top: { top: '0', left: '0', right: '0', height: px(g.dims.top.height) },
          bottom: { top: px(g.dims.bottom.top), left: '0', right: '0', bottom: '0' },
          left: { top: px(g.dims.left.top), left: '0', width: px(g.dims.left.width), height: px(g.dims.left.height) },
          right: { top: px(g.dims.right.top), left: px(g.dims.right.left), right: '0', height: px(g.dims.right.height) },
        },
      };
    },

    // Chamado uma vez, quando o app-shell autenticado monta (ver
    // x-init="$store.onboarding.iniciarSeNecessario()" em index.html) — não
    // faz nada se a pessoa já viu antes NESTE navegador. Isto não é
    // preferência de conta nem dado de negócio (é só "já vi isso aqui"),
    // por isso localStorage direto, sem passar por services/ (CLAUDE.md:
    // essa regra é sobre DADO, esta flag não é dado do usuário).
    iniciarSeNecessario() {
      if (localStorage.getItem(CHAVE_VISTO) === '1') return;
      this.abrir();
    },

    // Ponto de reabertura manual (Perfil → "Rever tutorial") — sempre
    // reinicia do passo 1, mesmo que a pessoa já tenha visto/concluído
    // antes, e sempre zera concluído/pulado (uma re-execução é uma sessão
    // nova do tour, não continuação de uma anterior).
    abrir() {
      this.passoAtual = 0;
      this.concluido = estadoVazioPorArea();
      this.pulado = estadoVazioPorArea();
      this.rectAlvo = null;
      this.telaAoAbrir = Alpine.store('app').view;
      this.aberto = true;
      this._entrarNoPasso();
    },

    avancar() {
      if (this.ultimoPasso) { this.concluir(); return; }
      this.passoAtual++;
      this._entrarNoPasso();
    },

    voltar() {
      if (this.passoAtual === 0) return;
      this.passoAtual--;
      this._entrarNoPasso();
    },

    // "Pular esta etapa" — só nos passos de ação, só quando ainda não feita
    // de verdade. Marca como pulada (libera "Continuar" mostrando texto
    // normal, não o de resultado) e já avança — ninguém fica preso num
    // passo que não quer fazer agora.
    pularEtapa() {
      const p = this.passo;
      if (p.tipo === 'acao') this.pulado[p.area] = true;
      this.avancar();
    },

    // "Pular tudo" / Esc / clique no X ou no backdrop escurecido fora do
    // buraco — sempre encerra o tour inteiro (nunca só o passo atual, que é
    // o que "Pular esta etapa" já faz). Mesma ideia da v1: rótulo do botão
    // muda ("Pular" num passo informativo, "Começar a usar" no último), mas
    // do ponto de vista de "não abrir sozinho de novo", pular e concluir são
    // a mesma coisa.
    pular() { this.encerrar(); },
    concluir() { this.encerrar(); },

    encerrar() {
      this._limparPasso();
      this.aberto = false;
      // Devolve a pessoa pra tela de onde ela abriu o tour — sem isso, quem
      // terminava o passo de Recursos ficava "esquecido" lá, numa tela que
      // só visitou por causa do guiado, não por escolha própria.
      if (this.telaAoAbrir) Alpine.store('app').view = this.telaAoAbrir;
      localStorage.setItem(CHAVE_VISTO, '1');
    },

    // ---------- Mecânica interna de cada passo de ação ----------

    // Ponto único de entrada em QUALQUER passo (chamado por abrir/avancar/
    // voltar) — sempre limpa o passo anterior primeiro (nunca acumula
    // listener), e só faz alguma coisa a mais se o passo novo for de ação.
    async _entrarNoPasso() {
      this._limparPasso();
      const p = this.passo;
      if (p.tipo !== 'acao') return;

      const appStore = Alpine.store('app');
      appStore.view = p.view;
      appStore.navOpen = false; // fecha o menu hambúrguer (mobile) se estava aberto — nunca deixa ele por cima do spotlight
      await nextTick();

      // Recursos tem um drill-down de navegação (cômodo -> subcategoria)
      // ANTES do alvo real ("Item") existir na tela — isso é só "plumbing"
      // de navegação, não a ação que a pessoa está aprendendo a fazer aqui
      // (essa é "cadastrar um item"), então o tour anda essa parte sozinho
      // em vez de transformar isso num passo próprio (ficaria comprido
      // demais pro que o usuário pediu: "simplifique o quanto precisar").
      if (p.area === 'recursos') await this._prepararRecursos();
      await nextTick();

      this._escutarAcao(p.area);
      this._focarAlvo();
      this._ligarRecalculoAutomatico();
    },

    async _prepararRecursos() {
      const el = document.querySelector('section[x-data^="resourcesView"]');
      const comp = el && Alpine.$data(el);
      if (!comp) return;
      // Só entra sozinho se a pessoa ainda não estiver dentro de um cômodo
      // (ex.: reabrindo o tour já no meio de uma navegação em Recursos) —
      // nesse caso usa a posição em que ela já está, nunca reseta o que ela
      // já tinha escolhido.
      if (!comp.activeRoomId && comp.rooms.length) {
        await comp.selecionarRoom(comp.rooms[0].id);
      }
      if (comp.activeRoomId && !comp.activeCategoryId) {
        await comp.selecionarCategoria('todas');
      }
    },

    _escutarAcao(area) {
      const ouvinte = (evento) => {
        if (evento.detail?.area !== area) return;
        this.concluido[area] = true;
        // BUG REAL encontrado testando com Playwright: Compras é a ÚNICA das
        // 3 telas que mantém o modal de "Adicionar item" aberto DE PROPÓSITO
        // depois de salvar (pra colocar vários itens seguidos sem reabrir a
        // cada um — ver comentário em shoppingList.js::addItem()). Fora do
        // tour isso é bom; DURANTE o passo guiado, o modal real (z-index
        // maior que o nosso painel) ficava por CIMA do resultado/"Continuar",
        // escondendo os dois. As outras duas telas (transação/recurso) já
        // fecham sozinhas ao salvar — só esta precisa de um empurrão extra
        // aqui, sem mudar o comportamento normal (fora do tour) da tela.
        if (area === 'compras') {
          const el = document.querySelector('section[x-data^="shoppingView"]');
          const comp = el && Alpine.$data(el);
          comp?.fecharItemForm?.();
        }
      };
      window.addEventListener('cg:onboarding-acao', ouvinte);
      this._pararEscutaAcao = () => window.removeEventListener('cg:onboarding-acao', ouvinte);
    },

    // Rola o alvo real pro centro da tela (existe alvo abaixo da dobra em
    // telas pequenas/muito conteúdo acima) e calcula a posição inicial do
    // spotlight — scroll instantâneo (não 'smooth') de propósito: computar
    // o retângulo logo em seguida sem esperar uma animação terminar evita
    // ter que "adivinhar" quando o scroll suave já chegou.
    _focarAlvo() {
      const p = this.passo;
      const el = p.tipo === 'acao' ? document.querySelector(p.alvoSeletor) : null;
      if (el) el.scrollIntoView({ block: 'center' });
      this._recalcularSpotlight();
    },

    _recalcularSpotlight() {
      const p = this.passo;
      const el = p && p.tipo === 'acao' ? document.querySelector(p.alvoSeletor) : null;
      if (!el) { this.rectAlvo = null; return; }
      const r = el.getBoundingClientRect();
      this.rectAlvo = { top: r.top, left: r.left, width: r.width, height: r.height };
    },

    // Scroll/resize acontecem dezenas de vezes por segundo — recalcular a
    // CADA disparo seria o tipo exato de trabalho pesado por frame que o
    // usuário relatou como "lento e travando" numa rodada anterior (mesmo
    // sem confirmar a causa real, ver histórico da tarefa). `agendado`
    // garante no máximo 1 recálculo por frame (requestAnimationFrame),
    // nunca 1 por evento cru.
    _ligarRecalculoAutomatico() {
      let agendado = false;
      const aoRolarOuRedimensionar = () => {
        if (agendado) return;
        agendado = true;
        requestAnimationFrame(() => {
          this._recalcularSpotlight();
          agendado = false;
        });
      };
      window.addEventListener('scroll', aoRolarOuRedimensionar, { passive: true });
      window.addEventListener('resize', aoRolarOuRedimensionar);
      this._pararRecalculo = () => {
        window.removeEventListener('scroll', aoRolarOuRedimensionar);
        window.removeEventListener('resize', aoRolarOuRedimensionar);
      };
    },

    _limparPasso() {
      this._pararEscutaAcao?.();
      this._pararEscutaAcao = null;
      this._pararRecalculo?.();
      this._pararRecalculo = null;
      this.rectAlvo = null;
    },
  };
}
