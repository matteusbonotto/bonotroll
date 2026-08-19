import * as res from '../services/resources.js';
import { getOrCreateActiveList, addItem as addShoppingItem } from '../services/shoppingList.js';
import { computeExpiryStatus, expiryStatusMeta } from '../utils/status.js';
import { startBarcodeScanner, stopBarcodeScanner, lookupProductByBarcode } from '../services/barcode.js';
import { recognizeText, parseReceiptText } from '../services/ocr.js';

const ITEM_FORM_VAZIO = () => ({ id: null, nome: '', quantidade: 1, data_validade: '', categoria_id: '' });
const ROOM_FORM_VAZIO = () => ({ id: null, nome: '', icone: 'bi-door-open' });
const CATEGORIA_FORM_VAZIO = () => ({ id: null, nome: '' });

export const ROOM_ICON_PRESETS = [
  'bi-door-open', 'bi-door-closed', 'bi-briefcase', 'bi-cup-hot', 'bi-droplet',
  'bi-tv', 'bi-basket2', 'bi-house-door', 'bi-tree', 'bi-car-front',
  'bi-book', 'bi-controller', 'bi-flower1', 'bi-bicycle', 'bi-tools',
];

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
    // Fechado por padrão — a lista de sugestões pode crescer bastante e
    // atrapalhava enxergar a grade de cômodos logo abaixo dela.
    sugestoesAbertas: false,

    itemModalAberto: false,
    itemForm: ITEM_FORM_VAZIO(),
    salvandoItem: false,
    uploadingFotoId: null,
    lendoFotoItem: false,
    scannerAberto: false,
    scannerErro: '',
    _debounceQty: {}, // { [item.id]: timeoutId } — ver ajustar()

    // ---------- Gerenciar cômodos ----------
    roomModalAberto: false,
    roomForm: ROOM_FORM_VAZIO(),
    salvandoRoom: false,
    roomIconPresets: ROOM_ICON_PRESETS,

    // ---------- Gerenciar subcategorias ----------
    categoriaModalAberto: false,
    categoriaForm: CATEGORIA_FORM_VAZIO(),
    salvandoCategoria: false,

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
        // Dashboard tem seu próprio card "Recursos em falta" com os mesmos
        // dados (ver js/components/dashboard.js) — como as telas ficam
        // todas montadas ao mesmo tempo (x-show, não x-if), sem esse evento
        // ele nunca sabia que algo mudou aqui e ficava com a lista velha até
        // um F5. Mesmo padrão já usado por cg:transactions-changed etc.
        window.dispatchEvent(new CustomEvent('cg:recursos-changed'));
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar as sugestões.', 'danger');
      }
    },

    // Entrar num cômodo mostra só os tiles de subcategoria (Todas + as que
    // existirem + "Nova subcategoria") — NÃO carrega itens ainda. Antes a
    // grade de subcategorias e a lista de itens apareciam juntas na mesma
    // tela (tiles + botão "+" + listagem, tudo empilhado), o que ficava
    // confuso. Agora é dois passos: escolher subcategoria (ou "Todas")
    // primeiro, ver os itens depois.
    async selecionarRoom(roomId) {
      this.activeRoomId = roomId;
      this.activeCategoryId = null;
      this.items = [];
      try {
        this.roomCategories = await res.listRoomCategories(roomId);
      } catch (e) {
        this.$store.app.notify(e.message || 'Não consegui abrir esse cômodo.', 'danger');
      }
    },

    voltarParaGrade() {
      this.activeRoomId = null;
      this.activeCategoryId = null;
      this.items = [];
    },

    // Volta da lista de itens pros tiles de subcategoria, sem sair do
    // cômodo (equivalente ao "voltar" de um passo só, não dois).
    voltarParaSubcategorias() {
      this.activeCategoryId = null;
      this.items = [];
    },

    // categoryId = 'todas' (sentinela, não é um id de verdade) mostra todo
    // item do cômodo, tenha subcategoria ou não; um id de verdade filtra só
    // aquela subcategoria. Os dois casos entram na tela de LISTAGEM (ver
    // carregarItens), saindo da tela de tiles.
    async selecionarCategoria(categoryId) {
      this.activeCategoryId = categoryId;
      await this.carregarItens();
    },

    // ---------- Gerenciar cômodos (criar/editar/excluir) ----------
    abrirNovaRoom() {
      this.roomForm = ROOM_FORM_VAZIO();
      this.roomModalAberto = true;
    },
    // event.stopPropagation() é essencial aqui: o lápis fica DENTRO do botão
    // clicável do tile (abre o cômodo) — sem isso, editar um cômodo também
    // navegava pra dentro dele.
    abrirEditarRoom(room, event) {
      event.stopPropagation();
      this.roomForm = { id: room.id, nome: room.nome, icone: room.icone || 'bi-door-open' };
      this.roomModalAberto = true;
    },
    fecharRoomModal() {
      this.roomModalAberto = false;
    },
    async salvarRoom() {
      if (!this.roomForm.nome.trim() || this.salvandoRoom) return;
      const store = this.$store.app;
      this.salvandoRoom = true;
      try {
        if (this.roomForm.id) {
          const atualizado = await res.updateRoom(this.roomForm.id, { nome: this.roomForm.nome.trim(), icone: this.roomForm.icone });
          const idx = this.rooms.findIndex((r) => r.id === atualizado.id);
          if (idx >= 0) this.rooms[idx] = atualizado;
          store.notify('Cômodo atualizado.');
        } else {
          const criado = await res.createRoom({
            nome: this.roomForm.nome.trim(),
            icone: this.roomForm.icone,
            ownerId: store.profile.id,
            groupId: store.group?.group?.id,
          });
          this.rooms.push(criado);
          store.notify('Cômodo criado.');
        }
        this.roomModalAberto = false;
        window.dispatchEvent(new CustomEvent('cg:recursos-changed'));
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar o cômodo.', 'danger');
      } finally {
        this.salvandoRoom = false;
      }
    },
    async excluirRoom() {
      if (!this.roomForm.id) return;
      if (!confirm(`Excluir o cômodo "${this.roomForm.nome}"? As subcategorias e itens dele também serão excluídos — essa ação não pode ser desfeita.`)) return;
      const store = this.$store.app;
      try {
        await res.deleteRoom(this.roomForm.id);
        const idExcluido = this.roomForm.id;
        this.rooms = this.rooms.filter((r) => r.id !== idExcluido);
        this.allItems = this.allItems.filter((i) => i.room_id !== idExcluido);
        this.roomModalAberto = false;
        if (this.activeRoomId === idExcluido) this.voltarParaGrade();
        store.notify('Cômodo excluído.');
        window.dispatchEvent(new CustomEvent('cg:recursos-changed'));
      } catch (e) {
        store.notify(e.message || 'Não foi possível excluir o cômodo.', 'danger');
      }
    },

    // ---------- Gerenciar subcategorias (criar/editar/excluir) ----------
    abrirNovaSubcategoria() {
      this.categoriaForm = CATEGORIA_FORM_VAZIO();
      this.categoriaModalAberto = true;
    },
    abrirEditarSubcategoria(categoria, event) {
      event.stopPropagation();
      this.categoriaForm = { id: categoria.id, nome: categoria.nome };
      this.categoriaModalAberto = true;
    },
    fecharCategoriaModal() {
      this.categoriaModalAberto = false;
    },
    async salvarSubcategoria() {
      if (!this.categoriaForm.nome.trim() || this.salvandoCategoria) return;
      const store = this.$store.app;
      this.salvandoCategoria = true;
      try {
        if (this.categoriaForm.id) {
          const atualizada = await res.updateRoomCategory(this.categoriaForm.id, { nome: this.categoriaForm.nome.trim() });
          const idx = this.roomCategories.findIndex((c) => c.id === atualizada.id);
          if (idx >= 0) this.roomCategories[idx] = atualizada;
          store.notify('Subcategoria atualizada.');
        } else {
          const criada = await res.createRoomCategory({ roomId: this.activeRoomId, nome: this.categoriaForm.nome.trim() });
          this.roomCategories.push(criada);
          store.notify('Subcategoria criada.');
        }
        this.categoriaModalAberto = false;
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar a subcategoria.', 'danger');
      } finally {
        this.salvandoCategoria = false;
      }
    },
    async excluirSubcategoria() {
      if (!this.categoriaForm.id) return;
      if (!confirm(`Excluir a subcategoria "${this.categoriaForm.nome}"? Os itens dela ficam sem subcategoria (não são excluídos) — essa ação não pode ser desfeita.`)) return;
      const store = this.$store.app;
      try {
        await res.deleteRoomCategory(this.categoriaForm.id);
        const idExcluida = this.categoriaForm.id;
        this.roomCategories = this.roomCategories.filter((c) => c.id !== idExcluida);
        if (this.activeCategoryId === idExcluida) this.activeCategoryId = null;
        this.categoriaModalAberto = false;
        await Promise.all([this.carregarItens(), this.carregarSugestoes()]);
        store.notify('Subcategoria excluída.');
      } catch (e) {
        store.notify(e.message || 'Não foi possível excluir a subcategoria.', 'danger');
      }
    },

    async carregarItens() {
      try {
        const categoryId = this.activeCategoryId && this.activeCategoryId !== 'todas' ? this.activeCategoryId : undefined;
        this.items = await res.listItems({ roomId: this.activeRoomId, categoryId });
      } catch (e) {
        this.$store.app.notify(e.message || 'Não consegui carregar os itens.', 'danger');
      }
    },

    get nomeCategoriaAtiva() {
      if (this.activeCategoryId === 'todas') return 'Todas';
      return this.roomCategories.find((c) => c.id === this.activeCategoryId)?.nome || '';
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

    // Mesma ideia, por subcategoria dentro do cômodo atual — usado nos tiles
    // de subcategoria (mesma aparência dos tiles de cômodo, pedido explícito).
    itemCountForCategoria(categoriaId) {
      return this.allItems.filter((i) => i.room_id === this.activeRoomId && i.category_id === categoriaId).length;
    },
    alertCountForCategoria(categoriaId) {
      return this.allItems.filter((i) => i.room_id === this.activeRoomId && i.category_id === categoriaId && computeExpiryStatus(i) !== 'ok').length;
    },
    // "Todas" conta todo item do cômodo, tenha subcategoria ou não.
    itemCountTodas() {
      return this.allItems.filter((i) => i.room_id === this.activeRoomId).length;
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
    // Subcategoria vem pré-preenchida com a que estiver ativa (dentro dela,
    // "Todas" = sem subcategoria escolhida) — mas continua editável no
    // select, pra dar pra escolher outra ou nenhuma mesmo adicionando de
    // dentro de uma subcategoria específica.
    abrirNovoItem() {
      const categoriaPreSelecionada = this.activeCategoryId && this.activeCategoryId !== 'todas' ? this.activeCategoryId : '';
      this.itemForm = { ...ITEM_FORM_VAZIO(), categoria_id: categoriaPreSelecionada };
      this.scannerErro = '';
      this.itemModalAberto = true;
    },
    abrirEditarItem(item) {
      this.itemForm = {
        id: item.id,
        nome: item.nome,
        quantidade: item.quantidade,
        data_validade: item.data_validade || '',
        categoria_id: item.category_id || '',
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
          category_id: this.itemForm.categoria_id || null,
        };
        if (this.itemForm.id) {
          await res.updateItem(this.itemForm.id, patch);
        } else {
          await res.createItem({
            ...patch,
            room_id: this.activeRoomId,
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
          if (dados.vencimento) this.itemForm.data_validade = dados.vencimento;
          store.notify(dados.vencimento ? 'Nome e validade lidos da foto — confira antes de salvar.' : 'Nome lido da foto — confira antes de salvar.');
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
