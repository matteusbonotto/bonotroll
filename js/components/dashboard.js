import { listTransactions, computeSummary, groupByCategory } from '../services/transactions.js';

// Home: resumo pessoal (sempre) + resumo do grupo (se houver grupo, é a soma dos membros).
export function dashboardView() {
  return {
    loading: true,
    personal: { entradas: 0, saidas: 0, saldo: 0, maiorGasto: null },
    grupo: { entradas: 0, saidas: 0, saldo: 0, maiorGasto: null },
    recentes: [],
    categoriaResumo: [],

    init() {
      this.load();
      window.addEventListener('cg:transactions-changed', () => this.load());
      this.$watch('$store.app.group', () => this.load());
    },

    async load() {
      const store = this.$store.app;
      if (!store.profile) return;
      this.loading = true;

      const groupId = store.group?.group?.id;
      const escopo = await listTransactions({ ownerId: store.profile.id, groupId });
      const minhas = escopo.filter((t) => t.responsavel_id === store.profile.id);

      this.personal = computeSummary(minhas);

      if (groupId) {
        this.grupo = computeSummary(escopo);
        this.categoriaResumo = groupByCategory(escopo, store.categories);
        this.recentes = escopo.slice(0, 6);
      } else {
        this.grupo = { entradas: 0, saidas: 0, saldo: 0, maiorGasto: null };
        this.categoriaResumo = groupByCategory(minhas, store.categories);
        this.recentes = minhas.slice(0, 6);
      }

      this.loading = false;
    },

    categoryFor(id) {
      return this.$store.app.categoryById(id);
    },
    responsavelFor(id) {
      return this.$store.app.profileById(id);
    },
  };
}
