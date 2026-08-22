import * as cartoesService from '../services/cartoes.js';

// Alpine.store('cartaoModal') — gerencia SÓ o cartão de crédito (nome +
// banco vinculado), no mesmo padrão de dois modais empilhados (lista →
// formulário por cima) de bankModal/categoryModal/companyModal. Ver
// .claude/discussions/001-cartao-credito-multi-cartao.md.
//
// Duas portas de entrada:
// - openManage(): lista de cartões (Perfil → Cartões) — "+ Novo"/lápis
//   abrem o formulário POR CIMA da lista (cg-modal-backdrop--stacked).
// - openCreate(callback): direto pro formulário, sem lista (usado pelo
//   seletor de cartão no formulário de despesa, "+ Novo cartão...") — mesmo
//   papel de bankModal.openCreate ao criar banco de dentro da caixinha.
export function cartaoModalStore() {
  return {
    open: false, // lista visível
    loading: false,
    items: [],

    formOpen: false,
    editingId: null,
    nome: '',
    bancoId: '',
    saving: false,
    onCreated: null,

    resetForm() {
      this.editingId = null;
      this.nome = '';
      this.bancoId = '';
    },

    async openManage() {
      this.open = true;
      await this.carregar();
    },
    closeManage() {
      this.open = false;
      this.items = [];
    },

    openCreate(callback) {
      this.resetForm();
      this.onCreated = callback || null;
      this.formOpen = true;
    },
    edit(cartao) {
      this.editingId = cartao.id;
      this.nome = cartao.nome;
      this.bancoId = cartao.banco_id || '';
      this.onCreated = null;
      this.formOpen = true;
    },
    closeForm() {
      this.formOpen = false;
      this.onCreated = null;
      this.resetForm();
    },

    async carregar() {
      const store = Alpine.store('app');
      if (!store.profile) return;
      this.loading = true;
      try {
        this.items = await cartoesService.listCartoes({ ownerId: store.profile.id, groupId: store.group?.group?.id });
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar os cartões.', 'danger');
      } finally {
        this.loading = false;
      }
    },

    async salvar() {
      if (!this.nome.trim() || this.saving) return;
      const store = Alpine.store('app');
      this.saving = true;
      try {
        const nome = this.nome.trim();
        const bancoId = this.bancoId || null;
        let cartao;
        if (this.editingId) {
          cartao = await cartoesService.updateCartao(this.editingId, { nome, banco_id: bancoId });
          const idx = this.items.findIndex((c) => c.id === cartao.id);
          if (idx >= 0) this.items[idx] = cartao;
          store.notify('Cartão atualizado.');
        } else {
          // Mesmo "não pode haver cartões duplicados": se já existe um
          // cartão com esse nome do mesmo dono, reaproveita em vez de criar
          // outro (o índice único cartoes_owner_nome_uniq impede de qualquer
          // jeito; aqui só evitamos o erro de constraint no cliente).
          cartao = await cartoesService.findOrCreateCartao({ nome, bancoId, ownerId: store.profile.id, groupId: store.group?.group?.id ?? null, existingCartoes: store.cartoes.length ? store.cartoes : this.items });
          if (!this.items.some((c) => c.id === cartao.id)) this.items.push(cartao);
          store.notify('Cartão criado.');
        }
        await store.refreshCartoes();
        const callback = this.onCreated;
        this.closeForm();
        if (callback) await Alpine.nextTick().then(() => callback(cartao));
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar o cartão.', 'danger');
      } finally {
        this.saving = false;
      }
    },

    async excluir(cartao) {
      if (!confirm(`Excluir o cartão "${cartao.nome}"? As despesas que usam esse cartão deixam de saber qual cartão foi (voltam ao agrupamento por responsável+mês). Essa ação não pode ser desfeita.`)) return;
      const store = Alpine.store('app');
      try {
        await cartoesService.deleteCartao(cartao.id);
        this.items = this.items.filter((c) => c.id !== cartao.id);
        await store.refreshCartoes();
        store.notify('Cartão excluído.');
      } catch (e) {
        store.notify(e.message || 'Não foi possível excluir o cartão.', 'danger');
      }
    },
  };
}
