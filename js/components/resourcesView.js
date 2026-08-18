import * as res from '../services/resources.js';
import { getOrCreateActiveList, addItem as addShoppingItem } from '../services/shoppingList.js';
import { computeExpiryStatus, expiryStatusMeta } from '../utils/status.js';
import { startBarcodeScanner, stopBarcodeScanner, lookupProductByBarcode } from '../services/barcode.js';
import { recognizeText, parseReceiptText } from '../services/ocr.js';

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
    salvandoItem: false,
    uploadingFotoId: null,
    lendoFotoItem: false,
    scannerAberto: false,
    scannerErro: '',
    _debounceQty: {}, // { [item.id]: timeoutId } — ver ajustar()

    async init() {
      const store = this.$store.app;
      if (!store.profile) return;
      this.loading = true;
      try {
        const groupId = store.group?.group?.id;
        this.rooms = await res.ensureDefaultRooms(store.profile.id, groupId);
        await this.carregarSugestoes();
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar Recursos.', 'danger');
      } finally {
        this.loading = false;
      }
    },

    async carregarSugestoes() {
      const store = this.$store.app;
      try {
        this.allItems = await res.listAllItems({ ownerId: store.profile.id, groupId: store.group?.group?.id });
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar as sugestões.', 'danger');
      }
    },

    async selecionarRoom(roomId) {
      this.activeRoomId = roomId;
      this.activeCategoryId = null;
      try {
        this.roomCategories = await res.listRoomCategories(roomId);
        await this.carregarItens();
      } catch (e) {
        this.$store.app.notify(e.message || 'Não consegui abrir esse cômodo.', 'danger');
      }
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
      try {
        this.items = await res.listItems({ roomId: this.activeRoomId, categoryId: this.activeCategoryId || undefined });
      } catch (e) {
        this.$store.app.notify(e.message || 'Não consegui carregar os itens.', 'danger');
      }
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
      this.scannerErro = '';
      this.itemModalAberto = true;
    },
    abrirEditarItem(item) {
      this.itemForm = {
        id: item.id,
        nome: item.nome,
        quantidade: item.quantidade,
        data_validade: item.data_validade || '',
      };
      this.scannerErro = '';
      this.itemModalAberto = true;
    },
    async fecharModalItem() {
      await this.fecharScanner();
      this.itemModalAberto = false;
    },

    async salvarItem() {
      if (!this.itemForm.nome.trim() || !this.activeRoomId || this.salvandoItem) return;
      const store = this.$store.app;
      this.salvandoItem = true;
      try {
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
        store.notify(this.itemForm.id ? 'Item atualizado.' : `"${patch.nome}" adicionado.`);
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar o item.', 'danger');
      } finally {
        this.salvandoItem = false;
      }
    },

    // Otimista + debounced: atualiza a UI na hora (sem esperar rede) e só
    // escreve no banco 500ms depois do último clique. Necessário porque
    // segurar o botão (ver data-repeat em app.js) dispara vários cliques
    // por segundo — escrever a cada um causaria corrida entre as respostas
    // (a mais lenta podia "voltar" o valor pra uma versão desatualizada).
    ajustar(item, delta) {
      item.quantidade = res.ajustarQuantidade(item, delta);
      clearTimeout(this._debounceQty[item.id]);
      this._debounceQty[item.id] = setTimeout(async () => {
        try {
          await res.updateItem(item.id, { quantidade: item.quantidade });
          await this.carregarSugestoes();
        } catch (e) {
          this.$store.app.notify(e.message || 'Não foi possível salvar a quantidade.', 'danger');
          await this.carregarItens();
        }
      }, 500);
    },

    async removeItem(id) {
      if (!confirm('Remover este item?')) return;
      const store = this.$store.app;
      try {
        await res.deleteItem(id);
        this.itemModalAberto = false;
        await this.carregarItens();
        await this.carregarSugestoes();
        store.notify('Item removido.');
      } catch (e) {
        store.notify(e.message || 'Não foi possível remover o item.', 'danger');
      }
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
        store.notify('Foto atualizada.');
      } catch (e) {
        store.notify(e.message || 'Erro ao enviar foto — confira se o bucket "avatars" existe no Storage (ver supabase/schema.sql).', 'danger');
      } finally {
        this.uploadingFotoId = null;
        event.target.value = '';
      }
    },

    // ---------- Identificar o nome do item por código de barras ou foto ----------
    // Mesma capacidade que já existia na Lista de compras — fazia sentido
    // só lá, mas cadastrar produto é a mesma ação aqui.
    async abrirScanner() {
      this.scannerAberto = true;
      this.scannerErro = '';
      await this.$nextTick();
      try {
        await startBarcodeScanner('cg-scanner-viewport-recursos', (codigo) => this.onCodigoLido(codigo));
      } catch {
        this.scannerErro = 'Não foi possível acessar a câmera. Digite o item manualmente.';
      }
    },
    async fecharScanner() {
      if (!this.scannerAberto) return;
      await stopBarcodeScanner();
      this.scannerAberto = false;
    },
    async onCodigoLido(codigo) {
      await stopBarcodeScanner();
      this.scannerAberto = false;
      const store = this.$store.app;
      try {
        const produto = await lookupProductByBarcode(codigo);
        this.itemForm.nome = produto?.nome || `Item ${codigo}`;
        store.notify(produto?.nome ? `Produto identificado: ${produto.nome}` : 'Código lido — confira o nome do item.');
      } catch (e) {
        store.notify(e.message || 'Não consegui identificar esse código.', 'danger');
      }
    },

    async onFotoNomeItem(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = this.$store.app;
      this.lendoFotoItem = true;
      try {
        const texto = await recognizeText(file);
        const dados = parseReceiptText(texto);
        if (dados.titulo) {
          this.itemForm.nome = dados.titulo;
          store.notify('Nome lido da foto — confira antes de salvar.');
        } else {
          store.notify('Não consegui ler nenhum texto nessa foto.', 'danger');
        }
      } catch (e) {
        store.notify(e.message || 'Erro ao ler a foto.', 'danger');
      } finally {
        this.lendoFotoItem = false;
        event.target.value = '';
      }
    },

    // Sugestão -> Lista de compras: adiciona o item já com o nome preenchido
    // na lista ativa (pedido explícito: "ao add a opção é adicionada a
    // lista de compras").
    async adicionarNaListaDeCompras(item) {
      const store = this.$store.app;
      try {
        const lista = await getOrCreateActiveList({ ownerId: store.profile.id, groupId: store.group?.group?.id });
        await addShoppingItem(lista.id, { nome: item.nome, categoria_id: '', unidade: 'un', quantidade: 1 });
        window.dispatchEvent(new CustomEvent('cg:shopping-changed'));
        store.notify(`"${item.nome}" adicionado à lista de compras.`);
      } catch (e) {
        store.notify(e.message || 'Não foi possível adicionar à lista de compras.', 'danger');
      }
    },
  };
}
