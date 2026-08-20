import { listTransactions, computeSummary, groupByCategory, groupByCompany, groupByMember, groupByPeriod, listPayersFor, shareForMember } from '../services/transactions.js';
import { listAllItems as listAllResourceItems } from '../services/resources.js';
import { listBudgets, computeBudgetProgress } from '../services/budgets.js';
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

function pad2(n) {
  return String(n).padStart(2, '0');
}
function isoYMD(ano, mes1a12, dia) {
  return `${ano}-${pad2(mes1a12)}-${pad2(dia)}`;
}
function ultimoDiaDoMes(ano, mes1a12) {
  return new Date(ano, mes1a12, 0).getDate();
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
    // Resumo em destaque, comparativo e gráficos agora respeitam um período
    // (2026-08-20) — antes eram sempre "desde o início dos tempos", o que
    // dava um saldo/soma acumulados difíceis de interpretar (e explicava
    // parte da suspeita de "saldo negativo" — não era a divisão de despesa,
    // era não ter nenhum corte de período). "Contas a vencer"/Recursos
    // continuam sempre olhando o estado atual, sem período — não fazem
    // sentido escopados (uma conta vencida é vencida agora, não "no mês x").
    periodoModo: 'mes_atual', // mes_atual|mes_anterior|proximo_mes|ano_atual|ano_anterior|personalizado|tudo
    periodoInicio: '',
    periodoFim: '',
    // 3 gráficos independentes, cada um com sua própria quebra — trocável a
    // qualquer momento, cada escolha fica salva (por navegador) pra próxima
    // visita. Cada valor: 'categoria' | 'empresa' | 'fluxo' | 'dia' | 'mes' | 'ano'.
    quebras: quebrasIniciais(),
    contasAVencer: [],
    recentes: [],
    recursosAllItems: [],
    recursosSugestoesAbertas: false,
    budgets: [], // orçamentos pessoais (sempre owner_id, nunca de grupo — ver services/budgets.js)

    init() {
      this.load();
      window.addEventListener('cg:transactions-changed', () => this.load());
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

    // silent=true (usado pelo auto-refresh de 1 min, ver setupAutoRefresh em
    // app.js) busca os mesmos dados sem mexer em "loading" — a tela troca
    // pros valores novos direto, sem piscar spinner nenhum no meio.
    async load(silent = false) {
      const store = this.$store.app;
      if (!store.profile) return;
      if (!silent) this.loading = true;

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
        await this.carregarRecursosSugestoes();
      } catch (e) {
        if (!silent) store.notify(e.message || 'Não consegui carregar o painel.', 'danger');
      }

      // Best-effort (padrão §14.4 do RAIO-X): orçamento é só um complemento
      // discreto no card de saldo (ver orcamentoAlerta) — uma falha aqui
      // nunca pode derrubar o resto do painel.
      try {
        this.budgets = await listBudgets(store.profile.id);
      } catch {
        this.budgets = [];
      }

      if (!silent) this.loading = false;
    },

    // "Quanto ainda posso gastar" (docs/BONOTTO-2027-BLUEPRINT.md, Conflito 2)
    // — só pra "Eu" (orçamento é sempre pessoal, nunca faz sentido pra
    // Grupo/outro membro) e só quando alguma categoria já está a 80%+ do
    // limite (silêncio quando não há nada a decidir, "antecipar sem
    // invadir" — princípio do prompt master §60). Sempre olha o MÊS ATUAL de
    // verdade (computeBudgetProgress), independente do periodoModo
    // selecionado — orçamento é sempre "este mês", nunca "mês anterior".
    get orcamentoAlerta() {
      if (this.quemVer !== 'eu' || !this.budgets.length) return null;
      const store = this.$store.app;
      const minhas = this.escopo.filter((t) => t.responsavel_id === store.profile?.id);
      const progresso = computeBudgetProgress(minhas, this.budgets, store.categories);
      const critico = progresso.find((p) => p.limite > 0 && p.percentual >= 80);
      if (!critico) return null;
      return {
        categoriaNome: critico.categoria?.nome || 'categoria',
        percentual: critico.percentual,
        restante: Math.max(0, critico.limite - critico.gasto),
        estourado: critico.percentual >= 100,
      };
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

    // Início/fim (ISO, inclusive) do período selecionado — null/null = sem
    // corte nenhum ("Tudo"). Construído por soma de inteiros de calendário
    // (nunca Date+toISOString) pra nunca correr risco de fuso horário
    // empurrar a data um dia pra trás/frente.
    get periodoRange() {
      const hojeStr = todayIso();
      const ano = Number(hojeStr.slice(0, 4));
      const mes = Number(hojeStr.slice(5, 7));
      if (this.periodoModo === 'tudo') return { inicio: null, fim: null };
      if (this.periodoModo === 'personalizado') return { inicio: this.periodoInicio || null, fim: this.periodoFim || null };
      if (this.periodoModo === 'ano_atual') return { inicio: isoYMD(ano, 1, 1), fim: isoYMD(ano, 12, 31) };
      if (this.periodoModo === 'ano_anterior') return { inicio: isoYMD(ano - 1, 1, 1), fim: isoYMD(ano - 1, 12, 31) };
      let alvoAno = ano;
      let alvoMes = mes;
      if (this.periodoModo === 'mes_anterior') {
        alvoMes -= 1;
        if (alvoMes < 1) {
          alvoMes = 12;
          alvoAno -= 1;
        }
      } else if (this.periodoModo === 'proximo_mes') {
        alvoMes += 1;
        if (alvoMes > 12) {
          alvoMes = 1;
          alvoAno += 1;
        }
      }
      return { inicio: isoYMD(alvoAno, alvoMes, 1), fim: isoYMD(alvoAno, alvoMes, ultimoDiaDoMes(alvoAno, alvoMes)) };
    },

    get periodoLabel() {
      const nomes = {
        mes_atual: 'Este mês',
        mes_anterior: 'Mês anterior',
        proximo_mes: 'Próximo mês',
        ano_atual: 'Este ano',
        ano_anterior: 'Ano anterior',
        tudo: 'Todo o período',
        personalizado: 'Período personalizado',
      };
      return nomes[this.periodoModo] || '';
    },

    // Escopo (saldo/comparativo/gráficos) restrito ao período selecionado —
    // "Contas a vencer"/Recursos usam this.escopo direto, sem esse filtro
    // (ver comentário em periodoModo acima).
    get escopoFiltrado() {
      const { inicio, fim } = this.periodoRange;
      if (!inicio && !fim) return this.escopo;
      return this.escopo.filter((t) => {
        const data = t.data_cadastro;
        if (!data) return false;
        if (inicio && data < inicio) return false;
        if (fim && data > fim) return false;
        return true;
      });
    },

    // Resumo pessoal de um membro específico: entrada é sempre 100% de quem
    // é o responsavel_id dela (entrada não é dividida — só despesa); saída
    // usa a fatia calculada por shareFor, que cai pra responsavel_id sozinho
    // quando a despesa não tem divisão.
    // entradas/saidas: só o que já foi PAGO (data_pagamento preenchida) —
    // "quanto eu realmente tenho". entradasPrevistas/saidasPrevistas: tudo,
    // pago ou não — "quanto deve entrar/sair no total". Mesma distinção de
    // computeSummary em services/transactions.js (usado pra "grupo"); esta
    // aqui é a versão por pessoa (entrada não é dividida, saída usa a
    // fatia de shareFor).
    resumoPara(profileId) {
      let entradas = 0;
      let saidas = 0;
      let entradasPrevistas = 0;
      let saidasPrevistas = 0;
      let maiorGasto = null;
      for (const t of this.escopoFiltrado) {
        const pago = !!t.data_pagamento;
        if (t.tipo === 'entrada') {
          if (t.responsavel_id === profileId) {
            const valor = Number(t.valor) || 0;
            entradasPrevistas += valor;
            if (pago) entradas += valor;
          }
          continue;
        }
        const fatia = this.shareFor(t, profileId);
        if (fatia <= 0) continue;
        saidasPrevistas += fatia;
        if (pago) saidas += fatia;
        if (!maiorGasto || fatia > maiorGasto.valor) maiorGasto = { ...t, valor: fatia };
      }
      return {
        entradas,
        saidas,
        saldo: entradas - saidas,
        entradasPrevistas,
        saidasPrevistas,
        saldoPrevisto: entradasPrevistas - saidasPrevistas,
        maiorGasto,
      };
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
      if (this.quemVer === 'grupo') return computeSummary(this.escopoFiltrado);
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
      if (this.quemVer === 'grupo') return this.escopoFiltrado;
      const id = this.idQuemVer;
      return this.escopoFiltrado
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
      // Por membro sempre olha o grupo inteiro (não a fatia de quemVer) —
      // é exatamente o gráfico que responde "quem gastou quanto", então
      // escopar por membro selecionado não faria sentido aqui. Usa o
      // escopo cru (não linhasQuebra, que já vem achatado pra UM membro).
      if (tipo === 'membro') {
        const membros = store.group?.members || [];
        return groupByMember(this.escopoFiltrado, membros, this.payersByTx);
      }
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
