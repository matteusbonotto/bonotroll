// Passo-a-passo interativo de onboarding + Central de tutoriais (TASK-042,
// 2026-09-14) — GENERALIZAÇÃO do mecanismo de spotlight construído em
// TASK-037/038 (reconstrução anterior, ver histórico abaixo). Feedback real
// de usuário de teste que motivou ESTA rodada:
//
//   "Só tem tutorial de criação de despesa... Tem q ter tutorial tour para
//   cada coisa... e dar a opção para o usuário escolher oq ele quer
//   aprender a fazer no app."
//
// Ou seja: um tour ÚNICO forçando 3 ações em sequência (financeiro -> compras
// -> recursos) não bastava — era preciso um CATÁLOGO de mini-guias
// independentes (CATALOGO_GUIAS abaixo), cada um ensinando UMA ação
// específica, com um menu pra pessoa ESCOLHER o que quer aprender agora (a
// "Central de tutoriais" — Perfil → Preferências e um ícone dedicado na
// topbar) em vez de uma sequência única forçada.
//
// HISTÓRICO (TASK-037/038, ainda válido pro mecanismo em si): a v1 (5 slides
// só de leitura) foi TESTADA e REJEITADA — "não é um tour... quero um passo
// a passo para a pessoa fazer ao menos uma coisa de cada do zero. e ver os
// resultados". A reconstrução v2 trocou por um mecanismo que navega sozinho
// pra tela certa, DESTACA o elemento real (spotlight: escurece o resto da
// tela, com um "buraco" recortado em volta do alvo — ver js/utils/
// spotlight.js pra geometria pura) e espera a pessoa interagir DE VERDADE
// com a tela por baixo — nada de simulação, screenshot ou formulário fake.
// Essa v2 continua sendo a base AQUI: o que mudou nesta rodada é só que o
// mecanismo agora é ORIENTADO A DADOS (CATALOGO_GUIAS, uma lista) em vez de
// hardcoded pros 3 passos fixos, e ganhou um segundo modo de uso (guia
// avulso escolhido na Central, não só dentro de um tour de 5 passos).
//
// DECISÃO DE ARQUITETURA (herdada, ainda válida): reaproveita
// .cg-modal-backdrop/.cg-modal em vez de importar uma lib de tour (ex.
// driver.js/intro.js) — evita ter que sobrescrever o CSS inteiro de uma lib
// externa pra bater com os tokens do design system (mais risco de conflito
// de especificidade, ver CLAUDE.md "Armadilhas já conhecidas") E ganha de
// graça o Esc-fecha-e-devolve-foco já centralizado em setupOverlayBehavior
// (js/app.js) pra QUALQUER .cg-modal-backdrop visível.
//
// DOIS MODOS, MESMO MECANISMO — this.passos sempre é a fonte de verdade
// (dots, "Passo X de Y", spotlight, gatilho de conclusão); só quem POPULA
// esse array muda:
//   - abrir(): tour de 1ª visita/"Tour de boas-vindas completo" — boas-vindas
//     (info) + UMA ação real (financeiro, a mais fundamental) + conclusão
//     (info, com atalho pra abrir a Central). Até 2026-09-14 forçava as 3
//     ações fixas em sequência; simplificado porque a Central agora cobre o
//     resto — ver comentário grande em abrir() mais abaixo pro raciocínio
//     completo.
//   - iniciarGuia(id): um guia AVULSO do catálogo, escolhido na Central —
//     sequência de 1 passo só (sempre tipo:'acao', nunca precisa de
//     boas-vindas/conclusão em volta) PRA QUASE TODOS os guias. get
//     modoUnico (abaixo) é o que o template usa pra evitar um "Passo 1 de 1"
//     sem sentido nesse modo. Exceção: 'financeiro' tem um campo `passos`
//     próprio no catálogo (PASSOS_FINANCEIRO, mais abaixo) — um guia
//     DETALHADO de 17 passos curtos, um balão por campo do formulário real,
//     em vez de 1 parágrafo comprido só. iniciarGuia() usa `guia.passos`
//     quando existe; abrir() (tour de boas-vindas) faz o mesmo via spread.
//
// PASSO DE AÇÃO NÃO PODE ser um modal cheio de verdade, porque a pessoa
// PRECISA continuar enxergando e clicando na tela real por baixo (abrir o
// formulário de "Nova despesa", preencher, salvar) — ver o bloco de markup
// no fim de index.html (".cg-tour-spot-backdrop") e o comentário grande lá
// sobre como isso ainda se encaixa em setupOverlayBehavior sem reimplementar
// nada, inclusive o cuidado de ordem no DOM pra Esc nunca fechar o tour
// inteiro por engano quando o FORMULÁRIO REAL (aberto por cima do spotlight)
// é o que a pessoa queria fechar. 4 dos guias novos (dividir-despesa/fixa/
// cartao, todos com view:'home') apontam de propósito pro MESMO alvo de
// sempre ("Nova despesa") em vez de um campo específico DENTRO do formulário
// — abrir o formulário sozinho por baixo do spotlight faria o modal real
// (z-index 1050) cobrir o painel do guia (z-index 1046, ver components.css),
// deixando o texto/spotlight invisível atrás dele; com o alvo sendo só o
// botão que ABRE o formulário, o comportamento é idêntico ao guia
// "financeiro" já testado (o painel reaparece, já com o resultado, assim que
// a pessoa fecha o formulário real por conta própria — Salvar, Cancelar, X
// ou Esc, não importa qual).
//
// DETECÇÃO DE CONCLUSÃO — cada guia escuta um evento "cg:onboarding-acao"
// dedicado (detail: { area }), disparado só no momento exato em que a ação
// de verdade acontece. Nunca detecta "concluído" por "a lista não está
// vazia" — o modo demo já vem com dado de exemplo (seed), então qualquer
// lista/grupo/cartão SEMPRE teria algo; um evento disparado no momento exato
// da ação é o único jeito confiável. Pontos de disparo, um por guia:
//   - financeiro:      transactionForm.js::save(), só no CREATE.
//   - compras:         shoppingList.js::addItem(), sempre que adiciona.
//   - recursos:        resourcesView.js::salvarItem(), só no CREATE.
//   - dividir-despesa: transactionForm.js::adicionarPagador().
//   - fixa:            transactionForm.js::onTipoDespesaChange(), só ao
//                       virar 'fixa' (nunca ao voltar pra variável).
//   - cartao:           transactionForm.js::onCartaoChange(), só ao
//                       selecionar um cartão de verdade (nunca o sentinela
//                       "cartão não informado").
//   - caixinha:         caixinhaManager.js::salvar(), só no CREATE.
//   - convite:          groupView.js::copiarCodigo() (copiar o código já É
//                       a ação de convidar — quem entra de fato é a outra
//                       pessoa, em outro navegador, então não dá pra
//                       detectar isso desta sessão).
//   - compra-status:    shoppingList.js::toggleStart()/finalizar(), nas duas
//                       direções (iniciar OU encerrar contam).
//
// PERFORMANCE (preocupação real levantada: "tá lento e travando") — o
// spotlight recalcula a posição do alvo em scroll/resize, mas SEMPRE via
// requestAnimationFrame (no máximo 1x por frame, nunca 1x por evento de
// scroll cru, que dispara dezenas de vezes por segundo) e SEMPRE remove os
// listeners ao trocar de passo/fechar o guia (_pararRecalculo) — nunca
// acumula um listener de scroll por passo visitado.
import { computeSpotlightGeometry, computeBalloonGeometry } from '../utils/spotlight.js';

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

