import { listTransactions, computeSummary, groupByCategory } from '../services/transactions.js';
import { todayIso } from '../utils/format.js';

function diasAte(isoData) {
  const a = new Date(`${isoData}T00:00:00Z`).getTime();
  const b = new Date(`${todayIso()}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86400000);
}

// Home: saldo em destaque + "Contas a vencer" (o que precisa de atenção
// agora) antes do log de lançamentos — pago não compete por atenção com o
// que está vencido/vencendo, então fica de fora dessa lista.
export function dashboardView() {
  return {
    loading: true,
    personal: { entradas: 0, saidas: 0, saldo: 0, maiorGasto: null },
    grupo: { entradas: 0, saidas: 0, saldo: 0, maiorGasto: null },
    recentes: [],
    contasAVencer: [],
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
      this.contasAVencer = minhas
        .filter((t) => t.tipo === 'saida' && (t._status === 'vencido' || t._status === 'a_vencer'))
        .sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))
        .slice(0, 5);

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

    diasLabel(t) {
      const dias = diasAte(t.data_vencimento);
      if (dias < 0) return `Venceu há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`;
      if (dias === 0) return 'Vence hoje';
      if (dias === 1) return 'Vence amanhã';
      return `Vence em ${dias} dias`;
    },

    categoryFor(id) {
      return this.$store.app.categoryById(id);
    },
    responsavelFor(id) {
      return this.$store.app.profileById(id);
    },
  };
}
