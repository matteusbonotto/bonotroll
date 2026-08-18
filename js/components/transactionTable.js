import { listTransactions, updateTransaction, markAsPaid, markAsUnpaid, listPayersFor } from '../services/transactions.js';
import { notifyPayment } from '../services/notifications.js';
import { STATUS_META, statusMeta } from '../utils/status.js';
import { exportToCsv } from '../services/csvImport.js';
import * as format from '../utils/format.js';

const FILTRO_VAZIO = { tipo: '', categoriaId: '', responsavelId: '', status: '', tipoDespesa: '', busca: '', dataInicio: '', dataFim: '' };

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

    // Lista (tabela desktop / cards empilhados mobile, com edição inline) é
    // o default. Grade e grade compacta são visões de navegação — tocar num
    // card abre o formulário completo em vez de editar campo a campo.
    viewMode: localStorage.getItem('bonotto_view_transacoes') || 'lista',
    setViewMode(mode) {
      this.viewMode = mode;
      localStorage.setItem('bonotto_view_transacoes', mode);
    },

    init() {
      this.load();
      window.addEventListener('cg:transactions-changed', () => this.load());
      this.$watch('filtro', () => this.load());
    },

    async load() {
      const store = this.$store.app;
      if (!store.profile) return;
      this.loading = true;
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
      this.loading = false;
    },

    // Pagadores de uma transação (vazio = caso simples, só o responsável).
    // Usado pra desenhar o "avatar stack" quando há 2+.
    payersFor(row) {
      return this.payersByTx[row.id] || [];
    },

    get sortedRows() {
      const dir = this.ordemDesc ? -1 : 1;
      return [...this.rows].sort((a, b) => {
        const av = a[this.ordenarPor] ?? '';
        const bv = b[this.ordenarPor] ?? '';
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
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

    categoryFor(id) {
      return this.$store.app.categoryById(id);
    },
    responsavelFor(id) {
      return this.$store.app.profileById(id);
    },

    async setCategoria(row, categoriaId) {
      await updateTransaction(row.id, { categoria_id: categoriaId || null });
      await this.load();
    },
    async setResponsavel(row, responsavelId) {
      await updateTransaction(row.id, { responsavel_id: responsavelId || null });
      await this.load();
    },
    async setVencimento(row, data) {
      await updateTransaction(row.id, { data_vencimento: data || null });
      await this.load();
    },
    async setDataPagamento(row, data) {
      await updateTransaction(row.id, { data_pagamento: data || null });
      await this.load();
    },
    async togglePago(row) {
      if (row._status === 'pago') {
        await markAsUnpaid(row.id);
      } else {
        const paga = await markAsPaid(row.id);
        await this.avisarPagamento(paga);
      }
      await this.load();
    },

    // Avisa os outros membros do grupo que essa despesa foi paga (ver
    // services/notifications.js::notifyPayment). Só faz sentido quando há
    // grupo com mais de uma pessoa.
    async avisarPagamento(transacaoPaga) {
      const store = this.$store.app;
      const memberIds = (store.group?.members || []).map((m) => m.id);
      if (memberIds.length < 2) return;
      await notifyPayment({ transaction: transacaoPaga, payerProfileId: store.profile.id, memberIds });
      store.refreshNotifications();
    },
    async toggleTipoDespesa(row) {
      await updateTransaction(row.id, { tipo_despesa: row.tipo_despesa === 'fixa' ? 'variavel' : 'fixa' });
      await this.load();
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

    exportar() {
      const dados = this.sortedRows.map((r) => ({
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
