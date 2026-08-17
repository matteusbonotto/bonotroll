// Tela de entrada: em modo demonstração mostra acesso rápido (Matheus/Beatriz);
// com Supabase configurado, mostra e-mail/senha (login e cadastro).
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
        if (this.mode === 'signup') {
          const session = await this.$store.app.signup(this.email, this.password, this.nome);
          if (!session) this.info = 'Conta criada! Verifique seu e-mail para confirmar o acesso.';
        } else {
          await this.$store.app.loginPassword(this.email, this.password);
        }
      } catch (e) {
        this.error = e.message || 'Não foi possível entrar. Confira os dados e tente novamente.';
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
