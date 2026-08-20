import { createCategory, updateCategory, deleteCategory, uploadCategoryIcon } from '../services/categories.js';
import { resizeImage } from '../utils/image.js';

export const CATEGORY_ICON_PRESETS = [
  'bi-tag', 'bi-house-door', 'bi-car-front', 'bi-basket', 'bi-cart3',
  'bi-cash-coin', 'bi-heart', 'bi-airplane', 'bi-gift', 'bi-lightning-charge',
  'bi-phone', 'bi-book', 'bi-cup-straw', 'bi-bicycle', 'bi-collection-play',
  'bi-mortarboard', 'bi-droplet', 'bi-three-dots',
];

// Modal único (Alpine.store('categoryManager')) usado tanto pela tela
// "Perfil → Gerenciar categorias" (listar/editar/excluir todas) quanto pelo
// "+ Nova categoria" do formulário de lançamento (onCreated seleciona a
// categoria recém-criada de volta no formulário que abriu o modal).
export function categoryModalStore() {
  return {
    open: false,
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

    // Abre já focado em criar (usado pelo "+ Nova categoria" do lançamento).
    openCreate(onCreated) {
      this.resetForm();
      this.onCreated = onCreated || null;
      this.open = true;
    },

    // Abre a lista de gerenciamento (usado pelo Perfil).
    openManage() {
      this.resetForm();
      this.onCreated = null;
      this.open = true;
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
    },

    close() {
      this.open = false;
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
        const iconeUrl = this.modoIcone === 'preset' ? '' : (this.iconeUrl || this.iconeUrlInput);
        let cat;
        if (this.editingId) {
          // Só manda a chave icone_url se ela tem valor OU se essa categoria
          // já tinha um ícone customizado antes (precisa mandar null pra
          // limpar). Categoria sem icone_url nunca chegou a usar essa coluna
          // — evita quebrar edições (nome/cor) em bancos que ainda não
          // rodaram a migration que adiciona ela.
          const patch = { nome: this.nome.trim(), cor: this.cor, icone: this.icone };
          if (iconeUrl || this.editingHadIconeUrl) patch.icone_url = iconeUrl || null;
          cat = await updateCategory(this.editingId, patch);
          const idx = store.categories.findIndex((c) => c.id === this.editingId);
          if (idx >= 0) store.categories[idx] = cat;
          store.notify('Categoria atualizada.');
        } else {
          cat = await createCategory({
            nome: this.nome.trim(),
            cor: this.cor,
            icone: this.icone,
            iconeUrl,
            ownerId: store.profile.id,
            groupId: store.group?.group?.id ?? null,
          });
          store.categories.push(cat);
          store.notify('Categoria criada.');
        }
        const callback = this.onCreated;
        this.resetForm();
        if (callback) {
          // "+ Nova categoria" do lançamento: cria e já volta pro formulário
          // com ela selecionada, sem precisar ficar na tela de gerenciar.
          await Alpine.nextTick();
          callback(cat);
          this.close();
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
        if (this.editingId === cat.id) this.resetForm();
        store.notify('Categoria excluída.');
      } catch (e) {
        store.notify(e.message || 'Erro ao excluir categoria.', 'danger');
      }
    },
  };
}
