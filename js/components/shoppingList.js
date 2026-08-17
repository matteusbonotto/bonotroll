import * as sl from '../services/shoppingList.js';
import { startBarcodeScanner, stopBarcodeScanner, lookupProductByBarcode } from '../services/barcode.js';
import { createTransaction } from '../services/transactions.js';
import { recognizeText, parseReceiptText } from '../services/ocr.js';
import { todayIso } from '../utils/format.js';

export function shoppingView() {
  return {
    list: null,
    items: [],
    loading: true,
    novoItem: { nome: '', categoria_id: '', unidade: 'un', quantidade: 1 },
    itemEmEdicaoId: null,
    precoEdicao: { valor: '', quantidade: '' },
    scannerAberto: false,
    scannerErro: '',
    graficoAberto: false,
    lendoFotoItem: false,

    init() {
      this.load();
      window.addEventListener('cg:shopping-changed', () => this.refreshItems());
    },

    async load() {
      const store = this.$store.app;
      if (!store.profile) return;
      this.loading = true;
      this.list = await sl.getOrCreateActiveList({ ownerId: store.profile.id, groupId: store.group?.group?.id });
      this.items = await sl.listItems(this.list.id);
      this.loading = false;
    },

    async refreshItems() {
      if (!this.list) return;
      this.items = await sl.listItems(this.list.id);
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

    categoryFor(id) {
      return this.$store.app.categoryById(id);
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
          store.notify('Nome lido da foto — confira antes de adicionar.');
        } else {
          store.notify('Não consegui ler nenhum texto nessa foto.', 'danger');
        }
      } catch {
        store.notify('Erro ao ler a foto.', 'danger');
      } finally {
        this.lendoFotoItem = false;
        event.target.value = '';
      }
    },

    async addItem() {
      if (!this.novoItem.nome.trim()) return;
      await sl.addItem(this.list.id, { ...this.novoItem, nome: this.novoItem.nome.trim() });
      this.novoItem = { nome: '', categoria_id: '', unidade: 'un', quantidade: 1 };
      await this.refreshItems();
    },

    async removeItem(id) {
      await sl.removeItem(id);
      await this.refreshItems();
    },

    // Botão único que alterna: "Iniciar Compra" (planejando/pausada -> comprando)
    // e "Encerrar Compra" (comprando -> finalizada).
    async toggleStart() {
      if (this.emCompra) {
        await this.finalizar();
      } else {
        this.list = await sl.startShopping(this.list.id);
      }
    },

    async pausar() {
      this.list = await sl.pauseShopping(this.list.id);
    },
    async retomar() {
      this.list = await sl.resumeShopping(this.list.id);
    },

    async finalizar() {
      const resumo = this.resumo;
      const ok = confirm(`Encerrar a compra?\n${resumo.itensComprados}/${resumo.totalItens} itens · Total R$ ${resumo.valorTotal.toFixed(2)}`);
      if (!ok) return;

      this.list = await sl.finishShopping(this.list.id);
      const store = this.$store.app;

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
    },

    async novaLista() {
      const store = this.$store.app;
      this.list = await sl.createList({ ownerId: store.profile.id, groupId: store.group?.group?.id, nome: 'Lista de Compras' });
      this.items = [];
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
      const patch = { quantidade: Number(this.precoEdicao.quantidade) || 0, comprado: true };
      if (item.unidade === 'un') patch.preco_unitario = Number(this.precoEdicao.valor) || 0;
      else patch.preco_por_kg = Number(this.precoEdicao.valor) || 0;
      await sl.updateItem(item.id, patch);
      this.itemEmEdicaoId = null;
      await this.refreshItems();
    },

    async desmarcarComprado(item) {
      await sl.updateItem(item.id, { comprado: false });
      await this.refreshItems();
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
      const produto = await lookupProductByBarcode(codigo);
      this.novoItem.nome = produto?.nome || `Item ${codigo}`;
      this.$store.app.notify(produto?.nome ? `Produto identificado: ${produto.nome}` : 'Código lido — confira o nome do item.');
    },

    abrirImportacao() {
      this.$store.csvModal.openFor('itens_compra', this.list.id);
    },
  };
}
