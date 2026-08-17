import * as groupsService from '../services/groups.js';

// Tela "Grupo": criar/entrar/sair de um grupo (ex.: família). Sempre opcional.
export function groupView() {
  return {
    nomeGrupo: '',
    codigoEntrada: '',
    loading: false,

    async criar() {
      if (!this.nomeGrupo.trim()) return;
      const store = this.$store.app;
      this.loading = true;
      try {
        await groupsService.createGroup(this.nomeGrupo.trim(), store.profile.id);
        await store.refreshGroup();
        await store.refreshCategories();
        store.notify('Grupo criado! Compartilhe o código com quem vai participar.');
        this.nomeGrupo = '';
      } catch (e) {
        store.notify(e.message || 'Erro ao criar grupo.', 'danger');
      } finally {
        this.loading = false;
      }
    },

    async entrar() {
      if (!this.codigoEntrada.trim()) return;
      const store = this.$store.app;
      this.loading = true;
      try {
        await groupsService.joinGroupByCode(this.codigoEntrada.trim(), store.profile.id);
        await store.refreshGroup();
        await store.refreshCategories();
        store.notify('Você entrou no grupo!');
        this.codigoEntrada = '';
      } catch (e) {
        store.notify(e.message || 'Código inválido.', 'danger');
      } finally {
        this.loading = false;
      }
    },

    async sair() {
      const store = this.$store.app;
      if (!confirm('Sair do grupo? Você deixará de ver os dados compartilhados.')) return;
      await groupsService.leaveGroup(store.group.group.id, store.profile.id);
      await store.refreshGroup();
      await store.refreshCategories();
      store.notify('Você saiu do grupo.');
    },
  };
}
