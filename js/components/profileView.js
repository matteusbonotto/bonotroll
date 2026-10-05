import { updateProfile, uploadAvatar, excluirMinhaConta } from '../services/auth.js';
import { mockDb } from '../data/mockDb.js';
import { isPushSupported, estadoPush, subscribeToPush, unsubscribeFromPush, explicarErroPush } from '../services/push.js';
import { resizeImage } from '../utils/image.js';
import { exportarMeusDados, baixarComoJson } from '../services/dataExport.js';

export function profileView() {
  return {
    nome: '',
    cor: '#0E9F6E',
    saving: false,
    uploadingAvatar: false,
    pushSuportado: isPushSupported(),
    // Aberto pelo app instalado (PWA): as instruções de desbloqueio são outras.
    appInstalado: window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true,
    pushEstado: 'verificando',
    pushErro: '',
    pushErroTecnico: '',
    pushCarregando: false,
    exportando: false,
    // Excluir conta (LGPD)
    excluirAberto: false,
    excluirSenha: '',
    excluirEntendi: false,
    excluindo: false,
    excluirErro: '',

    async excluirConta() {
      this.excluirErro = '';
      if (!this.excluirEntendi || !this.excluirSenha) return;
      this.excluindo = true;
      try {
        await excluirMinhaConta(this.excluirSenha);
        this.excluirSenha = '';
        this.excluirAberto = false;
        this.$store.app.clearSession();
        this.$store.app.notify('Sua conta e seus dados foram excluídos.');
      } catch (e) {
        this.excluirErro = e.message;
      } finally {
        this.excluindo = false;
      }
    },

    async init() {
      this.nome = this.$store.app.profile?.nome || '';
      this.cor = this.$store.app.profile?.cor || '#0E9F6E';
      await this.verificarPush();
      // A tela monta antes do login: confere de novo quando a conta chegar.
      this.$watch('$store.app.profile?.id', () => this.verificarPush());
    },

    // Estado real (ver services/push.js::estadoPush) — a tela nunca finge.
    async verificarPush() {
      this.pushErro = '';
      this.pushErroTecnico = '';
      if (!this.$store.app.profile?.id) return; // ainda sem conta: não dá para conferir o servidor
      try {
        this.pushEstado = await estadoPush();
      } catch {
        this.pushEstado = 'nao-pedido';
      }
      // Permitido no aparelho mas sem registro no servidor (ex.: trocou de
      // conta, ou a ativação caiu no meio): conclui sozinho, sem novo pedido.
      if (this.pushEstado === 'so-no-aparelho' && !this.pushCarregando) await this.ativarPush(true);
    },

    async ativarPush(silencioso = false) {
      const store = this.$store.app;
      this.pushCarregando = true;
      this.pushErro = '';
      this.pushErroTecnico = '';
      try {
        await subscribeToPush(store.profile.id);
        this.pushEstado = await estadoPush();
        if (this.pushEstado === 'ativo' && !silencioso) store.notify('Notificações ativadas neste aparelho.');
      } catch (e) {
        if (e.estado) {
          this.pushEstado = e.estado;
          if (e.estado === 'nao-pedido') this.pushErro = e.message;
        } else if (!silencioso) {
          const { mensagem, tecnico } = explicarErroPush(e);
          this.pushErro = mensagem;
          this.pushErroTecnico = tecnico;
        }
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
