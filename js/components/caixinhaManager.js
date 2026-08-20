import * as cx from '../services/caixinhas.js';
import { MOEDAS_SUPORTADAS } from '../utils/format.js';

const FORM_VAZIO = () => ({ bancoId: '', moeda: 'BRL', meta: '', responsavelId: '' });

// Modal único (Alpine.store('caixinhaModal')) pra criar/editar UMA
// caixinha (banco + moeda + meta + responsável) — só reachable de dentro
// da própria tela de Caixinhas (FAB "Nova caixinha" e lápis no card).
//
// Banco em si (nome + logo) é um assunto SEPARADO agora, gerenciado só por
// Alpine.store('bankModal') (js/components/bankManager.js) — pedido
// explícito: "meta, valor, responsável é dentro do menu de caixinhas
// mesmo... banco e logo é outra coisa, precisa tá separado". Aqui o campo
// "Banco" é um <select> das linhas já cadastradas em $store.app.banks, com
// "+ Novo banco…" abrindo bankModal.openCreate(callback) por cima deste
// modal — mesmo padrão já usado por "+ Nova categoria" no formulário de
// despesa (ver transactionForm.js).
export function caixinhaModalStore() {
  return {
    open: false,
    editingId: null,
    ...FORM_VAZIO(),
    saving: false,
    moedasSuportadas: MOEDAS_SUPORTADAS,

    resetForm() {
      Object.assign(this, FORM_VAZIO());
      this.editingId = null;
      const store = Alpine.store('app');
      if (store.profile) this.responsavelId = store.profile.id;
      // Sem banco nenhum cadastrado ainda, já pré-seleciona "+ Novo banco…"
      // — evita a pessoa ter que descobrir a opção no fundo de um <select>
      // vazio antes de conseguir criar a primeira caixinha.
      if (!store.banks.length) this.bancoId = '__novo__';
    },

    get membros() {
      const store = Alpine.store('app');
      if (!store.profile) return [];
      return [store.profile, ...(store.group?.members || []).filter((m) => m.id !== store.profile.id)];
    },

    openNew() {
      this.resetForm();
      this.open = true;
      // Sem banco nenhum cadastrado ainda: abre direto o formulário de
      // banco por cima, em vez de deixar a pessoa perdida com um <select>
      // já em "+ Novo banco…" mas nenhum jeito óbvio de continuar dali
      // (selecionar de novo a mesma opção não dispara @change).
      if (this.bancoId === '__novo__') this.onBancoChange();
    },
    openEdit(c) {
      this.edit(c);
      this.open = true;
    },
    close() {
      this.open = false;
      this.resetForm();
    },

    edit(c) {
      const store = Alpine.store('app');
      this.editingId = c.id;
      this.bancoId = store.bankByName(c.banco_nome)?.id || '';
      this.moeda = c.moeda || 'BRL';
      this.meta = c.meta || '';
      this.responsavelId = c.owner_id;
    },

    // Chamado pelo <select> quando a pessoa escolhe "+ Novo banco…" — abre
    // bankModal por cima e, quando o banco é criado, volta e já seleciona
    // ele sozinho (sem a pessoa precisar reabrir o <select>).
    onBancoChange() {
      if (this.bancoId !== '__novo__') return;
      Alpine.store('bankModal').openCreate((banco) => {
        this.bancoId = banco.id;
      });
    },

    async salvar() {
      const store = Alpine.store('app');
      const banco = store.banks.find((b) => b.id === this.bancoId);
      if (!banco || this.saving) return;
      this.saving = true;
      try {
        const patch = {
          banco_nome: banco.nome,
          moeda: this.moeda || 'BRL',
          meta: this.meta ? Number(this.meta) : null,
          owner_id: this.responsavelId || store.profile.id,
        };

        if (this.editingId) {
          await cx.updateCaixinha(this.editingId, patch);
          store.notify('Caixinha atualizada.');
        } else {
          await cx.createCaixinha({
            bancoNome: patch.banco_nome,
            moeda: patch.moeda,
            meta: patch.meta,
            icone: 'bi-piggy-bank',
            iconeUrl: null,
            ownerId: patch.owner_id,
            groupId: store.group?.group?.id,
          });
          store.notify('Caixinha criada.');
        }
        this.close();
        window.dispatchEvent(new CustomEvent('cg:caixinhas-changed'));
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar a caixinha.', 'danger');
      } finally {
        this.saving = false;
      }
    },

    async excluir() {
      if (!this.editingId) return;
      const store = Alpine.store('app');
      const banco = store.banks.find((b) => b.id === this.bancoId);
      if (!confirm(`Excluir a caixinha "${banco?.nome || ''}"? O histórico de movimentações dela também será excluído — essa ação não pode ser desfeita.`)) return;
      try {
        await cx.deleteCaixinha(this.editingId);
        store.notify('Caixinha excluída.');
        this.close();
        window.dispatchEvent(new CustomEvent('cg:caixinhas-changed'));
      } catch (e) {
        store.notify(e.message || 'Não foi possível excluir a caixinha.', 'danger');
      }
    },
  };
}
