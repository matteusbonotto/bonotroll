import * as sl from '../services/shoppingList.js';
import { startBarcodeScanner, stopBarcodeScanner, lookupProductByBarcode } from '../services/barcode.js';
import { createTransaction } from '../services/transactions.js';
import { recognizeText, parseReceiptText } from '../services/ocr.js';
import { todayIso } from '../utils/format.js';

const NOVO_ITEM_VAZIO = () => ({ nome: '', categoria_id: '', unidade: 'un', quantidade: 1, prioridade: 3 });

export function shoppingView() {
  return {
    list: null,
    items: [],
    loading: true,
    novoItem: NOVO_ITEM_VAZIO(),
    categoriaEscolhidaManualmente: false,
    salvandoItem: false,
    itemEmEdicaoId: null,
    precoEdicao: { valor: '', quantidade: '' },
    scannerAberto: false,
    scannerErro: '',
    graficoAberto: false,
    lendoFotoItem: false,
    maisOpcoesItem: false,
    ordenarPorPrioridade: false,
    // Card "Adicionar item" começa fechado (tela mais limpa) e abre pelo
    // botão flutuante — fica aberto entre adições (pra colocar vários itens
    // seguidos sem reabrir a cada um), só fecha quando a pessoa manda fechar.
    itemFormAberto: false,
    toggleItemForm() {
      this.itemFormAberto = !this.itemFormAberto;
      if (this.itemFormAberto) this.$nextTick(() => this.$refs.inputNovoItem?.focus());
    },

    // ---------- Histórico de compras finalizadas ----------
    historicoAberto: false,
    historicoCarregando: false,
    historicoListas: [], // [{ list, resumo }]
    detalheAberto: false,
    detalheLista: null,
    detalheItens: [],

    // Modal de edição completa (nome/categoria/unidade/quantidade/
    // prioridade) — separado do editor de preço (abrirPreco), que é só
    // pro fluxo de "Comprando".
    edicaoAberta: false,
    edicaoForm: { id: null, nome: '', categoria_id: '', unidade: 'un', quantidade: 1, prioridade: 3 },

    // "lista" = folha de caderno (default, ver .cg-notebook em css/components.css).
    // Grade/grade compacta são uma visão alternativa de navegação, sem o
    // tema de papel.
    viewMode: localStorage.getItem('bonotto_view_compras') || 'lista',
    setViewMode(mode) {
      this.viewMode = mode;
      localStorage.setItem('bonotto_view_compras', mode);
    },

    init() {
      this.load();
      window.addEventListener('cg:shopping-changed', () => this.refreshItems());
    },

    async load() {
      const store = this.$store.app;
      if (!store.profile) return;
      this.loading = true;
      try {
        this.list = await sl.getOrCreateActiveList({ ownerId: store.profile.id, groupId: store.group?.group?.id });
        this.items = await sl.listItems(this.list.id);
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar a lista de compras.', 'danger');
      } finally {
        this.loading = false;
      }
    },

    async refreshItems() {
      if (!this.list) return;
      try {
        this.items = await sl.listItems(this.list.id);
      } catch (e) {
        this.$store.app.notify(e.message || 'Não consegui atualizar a lista.', 'danger');
      }
    },

    get resumo() {
      return sl.computeListSummary(this.items);
    },
    get resumoPorCategoria() {
      const map = new Map();
      for (const item of this.items) {
        if (!item.subtotal) continue;
        const cat = this.categoryFor(item.categoria_id);
        const key = cat?.id || 'sem-categoria';
        const atual = map.get(key) || { nome: cat?.nome || 'Sem categoria', cor: cat?.cor || '#94A3B8', total: 0 };
        atual.total += Number(item.subtotal) || 0;
        map.set(key, atual);
      }
      return [...map.values()].sort((a, b) => b.total - a.total);
    },

    get planejando() { return this.list?.status === 'planejando'; },
    get emCompra() { return this.list?.status === 'comprando'; },
    get pausada() { return this.list?.status === 'pausada'; },

    // "Importantes primeiro" (prioridade 5 -> 1); desligado mostra a ordem
    // de criação normal (a mesma que já vinha do banco).
    get itemsOrdenados() {
      if (!this.ordenarPorPrioridade) return this.items;
      return [...this.items].sort((a, b) => (b.prioridade || 3) - (a.prioridade || 3));
    },

    categoryFor(id) {
      return this.$store.app.categoryById(id);
    },

    // Sugere categoria pelo nome digitado (ver guessCategoryByName) — só
    // se a pessoa ainda não tiver escolhido uma categoria na mão pra este
    // item; nunca sobrescreve uma escolha manual.
    onNomeInput() {
      if (this.categoriaEscolhidaManualmente) return;
      const sugestao = sl.guessCategoryByName(this.novoItem.nome, this.$store.app.categories);
      if (sugestao) this.novoItem.categoria_id = sugestao.id;
    },
    onCategoriaManual() {
      this.categoriaEscolhidaManualmente = true;
    },

    async onFotoItem(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = this.$store.app;
      this.lendoFotoItem = true;
      try {
        const texto = await recognizeText(file);
        const dados = parseReceiptText(texto);
        if (dados.titulo) {
          this.novoItem.nome = dados.titulo;
          this.onNomeInput();
          store.notify('Nome lido da foto — confira antes de adicionar.');
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

    async addItem() {
      if (!this.novoItem.nome.trim() || this.salvandoItem) return;
      const store = this.$store.app;
      this.salvandoItem = true;
      try {
        await sl.addItem(this.list.id, { ...this.novoItem, nome: this.novoItem.nome.trim() });
        const nomeAdicionado = this.novoItem.nome.trim();
        this.novoItem = NOVO_ITEM_VAZIO();
        this.categoriaEscolhidaManualmente = false;
        await this.refreshItems();
        store.notify(`"${nomeAdicionado}" adicionado.`);
      } catch (e) {
        store.notify(e.message || 'Não foi possível adicionar o item.', 'danger');
      } finally {
        this.salvandoItem = false;
      }
    },

    async removeItem(id) {
      const store = this.$store.app;
      try {
        await sl.removeItem(id);
        await this.refreshItems();
        store.notify('Item removido.');
      } catch (e) {
        store.notify(e.message || 'Não foi possível remover o item.', 'danger');
      }
    },

    // ---------- Edição completa de um item já existente ----------
    abrirEdicao(item) {
      this.edicaoForm = {
        id: item.id,
        nome: item.nome,
        categoria_id: item.categoria_id || '',
        unidade: item.unidade,
        quantidade: item.quantidade,
        prioridade: item.prioridade || 3,
      };
      this.edicaoAberta = true;
    },
    fecharEdicao() {
      this.edicaoAberta = false;
    },
    async salvarEdicao() {
      if (!this.edicaoForm.nome.trim()) return;
      const store = this.$store.app;
      try {
        const { id, ...patch } = this.edicaoForm;
        patch.nome = patch.nome.trim();
        patch.categoria_id = patch.categoria_id || null;
        patch.quantidade = Number(patch.quantidade) || 0;
        await sl.updateItem(id, patch);
        this.edicaoAberta = false;
        await this.refreshItems();
        store.notify('Item atualizado.');
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar as alterações.', 'danger');
      }
    },

    // Botão único que alterna: "Iniciar Compra" (planejando/pausada -> comprando)
    // e "Encerrar Compra" (comprando -> finalizada).
    async toggleStart() {
      if (this.emCompra) {
        await this.finalizar();
        return;
      }
      try {
        this.list = await sl.startShopping(this.list.id);
      } catch (e) {
        this.$store.app.notify(e.message || 'Não foi possível iniciar a compra.', 'danger');
      }
    },

    async pausar() {
      try {
        this.list = await sl.pauseShopping(this.list.id);
      } catch (e) {
        this.$store.app.notify(e.message || 'Não foi possível pausar.', 'danger');
      }
    },
    async retomar() {
      try {
        this.list = await sl.resumeShopping(this.list.id);
      } catch (e) {
        this.$store.app.notify(e.message || 'Não foi possível retomar.', 'danger');
      }
    },

    async finalizar() {
      const resumo = this.resumo;
      const ok = confirm(`Encerrar a compra?\n${resumo.itensComprados}/${resumo.totalItens} itens · Total R$ ${resumo.valorTotal.toFixed(2)}`);
      if (!ok) return;
      const store = this.$store.app;

      try {
        this.list = await sl.finishShopping(this.list.id);

        if (resumo.valorTotal > 0 && confirm('Lançar essa compra como uma despesa no controle financeiro?')) {
          const categoriaMercado = store.categories.find((c) => c.nome.toLowerCase() === 'mercado');
          const tx = await createTransaction({
            tipo: 'saida',
            titulo: this.list.nome || 'Compras do mercado',
            categoria_id: categoriaMercado?.id || null,
            tipo_despesa: 'variavel',
            valor: resumo.valorTotal,
            responsavel_id: store.profile.id,
            owner_id: store.profile.id,
            group_id: store.group?.group?.id ?? null,
            data_cadastro: todayIso(),
            data_pagamento: todayIso(),
          });
          await sl.linkListToTransaction(this.list.id, tx.id);
          window.dispatchEvent(new CustomEvent('cg:transactions-changed'));
          store.notify('Compra lançada no financeiro.');
        }

        await this.novaLista();
      } catch (e) {
        store.notify(e.message || 'Não foi possível encerrar a compra.', 'danger');
      }
    },

    async novaLista() {
      const store = this.$store.app;
      try {
        this.list = await sl.createList({ ownerId: store.profile.id, groupId: store.group?.group?.id, nome: 'Lista de Compras' });
        this.items = [];
      } catch (e) {
        store.notify(e.message || 'Não foi possível criar uma nova lista.', 'danger');
      }
    },

    // Compras já finalizadas — o que foi comprado, quando, quanto custou.
    // Carrega os itens de cada lista pra calcular o resumo (sem coluna
    // "total" na tabela: o valor certo já é sempre o somatório dos itens,
    // então recalcular aqui evita uma segunda fonte de verdade divergente).
    async abrirHistorico() {
      const store = this.$store.app;
      this.historicoAberto = true;
      this.historicoCarregando = true;
      try {
        const todas = await sl.listLists({ ownerId: store.profile.id, groupId: store.group?.group?.id });
        const finalizadas = todas
          .filter((l) => l.status === 'finalizada')
          .sort((a, b) => (b.finalizado_em || '').localeCompare(a.finalizado_em || ''));
        this.historicoListas = await Promise.all(
          finalizadas.map(async (list) => ({ list, resumo: sl.computeListSummary(await sl.listItems(list.id)) }))
        );
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar o histórico.', 'danger');
      } finally {
        this.historicoCarregando = false;
      }
    },
    fecharHistorico() {
      this.historicoAberto = false;
    },
    async verDetalheHistorico(entry) {
      try {
        this.detalheLista = entry.list;
        this.detalheItens = await sl.listItems(entry.list.id);
        this.detalheAberto = true;
      } catch (e) {
        this.$store.app.notify(e.message || 'Não consegui carregar os itens dessa compra.', 'danger');
      }
    },
    fecharDetalheHistorico() {
      this.detalheAberto = false;
      this.detalheLista = null;
      this.detalheItens = [];
    },

    abrirPreco(item) {
      this.itemEmEdicaoId = item.id;
      this.precoEdicao = {
        valor: item.unidade === 'un' ? item.preco_unitario ?? '' : item.preco_por_kg ?? '',
        quantidade: item.quantidade ?? 1,
      };
    },
    fecharPreco() {
      this.itemEmEdicaoId = null;
    },

    async salvarPreco(item) {
      const store = this.$store.app;
      try {
        const patch = { quantidade: Number(this.precoEdicao.quantidade) || 0, comprado: true };
        if (item.unidade === 'un') patch.preco_unitario = Number(this.precoEdicao.valor) || 0;
        else patch.preco_por_kg = Number(this.precoEdicao.valor) || 0;
        await sl.updateItem(item.id, patch);
        this.itemEmEdicaoId = null;
        await this.refreshItems();
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar o preço.', 'danger');
      }
    },

    async desmarcarComprado(item) {
      try {
        await sl.updateItem(item.id, { comprado: false });
        await this.refreshItems();
      } catch (e) {
        this.$store.app.notify(e.message || 'Não foi possível desmarcar o item.', 'danger');
      }
    },

    async abrirScanner() {
      this.scannerAberto = true;
      this.scannerErro = '';
      await this.$nextTick();
      try {
        await startBarcodeScanner('cg-scanner-viewport', (codigo) => this.onCodigoLido(codigo));
      } catch {
        this.scannerErro = 'Não foi possível acessar a câmera. Digite o item manualmente.';
      }
    },

    async fecharScanner() {
      await stopBarcodeScanner();
      this.scannerAberto = false;
    },

    async onCodigoLido(codigo) {
      await stopBarcodeScanner();
      this.scannerAberto = false;
      try {
        const produto = await lookupProductByBarcode(codigo);
        this.novoItem.nome = produto?.nome || `Item ${codigo}`;
        this.onNomeInput();
        this.$store.app.notify(produto?.nome ? `Produto identificado: ${produto.nome}` : 'Código lido — confira o nome do item.');
      } catch (e) {
        this.$store.app.notify(e.message || 'Não consegui identificar esse código.', 'danger');
      }
    },

    abrirImportacao() {
      this.$store.csvModal.openFor('itens_compra', this.list.id);
    },
  };
}