// v2 (não mais v1): a reconstrução de TASK-037/038 mudou tanto o formato que
// fez sentido mostrar o tour novo de novo pra quem já tinha visto (e
// rejeitado) a v1 — gente que já "dispensou" um tour-de-slides nunca teve a
// chance de ver este formato. A generalização de TASK-042 reaproveita a
// MESMA chave: quem já viu a v2 (passo a passo interativo) não precisa ver
// de novo só porque o conteúdo por trás ganhou um catálogo maior — o that
// importa aqui é "já entendeu que é interativo", não a lista exata de
// passos. tests/e2e e playwright.config.js usam esta MESMA chave pra
// pré-semear "já visto" e pular o tour nos testes que não são sobre ele.
const CHAVE_VISTO = 'bonotto_onboarding_v2_seen';

// ---------- Helpers de "preparar" (plumbing de navegação ANTES de destacar
// o alvo real) — funções livres, não métodos do store: só falam com OUTROS
// componentes via Alpine.$data (o mesmo padrão já usado no app inteiro pra
// alcançar o estado de uma seção a partir de fora dela), nunca com o estado
// do onboarding em si. Nenhuma delas é a ação que a pessoa está aprendendo
// a fazer no guia — são só o "andar sozinho até lá" que evitaria um passo
// extra sem valor de aprendizado nenhum (ex.: teria que virar um guia
// próprio só pra ensinar "entre num cômodo", o que não é o pedido). ----------

// Recursos tem um drill-down de navegação (cômodo -> subcategoria) ANTES do
// alvo real ("Item") existir na tela — ver comentário acima.
async function prepararRecursos() {
  const el = document.querySelector('section[x-data^="resourcesView"]');
  const comp = el && Alpine.$data(el);
  if (!comp) return;
  // Só entra sozinho se a pessoa ainda não estiver dentro de um cômodo (ex.:
  // reabrindo o guia já no meio de uma navegação em Recursos) — nesse caso
  // usa a posição em que ela já está, nunca reseta o que ela já tinha
  // escolhido.
  if (!comp.activeRoomId && comp.rooms.length) {
    await comp.selecionarRoom(comp.rooms[0].id);
  }
  if (comp.activeRoomId && !comp.activeCategoryId) {
    await comp.selecionarCategoria('todas');
  }
}

// Caixinhas tem um drill-down parecido (grade -> detalhe de UMA caixinha) —
// se a pessoa tivesse ficado olhando o detalhe de uma caixinha antes de
// abrir este guia, o tile "Nova caixinha" (na grade) não existiria na tela.
// Mesma lógica de "só mexe se precisar": nunca reseta nada que não atrapalha
// o alvo.
function prepararCaixinhas() {
  const el = document.querySelector('section[x-data^="caixinhasView"]');
  const comp = el && Alpine.$data(el);
  if (comp && comp.activeId) comp.voltar();
}

// Guia detalhado "Registre um gasto de verdade" (ver PASSOS_FINANCEIRO
// abaixo) — a partir do passo "Empresa/Serviço" os alvos vivem dentro de
// "Mais opções" (x-show="$store.txModal.showMore"), que começa fechado.
// txModal é um store global (não um componente por seção, diferente de
// Recursos/Caixinhas acima), então dá pra tocar direto nele sem precisar de
// Alpine.$data + querySelector de elemento.
function prepararMostrarMaisOpcoes() {
  const tx = Alpine.store('txModal');
  if (tx && !tx.showMore) tx.showMore = true;
}

