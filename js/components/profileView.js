import { updateProfile, uploadAvatar } from '../services/auth.js';
import { mockDb } from '../data/mockDb.js';
import { isPushSupported, estadoPush, subscribeToPush, unsubscribeFromPush } from '../services/push.js';
import { resizeImage } from '../utils/image.js';
import { exportarMeusDados, baixarComoJson } from '../services/dataExport.js';

export function profileView() {
  return {
    nome: '',
    cor: '#0E9F6E',
    saving: false,
    uploadingAvatar: false,
    pushSuportado: isPushSupported(),
    pushEstado: 'verificando',
    pushErro: '',
    pushCarregando: false,
    exportando: false,

    async init() {
      this.nome = this.$store.app.profile?.nome || '';
      this.cor = this.$store.app.profile?.cor || '#0E9F6E';
      await this.verificarPush();
    },

    // Estado real (ver services/push.js::estadoPush) — a tela nunca finge.
    async verificarPush() {
      this.pushErro = '';
      try {
        this.pushEstado = await estadoPush();
      } catch {
        this.pushEstado = 'nao-pedido';
      }
    },

    async ativarPush() {
      const store = this.$store.app;
      this.pushCarregando = true;
      this.pushErro = '';
      try {
        await subscribeToPush(store.profile.id);
        await this.verificarPush();
        if (this.pushEstado === 'ativo') store.notify('Notificações ativadas neste aparelho.');
      } catch (e) {
        if (e.estado) this.pushEstado = e.estado;
        this.pushErro = e.estado === 'bloqueado' ? '' : (e.message || 'Não foi possível ativar agora. Tente de novo.');
      } finally {
        this.pushCarregando = false;
      }
    },

    async desativarPush() {
      this.pushCarregando = true;
      try {
        await unsubscribeFromPush();
        this.$store.app.notify('Notificações desativadas neste aparelho.');
      } catch (e) {
        this.pushErro = e.message || 'Não foi possível desativar agora.';
      } finally {
        this.pushCarregando = false;
        await this.verificarPush();
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
        baixarComoJson(dados, `bntt-meus-dados-${dataIso}.json`);
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
