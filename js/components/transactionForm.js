import { createTransaction, updateTransaction, deleteTransaction, uploadComprovante, getComprovanteUrl, listPayers, setPayers, splitEqually } from '../services/transactions.js';
import { createCompany, updateCompany, uploadCompanyLogo } from '../services/companies.js';
import { notifyPayment } from '../services/notifications.js';
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

    // Divisão entre múltiplos pagadores. [] = modo simples (100% pro
    // responsavel_id, sem nenhuma linha em transaction_payers). Com 2+
    // pessoas vira [{ profile_id, percentual, valor }], sempre reconciliado
    // contra form.valor (ver divisaoValida).
    pagadores: [],

    // Logo da empresa/serviço (opcional) — null = usa o que já existe pra
    // esse nome (ver empresaExistente), uma string = logo novo escolhido
    // nesta sessão do formulário (ainda não persistido em `companies`).
    empresaLogoUrl: null,
    uploadingEmpresaLogo: false,

    // Pra detectar a TRANSIÇÃO de "não paga" -> "paga" no save() (dispara
    // notifyPayment só nesse momento, não em toda edição de uma despesa já paga).
    pagoAoAbrir: false,

    openNew(tipo = 'saida', tipoDespesa = 'variavel') {
      this.form = emptyForm();
      this.form.tipo = tipo;
      this.form.tipo_despesa = tipoDespesa;
      this.form.responsavel_id = Alpine.store('app').profile?.id || '';
      this.showMore = tipoDespesa === 'fixa';
      this.comprovantePreviewUrl = null;
      this.pagadores = [];
      this.empresaLogoUrl = null;
      this.pagoAoAbrir = false;
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
      this.pagadores = [];
      this.empresaLogoUrl = null;
      this.pagoAoAbrir = !!tx.data_pagamento;
      if (tx.comprovante_url) {
        getComprovanteUrl(tx.comprovante_url).then((url) => { this.comprovantePreviewUrl = url; });
      }
      listPayers(tx.id).then((rows) => { this.pagadores = rows.length >= 2 ? rows : []; });
      this.open = true;
    },

    onPagoChange(checked) {
      this.form.data_pagamento = checked ? todayIso() : '';
    },

    // ---------- Divisão entre pagadores ----------

    get membrosDisponiveis() {
      const store = Alpine.store('app');
      const eu = store.profile ? [store.profile] : [];
      const outros = store.group?.members?.filter((m) => m.id !== store.profile?.id) || [];
      return [...eu, ...outros];
    },

    get participantesIds() {
      return this.pagadores.map((p) => p.profile_id);
    },

    membroFor(id) {
      return this.membrosDisponiveis.find((m) => m.id === id) || null;
    },

    // Quem ainda pode ser adicionado à divisão (exclui quem já participa —
    // em modo simples isso é só o responsavel_id, que entra automaticamente
    // como base assim que o 2º pagador é adicionado).
    get candidatosPagador() {
      const jaIncluido = this.pagadores.length ? this.participantesIds : [this.form.responsavel_id];
      return this.membrosDisponiveis.filter((m) => !jaIncluido.includes(m.id));
    },

    adicionarPagador(memberId) {
      if (!memberId || this.participantesIds.includes(memberId)) return;
      const base = this.pagadores.length ? this.participantesIds : [this.form.responsavel_id].filter(Boolean);
      this.pagadores = splitEqually(this.form.valor, [...base, memberId]);
    },

    removerPagador(memberId) {
      const restantes = this.participantesIds.filter((id) => id !== memberId);
      if (restantes.length <= 1) {
        // Volta pro modo simples: quem sobrou vira o responsável único.
        if (restantes[0]) this.form.responsavel_id = restantes[0];
        this.pagadores = [];
      } else {
        this.pagadores = splitEqually(this.form.valor, restantes);
      }
    },

    onPercentualChange(profileId, percentual) {
      const pct = Number(percentual) || 0;
      const total = Number(this.form.valor) || 0;
      const valor = Math.round(total * (pct / 100) * 100) / 100;
      this.pagadores = this.pagadores.map((p) => (p.profile_id === profileId ? { ...p, percentual: pct, valor } : p));
    },

    onValorPagadorChange(profileId, valor) {
      const v = Number(valor) || 0;
      const total = Number(this.form.valor) || 0;
      const percentual = total > 0 ? Math.round((v / total) * 10000) / 100 : 0;
      this.pagadores = this.pagadores.map((p) => (p.profile_id === profileId ? { ...p, valor: v, percentual } : p));
    },

    get somaValoresPagadores() {
      return this.pagadores.reduce((acc, p) => acc + (Number(p.valor) || 0), 0);
    },

    get divisaoValida() {
      if (!this.pagadores.length) return true;
      return Math.abs(this.somaValoresPagadores - (Number(this.form.valor) || 0)) < 0.01;
    },

    // ---------- Logo de empresa/serviço ----------

    get empresaExistente() {
      const nome = this.form.empresa_servico.trim();
      if (!nome) return null;
      return Alpine.store('app').companyByName(nome);
    },

    get empresaLogoPreview() {
      return this.empresaLogoUrl || this.empresaExistente?.logo_url || null;
    },

    async onEmpresaLogoChange(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = Alpine.store('app');
      this.uploadingEmpresaLogo = true;
      try {
        this.empresaLogoUrl = await uploadCompanyLogo(store.profile.id, file);
      } catch (e) {
        store.notify(e.message || 'Erro ao enviar logo.', 'danger');
      } finally {
        this.uploadingEmpresaLogo = false;
        event.target.value = '';
      }
    },

    // Garante que "empresa_servico" vira/atualiza uma linha em `companies`
    // (find-or-create pelo nome) — chamado depois de salvar a transação.
    async syncEmpresa(nome, store) {
      if (!nome) return;
      const groupId = store.group?.group?.id ?? null;
      const existente = store.companyByName(nome);
      if (!existente) {
        await createCompany({ nome, logoUrl: this.empresaLogoUrl, ownerId: store.profile.id, groupId });
      } else if (this.empresaLogoUrl && this.empresaLogoUrl !== existente.logo_url) {
        await updateCompany(existente.id, { logo_url: this.empresaLogoUrl });
      }
      await store.refreshCompanies();
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
      if (!this.divisaoValida) {
        store.notify('A soma da divisão entre pagadores precisa bater com o valor total.', 'danger');
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

        let transactionId = this.form.id;
        let salva;
        if (transactionId) {
          salva = await updateTransaction(transactionId, payload);
          store.notify('Lançamento atualizado.');
        } else {
          salva = await createTransaction(payload);
          transactionId = salva.id;
          store.notify(this.form.tipo === 'entrada' ? 'Entrada adicionada.' : 'Despesa adicionada.');
        }

        if (!this.pagoAoAbrir && payload.data_pagamento) {
          const memberIds = (store.group?.members || []).map((m) => m.id);
          if (memberIds.length >= 2) {
            await notifyPayment({ transaction: salva, payerProfileId: store.profile.id, memberIds });
            store.refreshNotifications();
          }
        }

        await setPayers(
          transactionId,
          this.pagadores.length >= 2
            ? this.pagadores.map((p) => ({ profile_id: p.profile_id, percentual: p.percentual, valor: p.valor }))
            : []
        );

        await this.syncEmpresa(payload.empresa_servico, store);

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