// ---------- Catálogo de guias (TASK-042) ----------
// Cada entrada é um mini-tutorial INDEPENDENTE — a pessoa escolhe qual quer
// fazer agora na Central de tutoriais, em vez de uma sequência forçada. Os 3
// primeiros (financeiro/compras/recursos) são exatamente os mesmos de
// TASK-037/038 (mesmo texto/seletor/gatilho de sempre — não reintroduzir
// nenhum dos bugs já corrigidos neles), agora reaproveitados TANTO aqui
// quanto dentro do tour simplificado de 1ª visita (ver abrir() abaixo) — um
// objeto só, nunca duplicado em dois lugares.
//
// Campos de cada guia:
//   id/area        — mesma string sempre (id é usado pra abrir/listar; area
//                     é o que o evento "cg:onboarding-acao" carrega —
//                     mantidos como duas chaves só pra não precisar tocar em
//                     todo `dispatchEvent(...)` já existente nos outros
//                     componentes, mas sempre com o MESMO valor).
//   view            — tela ($store.app.view) pra onde navega sozinho.
//   alvoSeletor     — seletor do elemento real a destacar, sempre escopado
//                     por `section[x-data^="..."]` (CLAUDE.md: as 7 telas
//                     ficam todas montadas ao mesmo tempo — um seletor sem
//                     esse escopo arrisca pegar o elemento errado de uma
//                     tela escondida).
//   preparar        — opcional, async: plumbing de navegação automática (ver
//                     prepararRecursos/prepararCaixinhas acima).
//   requisito       — opcional: (storeApp) => boolean. Se falhar,
//                     iniciarGuia() avisa por toast e NÃO abre — evita abrir
//                     um guia apontando pra um elemento que não existe nesta
//                     conta (ex.: "dividir despesa" sem ninguém mais no
//                     grupo pra dividir com).
//   requisitoTexto  — mensagem do toast acima.
//   icone/titulo/texto/textoResultado — mesmo formato dos guias originais.
//   resumo          — 1 linha, só usada na listagem da Central.
// Guia detalhado "Registre um gasto de verdade" (pedido explícito de
// usuário testando o tour, 2026-09-15: a versão anterior era 1 passo só com
// um parágrafo comprido explicando o formulário inteiro de uma vez —
// "muito texto pode tirar o interesse do usuário... os textos quebrando em
// balões por etapa dá a sensação mais de diálogo"). Cada campo do
// formulário vira um passo curto (1-2 frases) com um balão apontando pro
// campo real, dentro do modal JÁ ABERTO — ver "tipo: 'campo'" no getter
// `passoResolvido`/render em index.html (".cg-tour-balloon"), diferente do
// spotlight de tela cheia usado pros passos "acao" de fora de um modal
// (botão "Nova despesa" que abre o formulário, "Salvar" que fecha ele).
//
// Só os dois passos de ponta (abrir/salvar) são "acao" de verdade (esperam
// a pessoa interagir DE VERDADE, mesma filosofia do resto do onboarding —
// ver comentário grande no topo do arquivo): os 15 do meio são só
// explicação curta + "Próximo", sem gatilho — forçar detecção de "preencheu
// certo" em cada um dos 15 campos seria I) muito mais plumbing por pouco
// ganho de aprendizado e II) o oposto do pedido ("pouco texto", fluido).
// `dentroModal: true` no passo "Salvar" (o único 'acao' que precisa do
// balão em vez do spotlight de tela cheia, porque o alvo dele também vive
// dentro do modal real).
const PASSOS_FINANCEIRO = [
  {
    id: 'abrir',
    tipo: 'acao',
    area: 'financeiro-abrir',
    autoAvancar: true, // avança sozinho ao abrir o modal — ver dispatch em transactionForm.js::openNew()
    naoPular: true, // pular aqui deixaria os 16 passos seguintes apontando pra dentro de um modal que nunca abriu
    view: 'home',
    alvoSeletor: 'section[x-data^="dashboardView"] [data-tour-alvo="nova-transacao"]',
    icone: 'bi-cash-coin',
    titulo: 'Vamos registrar um gasto de teste',
    texto: 'Toque em "Nova despesa" pra começar.',
  },
  {
    id: 'campo-entrada',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-tipo-entrada"]',
    icone: 'bi-plus-circle-fill',
    titulo: 'Entrada',
    texto: 'Dinheiro que entra — salário, presente, venda.',
  },
  {
    id: 'campo-saida',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-tipo-saida"]',
    icone: 'bi-dash-circle-fill',
    titulo: 'Saída',
    texto: 'Dinheiro que sai — uma compra, conta, boleto. Vamos seguir com uma saída.',
  },
  {
    id: 'campo-titulo',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-titulo"]',
    icone: 'bi-card-text',
    titulo: 'Título',
    texto: 'Dê um nome curto. Ex: "Mercado" ou "Aluguel".',
  },
  {
    id: 'campo-categoria',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-categoria"]',
    icone: 'bi-tags-fill',
    titulo: 'Categoria',
    texto: 'Organiza o gasto por tipo. Opcional.',
  },
  {
    id: 'campo-valor',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-valor"]',
    icone: 'bi-cash',
    titulo: 'Valor',
    texto: 'O quanto custou. Um cafezinho de R$ 10 já serve pra testar.',
  },
  {
    id: 'campo-mais-opcoes',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-mais-opcoes"]',
    icone: 'bi-chevron-down',
    titulo: 'Mais opções',
    texto: 'Aqui tem campos extras — tudo opcional, só usa quando precisar.',
  },
  {
    id: 'campo-empresa',
    tipo: 'campo',
    view: 'home',
    preparar: () => prepararMostrarMaisOpcoes(),
    alvoSeletor: '[data-tour-alvo="campo-empresa"]',
    icone: 'bi-shop',
    titulo: 'Empresa ou serviço',
    texto: 'Quem você pagou — Nubank, iFood, o mercado. Ajuda a identificar o gasto depois.',
  },
  {
    id: 'campo-tipo-despesa',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-tipo-despesa"]',
    icone: 'bi-pin-angle-fill',
    titulo: 'Fixa ou variável',
    texto: 'Fixa repete todo mês (aluguel). Variável muda sempre (mercado).',
  },
  {
    id: 'campo-responsavel',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-responsavel"]',
    icone: 'bi-people-fill',
    titulo: 'Responsável',
    texto: 'Quem pagou. O "+" ao lado divide essa despesa com seu par.',
  },
  {
    id: 'campo-datas',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-datas"]',
    icone: 'bi-calendar3',
    titulo: 'Datas',
    texto: 'Cadastro já vem com hoje. Vencimento é opcional, pra conta com prazo.',
  },
  {
    id: 'campo-pago-recorrente',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-pago-recorrente"]',
    icone: 'bi-arrow-repeat',
    titulo: 'Pago e Recorrente',
    texto: '"Pago" marca como já quitado. "Recorrente" repete esse lançamento sozinho todo mês.',
  },
  {
    id: 'campo-cartao',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-cartao"]',
    icone: 'bi-credit-card-2-front-fill',
    titulo: 'Cartão de crédito',
    texto: 'Comprou no crédito? Escolha o cartão — entra direto na fatura do mês.',
  },
  {
    id: 'campo-parcelas',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-parcelas"]',
    icone: 'bi-collection',
    titulo: 'Parcelas',
    texto: 'Comprou parcelado? Parcela atual / total. Ex: 1 / 3.',
  },
  {
    id: 'campo-comprovante',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-comprovante"]',
    icone: 'bi-upc-scan',
    titulo: 'Comprovante',
    texto: 'Foto, arquivo, PDF ou código de barras/QR — qualquer um preenche o formulário sozinho.',
  },
  {
    id: 'campo-observacoes',
    tipo: 'campo',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-observacoes"]',
    icone: 'bi-chat-left-text',
    titulo: 'Observações',
    texto: 'Um espaço livre pra qualquer anotação extra. Opcional.',
  },
  {
    id: 'campo-salvar',
    tipo: 'acao',
    dentroModal: true,
    area: 'financeiro',
    view: 'home',
    alvoSeletor: '[data-tour-alvo="campo-salvar"]',
    icone: 'bi-check-circle-fill',
    titulo: 'Salvar',
    texto: 'Toque em "Salvar" pra concluir. Dá pra editar ou apagar depois, em Transações.',
    textoResultado: 'Prontinho! O saldo do Início já mudou na hora, e esse lançamento aparece em "Transações".',
  },
];

