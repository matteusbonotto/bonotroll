import * as groupsService from '../services/groups.js';
import { listTransactions, listPayersFor, computeSaldosEntreMembros } from '../services/transactions.js';

// Tela "Grupo": criar/entrar/sair de um grupo (ex.: família). Sempre opcional.
export function groupView() {
  return {
    nomeGrupo: '',
    codigoEntrada: '',
    loading: false,
    editandoNome: false,
    novoNome: '',
    saldosEntreMembros: [], // "Entre vocês" — ver computeSaldosEntreMembros

    init() {
      this.carregarSaldos();
      window.addEventListener('cg:transactions-changed', () => this.carregarSaldos());
      this.$watch('$store.app.group', () => this.carregarSaldos());
    },

    // Best-effort (padrão §14.4 do RAIO-X): "quem deve quanto" é um
    // complemento da tela de Grupo, nunca pode impedir o resto dela (criar/
    // entrar/sair) de funcionar se a busca falhar.
    async carregarSaldos() {
      const store = this.$store.app;
      if (!store.group || !store.profile) { this.saldosEntreMembros = []; return; }
      try {
        const groupId = store.group.group.id;
        const txs = await listTransactions({ ownerId: store.profile.id, groupId });
        const payersMap = await listPayersFor(txs.map((t) => t.id));
        this.saldosEntreMembros = computeSaldosEntreMembros(txs, Object.fromEntries(payersMap));
      } catch {
        this.saldosEntreMembros = [];
      }
    },

    nomeMembro(id) {
      return this.$store.app.profileById(id)?.nome || '—';
    },

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
