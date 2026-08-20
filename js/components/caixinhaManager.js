import * as cx from '../services/caixinhas.js';
import { resizeImage } from '../utils/image.js';
import { MOEDAS_SUPORTADAS } from '../utils/format.js';
import { CAIXINHA_ICON_PRESETS } from './caixinhasView.js';

const FORM_VAZIO = () => ({ bancoNome: '', moeda: 'BRL', meta: '', icone: 'bi-piggy-bank', responsavelId: '' });

// Modal único (Alpine.store('caixinhaModal')), mesmo padrão de
// categoryModalStore/companyModalStore: gerencia (lista + cria + edita +
// exclui) direto de "Perfil → Caixinhas", sem precisar navegar pra tela de
// Caixinhas (que continua existindo, focada em ver saldo/histórico e
// registrar aportes/retiradas — não em cadastro).
//
// Diferente de categories/companies (que ficam cacheadas em
// Alpine.store('app')), a lista de caixinhas é carregada aqui mesmo — a
// tela de Caixinhas também carrega a dela por conta própria (tem que
// buscar as movimentações junto). Depois de qualquer criação/edição/
// exclusão por aqui, dispara 'cg:caixinhas-changed' pra tela de Caixinhas
// recarregar se estiver montada — mesmo padrão de 'cg:shopping-changed'
// em shoppingList.js.
export function caixinhaModalStore() {
  return {
    open: false,
    loading: false,
    items: [],
    editingId: null,
    ...FORM_VAZIO(),
    iconeUrl: '',
    iconeUrlInput: '',
    modoIcone: 'preset',
    uploadingIcone: false,
    editingHadIconeUrl: false,
    saving: false,
    iconePresets: CAIXINHA_ICON_PRESETS,
    moedasSuportadas: MOEDAS_SUPORTADAS,

    resetForm() {
      Object.assign(this, FORM_VAZIO());
      this.editingId = null;
      this.iconeUrl = '';
      this.iconeUrlInput = '';
      this.modoIcone = 'preset';
      this.editingHadIconeUrl = false;
      const store = Alpine.store('app');
      if (store.profile) this.responsavelId = store.profile.id;
    },

    get membros() {
      const store = Alpine.store('app');
      if (!store.profile) return [];
      return [store.profile, ...(store.group?.members || []).filter((m) => m.id !== store.profile.id)];
    },

    async openManage() {
      this.resetForm();
      this.open = true;
      await this.carregar();
    },
    close() {
      this.open = false;
      this.resetForm();
    },

    async carregar() {
      const store = Alpine.store('app');
      if (!store.profile) return;
      this.loading = true;
      try {
        this.items = await cx.listCaixinhas({ ownerId: store.profile.id, groupId: store.group?.group?.id });
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar as caixinhas.', 'danger');
      } finally {
        this.loading = false;
      }
    },

    edit(c) {
      this.editingId = c.id;
      this.bancoNome = c.banco_nome;
      this.moeda = c.moeda || 'BRL';
      this.meta = c.meta || '';
      this.icone = c.icone || 'bi-piggy-bank';
      this.responsavelId = c.owner_id;
      this.iconeUrl = c.icone_url || '';
      this.iconeUrlInput = c.icone_url || '';
      this.modoIcone = c.icone_url ? 'url' : 'preset';
      this.editingHadIconeUrl = !!c.icone_url;
    },

    async onIconeFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = Alpine.store('app');
      this.uploadingIcone = true;
      try {
        this.iconeUrl = await cx.uploadCaixinhaIcone(store.profile.id, await resizeImage(file));
      } catch (e) {
        store.notify(e.message || 'Erro ao enviar imagem.', 'danger');
      } finally {
        this.uploadingIcone = false;
        event.target.value = '';
      }
    },

    async salvar() {
      if (!this.bancoNome.trim() || this.saving) return;
      const store = Alpine.store('app');
      this.saving = true;
      try {
        if (this.modoIcone === 'url') this.iconeUrl = this.iconeUrlInput;
        const iconeUrl = this.modoIcone === 'preset' ? '' : (this.iconeUrl || this.iconeUrlInput);
        const patch = {
          banco_nome: this.bancoNome.trim(),
          moeda: this.moeda || 'BRL',
          meta: this.meta ? Number(this.meta) : null,
          icone: this.icone,
          owner_id: this.responsavelId || store.profile.id,
        };
        if (iconeUrl || this.editingHadIconeUrl) patch.icone_url = iconeUrl || null;

        if (this.editingId) {
          const atualizada = await cx.updateCaixinha(this.editingId, patch);
          const idx = this.items.findIndex((c) => c.id === atualizada.id);
          if (idx >= 0) this.items[idx] = atualizada;
          store.notify('Caixinha atualizada.');
        } else {
          const criada = await cx.createCaixinha({
            bancoNome: patch.banco_nome,
            moeda: patch.moeda,
            meta: patch.meta,
            icone: patch.icone,
            iconeUrl,
            ownerId: patch.owner_id,
            groupId: store.group?.group?.id,
          });
          this.items.push(criada);
          store.notify('Caixinha criada.');
        }
        this.resetForm();
        window.dispatchEvent(new CustomEvent('cg:caixinhas-changed'));
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar a caixinha.', 'danger');
      } finally {
        this.saving = false;
      }
    },

    async excluir(c) {
      if (!confirm(`Excluir a caixinha "${c.banco_nome}"? O histórico de movimentações dela também será excluído — essa ação não pode ser desfeita.`)) return;
      const store = Alpine.store('app');
      try {
        await cx.deleteCaixinha(c.id);
        this.items = this.items.filter((x) => x.id !== c.id);
        if (this.editingId === c.id) this.resetForm();
        store.notify('Caixinha excluída.');
        window.dispatchEvent(new CustomEvent('cg:caixinhas-changed'));
      } catch (e) {
        store.notify(e.message || 'Não foi possível excluir a caixinha.', 'danger');
      }
    },
  };
}