const CATALOGO_GUIAS = [
  {
    id: 'financeiro',
    area: 'financeiro',
    view: 'home',
    icone: 'bi-cash-coin',
    titulo: 'Registre um gasto de verdade',
    resumo: 'Cadastre uma despesa ou entrada — o básico do financeiro.',
    passos: PASSOS_FINANCEIRO,
  },
  {
    id: 'compras',
    area: 'compras',
    view: 'compras',
    alvoSeletor: 'section[x-data^="shoppingView"] [data-tour-alvo="novo-item-compra"]',
    // "bi-cart3-fill" NÃO EXISTE no Bootstrap Icons 1.11.3 (achado numa
    // revisão visual manual, 2026-09-14: ícone aparecia como quadrado vazio
    // na Central de tutoriais — confirmado via computed style, content:
    // none — e no próprio conjunto oficial de ícones, só existem
    // cart/cart-fill/cart2/cart3/cart4/cart-check(-fill)/cart-dash(-fill)/
    // cart-plus(-fill)/cart-x(-fill), nunca "cart3-fill"). Bug pré-existente
    // desde TASK-037/038 (mesmo nome usado lá), só ficou óbvio agora que o
    // ícone apareceu maior, na listagem da Central, em vez de pequeno
    // dentro do painel do tour.
    icone: 'bi-cart-fill',
    titulo: 'Adicione um item na lista',
    resumo: 'Coloque algo na lista de compras do mercado.',
    texto: 'Toque no botão "+" e coloque algo que precisa comprar — pode ser qualquer coisa, tipo "Leite".',
    textoResultado: 'Viu? O item já apareceu na lista e o total foi recalculado sozinho. Quando for ao mercado, é só marcar cada item como comprado — dá pra anotar o preço na hora, direto na lista.',
  },
  {
    id: 'recursos',
    area: 'recursos',
    view: 'recursos',
    alvoSeletor: 'section[x-data^="resourcesView"] [data-tour-alvo="recursos-add-item"]',
    preparar: () => prepararRecursos(),
    icone: 'bi-box-seam-fill',
    titulo: 'Cadastre algo que tem em casa',
    resumo: 'Guarde no inventário algo que já existe em algum cômodo.',
    texto: 'Já te levamos pra dentro de um cômodo. Toque em "Item" e cadastre algo que exista aí de verdade — tipo "Sabonete" ou "Arroz".',
    textoResultado: 'Esse item já está guardado nesse cômodo. Quando a quantidade chegar a zero ou a validade vencer, ele aparece sozinho em "Sugestões de compra" — com um atalho pra já mandar direto pra lista de compras.',
  },
  {
    id: 'dividir-despesa',
    area: 'dividir-despesa',
    view: 'home',
    alvoSeletor: 'section[x-data^="dashboardView"] [data-tour-alvo="nova-transacao"]',
    requisito: (app) => (app.group?.members?.length || 0) >= 2,
    requisitoTexto: 'Esse guia precisa de um grupo com você e seu par (tela Grupo) — convide seu par primeiro.',
    icone: 'bi-people-fill',
    titulo: 'Divida uma despesa com seu par',
    resumo: 'Some quem mais participou de uma despesa, sem fazer conta de cabeça.',
    texto: 'Toque em "Nova despesa" e, dentro do formulário, abra "Mais opções". Ao lado de "Responsável" tem um botão "+" — toque nele e escolha quem mais participou dessa despesa.',
    textoResultado: 'Boa! O valor já foi dividido em partes iguais entre vocês — dá pra ajustar o valor ou o percentual de cada um na mão, se não for igual. O saldo de quem deve quanto pra quem aparece na tela "Grupo", em "Entre vocês".',
  },
  {
    id: 'fixa',
    area: 'fixa',
    view: 'home',
    alvoSeletor: 'section[x-data^="dashboardView"] [data-tour-alvo="nova-transacao"]',
    icone: 'bi-pin-angle-fill',
    titulo: 'Marque uma despesa como fixa',
    resumo: 'Aluguel, assinatura — algo que se repete todo mês sozinho.',
    texto: 'Toque em "Nova despesa" e abra "Mais opções". No campo "Tipo", escolha "Fixa".',
    textoResultado: 'Pronto! Marcar como fixa já ligou a recorrência mensal sozinha — o próximo lançamento é criado automaticamente, sem precisar cadastrar de novo. Dá pra ajustar o dia certo logo abaixo, em "Recorrente".',
  },
  {
    id: 'cartao',
    area: 'cartao',
    view: 'home',
    alvoSeletor: 'section[x-data^="dashboardView"] [data-tour-alvo="nova-transacao"]',
    icone: 'bi-credit-card-2-front-fill',
    titulo: 'Registre uma compra no cartão de crédito',
    resumo: 'Uma compra no crédito, somada automaticamente na fatura do mês.',
    texto: 'Toque em "Nova despesa" e abra "Mais opções". Perto de "Recorrente" tem um campo pra escolher o cartão — selecione um cartão (ou crie um novo, se ainda não tiver nenhum).',
    textoResultado: 'Show! Essa despesa já está dentro da fatura daquele cartão no mês — o app junta tudo sozinho e conta o valor uma vez só, sem duplicar no saldo.',
  },
  {
    id: 'caixinha',
    area: 'caixinha',
    view: 'caixinhas',
    alvoSeletor: 'section[x-data^="caixinhasView"] [data-tour-alvo="nova-caixinha"]',
    preparar: () => prepararCaixinhas(),
    icone: 'bi-piggy-bank',
    titulo: 'Crie uma caixinha',
    resumo: 'Uma reserva separada, com meta e moeda à sua escolha.',
    texto: 'Toque em "Nova caixinha" e escolha um banco, uma moeda e, se quiser, uma meta de quanto pretende guardar.',
    textoResultado: 'Show! Sua caixinha já está criada. Agora é só guardar (ou retirar) valores nela quando quiser — o saldo é sempre a soma do que entrou menos o que saiu.',
  },
  {
    id: 'convite',
    area: 'convite',
    view: 'grupo',
    alvoSeletor: 'section[x-data^="groupView"] [data-tour-alvo="copiar-codigo-grupo"]',
    requisito: (app) => !!app.group,
    requisitoTexto: 'Crie ou entre num grupo primeiro (tela Grupo) pra ter um código de convite.',
    icone: 'bi-person-plus-fill',
    titulo: 'Convide seu par pro grupo',
    resumo: 'Compartilhe o código do grupo pra dividir contas com seu par.',
    texto: 'Toque em "Copiar código" e mande esse código pra quem você quer que entre — a pessoa usa ele em "Entrar em um grupo".',
    textoResultado: 'Código copiado! Quando a outra pessoa entrar com ele, vocês passam a compartilhar categorias e conseguem dividir despesas — o saldo "Entre vocês" aparece logo abaixo, nesta mesma tela.',
  },
  {
    id: 'compra-status',
    area: 'compra-status',
    view: 'compras',
    alvoSeletor: 'section[x-data^="shoppingView"] [data-tour-alvo="toggle-compra-status"]',
    icone: 'bi-play-circle-fill',
    titulo: 'Inicie uma compra',
    resumo: 'Passe a lista pro modo "comprando" quando chegar no mercado.',
    texto: 'Toque no botão pra começar a comprar — a lista entra no modo "comprando", pronta pra marcar cada item conforme você coloca no carrinho.',
    textoResultado: 'Prontinho! O status da lista já mudou — repare no rótulo do botão, que trocou sozinho. Quando terminar, é só tocar de novo nele pra encerrar.',
  },
];

