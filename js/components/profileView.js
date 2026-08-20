import { updateProfile, uploadAvatar } from '../services/auth.js';
import { mockDb } from '../data/mockDb.js';
import { isPushSupported, getExistingSubscription, subscribeToPush, unsubscribeFromPush } from '../services/push.js';
import { resizeImage } from '../utils/image.js';
import { exportarMeusDados, baixarComoJson } from '../services/dataExport.js';

export function profileView() {
  return {
    nome: '',
    cor: '#1F7A5C',
    saving: false,
    uploadingAvatar: false,
    pushSuportado: isPushSupported(),
    pushAtivo: false,
    pushCarregando: false,
    exportando: false,

    async init() {
      this.nome = this.$store.app.profile?.nome || '';
      this.cor = this.$store.app.profile?.cor || '#1F7A5C';
      if (this.pushSuportado) {
        try {
          this.pushAtivo = !!(await getExistingSubscription());
        } catch {
          // best-effort: se a checagem falhar o switch só começa desligado
        }
      }
    },

    async alternarPush() {
      const store = this.$store.app;
      this.pushCarregando = true;
      try {
        if (this.pushAtivo) {
          await unsubscribeFromPush();
          this.pushAtivo = false;
          store.notify('Notificações push desativadas.');
        } else {
          await subscribeToPush(store.profile.id);
          this.pushAtivo = true;
          store.notify('Notificações push ativadas.');
        }
      } catch (e) {
        store.notify(e.message || 'Não foi possível alterar as notificações push.', 'danger');
      } finally {
        this.pushCarregando = false;
      }
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
        store.profile = await uploadAvatar(store.profile.id, await resizeImage(file));
        store.notify('Foto atualizada.');
      } catch (e) {
        store.notify(e.message || 'Erro ao enviar foto.', 'danger');
      } finally {
        this.uploadingAvatar = false;
        event.target.value = '';
      }
    },

    // Fase 6 (docs/BONOTTO-2027-BLUEPRINT.md §12) — exporta tudo que a
    // pessoa vê hoje num JSON baixável, sem depender de servidor nenhum.
    async exportarDados() {
      const store = this.$store.app;
      this.exportando = true;
      try {
        const dados = await exportarMeusDados({
          profile: store.profile,
          categories: store.categories,
          groupId: store.group?.group?.id,
        });
        const dataIso = new Date().toISOString().slice(0, 10);
        baixarComoJson(dados, `bonotto-meus-dados-${dataIso}.json`);
        store.notify('Dados exportados.');
      } catch (e) {
        store.notify(e.message || 'Não foi possível exportar os dados.', 'danger');
      } finally {
        this.exportando = false;
      }
    },

    resetarDemo() {
      if (!confirm('Restaurar os dados de demonstração originais? Tudo que você alterou no modo demo será perdido.')) return;
      mockDb.reset();
      location.reload();
    },
  };
}
