import { createCategory, updateCategory, deleteCategory, uploadCategoryIcon } from '../services/categories.js';
import { resizeImage } from '../utils/image.js';

export const CATEGORY_ICON_PRESETS = [
  'bi-tag', 'bi-house-door', 'bi-car-front', 'bi-basket', 'bi-cart3',
  'bi-cash-coin', 'bi-heart', 'bi-airplane', 'bi-gift', 'bi-lightning-charge',
  'bi-phone', 'bi-book', 'bi-cup-straw', 'bi-bicycle', 'bi-collection-play',
  'bi-mortarboard', 'bi-droplet', 'bi-three-dots',
];

// Alpine.store('categoryModal') — dois modais separados (não um só com
// lista+formulário juntos, "é feio", pedido explícito): `open` é a LISTA
// ("Perfil → Categorias"), `formOpen` é o formulário de criar/editar,
// empilhado por cima (.cg-modal-backdrop--stacked) quando `open` também
// está true. Mesmo padrão de bankManager.js. "+ Nova categoria" do
// formulário de lançamento continua usando openCreate(callback) — abre só
// o formulário, sem lista nenhuma por trás.
export function categoryModalStore() {
  return {
    open: false,
    formOpen: false,
    editingId: null,
    nome: '',
    cor: '#64748B',
    icone: 'bi-tag',
    iconeUrl: '',
    iconeUrlInput: '',
    modoIcone: 'preset',
    uploadingIcone: false,
    saving: false,
    onCreated: null,
    editingHadIconeUrl: false,
    iconePresets: CATEGORY_ICON_PRESETS,

    resetForm() {
      this.editingId = null;
      this.nome = '';
      this.cor = '#64748B';
      this.icone = 'bi-tag';
      this.iconeUrl = '';
      this.iconeUrlInput = '';
      this.modoIcone = 'preset';
      this.editingHadIconeUrl = false;
    },

    // Abre só o formulário, já em "criar" (usado pelo "+ Nova categoria" do
    // lançamento, e pelo "+ Nova" dentro da lista de gerenciar).
    openCreate(onCreated) {
      this.resetForm();
      this.onCreated = onCreated || null;
      this.formOpen = true;
    },

    // Abre a lista de gerenciamento (Perfil → Categorias) — só a lista,
    // formulário fica fechado até "+ Nova"/lápis.
    openManage() {
      this.open = true;
    },
    closeManage() {
      this.open = false;
    },

    editCategory(cat) {
      this.editingId = cat.id;
      this.nome = cat.nome;
      this.cor = cat.cor || '#64748B';
      this.icone = cat.icone || 'bi-tag';
      this.iconeUrl = cat.icone_url || '';
      this.iconeUrlInput = cat.icone_url || '';
      this.modoIcone = cat.icone_url ? 'url' : 'preset';
      this.editingHadIconeUrl = !!cat.icone_url;
      this.onCreated = null;
      this.formOpen = true;
    },

    closeForm() {
      this.formOpen = false;
      this.onCreated = null;
      this.resetForm();
    },

    async onIconeFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = Alpine.store('app');
      this.uploadingIcone = true;
      try {
        this.iconeUrl = await uploadCategoryIcon(store.profile.id, await resizeImage(file));
      } catch (e) {
        store.notify(e.message || 'Erro ao enviar ícone.', 'danger');
      } finally {
        this.uploadingIcone = false;
        event.target.value = '';
      }
    },

    async salvar() {
      if (!this.nome.trim()) return;
      const store = Alpine.store('app');
      this.saving = true;
      try {
        const nome = this.nome.trim();
        const iconeUrl = this.modoIcone === 'preset' ? '' : (this.iconeUrl || this.iconeUrlInput);
        let cat;
        if (this.editingId) {
          // Só manda a chave icone_url se ela tem valor OU se essa categoria
          // já tinha um ícone customizado antes (precisa mandar null pra
          // limpar). Categoria sem icone_url nunca chegou a usar essa coluna
          // — evita quebrar edições (nome/cor) em bancos que ainda não
          // rodaram a migration que adiciona ela.
          const patch = { nome, cor: this.cor, icone: this.icone };
          if (iconeUrl || this.editingHadIconeUrl) patch.icone_url = iconeUrl || null;
          cat = await updateCategory(this.editingId, patch);
          const idx = store.categories.findIndex((c) => c.id === this.editingId);
          if (idx >= 0) store.categories[idx] = cat;
          store.notify('Categoria atualizada.');
        } else {
          // "Não pode haver duplicidade, melhor reaproveitamento de
          // logotipos e títulos" (pedido explícito) — mesmo nome
          // (case-insensitive) já existente reaproveita a categoria em vez
          // de criar outra; só atualiza o ícone se um novo foi anexado e a
          // categoria existente ainda não tinha nenhum.
          const alvo = nome.toLowerCase();
          const existente = store.categories.find((c) => c.nome.trim().toLowerCase() === alvo);
          if (existente) {
            cat = existente;
            if (iconeUrl && !existente.icone_url) {
              cat = await updateCategory(existente.id, { icone_url: iconeUrl });
              const idx = store.categories.findIndex((c) => c.id === existente.id);
              if (idx >= 0) store.categories[idx] = cat;
            }
            store.notify('Já existia uma categoria "' + nome + '" — reaproveitada em vez de duplicar.');
          } else {
            cat = await createCategory({
              nome,
              cor: this.cor,
              icone: this.icone,
              iconeUrl,
              ownerId: store.profile.id,
              groupId: store.group?.group?.id ?? null,
            });
            store.categories.push(cat);
            store.notify('Categoria criada.');
          }
        }
        const callback = this.onCreated;
        this.closeForm();
        if (callback) {
          await Alpine.nextTick();
          callback(cat);
        }
      } catch (e) {
        store.notify(e.message || 'Erro ao salvar categoria.', 'danger');
      } finally {
        this.saving = false;
      }
    },

    async excluir(cat) {
      if (!confirm(`Excluir a categoria "${cat.nome}"? Lançamentos que usam ela ficam sem categoria — essa ação não pode ser desfeita.`)) return;
      const store = Alpine.store('app');
      try {
        await deleteCategory(cat.id);
        store.categories = store.categories.filter((c) => c.id !== cat.id);
        if (this.editingId === cat.id) this.closeForm();
        store.notify('Categoria excluída.');
      } catch (e) {
        store.notify(e.message || 'Erro ao excluir categoria.', 'danger');
      }
    },
  };
}
