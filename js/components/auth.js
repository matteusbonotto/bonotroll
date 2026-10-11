// Tela de entrada: em modo demonstração mostra acesso rápido (Matheus/Beatriz);
// com Supabase configurado, mostra e-mail/senha (login e cadastro), Google e a
// confirmação do e-mail por link ou código.
import { sendPasswordReset, mensagemErroAuth, reenviarConfirmacao, segundosParaReenviar, normalizarCodigo } from '../services/auth.js';

export function authView() {
  return {
    mode: 'login', // 'login' | 'signup' | 'recuperar' | 'confirmar'
    email: '',
    password: '',
    nome: '',
    codigo: '',
    loading: false,
    error: '',
    info: '',
    agora: Date.now(), // relógio da contagem regressiva do "Reenviar"
    relogio: null,

    // Segundos até poder pedir outro e-mail (sobrevive a um F5 — ver
    // segundosParaReenviar). Depende de `agora` para o Alpine redesenhar.
    get esperaReenvio() {
      return this.email ? segundosParaReenviar(this.email.trim(), this.agora) : 0;
    },

    irPara(mode) {
      this.mode = mode;
      this.error = '';
      this.info = '';
    },

    async reenviar() {
      this.error = '';
      this.info = '';
      try {
        await reenviarConfirmacao(this.email.trim());
        this.agora = Date.now();
        this.info = 'Enviamos de novo. Confira a caixa de entrada e o spam (remetente: BNTT). Use sempre o e-mail mais recente.';
      } catch (e) {
        this.error = mensagemErroAuth(e);
      }
    },

    // Veio da LP com "Começar grátis" ou "Assinar": abre já no cadastro.
    // Voltou de um link de confirmação expirado/usado: abre a confirmação,
    // onde dá para pedir outro e-mail ou digitar o código.
    init() {
      if (this.$store.app.intencao?.cadastro) this.mode = 'signup';
      if (this.$store.app.erroRetornoAuth) {
        this.error = this.$store.app.erroRetornoAuth;
        if (this.$store.app.erroRetornoCodigo !== 'access_denied') this.mode = 'confirmar';
        this.$store.app.erroRetornoAuth = '';
      }
      this.relogio = setInterval(() => { this.agora = Date.now(); }, 1000);
    },

    destroy() {
      clearInterval(this.relogio);
    },

    async entrarComGoogle() {
      this.error = '';
      this.loading = true;
      try {
        await this.$store.app.loginGoogle();
        // segue para a página do Google — o loading fica até a página trocar
      } catch (e) {
        this.error = mensagemErroAuth(e);
        this.loading = false;
      }
    },

    async submit() {
      this.error = '';
      this.info = '';
      this.loading = true;
      try {
        if (this.mode === 'recuperar') {
          await sendPasswordReset(this.email.trim());
          this.info = 'Se houver uma conta com este e-mail, enviamos um link para criar uma nova senha. Confira a caixa de entrada e o spam.';
        } else if (this.mode === 'confirmar') {
          const codigo = normalizarCodigo(this.codigo);
          if (!codigo) {
            this.error = 'Digite o código de 6 dígitos que veio no e-mail.';
            return;
          }
          await this.$store.app.confirmarCodigoCadastro(this.email.trim(), codigo);
        } else if (this.mode === 'signup') {
          const { situacao } = await this.$store.app.signup(this.email.trim(), this.password, this.nome);
          if (situacao === 'ja_existe') {
            this.mode = 'login';
            this.error = 'Já existe uma conta com este e-mail. Entre com sua senha ou use "Esqueci minha senha". Se você ainda não confirmou o e-mail, entre para receber outro.';
          } else if (situacao === 'confirmar_email') {
            this.mode = 'confirmar';
            this.info = 'Conta criada! Enviamos um e-mail para você confirmar: toque no link ou digite aqui o código. Não chegou? Veja o spam.';
          }
        } else {
          await this.$store.app.loginPassword(this.email.trim(), this.password);
        }
      } catch (e) {
        this.error = mensagemErroAuth(e);
        // Login de quem ainda não confirmou: leva para a confirmação.
        if (this.mode === 'login' && /email not confirmed|email_not_confirmed/i.test(`${e?.code} ${e?.message}`)) this.mode = 'confirmar';
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
