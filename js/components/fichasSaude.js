import * as cofre from '../services/cofre.js';
import * as saude from '../services/saude.js';

// Fichas de emergência das pessoas da casa (Palm Business, fase 8).
// Etapas: sem-cofre → (criar senha) → codigo (mostrar código 1x) → aberto;
// com cofre e sem chave neste aparelho → bloqueado → (senha ou código) → aberto.
export function fichasSaude() {
  return {
    etapa: 'carregando',
    cofreAtual: null,
    chave: null,
    fichas: [],
    erro: '',
    ocupado: false,
    senha1: '',
    senha2: '',
    codigoMostrado: '',
    guardouCodigo: false,
    senhaDesbloqueio: '',
    usarCodigo: false,
    form: null, // ficha em edição (com textos das listas)
    TIPOS: saude.TIPOS_SANGUINEOS,

    get escopo() {
      const app = this.$store.app;
      return { ownerId: app.profile?.id, groupId: app.group?.group?.id ?? null };
    },

    async init() {
      try {
        this.cofreAtual = await cofre.buscarCofre(this.escopo);
        if (!this.cofreAtual) { this.etapa = 'sem-cofre'; return; }
        this.chave = await cofre.chaveDoAparelho(this.cofreAtual.id);
        if (this.chave) await this.abrir();
        else this.etapa = 'bloqueado';
      } catch (e) {
        this.erro = this._mensagem(e);
        this.etapa = 'erro';
      }
    },

    _mensagem(e) {
      const m = (e?.message || '').toLowerCase();
      if (m.includes('relation') || m.includes('does not exist') || m.includes('schema cache')) {
        return 'As fichas de saúde ainda estão sendo ativadas no servidor. Tente de novo mais tarde.';
      }
      if (m.includes('failed to fetch')) return 'Sem conexão. Verifique a internet e tente de novo.';
      return e?.message || 'Não foi possível concluir agora.';
    },

    async criarCofre() {
      this.erro = '';
      if (this.senha1.length < 8) { this.erro = 'A senha da família precisa ter pelo menos 8 caracteres.'; return; }
      if (this.senha1 !== this.senha2) { this.erro = 'As duas senhas não são iguais.'; return; }
      this.ocupado = true;
      try {
        const m = await cofre.criarMaterialDoCofre(this.senha1);
        this.cofreAtual = await cofre.salvarCofre({ ...this.escopo, pela_senha: m.pela_senha, pelo_codigo: m.pelo_codigo });
        this.chave = await cofre.lembrarChaveNoAparelho(this.cofreAtual.id, m.chaveDados);
        this.codigoMostrado = m.codigo;
        this.senha1 = this.senha2 = '';
        this.etapa = 'codigo';
      } catch (e) {
        this.erro = this._mensagem(e);
      } finally {
        this.ocupado = false;
      }
    },

    async concluirCodigo() {
      this.codigoMostrado = '';
      await this.abrir();
    },

    async copiarCodigo() {
      try {
        await navigator.clipboard.writeText(this.codigoMostrado);
        this.$store.app.notify('Código copiado. Guarde num lugar seguro.');
      } catch {
        this.$store.app.notify('Não deu para copiar — anote o código.', 'danger');
      }
    },

    async desbloquear() {
      this.erro = '';
      this.ocupado = true;
      try {
        const chave = this.usarCodigo
          ? await cofre.abrirComCodigo(this.cofreAtual, this.senhaDesbloqueio)
          : await cofre.abrirComSenha(this.cofreAtual, this.senhaDesbloqueio);
        this.chave = await cofre.lembrarChaveNoAparelho(this.cofreAtual.id, chave);
        this.senhaDesbloqueio = '';
        await this.abrir();
      } catch (e) {
        this.erro = this._mensagem(e);
      } finally {
        this.ocupado = false;
      }
    },

    async abrir() {
      this.fichas = await saude.listarFichas(this.chave, this.escopo);
      this.etapa = 'aberto';
    },

    async bloquearAparelho() {
      await cofre.esquecerChaveDoAparelho(this.cofreAtual.id);
      this.chave = null;
      this.fichas = [];
      this.etapa = 'bloqueado';
    },

    idade(f) {
      return saude.idade(f.nascimento);
    },

    nova() {
      this.erro = '';
      this.form = { id: null, ...saude.fichaVazia(), alergiasTexto: '', medicamentosTexto: '', condicoesTexto: '' };
    },

    editar(f) {
      this.erro = '';
      this.form = {
        ...saude.fichaVazia(),
        ...f,
        alergiasTexto: (f.alergias || []).join('\n'),
        medicamentosTexto: (f.medicamentos || []).join('\n'),
        condicoesTexto: (f.condicoes || []).join('\n'),
      };
    },

    async salvar() {
      this.erro = '';
      if (!this.form.nome.trim()) { this.erro = 'Escreva o nome da pessoa.'; return; }
      this.ocupado = true;
      try {
        const { id, alergiasTexto, medicamentosTexto, condicoesTexto, ...resto } = this.form;
        const dados = {
          ...resto,
          nome: resto.nome.trim(),
          alergias: saude.paraLista(alergiasTexto),
          medicamentos: saude.paraLista(medicamentosTexto),
          condicoes: saude.paraLista(condicoesTexto),
        };
        delete dados.ilegivel;
        await saude.salvarFicha(this.chave, { id, ...this.escopo, dados });
        this.form = null;
        await this.abrir();
        this.$store.app.notify(id ? 'Ficha atualizada.' : 'Pessoa adicionada.');
      } catch (e) {
        this.erro = this._mensagem(e);
      } finally {
        this.ocupado = false;
      }
    },

    async excluir(f) {
      if (!confirm(`Apagar a ficha de ${f.nome}? Isso não pode ser desfeito.`)) return;
      try {
        await saude.excluirFicha(f.id);
        this.form = null;
        await this.abrir();
        this.$store.app.notify('Ficha apagada.');
      } catch (e) {
        this.$store.app.notify(this._mensagem(e), 'danger');
      }
    },
  };
}
