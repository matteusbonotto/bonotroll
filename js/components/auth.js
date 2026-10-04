// Tela de entrada: em modo demonstração mostra acesso rápido (Matheus/Beatriz);
// com Supabase configurado, mostra e-mail/senha (login e cadastro).
import { sendPasswordReset, mensagemErroAuth } from '../services/auth.js';

export function authView() {
  return {
    mode: 'login',
    email: '',
    password: '',
    nome: '',
    loading: false,
    error: '',
    info: '',

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
          if (!session) this.info = 'Conta criada! Verifique seu e-mail para confirmar o acesso.';
        } else {
          await this.$store.app.loginPassword(this.email, this.password);
        }
      } catch (e) {
        this.error = mensagemErroAuth(e);
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
