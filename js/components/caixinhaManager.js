import * as cx from '../services/caixinhas.js';
import * as banksService from '../services/banks.js';
import { resizeImage } from '../utils/image.js';
import { MOEDAS_SUPORTADAS } from '../utils/format.js';

const FORM_VAZIO = () => ({ bancoNome: '', moeda: 'BRL', meta: '', responsavelId: '' });

// Modal único (Alpine.store('caixinhaModal')) usado tanto por "Perfil →
// Caixinhas" (gerenciar todas) quanto pela própria tela de Caixinhas
// (FAB "Nova caixinha" e lápis de editar em cada card) — mesmo padrão de
// dupla entrada já usado por categoryModal (openManage vs openCreate).
//
// Banco deixou de ser um campo livre com ícone PRÓPRIO por caixinha (bug
// relatado: "criei Nubank pra Matheus e Nubank pra Beatriz, viraram dois
// bancos sem relação, o logo de um não aparecia no outro"). Agora banco é
// uma entidade compartilhada (js/services/banks.js, mesmo padrão de
// companies/empresa-serviço): a caixinha guarda só o NOME do banco, e o
// logo é resolvido por nome contra a lista de bancos (Alpine.store('app').bankByName)
// — encontrar-ou-criar (findOrCreateBank) garante que nunca existam dois
// bancos com o mesmo nome.
export function caixinhaModalStore() {
  return {
    open: false,
    loading: false,
    items: [],
    editingId: null,
    ...FORM_VAZIO(),
    bancoLogoUrl: '',
    bancoLogoUrlInput: '',
    uploadingLogo: false,
    saving: false,
    moedasSuportadas: MOEDAS_SUPORTADAS,

    resetForm() {
      Object.assign(this, FORM_VAZIO());
      this.editingId = null;
      this.bancoLogoUrl = '';
      this.bancoLogoUrlInput = '';
      const store = Alpine.store('app');
      if (store.profile) this.responsavelId = store.profile.id;
    },

    get membros() {
      const store = Alpine.store('app');
      if (!store.profile) return [];
      return [store.profile, ...(store.group?.members || []).filter((m) => m.id !== store.profile.id)];
    },

    // Banco já cadastrado com esse nome (se existir) — usado tanto pra
    // mostrar o logo já salvo (sem precisar reanexar) quanto pra decidir
    // se "salvar" atualiza um banco existente ou cria um novo.
    get bancoExistente() {
      return Alpine.store('app').bankByName(this.bancoNome);
    },
    get bancoLogoPreview() {
      return this.bancoLogoUrl || this.bancoExistente?.logo_url || null;
    },

    async openManage() {
      this.resetForm();
      this.open = true;
      await this.carregar();
    },
    // Editar uma caixinha específica a partir da própria tela de Caixinhas
    // (lápis no card) — mesmo modal, já carrega a lista completa junto
    // (aparece embaixo do formulário, como em "Perfil → Caixinhas").
    async openEdit(c) {
      this.open = true;
      await this.carregar();
      this.edit(c);
    },
    close() {
      this.open = false;
      this.resetForm();
    },

    async carregar() {
      const store = Alpine.store('app');
      if (!store.profile) return;
      this.loading = true;
      try {
        this.items = await cx.listCaixinhas({ ownerId: store.profile.id, groupId: store.group?.group?.id });
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar as caixinhas.', 'danger');
      } finally {
        this.loading = false;
      }
    },

    edit(c) {
      this.editingId = c.id;
      this.bancoNome = c.banco_nome;
      this.moeda = c.moeda || 'BRL';
      this.meta = c.meta || '';
      this.responsavelId = c.owner_id;
      this.bancoLogoUrl = '';
      this.bancoLogoUrlInput = '';
    },

    async onLogoFile(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = Alpine.store('app');
      this.uploadingLogo = true;
      try {
        this.bancoLogoUrl = await banksService.uploadBankLogo(store.profile.id, await resizeImage(file));
      } catch (e) {
        store.notify(e.message || 'Erro ao enviar logo.', 'danger');
      } finally {
        this.uploadingLogo = false;
        event.target.value = '';
      }
    },

    // Garante que o banco digitado vira/atualiza uma linha em `banks`
    // (encontra-ou-cria pelo nome, nunca duplica) — mesmo papel de
    // syncEmpresa em transactionForm.js. Best-effort: `banks` é tabela nova,
    // exige migração manual (supabase/schema.sql) que nem todo mundo já
    // rodou — sem isso a CAIXINHA (que só guarda banco_nome como texto)
    // continua salvando normalmente, só sem o logo compartilhado ainda.
    async syncBanco(nome, store) {
      const groupId = store.group?.group?.id ?? null;
      const logoUrl = this.bancoLogoUrl || this.bancoLogoUrlInput || null;
      try {
        await banksService.findOrCreateBank({ nome, logoUrl, ownerId: store.profile.id, groupId, existingBanks: store.banks });
        await store.refreshBanks();
      } catch {
        // silencioso de propósito — ver comentário acima.
      }
    },

    async salvar() {
      if (!this.bancoNome.trim() || this.saving) return;
      const store = Alpine.store('app');
      this.saving = true;
      try {
        const nome = this.bancoNome.trim();
        await this.syncBanco(nome, store);
        const patch = {
          banco_nome: nome,
          moeda: this.moeda || 'BRL',
          meta: this.meta ? Number(this.meta) : null,
          owner_id: this.responsavelId || store.profile.id,
        };

        if (this.editingId) {
          const atualizada = await cx.updateCaixinha(this.editingId, patch);
          const idx = this.items.findIndex((c) => c.id === atualizada.id);
          if (idx >= 0) this.items[idx] = atualizada;
          store.notify('Caixinha atualizada.');
        } else {
          const criada = await cx.createCaixinha({
            bancoNome: patch.banco_nome,
            moeda: patch.moeda,
            meta: patch.meta,
            icone: 'bi-piggy-bank',
            iconeUrl: null,
            ownerId: patch.owner_id,
            groupId: store.group?.group?.id,
          });
          this.items.push(criada);
          store.notify('Caixinha criada.');
        }
        this.resetForm();
        window.dispatchEvent(new CustomEvent('cg:caixinhas-changed'));
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar a caixinha.', 'danger');
      } finally {
        this.saving = false;
      }
    },

    async excluir(c) {
      if (!confirm(`Excluir a caixinha "${c.banco_nome}"? O histórico de movimentações dela também será excluído — essa ação não pode ser desfeita.`)) return;
      const store = Alpine.store('app');
      try {
        await cx.deleteCaixinha(c.id);
        this.items = this.items.filter((x) => x.id !== c.id);
        if (this.editingId === c.id) this.resetForm();
        store.notify('Caixinha excluída.');
        window.dispatchEvent(new CustomEvent('cg:caixinhas-changed'));
      } catch (e) {
        store.notify(e.message || 'Não foi possível excluir a caixinha.', 'danger');
      }
    },
  };
}
