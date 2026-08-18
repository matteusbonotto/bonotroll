import * as groupsService from '../services/groups.js';

// Tela "Grupo": criar/entrar/sair de um grupo (ex.: família). Sempre opcional.
export function groupView() {
  return {
    nomeGrupo: '',
    codigoEntrada: '',
    loading: false,
    editandoNome: false,
    novoNome: '',

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
      try {
        await groupsService.leaveGroup(store.group.group.id, store.profile.id);
        await store.refreshGroup();
        await store.refreshCategories();
        store.notify('Você saiu do grupo.');
      } catch (e) {
        store.notify(e.message || 'Erro ao sair do grupo.', 'danger');
      }
    },

    souAdmin() {
      const group = this.$store.app.group?.group;
      return !!group && group.criado_por === this.$store.app.profile?.id;
    },

    iniciarEdicaoNome() {
      this.novoNome = this.$store.app.group.group.nome;
      this.editandoNome = true;
    },

    async salvarNome() {
      if (!this.novoNome.trim()) return;
      const store = this.$store.app;
      try {
        await groupsService.updateGroupName(store.group.group.id, this.novoNome.trim());
        await store.refreshGroup();
        this.editandoNome = false;
        store.notify('Nome do grupo atualizado.');
      } catch (e) {
        store.notify(e.message || 'Erro ao renomear grupo.', 'danger');
      }
    },

    async excluirGrupo() {
      const store = this.$store.app;
      if (!confirm('Excluir o grupo? Isso remove o grupo pra todo mundo (os lançamentos e categorias de cada pessoa continuam intactos, só deixam de ser compartilhados). Essa ação não pode ser desfeita.')) return;
      try {
        await groupsService.deleteGroup(store.group.group.id);
        await store.refreshGroup();
        await store.refreshCategories();
        store.notify('Grupo excluído.');
      } catch (e) {
        store.notify(e.message || 'Erro ao excluir grupo.', 'danger');
      }
    },
  };
}
