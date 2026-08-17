import { parseCsvFile, applyMapping, IMPORT_TARGETS } from '../services/csvImport.js';
import { createTransaction } from '../services/transactions.js';
import { createCategory } from '../services/categories.js';
import * as sl from '../services/shoppingList.js';

// Modal global de importação de CSV (Alpine.store('csvModal')) — reaproveitado
// para transações e para itens de lista de compras.
export function csvModalStore() {
  return {
    open: false,
    step: 'upload', // upload -> map -> preview -> resultado
    target: 'transacoes',
    listId: null,
    headers: [],
    rawRows: [],
    mapping: {},
    result: { ok: 0, erros: [] },
    IMPORT_TARGETS,

    openFor(target, listId = null) {
      this.target = target;
      this.listId = listId;
      this.step = 'upload';
      this.headers = [];
      this.rawRows = [];
      this.mapping = {};
      this.result = { ok: 0, erros: [] };
      this.open = true;
    },

    close() {
      this.open = false;
    },

    fields() {
      return this.IMPORT_TARGETS[this.target].fields;
    },

    async onFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const { headers, rows } = await parseCsvFile(file);
      this.headers = headers;
      this.rawRows = rows;
      this.mapping = {};
      for (const f of this.fields()) {
        // Match exato primeiro (ex: cabeçalho "tipo_despesa" tem que ganhar
        // do campo "tipo_despesa" antes de "tipo" tentar um match por
        // substring — senão "tipo" e "tipo_despesa" colidiam no mesmo
        // cabeçalho "tipo" e um dos dois ficava sem coluna nenhuma).
        const exact = headers.find((h) => h.toLowerCase() === f.key.toLowerCase());
        if (exact) {
          this.mapping[f.key] = exact;
          continue;
        }
        const chave = f.key.split('_')[0].toLowerCase();
        const match = headers.find((h) => h.toLowerCase().includes(chave));
        if (match) this.mapping[f.key] = match;
      }
      this.step = 'map';
    },

    avancarPreview() {
      this.step = 'preview';
    },

    async confirmar() {
      const store = Alpine.store('app');
      const mapeadas = applyMapping(this.rawRows, this.mapping);
      let ok = 0;
      const erros = [];

      for (const [i, row] of mapeadas.entries()) {
        try {
          if (this.target === 'transacoes') {
            if (!row.titulo || !row.valor) throw new Error('título e valor são obrigatórios');
            await createTransaction({
              tipo: (row.tipo || 'saida').toLowerCase().startsWith('entr') ? 'entrada' : 'saida',
              titulo: row.titulo,
              empresa_servico: row.empresa_servico || null,
              categoria_id: await this.resolveCategoria(row.categoria_nome),
              tipo_despesa: (row.tipo_despesa || 'variavel').toLowerCase().startsWith('fix') ? 'fixa' : 'variavel',
              valor: Number(String(row.valor).replace(',', '.')) || 0,
              data_vencimento: row.data_vencimento || null,
              responsavel_id: store.profile.id,
              owner_id: store.profile.id,
              group_id: store.group?.group?.id ?? null,
            });
          } else {
            if (!row.nome) throw new Error('nome do item é obrigatório');
            const unidade = ['kg', 'g'].includes((row.unidade || '').toLowerCase()) ? row.unidade.toLowerCase() : 'un';
            await sl.addItem(this.listId, {
              nome: row.nome,
              categoria_id: await this.resolveCategoria(row.categoria_nome),
              unidade,
              quantidade: Number(String(row.quantidade || 1).replace(',', '.')) || 1,
            });
          }
          ok++;
        } catch (e) {
          erros.push({ linha: i + 2, motivo: e.message });
        }
      }

      this.result = { ok, erros };
      this.step = 'resultado';
      window.dispatchEvent(new CustomEvent('cg:transactions-changed'));
      window.dispatchEvent(new CustomEvent('cg:shopping-changed'));
    },

    async resolveCategoria(nome) {
      if (!nome) return null;
      const store = Alpine.store('app');
      let cat = store.categories.find((c) => c.nome.toLowerCase() === nome.toLowerCase());
      if (!cat) {
        cat = await createCategory({ nome, ownerId: store.profile.id, groupId: store.group?.group?.id });
        await store.refreshCategories();
      }
      return cat.id;
    },
  };
}
