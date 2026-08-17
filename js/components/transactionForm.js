import { createTransaction, updateTransaction, deleteTransaction, uploadComprovante, getComprovanteUrl } from '../services/transactions.js';
import { recognizeText, parseReceiptText } from '../services/ocr.js';
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
  data_pagamento: '',
  comprovante_url: '',
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
    uploadingComprovante: false,
    lendoComprovante: false,
    comprovantePreviewUrl: null,

    openNew(tipo = 'saida', tipoDespesa = 'variavel') {
      this.form = emptyForm();
      this.form.tipo = tipo;
      this.form.tipo_despesa = tipoDespesa;
      this.form.responsavel_id = Alpine.store('app').profile?.id || '';
      this.showMore = tipoDespesa === 'fixa';
      this.comprovantePreviewUrl = null;
      this.open = true;
    },

    onCategoriaChange() {
      if (this.form.categoria_id === '__nova__') {
        this.form.categoria_id = '';
        // Abre o modal compartilhado de categorias já em modo "criar"; ao
        // salvar lá, a categoria nova volta selecionada aqui.
        Alpine.store('categoryModal').openCreate((cat) => { this.form.categoria_id = cat.id; });
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
        data_pagamento: tx.data_pagamento || '',
        comprovante_url: tx.comprovante_url || '',
        recorrente: !!tx.recorrente,
        observacoes: tx.observacoes || '',
      };
      this.showMore = true;
      this.comprovantePreviewUrl = null;
      if (tx.comprovante_url) {
        getComprovanteUrl(tx.comprovante_url).then((url) => { this.comprovantePreviewUrl = url; });
      }
      this.open = true;
    },

    onPagoChange(checked) {
      this.form.data_pagamento = checked ? todayIso() : '';
    },

    async onComprovanteChange(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = Alpine.store('app');
      this.uploadingComprovante = true;
      try {
        const path = await uploadComprovante(store.profile.id, file);
        this.form.comprovante_url = path;
        this.comprovantePreviewUrl = await getComprovanteUrl(path);
        this.uploadingComprovante = false;
        this.lendoComprovante = true;
        try {
          const texto = await recognizeText(file);
          const dados = parseReceiptText(texto);
          if (dados.titulo && !this.form.titulo.trim()) this.form.titulo = dados.titulo;
          if (dados.valor && !this.form.valor) this.form.valor = dados.valor;
          if (dados.titulo || dados.valor) store.notify('Dados lidos da foto — confira antes de salvar.');
        } catch {
          // leitura é só um bônus (best-effort) — se falhar, segue com o
          // anexo já salvo normalmente, sem travar o resto do formulário
        } finally {
          this.lendoComprovante = false;
        }
      } catch (e) {
        store.notify(e.message || 'Erro ao enviar comprovante.', 'danger');
      } finally {
        this.uploadingComprovante = false;
        event.target.value = '';
      }
    },

    removerComprovante() {
      this.form.comprovante_url = '';
      this.comprovantePreviewUrl = null;
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
          data_pagamento: this.form.data_pagamento || null,
          comprovante_url: this.form.comprovante_url || null,
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
