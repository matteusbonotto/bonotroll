import { listTransactions, computeSummary, groupByCategory, groupByCompany, groupByPeriod, listPayersFor, shareForMember } from '../services/transactions.js';
import { listBudgets, computeBudgetProgress } from '../services/budgets.js';
import { listAllItems as listAllResourceItems } from '../services/resources.js';
import { computeExpiryStatus, expiryStatusMeta } from '../utils/status.js';
import { todayIso } from '../utils/format.js';

const QUEBRAS_STORAGE_KEY = 'bonotto_dashboard_quebras';
function quebrasIniciais() {
  try {
    const salvas = JSON.parse(localStorage.getItem(QUEBRAS_STORAGE_KEY));
    if (Array.isArray(salvas) && salvas.length === 3) return salvas;
  } catch {
    // localStorage corrompido/vazio — cai pro default abaixo
  }
  return ['categoria', 'mes', 'fluxo'];
}

function diasAte(isoData) {
  const a = new Date(`${isoData}T00:00:00Z`).getTime();
  const b = new Date(`${todayIso()}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86400000);
}

// Home: saldo em destaque + "Contas a vencer" (o que precisa de atenção
// agora) antes do log de lançamentos — pago não compete por atenção com o
// que está vencido/vencendo, então fica de fora dessa lista.
//
// "quemVer" controla o resumo em destaque (Eu / cada membro do grupo /
// Grupo) e também escopa o gráfico de quebra — troca só o card e o
// gráfico, o restante da tela (contas a vencer, recentes) continua sempre
// no nível "eu ou grupo" que já existia.
export function dashboardView() {
  return {
    loading: true,
    escopo: [], // todas as transações visíveis (próprias + do grupo), com _status
    payersByTx: {},
    quemVer: 'eu', // 'eu' | <profile_id> | 'grupo'
    // 3 gráficos independentes, cada um com sua própria quebra — trocável a
    // qualquer momento, cada escolha fica salva (por navegador) pra próxima
    // visita. Cada valor: 'categoria' | 'empresa' | 'fluxo' | 'dia' | 'mes' | 'ano'.
    quebras: quebrasIniciais(),
    contasAVencer: [],
    recentes: [],
    budgets: [],
    recursosAllItems: [],
    recursosSugestoesAbertas: false,

    init() {
      this.load();
      window.addEventListener('cg:transactions-changed', () => this.load());
      window.addEventListener('cg:budgets-changed', () => this.carregarOrcamentos());
      window.addEventListener('cg:recursos-changed', () => this.carregarRecursosSugestoes());
      this.$watch('$store.app.group', () => this.load());
      this.$watch('quebras', (v) => localStorage.setItem(QUEBRAS_STORAGE_KEY, JSON.stringify(v)));
    },

    async carregarRecursosSugestoes() {
      const store = this.$store.app;
      try {
        this.recursosAllItems = await listAllResourceItems({ ownerId: store.profile.id, groupId: store.group?.group?.id });
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar as sugestões de Recursos.', 'danger');
      }
    },

    get recursosSugestoes() {
      return this.recursosAllItems
        .map((item) => ({ item, status: computeExpiryStatus(item) }))
        .filter(({ status }) => status !== 'ok')
        .sort((a, b) => (a.status === 'em_falta' ? -1 : 1) - (b.status === 'em_falta' ? -1 : 1));
    },
    recursosExpiryMeta(item) {
      return expiryStatusMeta(computeExpiryStatus(item));
    },

    async carregarOrcamentos() {
      const store = this.$store.app;
      if (!store.profile) return;
      try {
        this.budgets = await listBudgets(store.profile.id);
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar os orçamentos.', 'danger');
      }
    },

    async load() {
      const store = this.$store.app;
      if (!store.profile) return;
      this.loading = true;

      try {
        const groupId = store.group?.group?.id;
        this.escopo = await listTransactions({ ownerId: store.profile.id, groupId });
        const payersMap = await listPayersFor(this.escopo.map((t) => t.id));
        this.payersByTx = Object.fromEntries(payersMap);

        this.contasAVencer = this.escopo
          .filter((t) => this.participaEu(t) && t.tipo === 'saida' && (t._status === 'vencido' || t._status === 'a_vencer'))
          .sort((a, b) => (a.data_vencimento || '').localeCompare(b.data_vencimento || ''))
          .slice(0, 5);

        this.recentes = groupId ? this.escopo.slice(0, 6) : this.escopo.filter((t) => this.participaEu(t)).slice(0, 6);
        await this.carregarOrcamentos();
        await this.carregarRecursosSugestoes();
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar o painel.', 'danger');
      }

      this.loading = false;
    },

    // Pagadores de uma transação (vazio = caso simples, só o responsável).
    payersFor(t) {
      return this.payersByTx[t.id] || [];
    },

    // Quanto do valor de "t" cabe a profileId — despesa dividida usa a
    // fatia de cada um; sem divisão, cai pro responsavel_id sozinho.
    shareFor(t, profileId) {
      return shareForMember(t, this.payersFor(t), profileId);
    },

    participaEu(t) {
      const meuId = this.$store.app.profile?.id;
      const payers = this.payersFor(t);
      return payers.length ? payers.some((p) => p.profile_id === meuId) : t.responsavel_id === meuId;
    },

    // Resumo pessoal de um membro específico: entrada é sempre 100% de quem
    // é o responsavel_id dela (entrada não é dividida — só despesa); saída
    // usa a fatia calculada por shareFor, que cai pra responsavel_id sozinho
    // quando a despesa não tem divisão.
    resumoPara(profileId) {
      let entradas = 0;
      let saidas = 0;
      let maiorGasto = null;
      for (const t of this.escopo) {
        if (t.tipo === 'entrada') {
          if (t.responsavel_id === profileId) entradas += Number(t.valor) || 0;
          continue;
        }
        const fatia = this.shareFor(t, profileId);
        if (fatia <= 0) continue;
        saidas += fatia;
        if (!maiorGasto || fatia > maiorGasto.valor) maiorGasto = { ...t, valor: fatia };
      }
      return { entradas, saidas, saldo: entradas - saidas, maiorGasto };
    },

    get idQuemVer() {
      if (this.quemVer === 'eu') return this.$store.app.profile?.id;
      if (this.quemVer === 'grupo') return null;
      return this.quemVer;
    },

    get opcoesQuemVer() {
      const store = this.$store.app;
      if (!store.profile) return [];
      const opcoes = [{ id: 'eu', nome: 'Eu', cor: store.profile.cor, avatar_url: store.profile.avatar_url }];
      for (const m of store.group?.members || []) {
        if (m.id === store.profile.id) continue;
        opcoes.push({ id: m.id, nome: m.nome, cor: m.cor, avatar_url: m.avatar_url });
      }
      if (store.group) opcoes.push({ id: 'grupo', nome: 'Grupo', cor: null, avatar_url: null });
      return opcoes;
    },

    get resumoSelecionado() {
      if (this.quemVer === 'grupo') return computeSummary(this.escopo);
      return this.resumoPara(this.idQuemVer);
    },

    // ---------- Comparativo com o mês anterior (saídas) ----------
    // "Saldo"/"Entradas"/"Saídas" do hero são desde sempre (saldo
    // acumulado) — esse comparativo é só das saídas DENTRO de cada mês,
    // pra responder "gastei mais ou menos que mês passado" (métrica
    // acionável que o saldo acumulado sozinho não responde).
    saidasNoMes(profileId, mesStr) {
      let total = 0;
      for (const t of this.escopo) {
        if (t.tipo !== 'saida' || (t.data_cadastro || '').slice(0, 7) !== mesStr) continue;
        total += profileId ? this.shareFor(t, profileId) : Number(t.valor) || 0;
      }
      return total;
    },

    get comparativoMesAnterior() {
      const hoje = new Date();
      const mesAtual = hoje.toISOString().slice(0, 7);
      const anterior = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth() - 1, 1));
      const mesAnterior = anterior.toISOString().slice(0, 7);
      const id = this.quemVer === 'grupo' ? null : this.idQuemVer;
      const atual = this.saidasNoMes(id, mesAtual);
      const passado = this.saidasNoMes(id, mesAnterior);
      // Sem gasto no mês anterior pra comparar (conta nova, ou mês parado)
      // — não dá pra calcular variação percentual de uma base zero.
      const percentual = passado > 0 ? Math.round(((atual - passado) / passado) * 100) : null;
      return { atual, passado, percentual };
    },

    get corSelecionada() {
      return this.opcoesQuemVer.find((o) => o.id === this.quemVer)?.cor || null;
    },

    // Linhas de saída "achatadas" pra fatia do escopo selecionado (Eu/membro),
    // usadas pelas quebras (categoria/empresa/período) — o grupo usa o
    // valor cheio de cada despesa, sem achatar por fatia.
    get linhasQuebra() {
      if (this.quemVer === 'grupo') return this.escopo;
      const id = this.idQuemVer;
      return this.escopo
        .filter((t) => t.tipo === 'saida')
        .map((t) => ({ ...t, valor: this.shareFor(t, id) }))
        .filter((t) => t.valor > 0);
    },

    // Antes era um getter único (this.quebra); agora cada um dos 3 gráficos
    // passa a própria quebra (quebras[i]) como parâmetro, então precisa ser
    // método, não getter — um getter só "this.quebra" não dava pra
    // parametrizar por gráfico.
    dadosParaQuebra(tipo) {
      const rows = this.linhasQuebra;
      const store = this.$store.app;
      if (tipo === 'categoria') return groupByCategory(rows, store.categories);
      if (tipo === 'empresa') return groupByCompany(rows);
      // fluxo (Entrada x Saída) precisa dos dois lados — linhasQuebra é
      // saída-only (feito pra categoria/empresa/período, que são conceitos
      // só-de-gasto), então usar ela aqui zerava entradas sempre. resumoSelecionado
      // já calcula entradas/saídas corretas pra Eu/membro/grupo (mesma fonte
      // do card de saldo), então reaproveita em vez de recalcular.
      if (tipo === 'fluxo') {
        const resumo = this.resumoSelecionado;
        return [
          { nome: 'Entradas', total: resumo.entradas, cor: '#16A34A' },
          { nome: 'Saídas', total: resumo.saidas, cor: '#DC2626' },
        ];
      }
      return groupByPeriod(rows, tipo); // 'dia' | 'mes' | 'ano'
    },

    tipoGraficoPara(tipo) {
      return tipo === 'dia' || tipo === 'mes' || tipo === 'ano' ? 'bar' : 'doughnut';
    },

    // ---------- Orçamentos ----------
    // Sempre a fatia de QUEM ESTÁ LOGADO (não do "quemVer" selecionado no
    // topo) — orçamento é pessoal, então "ver o orçamento do Beatriz" nunca
    // faz sentido pro Matheus, independente de qual card ele escolheu ver.
    get linhasParaOrcamento() {
      const meuId = this.$store.app.profile?.id;
      return this.escopo
        .filter((t) => t.tipo === 'saida')
        .map((t) => ({ ...t, valor: this.shareFor(t, meuId) }))
        .filter((t) => t.valor > 0);
    },

    get budgetProgress() {
      return computeBudgetProgress(this.linhasParaOrcamento, this.budgets, this.$store.app.categories);
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
