import * as cx from '../services/caixinhas.js';

const CAIXINHA_FORM_VAZIA = () => ({ id: null, banco_nome: '', moeda: 'BRL', meta: '', icone: 'bi-piggy-bank' });
const MOV_FORM_VAZIA = () => ({ tipo: 'guardado', valor: '', data: new Date().toISOString().slice(0, 10), observacoes: '' });

export const CAIXINHA_ICON_PRESETS = ['bi-piggy-bank', 'bi-bank', 'bi-bank2', 'bi-wallet2', 'bi-graph-up-arrow', 'bi-cash-stack', 'bi-credit-card', 'bi-coin'];

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

    caixinhaModalAberto: false,
    caixinhaForm: CAIXINHA_FORM_VAZIA(),
    salvandoCaixinha: false,
    iconPresets: CAIXINHA_ICON_PRESETS,

    movModalAberto: false,
    movForm: MOV_FORM_VAZIA(),
    salvandoMov: false,

    async init() {
      const store = this.$store.app;
      if (!store.profile) return;
      this.loading = true;
      try {
        const groupId = store.group?.group?.id;
        this.caixinhas = await cx.listCaixinhas({ ownerId: store.profile.id, groupId });
        const map = await cx.listMovimentacoesFor(this.caixinhas.map((c) => c.id));
        this.movByCaixinha = Object.fromEntries(map);
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar as caixinhas.', 'danger');
      } finally {
        this.loading = false;
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

    get caixinhaAtiva() {
      return this.caixinhas.find((c) => c.id === this.activeId) || null;
    },

    selecionar(id) {
      this.activeId = id;
    },
    voltar() {
      this.activeId = null;
    },

    // ---------- Totalizadores: soma dos bancos + soma por responsável ----------
    get somaGeral() {
      return cx.somaSaldos(this.caixinhas, this.movByCaixinha);
    },
    // Cada linha: o membro + o quanto ele tem guardado (soma de todas as
    // caixinhas cujo dono é ele) — cobre "quanto o responsável tem
    // individual e somado com os membros do grupo" (a soma do grupo inteiro
    // é somaGeral acima, que já soma TODAS as caixinhas visíveis).
    get porResponsavel() {
      const store = this.$store.app;
      if (!store.profile) return [];
      const membros = [store.profile, ...(store.group?.members || []).filter((m) => m.id !== store.profile.id)];
      return membros
        .map((m) => ({ membro: m, saldo: cx.somaSaldos(this.caixinhas.filter((c) => c.owner_id === m.id), this.movByCaixinha) }))
        .filter((r) => this.caixinhas.some((c) => c.owner_id === r.membro.id));
    },

    // ---------- CRUD caixinha ----------
    abrirNovaCaixinha() {
      this.caixinhaForm = CAIXINHA_FORM_VAZIA();
      this.caixinhaModalAberto = true;
    },
    // event.stopPropagation() é essencial: o lápis fica dentro do tile
    // clicável (que abre a caixinha) — mesmo padrão de abrirEditarRoom em
    // resourcesView.js.
    abrirEditarCaixinha(c, event) {
      event.stopPropagation();
      this.caixinhaForm = { id: c.id, banco_nome: c.banco_nome, moeda: c.moeda, meta: c.meta || '', icone: c.icone || 'bi-piggy-bank' };
      this.caixinhaModalAberto = true;
    },
    fecharCaixinhaModal() {
      this.caixinhaModalAberto = false;
    },
    async salvarCaixinha() {
      if (!this.caixinhaForm.banco_nome.trim() || this.salvandoCaixinha) return;
      const store = this.$store.app;
      this.salvandoCaixinha = true;
      try {
        const patch = {
          banco_nome: this.caixinhaForm.banco_nome.trim(),
          moeda: (this.caixinhaForm.moeda || 'BRL').trim().toUpperCase() || 'BRL',
          meta: this.caixinhaForm.meta ? Number(this.caixinhaForm.meta) : null,
          icone: this.caixinhaForm.icone,
        };
        if (this.caixinhaForm.id) {
          const atualizada = await cx.updateCaixinha(this.caixinhaForm.id, patch);
          const idx = this.caixinhas.findIndex((c) => c.id === atualizada.id);
          if (idx >= 0) this.caixinhas[idx] = atualizada;
          store.notify('Caixinha atualizada.');
        } else {
          const criada = await cx.createCaixinha({
            bancoNome: patch.banco_nome,
            moeda: patch.moeda,
            meta: patch.meta,
            icone: patch.icone,
            ownerId: store.profile.id,
            groupId: store.group?.group?.id,
          });
          this.caixinhas.push(criada);
          this.movByCaixinha[criada.id] = [];
          store.notify('Caixinha criada.');
        }
        this.caixinhaModalAberto = false;
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar a caixinha.', 'danger');
      } finally {
        this.salvandoCaixinha = false;
      }
    },
    async excluirCaixinha() {
      if (!this.caixinhaForm.id) return;
      if (!confirm(`Excluir a caixinha "${this.caixinhaForm.banco_nome}"? O histórico de movimentações dela também será excluído — essa ação não pode ser desfeita.`)) return;
      const store = this.$store.app;
      try {
        await cx.deleteCaixinha(this.caixinhaForm.id);
        const idExcluida = this.caixinhaForm.id;
        this.caixinhas = this.caixinhas.filter((c) => c.id !== idExcluida);
        delete this.movByCaixinha[idExcluida];
        this.caixinhaModalAberto = false;
        if (this.activeId === idExcluida) this.voltar();
        store.notify('Caixinha excluída.');
      } catch (e) {
        store.notify(e.message || 'Não foi possível excluir a caixinha.', 'danger');
      }
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
    async removerMovimentacao(mov) {
      if (!confirm('Remover esta movimentação?')) return;
      const store = this.$store.app;
      try {
        await cx.deleteMovimentacao(mov.id);
        this.movByCaixinha[this.activeId] = this.movFor(this.activeId).filter((m) => m.id !== mov.id);
        store.notify('Movimentação removida.');
      } catch (e) {
        store.notify(e.message || 'Não foi possível remover.', 'danger');
      }
    },

    responsavelFor(id) {
      return this.$store.app.profileById(id);
    },
  };
}
