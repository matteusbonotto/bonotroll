import * as cx from '../services/caixinhas.js';
import { taxaParaBRL } from '../services/fx.js';
import { MOEDAS_SUPORTADAS, formatMoeda } from '../utils/format.js';

const CAIXINHA_FORM_VAZIA = () => ({ id: null, banco_nome: '', moeda: 'BRL', meta: '', icone: 'bi-piggy-bank', responsavel_id: '' });
const ICONE_CAIXINHA_VAZIO = () => ({ modo: 'preset', url: '', urlInput: '', uploading: false, editingHadUrl: false });
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
    filtroResponsavel: '', // '' = todos os membros

    // Cotação BRL de cada moeda estrangeira em uso, buscada uma vez por
    // moeda (não por caixinha) depois de carregar — ver services/fx.js.
    // null enquanto não carregou ou se a busca falhar (sem cotação, some
    // do card em vez de mostrar um erro).
    taxasPorMoeda: {},
    moedasSuportadas: MOEDAS_SUPORTADAS,

    caixinhaModalAberto: false,
    caixinhaForm: CAIXINHA_FORM_VAZIA(),
    salvandoCaixinha: false,
    iconPresets: CAIXINHA_ICON_PRESETS,
    // Ícone por preset (grid de Bootstrap Icons, default) OU escolhido pela
    // própria pessoa via upload de imagem/PNG ou URL colada — mesmo par
    // upload/URL já usado no modal de Categorias (icone_url).
    iconeCaixinha: ICONE_CAIXINHA_VAZIO(),

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
        this.carregarTaxas();
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
      return `1 ${moeda} ≈ R$ ${taxa.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
    get somaGeral() {
      return cx.somaSaldos(this.caixinhas, this.movByCaixinha);
    },
    // Cada linha: o membro + o quanto ele tem guardado (soma de todas as
    // caixinhas cujo dono é ele) — cobre "quanto o responsável tem
    // individual e somado com os membros do grupo" (a soma do grupo inteiro
    // é somaGeral acima, que já soma TODAS as caixinhas visíveis). Só soma
    // caixinhas em BRL — misturar moeda estrangeira sem conversão daria um
    // número sem sentido; ver conversaoBRLFor pro valor convertido por
    // caixinha individual.
    get porResponsavel() {
      return this.responsaveisComCaixinha.map((m) => ({
        membro: m,
        saldo: cx.somaSaldos(
          this.caixinhas.filter((c) => c.owner_id === m.id && (!c.moeda || c.moeda === 'BRL')),
          this.movByCaixinha
        ),
      }));
    },

    // ---------- CRUD caixinha ----------
    abrirNovaCaixinha() {
      const store = this.$store.app;
      this.caixinhaForm = { ...CAIXINHA_FORM_VAZIA(), responsavel_id: store.profile.id };
      this.iconeCaixinha = ICONE_CAIXINHA_VAZIO();
      this.caixinhaModalAberto = true;
    },
    // event.stopPropagation() é essencial: o lápis fica dentro do tile
    // clicável (que abre a caixinha) — mesmo padrão de abrirEditarRoom em
    // resourcesView.js.
    abrirEditarCaixinha(c, event) {
      event.stopPropagation();
      this.caixinhaForm = {
        id: c.id,
        banco_nome: c.banco_nome,
        moeda: c.moeda,
        meta: c.meta || '',
        icone: c.icone || 'bi-piggy-bank',
        responsavel_id: c.owner_id,
      };
      this.iconeCaixinha = {
        modo: c.icone_url ? 'url' : 'preset',
        url: c.icone_url || '',
        urlInput: c.icone_url || '',
        uploading: false,
        editingHadUrl: !!c.icone_url,
      };
      this.caixinhaModalAberto = true;
    },
    fecharCaixinhaModal() {
      this.caixinhaModalAberto = false;
    },
    async onCaixinhaIconeFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = this.$store.app;
      this.iconeCaixinha.uploading = true;
      try {
        this.iconeCaixinha.url = await cx.uploadCaixinhaIcone(store.profile.id, file);
      } catch (e) {
        store.notify(e.message || 'Erro ao enviar imagem.', 'danger');
      } finally {
        this.iconeCaixinha.uploading = false;
        event.target.value = '';
      }
    },
    async salvarCaixinha() {
      if (!this.caixinhaForm.banco_nome.trim() || this.salvandoCaixinha) return;
      const store = this.$store.app;
      this.salvandoCaixinha = true;
      try {
        const iconeUrl = this.iconeCaixinha.modo === 'preset' ? '' : this.iconeCaixinha.url || this.iconeCaixinha.urlInput;
        const patch = {
          banco_nome: this.caixinhaForm.banco_nome.trim(),
          moeda: this.caixinhaForm.moeda || 'BRL',
          meta: this.caixinhaForm.meta ? Number(this.caixinhaForm.meta) : null,
          icone: this.caixinhaForm.icone,
        };
        // Só manda icone_url quando tem valor OU quando essa caixinha já
        // tinha um antes (precisa mandar null pra limpar) — mesmo cuidado
        // de categoryManager.js pra não quebrar edição em banco que ainda
        // não rodou a migração que adiciona essa coluna.
        if (iconeUrl || this.iconeCaixinha.editingHadUrl) patch.icone_url = iconeUrl || null;

        if (this.caixinhaForm.id) {
          // Dono pode ser trocado na edição (ex.: cadastrou como Matheus e
          // era pra ser da Beatriz) — reaponta owner_id junto do resto.
          patch.owner_id = this.caixinhaForm.responsavel_id || store.profile.id;
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
            iconeUrl,
            ownerId: this.caixinhaForm.responsavel_id || store.profile.id,
            groupId: store.group?.group?.id,
          });
          this.caixinhas.push(criada);
          this.movByCaixinha[criada.id] = [];
          store.notify('Caixinha criada.');
        }
        this.caixinhaModalAberto = false;
        this.carregarTaxas();
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
