import { createTransaction, updateTransaction, deleteTransaction } from '../services/transactions.js';
import { createCategory } from '../services/categories.js';
import { todayIso } from '../utils/format.js';

const emptyForm = () => ({
  id: null,
  tipo: 'saida',
  titulo: '',
  empresa_servico: '',
  categoria_id: '',
  tipo_despesa: 'variavel',
  responsavel_id: '',
  valor: '',
  data_cadastro: todayIso(),
  data_vencimento: '',
  marcarPago: false,
  recorrente: false,
  observacoes: '',
});

// Modal global de "nova/editar transação" (Alpine.store('txModal')) — aberto
// a partir da Home, da tabela ou do botão flutuante.
export function txModalStore() {
  return {
    open: false,
    saving: false,
    showMore: false,
    form: emptyForm(),
    criandoCategoria: false,
    novaCategoriaNome: '',
    novaCategoriaCor: '#64748B',

    openNew(tipo = 'saida', tipoDespesa = 'variavel') {
      this.form = emptyForm();
      this.form.tipo = tipo;
      this.form.tipo_despesa = tipoDespesa;
      this.form.responsavel_id = Alpine.store('app').profile?.id || '';
      this.showMore = tipoDespesa === 'fixa';
      this.criandoCategoria = false;
      this.novaCategoriaNome = '';
      this.open = true;
    },

    onCategoriaChange() {
      if (this.form.categoria_id === '__nova__') {
        this.form.categoria_id = '';
        this.criandoCategoria = true;
      }
    },

    async criarCategoria() {
      if (!this.novaCategoriaNome.trim()) return;
      const store = Alpine.store('app');
      try {
        const cat = await createCategory({
          nome: this.novaCategoriaNome.trim(),
          cor: this.novaCategoriaCor,
          ownerId: store.profile.id,
          groupId: store.group?.group?.id ?? null,
        });
        // Insere direto no array reativo (não chama store.refreshCategories()
        // aqui: um refetch logo em seguida reatribui store.categories a um
        // array novo enquanto o <select> ainda está aplicando o valor
        // selecionado, e a corrida faz o navegador perder a seleção mesmo
        // com o id certo — só aparece de novo no próximo refresh natural,
        // ex. próximo login). O nextTick garante que a <option> nova já
        // existe no DOM antes de tentar selecioná-la (x-for e x-model são
        // efeitos reativos independentes, sem ordem garantida entre si).
        store.categories.push(cat);
        await Alpine.nextTick();
        this.criandoCategoria = false;
        this.novaCategoriaNome = '';
        this.form.categoria_id = cat.id;
      } catch (e) {
        store.notify(e.message || 'Erro ao criar categoria.', 'danger');
      }
    },

    openEdit(tx) {
      this.form = {
        id: tx.id,
        tipo: tx.tipo,
        titulo: tx.titulo,
        empresa_servico: tx.empresa_servico || '',
        categoria_id: tx.categoria_id || '',
        tipo_despesa: tx.tipo_despesa,
        responsavel_id: tx.responsavel_id || '',
        valor: tx.valor,
        data_cadastro: tx.data_cadastro,
        data_vencimento: tx.data_vencimento || '',
        marcarPago: !!tx.data_pagamento,
        recorrente: !!tx.recorrente,
        observacoes: tx.observacoes || '',
      };
      this.showMore = true;
      this.criandoCategoria = false;
      this.novaCategoriaNome = '';
      this.open = true;
    },

    close() {
      this.open = false;
    },

    async save() {
      const store = Alpine.store('app');
      if (!this.form.titulo.trim() || !this.form.valor) {
        store.notify('Preencha ao menos o título e o valor.', 'danger');
        return;
      }
      this.saving = true;
      try {
        const payload = {
          tipo: this.form.tipo,
          titulo: this.form.titulo.trim(),
          empresa_servico: this.form.empresa_servico.trim() || null,
          categoria_id: this.form.categoria_id || null,
          tipo_despesa: this.form.tipo_despesa,
          responsavel_id: this.form.responsavel_id || store.profile.id,
          valor: Number(this.form.valor),
          data_cadastro: this.form.data_cadastro || todayIso(),
          data_vencimento: this.form.data_vencimento || null,
          data_pagamento: this.form.marcarPago ? todayIso() : null,
          recorrente: this.form.recorrente,
          observacoes: this.form.observacoes.trim() || null,
          owner_id: store.profile.id,
          group_id: store.group?.group?.id ?? null,
        };

        if (this.form.id) {
          await updateTransaction(this.form.id, payload);
          store.notify('Lançamento atualizado.');
        } else {
          await createTransaction(payload);
          store.notify(this.form.tipo === 'entrada' ? 'Entrada adicionada.' : 'Despesa adicionada.');
        }
        this.open = false;
        window.dispatchEvent(new CustomEvent('cg:transactions-changed'));
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar.', 'danger');
      } finally {
        this.saving = false;
      }
    },

    async remove() {
      if (!this.form.id) return;
      if (!confirm('Excluir este lançamento? Essa ação não pode ser desfeita.')) return;
      await deleteTransaction(this.form.id);
      Alpine.store('app').notify('Lançamento excluído.');
      this.open = false;
      window.dispatchEvent(new CustomEvent('cg:transactions-changed'));
    },
  };
}
