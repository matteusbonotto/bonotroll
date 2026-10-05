// Tela de entrada: em modo demonstração mostra acesso rápido (Matheus/Beatriz);
// com Supabase configurado, mostra e-mail/senha (login e cadastro).
import { sendPasswordReset, mensagemErroAuth, reenviarConfirmacao } from '../services/auth.js';

export function authView() {
  return {
    mode: 'login',
    email: '',
    password: '',
    nome: '',
    loading: false,
    error: '',
    info: '',
    podeReenviar: false, // cadastro feito, ou "confirme seu e-mail" no login
    reenviadoEm: 0,

    async reenviar() {
      if (Date.now() - this.reenviadoEm < 60000) {
        this.info = 'Acabamos de enviar. Espere 1 minuto e confira também a caixa de spam.';
        return;
      }
      this.error = '';
      try {
        await reenviarConfirmacao(this.email.trim());
        this.reenviadoEm = Date.now();
        this.info = 'Enviamos de novo. Confira a caixa de entrada e o spam (remetente: BNTT).';
      } catch (e) {
        this.error = mensagemErroAuth(e);
      }
    },

    // Veio da LP com "Começar grátis" ou "Assinar": abre já no cadastro.
    init() {
      if (this.$store.app.intencao?.cadastro) this.mode = 'signup';
    },

    async submit() {
      this.error = '';
      this.info = '';
      this.loading = true;
      try {
        if (this.mode === 'recuperar') {
          await sendPasswordReset(this.email.trim());
          this.info = 'Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha. Confira a caixa de entrada e o spam.';
        } else if (this.mode === 'signup') {
          const session = await this.$store.app.signup(this.email, this.password, this.nome);
          if (!session) {
            this.info = 'Conta criada! Enviamos um link para o seu e-mail — toque nele para confirmar e entrar. Não chegou? Veja o spam.';
            this.podeReenviar = true;
          }
        } else {
          await this.$store.app.loginPassword(this.email, this.password);
        }
      } catch (e) {
        this.error = mensagemErroAuth(e);
        this.podeReenviar = /email not confirmed/i.test(e?.message || '');
      } finally {
        this.loading = false;
      }
    },

    async enterDemo(profileId) {
      this.loading = true;
      this.error = '';
      try {
        await this.$store.app.loginDemo(profileId);
      } finally {
        this.loading = false;
      }
    },
  };
}