export function onboardingStore() {
  return {
    aberto: false,
    centralAberta: false, // Central de tutoriais (catálogo escolhível) — TASK-042
    passoAtual: 0,
    passos: [], // populado por abrir() (tour) ou iniciarGuia() (guia avulso) — nunca mutado direto fora dessas duas entradas
    concluido: {}, // { [area]: true } assim que a AÇÃO REAL acontece nesta sessão do guia — chave criada sob demanda, nunca pré-semeada (não precisa mais de uma lista fixa de áreas, o catálogo pode crescer)
    pulado: {}, // { [area]: true } quando a pessoa clica "Pular esta etapa" (não fez a ação, mas também não trava mais o avanço)
    rectAlvo: null, // { top, left, width, height } do elemento real destacado, em px de viewport — null = sem spotlight visível agora
    telaAoAbrir: null, // $store.app.view de antes de abrir — devolve pra lá ao fechar/concluir, nunca deixa a pessoa "presa" numa tela que só visitou por causa do guia
    // Altura real do painel de instrução (.cg-tour-painel), em px — usada só
    // pra empurrar .toast-container (index.html) pra baixo dele durante um
    // passo de ação (achado numa revisão visual manual: o toast "N
    // lançamentos recorrentes gerados" cobria o texto do passo). Medida de
    // verdade via ResizeObserver (não um número fixo "generoso o bastante")
    // porque o conteúdo varia por guia (o de Recursos é bem mais comprido
    // que o de Compras) e por largura de tela (o mesmo texto quebra em mais
    // linhas no celular) — um valor chutado ficaria errado pra alguma
    // combinação mais cedo ou mais tarde.
    painelAltura: 0,

    // Limpeza de passo (listener do evento de ação + listeners de
    // scroll/resize) — sempre uma função ou null, nunca acumula: toda troca
    // de passo chama a anterior antes de registrar a próxima.
    _pararEscutaAcao: null,
    _pararRecalculo: null,
    _pararObservarPainel: null,
    _pararEscutaFechamento: null,

    catalogo: CATALOGO_GUIAS,

    // Nunca `undefined` — index.html tem vários `:aria-label`/`:class`
    // ligados a `$store.onboarding.passo.X` FORA de qualquer `x-show`/`x-if`
    // (o próprio Alpine avalia esses bindings o tempo todo, independente de
    // o elemento estar visível). Antes disto `passos` sempre nascia com um
    // array fixo de 5 itens (nunca vazio); agora, com o catálogo dinâmico,
    // `passos` começa `[]` até abrir()/iniciarGuia() rodar — sem este
    // fallback, `passo` seria `undefined` nesse meio-tempo e QUALQUER
    // `passo.titulo` etc. lançava "Cannot read properties of undefined",
    // travando a página inteira (bug real pego pelo smoke test/console).
    get passo() {
      return this.passos[this.passoAtual] || { tipo: null, titulo: '', texto: '', textoResultado: '', icone: '' };
    },
    get ultimoPasso() {
      return this.passoAtual === this.passos.length - 1;
    },
    // Um guia avulso (aberto pela Central) é sempre uma sequência de 1 passo
    // só — o template usa isto pra não mostrar "Passo 1 de 1"/dots sem
    // sentido nenhum, só nesse modo (o tour de boas-vindas continua com 3
    // passos reais, "modoUnico" fica false nele o tempo todo).
    get modoUnico() {
      return this.passos.length === 1;
    },
    // Um passo de ação "resolvido" tanto por ter feito a ação de verdade
    // quanto por ter escolhido pular ele — os dois liberam "Continuar" do
    // mesmo jeito, só o texto mostrado muda (resultado real vs. nada). Um
    // passo "campo" (guia detalhado, ver PASSOS_FINANCEIRO) nunca tem nada
    // pra detectar — é só explicação curta — então já nasce "resolvido":
    // o balão mostra direto o botão "Próximo", nunca "Pular esta etapa".
    get passoResolvido() {
      const p = this.passo;
      if (!p) return false;
      if (p.tipo === 'campo') return true;
      return p.tipo === 'acao' && (this.concluido[p.area] || this.pulado[p.area]);
    },
    // Passo "acao" cujo alvo vive DENTRO de um modal real já aberto (ex.:
    // botão "Salvar" do formulário de Nova despesa) — mesma renderização em
    // balão do tipo "campo" (index.html, ".cg-tour-balloon"), só que gated
    // (passoResolvido só vira true com a ação de verdade, não é automático).
    get mostraBalao() {
      const p = this.passo;
      return !!p && (p.tipo === 'campo' || (p.tipo === 'acao' && p.dentroModal));
    },

    // BUG REAL relatado em uso (2026-09-14): o passo de ação destaca o botão
    // "Nova despesa" e explica o que fazer, mas assim que a pessoa TOCA no
    // botão, o formulário real abre por cima (z-index 1050, maior que o
    // painel do guia, 1046, de propósito — ver comentário grande no topo
    // deste arquivo) e a instrução some da tela. Quem nunca usou o app antes
    // fica sem norte dentro do formulário: não sabe que "Mais opções" existe,
    // não sabe que só Título+Valor bastam, etc. — "continua por sua conta em
    // risco", nas palavras do usuário. Esta função devolve o TEXTO do guia
    // ativo quando (e só quando) o alvo dele é o botão que abre ESTE modal
    // (financeiro/dividir-despesa/fixa/cartao — os 4 guias que apontam pro
    // mesmo "Nova despesa" compartilham o mesmo alvoSeletor) — index.html
    // usa isto pra mostrar a MESMA instrução dentro do modal, reaproveitando
    // .cg-demo-banner (mesmo estilo visual do aviso de modo demonstração,
    // não um componente novo). null em qualquer outro caso (guia de outra
    // área, ou tour fechado) — o modal continua 100% normal fora do tour.
    get instrucaoModalTransacao() {
      const p = this.passo;
      if (!this.aberto || !p || p.tipo !== 'acao') return null;
      if (!p.alvoSeletor?.includes('nova-transacao')) return null;
      return p.texto;
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
    // Style pronto pra `:style` do balão de campo (ver `mostraBalao` acima)
    // — moldura fina em volta do alvo real + posição do balão (embaixo/em
    // cima, sempre dentro da largura da tela), calculados por
    // computeBalloonGeometry (js/utils/spotlight.js).
    get balloonStyles() {
      if (!this.rectAlvo) return null;
      const g = computeBalloonGeometry(this.rectAlvo, { width: window.innerWidth, height: window.innerHeight });
      const px = (n) => `${n}px`;
      const balloon = { left: px(g.balloon.left), maxWidth: px(g.balloon.maxWidth) };
      if (g.placement === 'bottom') balloon.top = px(g.balloon.top);
      else balloon.bottom = px(g.balloon.bottom);
      return {
        placement: g.placement,
        ring: { top: px(g.ring.top), left: px(g.ring.left), width: px(g.ring.width), height: px(g.ring.height) },
        balloon,
      };
    },

    // Usado tanto pela Central (mostrar um aviso no item indisponível) quanto
    // por iniciarGuia() (bloquear de verdade + avisar por toast).
    disponivel(guia) {
      return !guia.requisito || guia.requisito(Alpine.store('app'));
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

    // Tour de 1ª visita / "Tour de boas-vindas completo" (item fixo no topo
    // da Central) — boas-vindas (info) + UMA ação real (financeiro, a mais
    // fundamental) + conclusão (info, com atalho pra abrir a Central).
    //
    // Até 2026-09-14 este tour forçava financeiro+compras+recursos em
    // sequência única. Pedido explícito de usuário testando o app ("Tem q
    // ter tutorial tour para cada coisa... e dar a opção para o usuário
    // escolher oq ele quer aprender") trocou isso por um catálogo
    // escolhível — não fazia mais sentido o tour de 1ª visita continuar
    // forçando 3 ações quando a pessoa pode escolher exatamente essas
    // mesmas 3 (e mais 6 outras) na Central, no momento em que ela quiser.
    // O tour continua existindo (ninguém deveria cair de paraquedas na 1ª
    // visita sem NENHUM caminho guiado — só um menu jogado na cara sem
    // contexto seria pior, não melhor), só não força mais que UMA ação
    // prática antes de deixar a pessoa escolher o resto sozinha.
    abrir() {
      const financeiro = this.catalogo.find((g) => g.id === 'financeiro');
      this.passos = [
        {
          id: 'boas-vindas',
          tipo: 'info',
          icone: 'bi-house-heart-fill',
          titulo: 'Bem-vindo(a) ao BNTT!',
          texto: 'Aqui vocês dois colocam o dinheiro, a lista de compras e o que tem em casa sob controle — tudo num só lugar. No próximo passo você vai USAR a ferramenta de verdade, registrando um gasto real. Depois disso, você escolhe o que mais quer aprender.',
        },
        ...financeiro.passos,
        {
          id: 'conclusao',
          tipo: 'info',
          icone: 'bi-signpost-2-fill',
          titulo: 'Boa! Você já viu como funciona.',
          texto: 'Tem bastante mais coisa pra explorar — dividir despesa com seu par, despesa fixa, cartão de crédito, caixinha, lista de compras, recursos de casa e mais. A Central de tutoriais tem um guia rápido pra cada uma dessas ações, pra você escolher o que quiser aprender agora.',
          cta: { label: 'Abrir Central de tutoriais', metodo: 'abrirCentralDoTour' },
        },
      ];
      this.passoAtual = 0;
      this.concluido = {};
      this.pulado = {};
      this.rectAlvo = null;
      this.telaAoAbrir = Alpine.store('app').view;
      this.aberto = true;
      this._entrarNoPasso();
    },

    // ---------- Central de tutoriais (TASK-042) ----------
    // Ponto de entrada do catálogo escolhível — Perfil → Preferências e um
    // ícone dedicado na topbar (junto do "?" de FAQ, mas separado dele: são
    // conteúdos diferentes — dúvida pontual vs. "me ensina a fazer isso").
    abrirCentral() {
      this.centralAberta = true;
    },
    fecharCentral() {
      this.centralAberta = false;
    },
    // CTA do passo de conclusão do tour — encerra o tour normalmente
    // (mesmo encerrar() de sempre, devolve a tela, marca "visto") e já abre
    // a Central em seguida, sem a pessoa precisar procurar em Perfil.
    abrirCentralDoTour() {
      this.concluir();
      this.abrirCentral();
    },

    // Um guia AVULSO do catálogo, escolhido na Central — sequência de 1
    // passo só (sempre tipo:'acao'; não existe guia informativo isolado no
    // catálogo, só dentro do tour). Mesmo mecanismo de spotlight de sempre,
    // só "solto" (sem boas-vindas/conclusão em volta).
    iniciarGuia(id) {
      const guia = this.catalogo.find((g) => g.id === id);
      if (!guia) return;
      const appStore = Alpine.store('app');
      if (!this.disponivel(guia)) {
        appStore.notify(guia.requisitoTexto || 'Esse guia não está disponível agora.', 'danger');
        return;
      }
      this.centralAberta = false;
      this.passos = guia.passos || [{ ...guia, tipo: 'acao' }];
      this.passoAtual = 0;
      this.concluido = {};
      this.pulado = {};
      this.rectAlvo = null;
      this.telaAoAbrir = appStore.view;
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
    // passo que não quer fazer agora. Num guia avulso (modoUnico) isto já
    // avança pro "último passo" (o único que existe), então encerra o guia
    // inteiro — o próprio template troca o rótulo do botão pra "Pular" nesse
    // caso, ver index.html.
    pularEtapa() {
      const p = this.passo;
      if (p.naoPular) return; // ex.: "abrir o modal" — pular deixaria os passos seguintes apontando pra dentro de um modal que nunca abriu
      if (p.tipo === 'acao') this.pulado[p.area] = true;
      this.avancar();
    },

    // "Pular tudo" / Esc / clique no X ou no backdrop escurecido fora do
    // buraco — sempre encerra o tour/guia inteiro (nunca só o passo atual,
    // que é o que "Pular esta etapa" já faz). Rótulo do botão muda ("Pular"
    // num passo informativo, "Começar a usar" no último do tour), mas do
    // ponto de vista de "não abrir sozinho de novo", pular e concluir são a
    // mesma coisa.
    pular() { this.encerrar(); },
    concluir() { this.encerrar(); },

    encerrar() {
      this._limparPasso();
      this.aberto = false;
      // Devolve a pessoa pra tela de onde ela abriu o tour/guia — sem isso,
      // quem terminava um guia em Recursos ficava "esquecido" lá, numa tela
      // que só visitou por causa do guiado, não por escolha própria.
      if (this.telaAoAbrir) Alpine.store('app').view = this.telaAoAbrir;
      localStorage.setItem(CHAVE_VISTO, '1');
    },

    // ---------- Mecânica interna de cada passo de ação ----------

    // Ponto único de entrada em QUALQUER passo (chamado por abrir/
    // iniciarGuia/avancar/voltar) — sempre limpa o passo anterior primeiro
    // (nunca acumula listener), e só faz alguma coisa a mais se o passo
    // novo tiver um alvo real (tipo 'acao' ou 'campo' — 'info' não tem
    // alvoSeletor nenhum, ver PASSOS_FINANCEIRO/CATALOGO_GUIAS).
    async _entrarNoPasso() {
      this._limparPasso();
      const p = this.passo;
      if (p.tipo !== 'acao' && p.tipo !== 'campo') return;

      const appStore = Alpine.store('app');
      appStore.view = p.view;
      appStore.navOpen = false; // fecha o menu hambúrguer (mobile) se estava aberto — nunca deixa ele por cima do spotlight/balão
      await nextTick();

      // Plumbing de navegação específico do guia (ex.: Recursos precisa
      // entrar num cômodo antes do alvo real existir; o guia financeiro
      // detalhado precisa abrir "Mais opções" antes do alvo de Empresa
      // existir) — nunca é a ação que a pessoa está aprendendo, ver
      // comentário grande no topo do arquivo.
      if (typeof p.preparar === 'function') await p.preparar();
      await nextTick();

      if (p.tipo === 'acao') this._escutarAcao(p.area, p.autoAvancar);
      // Passo com alvo dentro de um modal real (campo, ou acao com
      // dentroModal) — se a pessoa fechar o modal de verdade (Cancelar/X/
      // Esc) no meio do guia, o balão ficaria apontando pra um campo que
      // sumiu. Ver close() em transactionForm.js (dispara
      // "cg:onboarding-modal-fechado" sempre, best-effort — só importa aqui
      // quando este listener está de fato registrado).
      if (p.tipo === 'campo' || p.dentroModal) this._escutarFechamentoModal();
      this._focarAlvo();
      this._ligarRecalculoAutomatico();
      await nextTick(); // o painel só existe no DOM depois deste tick (x-show acabou de virar true)
      this._observarPainel();
    },

    _escutarFechamentoModal() {
      const ouvinte = () => this.encerrar();
      window.addEventListener('cg:onboarding-modal-fechado', ouvinte, { once: true });
      this._pararEscutaFechamento = () => window.removeEventListener('cg:onboarding-modal-fechado', ouvinte);
    },

    _escutarAcao(area, autoAvancar) {
      const ouvinte = (evento) => {
        if (evento.detail?.area !== area) return;
        this.concluido[area] = true;
        // Passo tipo "abrir o modal" (ex.: PASSOS_FINANCEIRO[0]) conclui no
        // instante em que o modal abre — o painel de instrução (spotlight
        // de tela cheia) fica escondido atrás dele (z-index menor, de
        // propósito) assim que isso acontece, então o botão "Continuar"
        // ficaria inacessível se a pessoa precisasse clicar nele. Avança
        // sozinho pro balão do próximo campo em vez de esperar um clique
        // num botão que ninguém consegue ver.
        if (autoAvancar) { this.avancar(); return; }
        // BUG REAL encontrado testando com Playwright (TASK-037/038): Compras
        // é a ÚNICA tela que mantém o modal de "Adicionar item" aberto DE
        // PROPÓSITO depois de salvar (pra colocar vários itens seguidos sem
        // reabrir a cada um — ver comentário em shoppingList.js::addItem()).
        // Fora do tour isso é bom; DURANTE o guia, o modal real (z-index
        // maior que o nosso painel) ficava por CIMA do resultado/"Continuar",
        // escondendo os dois. As outras telas já fecham sozinhas ao salvar
        // (ou, no caso de dividir-despesa/fixa/cartao, a ação acontece DENTRO
        // do formulário e a pessoa decide quando fechar — ver comentário
        // grande no topo do arquivo) — só Compras precisa desse empurrão
        // extra aqui, sem mudar o comportamento normal (fora do guia) da
        // tela.
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
      const el = p.tipo === 'acao' || p.tipo === 'campo' ? document.querySelector(p.alvoSeletor) : null;
      if (el) el.scrollIntoView({ block: 'center' });
      this._recalcularSpotlight();
    },

    _recalcularSpotlight() {
      const p = this.passo;
      const el = p && (p.tipo === 'acao' || p.tipo === 'campo') ? document.querySelector(p.alvoSeletor) : null;
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

    // Mede a altura real do painel de instrução (achado numa revisão visual
    // manual: sem isso, .toast-container em index.html não tinha como saber
    // até onde precisa descer pra não cobrir o painel — um número fixo
    // "generoso o bastante" ficaria errado pro guia de Recursos, que é bem
    // mais comprido, ou pra alguma largura de tela específica). ResizeObserver
    // (não só uma medição única) porque o conteúdo pode mudar de altura sem
    // trocar de passo: a mesma frase quebra em mais ou menos linhas se a
    // pessoa girar o celular ou redimensionar a janela.
    _observarPainel() {
      const el = document.querySelector('.cg-tour-painel');
      if (!el || typeof ResizeObserver === 'undefined') return;
      const obs = new ResizeObserver(([entry]) => {
        this.painelAltura = entry.contentRect.height;
      });
      obs.observe(el);
      this._pararObservarPainel = () => obs.disconnect();
    },

    _limparPasso() {
      this._pararEscutaAcao?.();
      this._pararEscutaAcao = null;
      this._pararEscutaFechamento?.();
      this._pararEscutaFechamento = null;
      this._pararRecalculo?.();
      this._pararRecalculo = null;
      this._pararObservarPainel?.();
      this._pararObservarPainel = null;
      this.painelAltura = 0;
      this.rectAlvo = null;
    },
  };
}
