import * as unidades from '../services/unidades.js';
import { getMyGroup } from '../services/groups.js';

// Equipe do BNTT Business: papel de cada pessoa e as unidades (filiais).
// Só aparece em contas Business; as regras valem também no servidor
// (supabase/business-2026-10.sql) — aqui é a tela, não a segurança.
export function equipeBusiness() {
  return {
    PAPEIS: unidades.PAPEIS,
    novaUnidade: '',
    editandoId: null,
    editandoNome: '',
    ocupado: false,

    rotulo(papel) {
      return unidades.rotuloDoPapel(papel);
    },
    papelDe(m) {
      return unidades.papelEfetivo(m.papel);
    },

    async recarregarEquipe() {
      const app = this.$store.app;
      app.group = await getMyGroup(app.profile.id);
      await app.carregarUnidades();
    },

    async mudarPapel(m, papel) {
      const app = this.$store.app;
      try {
        await unidades.definirPapel(app.group.group.id, m.id, papel, m.unidade_id ?? null);
        await this.recarregarEquipe();
        app.notify(`${m.nome} agora é ${unidades.rotuloDoPapel(papel).toLowerCase()}.`);
      } catch (e) {
        app.notify(unidades.mensagemDeUnidades(e), 'danger');
        await this.recarregarEquipe();
      }
    },

    async criar() {
      const app = this.$store.app;
      const nome = this.novaUnidade.trim();
      if (!nome) return;
      if (!app.exigirLimite('unidades', app.unidades.length, `Seu plano permite ${app.limiteDoPlano('unidades')} ${app.limiteDoPlano('unidades') === 1 ? 'unidade' : 'unidades'}. Para abrir mais filiais, mude de plano.`)) return;
      this.ocupado = true;
      try {
        await unidades.criarUnidade(app.group.group.id, nome, app.profile.id);
        // Só limpa se a pessoa não começou a digitar outra enquanto salvava.
        if (this.novaUnidade.trim() === nome) this.novaUnidade = '';
        await app.carregarUnidades();
        app.notify(`Unidade "${nome}" criada.`);
      } catch (e) {
        app.notify(unidades.mensagemDeUnidades(e), 'danger');
      } finally {
        this.ocupado = false;
      }
    },

    editar(u) {
      this.editandoId = u.id;
      this.editandoNome = u.nome;
    },

    async salvarNome(u) {
      const app = this.$store.app;
      const nome = this.editandoNome.trim();
      if (!nome || nome === u.nome) { this.editandoId = null; return; }
      try {
        await unidades.renomearUnidade(u.id, nome);
        this.editandoId = null;
        await app.carregarUnidades();
      } catch (e) {
        app.notify(unidades.mensagemDeUnidades(e), 'danger');
      }
    },

    async excluir(u) {
      const app = this.$store.app;
      if (!confirm(`Excluir a unidade "${u.nome}"? Os lançamentos dela continuam, só ficam sem unidade.`)) return;
      try {
        await unidades.excluirUnidade(u.id);
        await app.carregarUnidades();
        window.dispatchEvent(new CustomEvent('cg:transactions-changed'));
        app.notify('Unidade excluída.');
      } catch (e) {
        app.notify(unidades.mensagemDeUnidades(e), 'danger');
      }
    },
  };
}
