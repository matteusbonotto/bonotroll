import { createCompany, deleteCompany, updateCompany, uploadCompanyLogo } from '../services/companies.js';
import { resizeImage } from '../utils/image.js';

// Alpine.store('companyModal') — dois modais separados: `open` é a LISTA
// ("Perfil → Empresas e serviços"), `formOpen` é o formulário de criar/
// editar, empilhado por cima (.cg-modal-backdrop--stacked) quando `open`
// também está true. Mesmo padrão de bankManager.js/categoryManager.js.
export function companyModalStore() {
  return {
    open: false,
    formOpen: false,
    editingId: null,
    nome: '',
    logoUrl: '',
    saving: false,
    uploading: false,

    openManage() {
      this.open = true;
    },
    closeManage() {
      this.open = false;
    },
    openCreate() {
      this.resetForm();
      this.formOpen = true;
    },
    closeForm() {
      this.formOpen = false;
      this.resetForm();
    },
    resetForm() {
      this.editingId = null;
      this.nome = '';
      this.logoUrl = '';
    },
    edit(company) {
      this.editingId = company.id;
      this.nome = company.nome;
      this.logoUrl = company.logo_url || '';
      this.formOpen = true;
    },
    async onLogoFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = Alpine.store('app');
      this.uploading = true;
      try {
        this.logoUrl = await uploadCompanyLogo(store.profile.id, await resizeImage(file));
      } catch (error) {
        store.notify(error.message || 'Erro ao enviar logo.', 'danger');
      } finally {
        this.uploading = false;
        event.target.value = '';
      }
    },
    async save() {
      if (!this.nome.trim()) return;
      const store = Alpine.store('app');
      this.saving = true;
      try {
        const nome = this.nome.trim();
        let company;
        if (this.editingId) {
          company = await updateCompany(this.editingId, { nome, logo_url: this.logoUrl || null });
          const index = store.companies.findIndex((item) => item.id === company.id);
          if (index >= 0) store.companies[index] = company;
          store.notify('Empresa atualizada.');
        } else {
          // "Não pode haver duplicidade, melhor reaproveitamento de
          // logotipos e títulos" (pedido explícito) — mesmo nome
          // (case-insensitive) já existente reaproveita em vez de duplicar.
          const alvo = nome.toLowerCase();
          const existente = store.companies.find((c) => c.nome.trim().toLowerCase() === alvo);
          if (existente) {
            company = existente;
            if (this.logoUrl && !existente.logo_url) {
              company = await updateCompany(existente.id, { logo_url: this.logoUrl });
              const index = store.companies.findIndex((item) => item.id === existente.id);
              if (index >= 0) store.companies[index] = company;
            }
            store.notify('Já existia uma empresa "' + nome + '" — reaproveitada em vez de duplicar.');
          } else {
            company = await createCompany({
              nome,
              logoUrl: this.logoUrl,
              ownerId: store.profile.id,
              groupId: store.group?.group?.id,
            });
            store.companies.push(company);
            store.notify('Empresa criada.');
          }
        }
        this.closeForm();
      } catch (error) {
        store.notify(error.message || 'Erro ao salvar empresa.', 'danger');
      } finally {
        this.saving = false;
      }
    },
    async remove(company) {
      if (!confirm(`Excluir "${company.nome}" da lista de empresas? Lancamentos existentes nao serao removidos.`)) return;
      const store = Alpine.store('app');
      try {
        await deleteCompany(company.id);
        store.companies = store.companies.filter((item) => item.id !== company.id);
        if (this.editingId === company.id) this.closeForm();
        store.notify('Empresa removida.');
      } catch (error) {
        store.notify(error.message || 'Erro ao remover empresa.', 'danger');
      }
    },
  };
}
