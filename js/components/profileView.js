import { updateProfile, uploadAvatar } from '../services/auth.js';
import { mockDb } from '../data/mockDb.js';

export function profileView() {
  return {
    nome: '',
    cor: '#1F7A5C',
    saving: false,
    uploadingAvatar: false,

    init() {
      this.nome = this.$store.app.profile?.nome || '';
      this.cor = this.$store.app.profile?.cor || '#1F7A5C';
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

    async salvarCor() {
      const store = this.$store.app;
      try {
        store.profile = await updateProfile(store.profile.id, { cor: this.cor });
        store.notify('Cor atualizada.');
      } catch (e) {
        store.notify(e.message || 'Erro ao atualizar cor.', 'danger');
      }
    },

    async onAvatarChange(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = this.$store.app;
      this.uploadingAvatar = true;
      try {
        store.profile = await uploadAvatar(store.profile.id, file);
        store.notify('Foto atualizada.');
      } catch (e) {
        store.notify(e.message || 'Erro ao enviar foto.', 'danger');
      } finally {
        this.uploadingAvatar = false;
        event.target.value = '';
      }
    },

    resetarDemo() {
      if (!confirm('Restaurar os dados de demonstração originais? Tudo que você alterou no modo demo será perdido.')) return;
      mockDb.reset();
      location.reload();
    },
  };
}
