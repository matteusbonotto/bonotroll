import { listTransactions, updateTransaction, markAsPaid, markAsUnpaid } from '../services/transactions.js';
import { STATUS_META } from '../utils/status.js';
import { exportToCsv } from '../services/csvImport.js';

// Tela "Transações": tabela com filtros, edição inline (categoria/responsável/pago)
// e exportação/importação de CSV.
export function transactionsView() {
  return {
    rows: [],
    loading: true,
    filtro: { tipo: '', categoriaId: '', responsavelId: '', status: '', tipoDespesa: '', busca: '' },
    ordenarPor: 'data_cadastro',
    ordemDesc: true,
    STATUS_META,

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
        },
      });
      this.loading = false;
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
      this.filtro = { tipo: '', categoriaId: '', responsavelId: '', status: '', tipoDespesa: '', busca: '' };
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
    async togglePago(row) {
      if (row._status === 'pago') await markAsUnpaid(row.id);
      else await markAsPaid(row.id);
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
      exportToCsv(dados, 'casagrana-transacoes.csv');
    },
  };
}
