import { createCompany, deleteCompany, updateCompany, uploadCompanyLogo } from '../services/companies.js';
import { resizeImage } from '../utils/image.js';

export function companyModalStore() {
  return {
    open: false,
    editingId: null,
    nome: '',
    logoUrl: '',
    saving: false,
    uploading: false,

    openManage() {
      this.resetForm();
      this.open = true;
    },
    close() {
      this.open = false;
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
        let company;
        if (this.editingId) {
          company = await updateCompany(this.editingId, { nome: this.nome.trim(), logo_url: this.logoUrl || null });
          const index = store.companies.findIndex((item) => item.id === company.id);
          if (index >= 0) store.companies[index] = company;
          store.notify('Empresa atualizada.');
        } else {
          company = await createCompany({
            nome: this.nome.trim(),
            logoUrl: this.logoUrl,
            ownerId: store.profile.id,
            groupId: store.group?.group?.id,
          });
          store.companies.push(company);
          store.notify('Empresa criada.');
        }
        this.resetForm();
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
        if (this.editingId === company.id) this.resetForm();
        store.notify('Empresa removida.');
      } catch (error) {
        store.notify(error.message || 'Erro ao remover empresa.', 'danger');
      }
    },
  };
}
