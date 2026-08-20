import * as cx from '../services/caixinhas.js';
import { taxaParaBRL } from '../services/fx.js';
import { MOEDAS_SUPORTADAS, formatMoeda, moedaInfo } from '../utils/format.js';

const MOV_FORM_VAZIA = () => ({ tipo: 'guardado', valor: '', data: new Date().toISOString().slice(0, 10), observacoes: '' });

// Tela "Caixinhas": dinheiro guardado em bancos/corretoras. Mesma navegação
// em 2 passos de Recursos (grade de bancos -> dentro de um, histórico +
// métricas), mas sem subcategoria (não fazia sentido aqui) — ver
// js/services/caixinhas.js pro porquê de guardado/retirado/saldo serem
// sempre calculados a partir do histórico, nunca colunas próprias.
export function caixinhasView() {
  return {
    loading: true,
    caixinhas: [],
    movByCaixinha: {}, // { [caixinha_id]: linhas[], mais recente primeiro }
    activeId: null, // null = grade de bancos
    filtroResponsavel: '', // '' = todos os membros

    // Cotação BRL de cada moeda estrangeira em uso, buscada uma vez por
    // moeda (não por caixinha) depois de carregar — ver services/fx.js.
    // null enquanto não carregou ou se a busca falhar (sem cotação, some
    // do card em vez de mostrar um erro).
    taxasPorMoeda: {},
    moedasSuportadas: MOEDAS_SUPORTADAS,

    movModalAberto: false,
    movForm: MOV_FORM_VAZIA(),
    salvandoMov: false,

    init() {
      this.carregarCaixinhas();
      // Gerenciar (criar/editar/excluir) também é possível direto de
      // "Perfil → Caixinhas" agora (ver js/components/caixinhaManager.js) —
      // sem isso, mudanças feitas por lá só apareceriam aqui num reload.
      window.addEventListener('cg:caixinhas-changed', () => this.carregarCaixinhas());
    },

    async carregarCaixinhas() {
      const store = this.$store.app;
      if (!store.profile) return;
      this.loading = true;
      try {
        const groupId = store.group?.group?.id;
        this.caixinhas = await cx.listCaixinhas({ ownerId: store.profile.id, groupId });
        const map = await cx.listMovimentacoesFor(this.caixinhas.map((c) => c.id));
        this.movByCaixinha = Object.fromEntries(map);
        this.carregarTaxas();
        // Se a caixinha aberta foi excluída por "Perfil → Caixinhas"
        // enquanto essa tela estava montada, volta pra grade em vez de
        // ficar num detalhe de algo que não existe mais.
        if (this.activeId && !this.caixinhas.some((c) => c.id === this.activeId)) this.activeId = null;
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar as caixinhas.', 'danger');
      } finally {
        this.loading = false;
      }
    },

    // Uma busca por moeda estrangeira distinta em uso (não por caixinha) —
    // best-effort, nunca bloqueia nem avisa erro, é só um detalhe a mais.
    async carregarTaxas() {
      const moedas = [...new Set(this.caixinhas.map((c) => c.moeda).filter((m) => m && m !== 'BRL'))];
      for (const m of moedas) {
        taxaParaBRL(m).then((taxa) => {
          if (taxa) this.taxasPorMoeda[m] = taxa;
        });
      }
    },

    movFor(id) {
      return this.movByCaixinha[id] || [];
    },
    totaisFor(id) {
      return cx.computeTotais(this.movFor(id));
    },
    progressoFor(c) {
      return cx.computeProgresso(this.totaisFor(c.id).saldo, c.meta);
    },
    formatMoeda(valor, moeda) {
      return formatMoeda(valor, moeda);
    },
    // Saldo convertido pra BRL, formatado, ou null se a moeda já é BRL ou a
    // cotação ainda não chegou/falhou — o template só mostra a linha
    // discreta de conversão quando isso não é null.
    conversaoBRLFor(caixinha) {
      if (!caixinha.moeda || caixinha.moeda === 'BRL') return null;
      const taxa = this.taxasPorMoeda[caixinha.moeda];
      if (!taxa) return null;
      const saldo = this.totaisFor(caixinha.id).saldo;
      return `≈ R$ ${(saldo * taxa).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },
    cotacaoLabel(moeda) {
      const taxa = this.taxasPorMoeda[moeda];
      if (!taxa) return '';
      const simbolo = moedaInfo(moeda).simbolo;
      return `${simbolo} 1 ≈ R$ ${taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    },

    get caixinhaAtiva() {
      return this.caixinhas.find((c) => c.id === this.activeId) || null;
    },

    selecionar(id) {
      this.activeId = id;
    },
    voltar() {
      this.activeId = null;
    },

    // ---------- Filtro por responsável (grade) ----------
    // Membros que efetivamente têm alguma caixinha — não faz sentido
    // oferecer um filtro pra alguém sem nenhuma.
    get responsaveisComCaixinha() {
      const store = this.$store.app;
      if (!store.profile) return [];
      const membros = [store.profile, ...(store.group?.members || []).filter((m) => m.id !== store.profile.id)];
      return membros.filter((m) => this.caixinhas.some((c) => c.owner_id === m.id));
    },
    get caixinhasFiltradas() {
      if (!this.filtroResponsavel) return this.caixinhas;
      return this.caixinhas.filter((c) => c.owner_id === this.filtroResponsavel);
    },

    // ---------- Totalizadores: soma dos bancos + soma por responsável ----------
    // Ambos somam TUDO em BRL — caixinha em BRL entra direto, caixinha
    // estrangeira entra já convertida (taxasPorMoeda) assim que a cotação
    // carrega; enquanto não carrega, fica de fora só daquele total
    // temporariamente (nunca soma um valor sem cotação de verdade por trás
    // — ver comentário em cx.somaSaldos). "Quanto eu tenho no total" precisa
    // somar tudo, não ignorar o que está guardado em outra moeda.
    get somaGeral() {
      return cx.somaSaldos(this.caixinhas, this.movByCaixinha, this.taxasPorMoeda);
    },
    // Cada linha: o membro + o quanto ele tem guardado, em BRL, somando
    // todas as caixinhas dele (BRL direto + estrangeira convertida) — cobre
    // "quanto o responsável tem individual e somado com os membros do
    // grupo" (a soma do grupo inteiro é somaGeral acima).
    get porResponsavel() {
      return this.responsaveisComCaixinha.map((m) => ({
        membro: m,
        saldo: cx.somaSaldos(
          this.caixinhas.filter((c) => c.owner_id === m.id),
          this.movByCaixinha,
          this.taxasPorMoeda
        ),
      }));
    },

    // Criar/editar/excluir caixinha agora é tudo no Alpine.store('caixinhaModal')
    // (js/components/caixinhaManager.js) — mesmo modal usado por "Perfil →
    // Caixinhas", aberto daqui também (FAB e lápis no card). Essa tela só
    // dispara $store.caixinhaModal.openManage()/openEdit(c) e escuta
    // 'cg:caixinhas-changed' (init() acima) pra recarregar depois.
    bankFor(bancoNome) {
      return this.$store.app.bankByName(bancoNome);
    },

    // ---------- Movimentações (aportes/retiradas) ----------
    abrirMovimentacao(tipo) {
      this.movForm = { ...MOV_FORM_VAZIA(), tipo };
      this.movModalAberto = true;
    },
    fecharMovModal() {
      this.movModalAberto = false;
    },
    async salvarMovimentacao() {
      if (!this.movForm.valor || Number(this.movForm.valor) <= 0 || this.salvandoMov) return;
      const store = this.$store.app;
      this.salvandoMov = true;
      try {
        const nova = await cx.createMovimentacao({
          caixinhaId: this.activeId,
          tipo: this.movForm.tipo,
          valor: this.movForm.valor,
          data: this.movForm.data,
          observacoes: this.movForm.observacoes.trim() || null,
        });
        this.movByCaixinha[this.activeId] = [nova, ...this.movFor(this.activeId)];
        this.movModalAberto = false;
        store.notify(this.movForm.tipo === 'guardado' ? 'Aporte registrado.' : 'Retirada registrada.');
      } catch (e) {
        store.notify(e.message || 'Não foi possível registrar a movimentação.', 'danger');
      } finally {
        this.salvandoMov = false;
      }
    },
    // Exclusão frequente/baixo dano (docs/BONOTTO-2027-BLUEPRINT.md,
    // Conflito 3) — sem confirm(), com "Desfazer" no lugar: a linha some da
    // UI na hora (otimista), e só é removida do banco de verdade alguns
    // segundos depois, se ninguém desfizer.
    async removerMovimentacao(mov) {
      const activeId = this.activeId;
      this.movByCaixinha[activeId] = this.movFor(activeId).filter((m) => m.id !== mov.id);
      this.$store.app.notifyUndo(
        'Movimentação removida.',
        () => cx.deleteMovimentacao(mov.id),
        () => { this.movByCaixinha[activeId] = [mov, ...this.movFor(activeId).filter((m) => m.id !== mov.id)]; }
      );
    },

    responsavelFor(id) {
      return this.$store.app.profileById(id);
    },
  };
}
