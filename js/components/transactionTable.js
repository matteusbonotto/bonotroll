import { listTransactions, updateTransaction, markAsPaid, markAsUnpaid, listPayersFor, groupCartaoCredito } from '../services/transactions.js';
import { notifyPayment } from '../services/notifications.js';
import { STATUS_META, statusMeta, computeStatus } from '../utils/status.js';
import { exportToCsv } from '../services/csvImport.js';
import * as format from '../utils/format.js';
import { todayIso } from '../utils/format.js';

const FILTRO_VAZIO = { tipo: '', categoriaId: '', responsavelId: '', status: '', tipoDespesa: '', busca: '', dataInicio: '', dataFim: '' };

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// Tela "Transações": tabela com filtros, edição inline (categoria/responsável/pago)
// e exportação/importação de CSV.
export function transactionsView() {
  return {
    rows: [],
    payersByTx: {},
    loading: true,
    filtro: { ...FILTRO_VAZIO },
    // Painel de filtros recolhível no mobile (a versão anterior ficava sempre
    // aberta e tomava a tela toda — ver reclamação de UX). No desktop
    // (≥992px) o CSS ignora esse estado e mostra o painel sempre (ver
    // .cg-filter-panel em css/app.css).
    filtrosAbertos: false,
    ordenarPor: 'data_cadastro',
    ordemDesc: true,
    STATUS_META,

    // 2 eixos independentes (2026-08-20, reestruturado — antes eram 4 modos
    // soltos: lista/tabela/grade/compacta, sem relação clara entre si, e
    // "lista" já SEMPRE tinha sido tabela-no-desktop/cards-no-mobile —
    // reportado como "lista não funciona em desktop" porque coexistir com
    // um "tabela" quase idêntico só confundia qual escolher):
    //   layout    = 'lista' (linhas, edição inline; tabela no desktop, cards
    //               no mobile) | 'tabela' (mesma tabela de 'lista', mas
    //               forçada em QUALQUER largura — pedido explícito de
    //               "planilha" no celular, com scroll horizontal E vertical
    //               em vez do card-stack; ver .cg-scroll-xy em css/app.css.
    //               Reintroduzido em 2026-08-20 — NÃO é o "tabela" antigo
    //               acima: aquele não diferia de 'lista' em lugar nenhum,
    //               este só existe pra resolver o mobile, então não
    //               reproduz a confusão "quase idêntico" que motivou a
    //               fusão original) | 'grade' (cards, toca pra abrir o
    //               formulário completo)
    //   densidade = 'normal' | 'compacta' (mais denso, menos respiro)
    // Os eixos se combinam livremente — inclusive tabela+compacta — e
    // "Agrupar" continua um terceiro filtro totalmente independente dos
    // dois (ver agrupando/secoesExibidas).
    layout: localStorage.getItem('bonotto_layout_transacoes') || 'lista',
    densidade: localStorage.getItem('bonotto_densidade_transacoes') || 'normal',
    setLayout(v) {
      this.layout = v;
      localStorage.setItem('bonotto_layout_transacoes', v);
    },
    setDensidade(v) {
      this.densidade = v;
      localStorage.setItem('bonotto_densidade_transacoes', v);
    },

    // ---------- Agrupamento: accordion por período/responsável/movimentação/categoria ----------
    // Filtro SEPARADO do viewMode (2026-08-20) — "agrupando" liga/desliga
    // por cima de qualquer lista/tabela/grade/compacta já selecionado; o
    // agrupamento é só quem decide COMO dividir as linhas em seções, o
    // viewMode continua decidindo COMO cada seção é desenhada por dentro
    // (tabela, cards ou grade — nunca uma renderização própria do
    // agrupamento). Ver secoesExibidas, que é o que os templates realmente
    // iteram agora em vez de sortedRows direto.
    agrupando: localStorage.getItem('bonotto_agrupando_transacoes') === '1',
    setAgrupando(valor) {
      this.agrupando = valor;
      localStorage.setItem('bonotto_agrupando_transacoes', valor ? '1' : '0');
    },
    agrupamento: localStorage.getItem('bonotto_agrupamento_transacoes') || 'periodo',
    setAgrupamento(modo) {
      this.agrupamento = modo;
      localStorage.setItem('bonotto_agrupamento_transacoes', modo);
      this.overridesAbertura = {};
    },
    // Chave (mês "aaaa-mm", responsavel_id, tipo, categoria_id...) -> true/false
    // quando a pessoa já clicou pra abrir/fechar aquele grupo manualmente,
    // sobrepondo o "aberto por padrão" (ver estaAberto). Objeto plano (não
    // Map) de propósito — mesmo padrão de payersByTx/_debounceQty já usado
    // no resto do app, garante que o Alpine reage a cada tecla nova.
    overridesAbertura: {},
    estaAberto(chave, abertoPorPadrao) {
      return chave in this.overridesAbertura ? this.overridesAbertura[chave] : abertoPorPadrao;
    },
    toggleGrupo(chave, abertoPorPadrao) {
      this.overridesAbertura[chave] = !this.estaAberto(chave, abertoPorPadrao);
    },

    labelMes(anoMes) {
      if (anoMes === 'sem-data') return 'Sem data';
      const [ano, mes] = anoMes.split('-');
      return `${MESES_ABREV[Number(mes) - 1]}/${ano.slice(2)}`;
    },

    // Contagem por status + soma de entrada/saída de um conjunto de linhas —
    // usado tanto pelo resumo de cada grupo do accordion quanto (com todas
    // as linhas de uma vez) poderia servir de totalizador geral, se um dia
    // fizer sentido mostrar isso fora do agrupamento também.
    resumoGrupo(linhas) {
      const r = { entradas: 0, saidas: 0, pago: 0, vencido: 0, a_vencer: 0, pendente: 0 };
      for (const t of linhas) {
        if (t.tipo === 'entrada') r.entradas += Number(t.valor) || 0;
        else r.saidas += Number(t.valor) || 0;
        r[t._status] = (r[t._status] || 0) + 1;
      }
      return r;
    },

    // Por mês ("aaaa-mm", rótulo "ago/26"), 1 nível só — o ano fica embutido
    // no rótulo em vez de virar um segundo nível de accordion (mais simples
    // de combinar com "dentro da seção é a mesma tabela/grade de sempre").
    // Usa vencimento (ou cadastro, se não tiver vencimento) como a data que
    // define o período — é a mesma data que a pessoa já olha pra saber
    // "isso é de quando". Sem nenhuma das duas (raro) cai num grupo "Sem
    // data" à parte em vez de sumir da lista.
    get gruposPorPeriodo() {
      const hojeAnoMes = todayIso().slice(0, 7);
      const porMes = new Map();
      for (const t of this.sortedRows) {
        const base = t.data_vencimento || t.data_cadastro || null;
        const anoMes = base ? base.slice(0, 7) : 'sem-data';
        if (!porMes.has(anoMes)) porMes.set(anoMes, []);
        porMes.get(anoMes).push(t);
      }
      return [...porMes.entries()]
        // Mês atual sempre primeiro da fila, sem exceção (pedido explícito)
        // — antes disso, ordenar só por string "aaaa-mm" descendente fazia
        // um mês FUTURO (ex.: recorrência já gerada com antecedência,
        // "set/26") aparecer antes do mês atual ("ago/26"), porque
        // "2026-09" > "2026-08" na comparação de string. "Sem data" sempre
        // por último; o resto continua mais recente -> mais antigo entre si.
        .sort(([a], [b]) => {
          if (a === hojeAnoMes) return -1;
          if (b === hojeAnoMes) return 1;
          if (a === 'sem-data') return 1;
          if (b === 'sem-data') return -1;
          return b.localeCompare(a);
        })
        .map(([anoMes, linhas]) => ({
          chave: anoMes,
          label: this.labelMes(anoMes),
          isAtual: anoMes === hojeAnoMes,
          abertoPorPadrao: anoMes === hojeAnoMes,
          linhas,
          resumo: this.resumoGrupo(linhas),
        }));
    },

    get gruposSimples() {
      const dim = this.agrupamento;
      const grupos = new Map();
      for (const t of this.sortedRows) {
        let chave;
        let label;
        if (dim === 'responsavel') {
          chave = t.responsavel_id || 'sem-responsavel';
          label = this.responsavelFor(t.responsavel_id)?.nome || 'Sem responsável';
        } else if (dim === 'movimentacao') {
          chave = t.tipo;
          label = t.tipo === 'entrada' ? 'Entradas' : 'Saídas';
        } else {
          chave = t.categoria_id || 'sem-categoria';
          label = this.categoryFor(t.categoria_id)?.nome || 'Sem categoria';
        }
        if (!grupos.has(chave)) grupos.set(chave, { chave, label, linhas: [] });
        grupos.get(chave).linhas.push(t);
      }
      return [...grupos.values()]
        .map((g) => ({ ...g, resumo: this.resumoGrupo(g.linhas), abertoPorPadrao: true }))
        .sort((a, b) => b.linhas.length - a.linhas.length);
    },

    // O que os templates de fato iteram: 1 "seção" sem rótulo (agrupamento
    // desligado — comportamento de sempre, tudo numa lista só) ou N seções
    // com rótulo + resumo (agrupamento ligado). Cada seção carrega só os
    // dados; QUAL viewMode desenha o conteúdo de dentro continua sendo
    // decidido separadamente pelos templates — agrupamento nunca decide
    // layout, só decide "quais linhas entram em cada bloco".
    get secoesExibidas() {
      // resumo sempre um objeto de verdade (nunca null) mesmo na seção
      // "sem agrupamento" — o cabeçalho do grupo é só x-if="agrupando", mas
      // durante a MESMA transição reativa em que agrupando vira true o
      // Alpine pode reavaliar esse x-for antes do x-if aninhado assentar;
      // sem isso, aparecia um "Cannot read properties of null" no meio da
      // troca (confirmado ao vivo, não só teoria).
      if (!this.agrupando) return [{ chave: '__todos__', label: null, linhas: this.sortedRows, abertoPorPadrao: true, resumo: this.resumoGrupo([]) }];
      return this.agrupamento === 'periodo' ? this.gruposPorPeriodo : this.gruposSimples;
    },

    init() {
      this.load();
      window.addEventListener('cg:transactions-changed', () => this.load());
      this.$watch('filtro', () => this.load());
    },

    // silent=true (auto-refresh de 1 min, ver setupAutoRefresh em app.js)
    // busca de novo sem mexer em "loading" — troca os dados na hora, sem
    // piscar spinner nem perder o scroll/filtro que a pessoa já tinha.
    async load(silent = false) {
      const store = this.$store.app;
      if (!store.profile) return;
      if (!silent) this.loading = true;
      try {
        this.rows = await listTransactions({
          ownerId: store.profile.id,
          groupId: store.group?.group?.id,
          filters: {
            tipo: this.filtro.tipo || undefined,
            categoriaId: this.filtro.categoriaId || undefined,
            responsavelId: this.filtro.responsavelId || undefined,
            status: this.filtro.status || undefined,
            tipoDespesa: this.filtro.tipoDespesa || undefined,
            busca: this.filtro.busca || undefined,
            dataInicio: this.filtro.dataInicio || undefined,
            dataFim: this.filtro.dataFim || undefined,
          },
        });
        const payersMap = await listPayersFor(this.rows.map((r) => r.id));
        this.payersByTx = Object.fromEntries(payersMap);
      } catch (e) {
        if (!silent) store.notify(e.message || 'Não consegui carregar as transações.', 'danger');
      } finally {
        if (!silent) this.loading = false;
      }
    },

    // Pagadores de uma transação (vazio = caso simples, só o responsável).
    // Usado pra desenhar o "avatar stack" quando há 2+.
    payersFor(row) {
      return this.payersByTx[row.id] || [];
    },

    _ordenar(linhas) {
      const dir = this.ordemDesc ? -1 : 1;
      return [...linhas].sort((a, b) => {
        const av = a[this.ordenarPor] ?? '';
        const bv = b[this.ordenarPor] ?? '';
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    },

    // Linhas "de topo": a compra marcada como paga no cartão sai da lista
    // solta e passa a viver dentro da fatura do mês (row.filhosCartao), que
    // vira o pai do accordion — ver groupCartaoCredito em
    // services/transactions.js. Aplicado AQUI (e não dentro de
    // gruposPorPeriodo/gruposSimples/resumoGrupo) porque tudo nesta tela
    // deriva de sortedRows: com um único ponto, os totais de cada grupo do
    // "Agrupar" também param de contar o mesmo dinheiro duas vezes, e os 3
    // layouts recebem o mesmo .filhosCartao de graça.
    get sortedRows() {
      return groupCartaoCredito(this._ordenar(this.rows), this.$store.app.categories).visiveis;
    },

    // ---------- Accordion da fatura do cartão ----------
    // Reaproveita o mesmo mecanismo do "Agrupar" (overridesAbertura +
    // estaAberto/toggleGrupo) em vez de um segundo estado paralelo — só com
    // um prefixo de chave próprio, pra uma fatura e um grupo nunca colidirem
    // no mesmo dicionário. Fechado por padrão: a fatura sozinha já mostra o
    // valor real do mês; o detalhe do que tem dentro é sob demanda.
    temFilhosCartao(row) {
      return !!(row.filhosCartao && row.filhosCartao.length);
    },
    cartaoAberto(row) {
      return this.estaAberto(`cartao:${row.id}`, false);
    },
    toggleCartao(row) {
      this.toggleGrupo(`cartao:${row.id}`, false);
    },

    // O que os 3 layouts (tabela, cards mobile, grade) iteram de verdade:
    // a mesma lista de linhas, com as filhas da fatura ABERTA intercaladas
    // logo depois dela, marcadas com _filhoCartao (só pra indentar/esmaecer).
    // Intercalar numa lista só, em vez de um x-for aninhado, é o que permite
    // reusar exatamente o mesmo template de linha pros dois casos — sem
    // segunda marcação paralela pra manter em dia.
    linhasComFilhos(linhas) {
      const saida = [];
      for (const t of linhas) {
        saida.push(t);
        if (!this.temFilhosCartao(t) || !this.cartaoAberto(t)) continue;
        for (const filho of t.filhosCartao) saida.push({ ...filho, _filhoCartao: true });
      }
      return saida;
    },

    sortBy(field) {
      if (this.ordenarPor === field) this.ordemDesc = !this.ordemDesc;
      else {
        this.ordenarPor = field;
        this.ordemDesc = true;
      }
    },

    limparFiltros() {
      this.filtro = { ...FILTRO_VAZIO };
    },

    get filtrosAtivosCount() {
      return Object.values(this.filtro).filter((v) => v !== '' && v != null).length;
    },

    // Chips dos filtros ativos (mobile) — cada um com um rótulo legível e uma
    // função pra limpar só aquele filtro, sem precisar reabrir o painel.
    get filtrosChips() {
      const chips = [];
      const f = this.filtro;
      if (f.tipo) chips.push({ key: 'tipo', label: f.tipo === 'entrada' ? 'Entrada' : 'Saída' });
      if (f.categoriaId) chips.push({ key: 'categoriaId', label: this.categoryFor(f.categoriaId)?.nome || 'Categoria' });
      if (f.responsavelId) chips.push({ key: 'responsavelId', label: this.responsavelFor(f.responsavelId)?.nome || 'Responsável' });
      if (f.status) chips.push({ key: 'status', label: statusMeta(f.status).label });
      if (f.tipoDespesa) chips.push({ key: 'tipoDespesa', label: f.tipoDespesa === 'fixa' ? 'Fixa' : 'Variável' });
      if (f.busca) chips.push({ key: 'busca', label: `"${f.busca}"` });
      if (f.dataInicio || f.dataFim) {
        const de = f.dataInicio ? format.formatDate(f.dataInicio) : '…';
        const ate = f.dataFim ? format.formatDate(f.dataFim) : '…';
        chips.push({ key: 'periodo', label: `${de} – ${ate}` });
      }
      return chips;
    },

    removerFiltro(key) {
      if (key === 'periodo') {
        this.filtro.dataInicio = '';
        this.filtro.dataFim = '';
      } else {
        this.filtro[key] = '';
      }
    },

    aplicarPeriodoRapido(dias) {
      const hoje = new Date();
      const fim = new Date(hoje);
      fim.setDate(fim.getDate() + dias);
      const iso = (d) => d.toISOString().slice(0, 10);
      if (dias >= 0) {
        this.filtro.dataInicio = iso(hoje);
        this.filtro.dataFim = iso(fim);
      } else {
        this.filtro.dataInicio = iso(fim);
        this.filtro.dataFim = iso(hoje);
      }
    },

    aplicarMesAtual() {
      const hoje = new Date();
      const iso = (d) => d.toISOString().slice(0, 10);
      this.filtro.dataInicio = iso(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
      this.filtro.dataFim = iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0));
    },

    // Ver o que já está lançado pro mês que vem — útil especialmente pra
    // despesa recorrente/fixa, que já é gerada com antecedência.
    aplicarProximoMes() {
      const hoje = new Date();
      const iso = (d) => d.toISOString().slice(0, 10);
      this.filtro.dataInicio = iso(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1));
      this.filtro.dataFim = iso(new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0));
    },

    categoryFor(id) {
      return this.$store.app.categoryById(id);
    },
    responsavelFor(id) {
      return this.$store.app.profileById(id);
    },

    // Todas as edições inline abaixo (dropdown de categoria/responsável na
    // tabela, datas, pago/não-pago, fixa/variável) passavam batido sem
    // try/catch — uma falha (rede, RLS, schema desatualizado) simplesmente
    // não fazia nada visível, exatamente o "não aparece erro nenhum"
    // reportado. Um helper comum evita repetir o try/catch 6 vezes.
    //
    // Dispara "cg:transactions-changed" em vez de chamar this.load() direto
    // (mesmo padrão de transactionForm.js): o próprio listener do init() já
    // recarrega esta tabela, e é esse evento que mantém o Dashboard em dia
    // também — as seções de tela ficam todas montadas ao mesmo tempo
    // (x-show, não x-if), então uma edição inline feita aqui não aparecia
    // no Início sem F5 até esse dispatch existir.
    // onErro (opcional) desfaz uma mudança otimista feita ANTES de chamar
    // (ver togglePago) — sem reverter, o campo ficaria mostrando o valor
    // novo mesmo depois de a chamada ter falhado de verdade.
    async _editarInline(acao, mensagemErro, onErro) {
      try {
        await acao();
        window.dispatchEvent(new CustomEvent('cg:transactions-changed'));
      } catch (e) {
        if (onErro) onErro();
        this.$store.app.notify(e.message || mensagemErro, 'danger');
      }
    },

    setCategoria(row, categoriaId) {
      return this._editarInline(() => updateTransaction(row.id, { categoria_id: categoriaId || null }), 'Não foi possível alterar a categoria.');
    },
    setResponsavel(row, responsavelId) {
      return this._editarInline(() => updateTransaction(row.id, { responsavel_id: responsavelId || null }), 'Não foi possível alterar o responsável.');
    },
    setVencimento(row, data) {
      return this._editarInline(() => updateTransaction(row.id, { data_vencimento: data || null }), 'Não foi possível alterar o vencimento.');
    },
    setDataPagamento(row, data) {
      return this._editarInline(() => updateTransaction(row.id, { data_pagamento: data || null }), 'Não foi possível alterar a data de pagamento.');
    },
    toggleTipoDespesa(row) {
      return this._editarInline(
        () => updateTransaction(row.id, { tipo_despesa: row.tipo_despesa === 'fixa' ? 'variavel' : 'fixa' }),
        'Não foi possível alterar fixa/variável.'
      );
    },

    // Otimista: o checkbox (:checked="!!row.data_pagamento") e o badge de
    // status mudam NA HORA, sem esperar a rede confirmar. Sem isso, no
    // meio-tempo entre o clique e a resposta, o Alpine re-sincroniza o
    // :checked pro valor antigo (a rede ainda não voltou) e o checkbox
    // "pisca" de volta pro estado errado antes de corrigir sozinho — dava a
    // impressão de que a ação tinha falhado, mesmo tendo funcionado.
    // onErro desfaz os dois campos se a chamada realmente falhar.
    togglePago(row) {
      const eraPago = row._status === 'pago';
      const anterior = { data_pagamento: row.data_pagamento, _status: row._status };

      row.data_pagamento = eraPago ? null : todayIso();
      row._status = computeStatus(row);

      return this._editarInline(
        async () => {
          if (eraPago) {
            await markAsUnpaid(row.id);
          } else {
            const paga = await markAsPaid(row.id);
            await this.avisarPagamento(paga);
          }
        },
        'Não foi possível atualizar o status de pagamento.',
        () => {
          row.data_pagamento = anterior.data_pagamento;
          row._status = anterior._status;
        }
      );
    },

    // Avisa os outros membros do grupo que essa despesa foi paga (ver
    // services/notifications.js::notifyPayment). Só faz sentido quando há
    // grupo com mais de uma pessoa. Best-effort: se a notificação falhar,
    // não desfaz o pagamento que já foi marcado com sucesso — só avisa.
    async avisarPagamento(transacaoPaga) {
      const store = this.$store.app;
      const memberIds = (store.group?.members || []).map((m) => m.id);
      if (memberIds.length < 2) return;
      try {
        await notifyPayment({ transaction: transacaoPaga, payerProfileId: store.profile.id, memberIds });
        store.refreshNotifications();
      } catch (e) {
        console.error('notifyPayment falhou:', e);
        store.notify(e.message || 'Pagamento salvo, mas não consegui avisar o grupo.', 'danger');
      }
    },

    editar(row) {
      this.$store.txModal.openEdit(row);
    },
    novaSaida() {
      this.$store.txModal.openNew('saida');
    },
    novaEntrada() {
      this.$store.txModal.openNew('entrada');
    },

    abrirImportacao() {
      this.$store.csvModal.openFor('transacoes');
    },

    // Exporta a lista CRUA ordenada (_ordenar(this.rows)), não sortedRows:
    // no CSV cada lançamento é uma linha própria e nada é somado, então
    // esconder as compras que estão dentro da fatura só perderia dado — a
    // dedução de duplicidade existe pra métrica, não pra backup.
    exportar() {
      const dados = this._ordenar(this.rows).map((r) => ({
        movimentacao: r.tipo === 'entrada' ? 'Entrada' : 'Saída',
        titulo: r.titulo,
        empresa_servico: r.empresa_servico || '',
        categoria: this.categoryFor(r.categoria_id)?.nome || '',
        responsavel: this.responsavelFor(r.responsavel_id)?.nome || '',
        tipo_despesa: r.tipo_despesa === 'fixa' ? 'Fixa' : 'Variável',
        valor: r.valor,
        vencimento: r.data_vencimento || '',
        status: STATUS_META[r._status].label,
      }));
      exportToCsv(dados, 'bonotto-transacoes.csv');
    },
  };
}
