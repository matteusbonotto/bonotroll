import { updateProfile } from '../services/auth.js';
import { mockDb } from '../data/mockDb.js';

export function profileView() {
  return {
    nome: '',
    saving: false,

    init() {
      this.nome = this.$store.app.profile?.nome || '';
    },

    async salvar() {
      const store = this.$store.app;
      if (!this.nome.trim()) return;
      this.saving = true;
      try {
        store.profile = await updateProfile(store.profile.id, { nome: this.nome.trim() });
        store.notify('Perfil atualizado.');
      } catch (e) {
        store.notify(e.message || 'Erro ao atualizar perfil.', 'danger');
      } finally {
        this.saving = false;
      }
    },

    resetarDemo() {
      if (!confirm('Restaurar os dados de demonstração originais? Tudo que você alterou no modo demo será perdido.')) return;
      mockDb.reset();
      location.reload();
    },
  };
}
