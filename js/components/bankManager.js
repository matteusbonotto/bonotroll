import * as banksService from '../services/banks.js';
import { resizeImage } from '../utils/image.js';

// Alpine.store('bankModal') — gerencia SÓ o banco (nome + logo), separado de
// "criar/editar caixinha" (banco + moeda + meta + responsável, que fica só
// dentro da tela de Caixinhas — ver caixinhaManager.js). Pedido explícito do
// usuário: "quando eu tô em Perfil, não quero abrir as caixinhas, quero
// apenas gerenciar Banco e logo" + "isso deve ser componentizado pra
// funcionar também com categorias e empresas" — mesmo padrão de dois
// modais empilhados (lista → formulário por cima, nunca os dois juntos no
// mesmo modal) usado por categoryModal/companyModal.
//
// Duas portas de entrada:
// - openManage(): lista de bancos (Perfil → Bancos, ou "Gerenciar bancos"
//   dentro da tela de Caixinhas) — "+ Novo"/lápis abrem o formulário POR
//   CIMA da lista (fica com cg-modal-backdrop--stacked, z-index maior).
// - openCreate(callback): direto pro formulário, sem lista (usado pelo
//   seletor de banco no formulário de caixinha, "+ Novo banco…") — mesmo
//   papel de categoryModal.openCreate ao criar categoria de dentro do
//   formulário de despesa.
export function bankModalStore() {
  return {
    open: false, // lista visível
    loading: false,
    items: [],

    formOpen: false,
    editingId: null,
    nome: '',
    logoUrl: '',
    logoUrlInput: '',
    uploading: false,
    saving: false,
    onCreated: null,

    resetForm() {
      this.editingId = null;
      this.nome = '';
      this.logoUrl = '';
      this.logoUrlInput = '';
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
    edit(bank) {
      this.editingId = bank.id;
      this.nome = bank.nome;
      this.logoUrl = bank.logo_url || '';
      this.logoUrlInput = bank.logo_url || '';
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
        this.items = await banksService.listBanks({ ownerId: store.profile.id, groupId: store.group?.group?.id });
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar os bancos.', 'danger');
      } finally {
        this.loading = false;
      }
    },

    async onLogoFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = Alpine.store('app');
      this.uploading = true;
      try {
        this.logoUrl = await banksService.uploadBankLogo(store.profile.id, await resizeImage(file));
      } catch (e) {
        store.notify(e.message || 'Erro ao enviar logo.', 'danger');
      } finally {
        this.uploading = false;
        event.target.value = '';
      }
    },

    async salvar() {
      if (!this.nome.trim() || this.saving) return;
      const store = Alpine.store('app');
      this.saving = true;
      try {
        const nome = this.nome.trim();
        const logoUrl = this.logoUrl || this.logoUrlInput || null;
        let banco;
        if (this.editingId) {
          banco = await banksService.updateBank(this.editingId, { nome, logo_url: logoUrl });
          const idx = this.items.findIndex((b) => b.id === banco.id);
          if (idx >= 0) this.items[idx] = banco;
          store.notify('Banco atualizado.');
        } else {
          // Mesmo "não pode haver bancos duplicados": se já existe um banco
          // com esse nome, reaproveita em vez de criar outro.
          banco = await banksService.findOrCreateBank({ nome, logoUrl, ownerId: store.profile.id, groupId: store.group?.group?.id ?? null, existingBanks: store.banks.length ? store.banks : this.items });
          if (!this.items.some((b) => b.id === banco.id)) this.items.push(banco);
          store.notify('Banco criado.');
        }
        await store.refreshBanks();
        const callback = this.onCreated;
        this.closeForm();
        if (callback) await Alpine.nextTick().then(() => callback(banco));
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar o banco.', 'danger');
      } finally {
        this.saving = false;
      }
    },

    async excluir(bank) {
      if (!confirm(`Excluir o banco "${bank.nome}"? Caixinhas que usam esse nome deixam de mostrar o logo — essa ação não pode ser desfeita.`)) return;
      const store = Alpine.store('app');
      try {
        await banksService.deleteBank(bank.id);
        this.items = this.items.filter((b) => b.id !== bank.id);
        await store.refreshBanks();
        store.notify('Banco excluído.');
      } catch (e) {
        store.notify(e.message || 'Não foi possível excluir o banco.', 'danger');
      }
    },
  };
}
