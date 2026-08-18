import * as res from '../services/resources.js';
import { getOrCreateActiveList, addItem as addShoppingItem } from '../services/shoppingList.js';
import { computeExpiryStatus, expiryStatusMeta } from '../utils/status.js';

const ITEM_FORM_VAZIO = () => ({ id: null, nome: '', quantidade: 1, data_validade: '' });

// Tela "Recursos": inventário doméstico por cômodo -> subcategoria (fixos) ->
// itens (livres, com quantidade e validade opcional). Navegação em
// drill-down: grade de cômodos -> dentro de um cômodo, subcategorias +
// itens -> "+" abre modal de adicionar/editar (ver js/services/resources.js
// pro CRUD/seed dos cômodos).
export function resourcesView() {
  return {
    loading: true,
    rooms: [],
    roomCategories: [],
    allItems: [], // todos os itens do usuário/grupo — pra "Sugestões" e contagem por cômodo
    items: [], // itens do cômodo/subcategoria selecionados
    activeRoomId: null, // null = mostra a grade de cômodos
    activeCategoryId: null, // null = "todas" as subcategorias do cômodo

    itemModalAberto: false,
    itemForm: ITEM_FORM_VAZIO(),
    uploadingFotoId: null,

    async init() {
      const store = this.$store.app;
      if (!store.profile) return;
      this.loading = true;
      const groupId = store.group?.group?.id;
      this.rooms = await res.ensureDefaultRooms(store.profile.id, groupId);
      await this.carregarSugestoes();
      this.loading = false;
    },

    async carregarSugestoes() {
      const store = this.$store.app;
      this.allItems = await res.listAllItems({ ownerId: store.profile.id, groupId: store.group?.group?.id });
    },

    async selecionarRoom(roomId) {
      this.activeRoomId = roomId;
      this.activeCategoryId = null;
      this.roomCategories = await res.listRoomCategories(roomId);
      await this.carregarItens();
    },

    voltarParaGrade() {
      this.activeRoomId = null;
      this.activeCategoryId = null;
      this.items = [];
    },

    async selecionarCategoria(categoryId) {
      this.activeCategoryId = categoryId;
      await this.carregarItens();
    },

    async carregarItens() {
      this.items = await res.listItems({ roomId: this.activeRoomId, categoryId: this.activeCategoryId || undefined });
    },

    get salaAtual() {
      return this.rooms.find((r) => r.id === this.activeRoomId) || null;
    },

    // Quantos itens (e quantos precisam de atenção) cada cômodo tem — mostrado
    // como badge no tile da grade, pra dar contexto sem precisar entrar.
    itemCountFor(roomId) {
      return this.allItems.filter((i) => i.room_id === roomId).length;
    },
    alertCountFor(roomId) {
      return this.allItems.filter((i) => i.room_id === roomId && computeExpiryStatus(i) !== 'ok').length;
    },

    // Itens em falta (quantidade 0) ou vencendo/vencidos — sugestão de
    // compra, com atalho direto pra lista de compras.
    get sugestoes() {
      return this.allItems
        .map((item) => ({ item, status: computeExpiryStatus(item) }))
        .filter(({ status }) => status !== 'ok')
        .sort((a, b) => (a.status === 'em_falta' ? -1 : 1) - (b.status === 'em_falta' ? -1 : 1));
    },

    expiryKey(item) {
      return computeExpiryStatus(item);
    },
    expiryMeta(item) {
      return expiryStatusMeta(this.expiryKey(item));
    },

    roomFor(roomId) {
      return this.rooms.find((r) => r.id === roomId) || null;
    },

    // ---------- Modal de adicionar/editar item ----------
    abrirNovoItem() {
      this.itemForm = ITEM_FORM_VAZIO();
      this.itemModalAberto = true;
    },
    abrirEditarItem(item) {
      this.itemForm = {
        id: item.id,
        nome: item.nome,
        quantidade: item.quantidade,
        data_validade: item.data_validade || '',
      };
      this.itemModalAberto = true;
    },
    fecharModalItem() {
      this.itemModalAberto = false;
    },

    async salvarItem() {
      if (!this.itemForm.nome.trim() || !this.activeRoomId) return;
      const store = this.$store.app;
      const patch = {
        nome: this.itemForm.nome.trim(),
        quantidade: Number(this.itemForm.quantidade) || 0,
        data_validade: this.itemForm.data_validade || null,
      };
      if (this.itemForm.id) {
        await res.updateItem(this.itemForm.id, patch);
      } else {
        await res.createItem({
          ...patch,
          room_id: this.activeRoomId,
          category_id: this.activeCategoryId,
          owner_id: store.profile.id,
          group_id: store.group?.group?.id ?? null,
        });
      }
      this.itemModalAberto = false;
      await this.carregarItens();
      await this.carregarSugestoes();
    },

    async ajustar(item, delta) {
      const quantidade = res.ajustarQuantidade(item, delta);
      await res.updateItem(item.id, { quantidade });
      await this.carregarItens();
      await this.carregarSugestoes();
    },

    async removeItem(id) {
      if (!confirm('Remover este item?')) return;
      await res.deleteItem(id);
      this.itemModalAberto = false;
      await this.carregarItens();
      await this.carregarSugestoes();
    },

    async onFotoChange(item, event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = this.$store.app;
      this.uploadingFotoId = item.id;
      try {
        const url = await res.uploadItemPhoto(store.profile.id, file);
        await res.updateItem(item.id, { foto_url: url });
        await this.carregarItens();
      } catch (e) {
        store.notify(e.message || 'Erro ao enviar foto.', 'danger');
      } finally {
        this.uploadingFotoId = null;
        event.target.value = '';
      }
    },

    // Sugestão -> Lista de compras: adiciona o item já com o nome preenchido
    // na lista ativa (pedido explícito: "ao add a opção é adicionada a
    // lista de compras").
    async adicionarNaListaDeCompras(item) {
      const store = this.$store.app;
      const lista = await getOrCreateActiveList({ ownerId: store.profile.id, groupId: store.group?.group?.id });
      await addShoppingItem(lista.id, { nome: item.nome, categoria_id: '', unidade: 'un', quantidade: 1 });
      window.dispatchEvent(new CustomEvent('cg:shopping-changed'));
      store.notify(`"${item.nome}" adicionado à lista de compras.`);
    },
  };
}
