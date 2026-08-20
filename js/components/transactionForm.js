import { createTransaction, updateTransaction, deleteTransaction, uploadComprovante, getComprovanteUrl, listPayers, setPayers, splitEqually, guessCategoryByTitle } from '../services/transactions.js';
import { createCompany, updateCompany, uploadCompanyLogo } from '../services/companies.js';
import { notifyPayment } from '../services/notifications.js';
import { recognizeText, parseReceiptText } from '../services/ocr.js';
import { startBarcodeScanner, stopBarcodeScanner, interpretScannedCode } from '../services/barcode.js';
import { extractTextFromPdf } from '../services/pdf.js';
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
  recorrencia_tipo: 'mensal',
  recorrencia_intervalo_dias: '',
  recorrencia_serie_id: '',
  parcela_atual: '',
  parcela_total: '',
  observacoes: '',
  codigo_barras: '',
  qrcode_dados: '',
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
    // false = botão de upload; true = campo de texto pra colar uma URL de
    // imagem já existente (mesmo par upload/URL do modal de categorias).
    empresaLogoModoUrl: false,

    // Pra detectar a TRANSIÇÃO de "não paga" -> "paga" no save() (dispara
    // notifyPayment só nesse momento, não em toda edição de uma despesa já paga).
    pagoAoAbrir: false,

    // Mesma lógica da lista de compras: sugere categoria pelo título
    // digitado, mas nunca sobrescreve uma escolha manual — só preenche o
    // campo, não trava ele.
    categoriaEscolhidaManualmente: false,

    openNew(tipo = 'saida', tipoDespesa = 'variavel') {
      this.form = emptyForm();
      this.form.tipo = tipo;
      this.form.tipo_despesa = tipoDespesa;
      this.form.responsavel_id = Alpine.store('app').profile?.id || '';
      this.showMore = tipoDespesa === 'fixa';
      this.comprovantePreviewUrl = null;
      this.pagadores = [];
      this.empresaLogoUrl = null;
      this.empresaLogoModoUrl = false;
      this.pagoAoAbrir = false;
      this.categoriaEscolhidaManualmente = false;
      this.open = true;
    },

    onTituloInput() {
      if (this.categoriaEscolhidaManualmente) return;
      const sugestao = guessCategoryByTitle(this.form.titulo, Alpine.store('app').categories);
      if (sugestao) this.form.categoria_id = sugestao.id;
    },

    onCategoriaChange() {
      this.categoriaEscolhidaManualmente = true;
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
        recorrencia_tipo: tx.recorrencia_tipo || 'mensal',
        recorrencia_intervalo_dias: tx.recorrencia_intervalo_dias || '',
        recorrencia_serie_id: tx.recorrencia_serie_id || '',
        parcela_atual: tx.parcela_atual || '',
        parcela_total: tx.parcela_total || '',
        observacoes: tx.observacoes || '',
        codigo_barras: tx.codigo_barras || '',
        qrcode_dados: tx.qrcode_dados || '',
      };
      this.showMore = true;
      this.comprovantePreviewUrl = null;
      this.pagadores = [];
      this.empresaLogoUrl = null;
      this.empresaLogoModoUrl = false;
      this.pagoAoAbrir = !!tx.data_pagamento;
      // Editando um lançamento existente a categoria já foi escolhida antes
      // (por sugestão ou à mão) — não deixa o próximo @input no título
      // trocar ela sozinha.
      this.categoriaEscolhidaManualmente = true;
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

    // Colar uma URL de imagem já existente em vez de fazer upload — a URL é
    // sempre a que o próprio usuário digitou/colou, nunca uma que eu tenha
    // adivinhado ou buscado sozinho.
    onEmpresaLogoUrlInput(url) {
      this.empresaLogoUrl = url.trim() || null;
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

    // Só preenche campo que ainda está vazio — nunca sobrescreve algo que a
    // pessoa já digitou/escolheu, seja na foto/PDF ou no scan de código.
    aplicarDadosExtraidos(dados) {
      let preencheu = false;
      if (dados.titulo && !this.form.titulo.trim()) { this.form.titulo = dados.titulo; preencheu = true; }
      if (dados.valor && !this.form.valor) { this.form.valor = dados.valor; preencheu = true; }
      if (dados.vencimento && !this.form.data_vencimento) { this.form.data_vencimento = dados.vencimento; preencheu = true; }
      if (dados.titulo && !this.categoriaEscolhidaManualmente) this.onTituloInput();
      return preencheu;
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
          const preencheu = this.aplicarDadosExtraidos(dados);
          if (preencheu) store.notify('Dados lidos da foto — confira antes de salvar.');
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

    // PDF (fatura/boleto digital): tenta o texto nativo do PDF primeiro
    // (rápido e exato) e só cai pra OCR se a página não tiver texto de
    // verdade (PDF escaneado) — ver extractTextFromPdf em services/pdf.js.
    // Não faz upload do PDF como comprovante (o bucket é pra imagem); só
    // usa ele pra preencher o formulário.
    async onComprovantePdfChange(event) {
      const file = event.target.files?.[0];
      if (!file) return;
      const store = Alpine.store('app');
      this.lendoComprovante = true;
      try {
        const texto = await extractTextFromPdf(file, { recognizeImage: (blob) => recognizeText(blob) });
        const dados = parseReceiptText(texto);
        const preencheu = this.aplicarDadosExtraidos(dados);
        store.notify(preencheu ? 'Dados lidos do PDF — confira antes de salvar.' : 'Não consegui ler dados úteis nesse PDF — preencha manualmente.', preencheu ? 'success' : 'danger');
      } catch (e) {
        store.notify(e.message || 'Erro ao ler o PDF.', 'danger');
      } finally {
        this.lendoComprovante = false;
        event.target.value = '';
      }
    },

    // ---------- Código de barras (boleto) / QR (Pix, nota fiscal) ----------
    scannerComprovanteAberto: false,
    scannerComprovanteErro: '',
    async abrirScannerComprovante() {
      this.scannerComprovanteAberto = true;
      this.scannerComprovanteErro = '';
      await Alpine.nextTick();
      try {
        await startBarcodeScanner('cg-scanner-viewport-despesa', (codigo) => this.onCodigoComprovanteLido(codigo));
      } catch {
        this.scannerComprovanteErro = 'Não foi possível acessar a câmera.';
      }
    },
    async fecharScannerComprovante() {
      await stopBarcodeScanner();
      this.scannerComprovanteAberto = false;
    },
    async onCodigoComprovanteLido(codigo) {
      await stopBarcodeScanner();
      this.scannerComprovanteAberto = false;
      const store = Alpine.store('app');
      const lido = interpretScannedCode(codigo);
      if (lido.tipo === 'boleto') this.form.codigo_barras = lido.codigo;
      else this.form.qrcode_dados = lido.codigo;

      let preencheu = false;
      if (lido.valor && !this.form.valor) { this.form.valor = lido.valor; preencheu = true; }
      if (lido.vencimento && !this.form.data_vencimento) { this.form.data_vencimento = lido.vencimento; preencheu = true; }
      if (lido.nomeRecebedor && !this.form.empresa_servico.trim()) { this.form.empresa_servico = lido.nomeRecebedor; preencheu = true; }

      if (lido.tipo === 'boleto' && preencheu) store.notify('Valor e vencimento lidos do boleto — confira antes de salvar.');
      else if (lido.tipo === 'pix' && preencheu) store.notify('Dados lidos do Pix — confira antes de salvar.');
      else if (lido.tipo === 'boleto' || lido.tipo === 'pix') store.notify('Código lido, mas não consegui extrair valor/vencimento — preencha manualmente.', 'danger');
      else store.notify('Código guardado (não reconhecido como boleto nem Pix) — preencha o resto manualmente.');
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
        // Uma série só existe enquanto "recorrente" está marcado. Novo id
        // gerado aqui (não no banco) na primeira vez que a pessoa liga a
        // recorrência — dali em diante gerarRecorrentesPendentes (recurring.js)
        // reconhece as ocorrências dessa série por esse id em vez de tentar
        // adivinhar pelo título (o que colidia entre despesas homônimas).
        const serieId = this.form.recorrente ? this.form.recorrencia_serie_id || crypto.randomUUID() : null;
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
          recorrencia_tipo: this.form.recorrente ? this.form.recorrencia_tipo : null,
          recorrencia_intervalo_dias:
            this.form.recorrente && this.form.recorrencia_tipo === 'personalizado' ? Number(this.form.recorrencia_intervalo_dias) || null : null,
          recorrencia_serie_id: serieId,
          parcela_atual: this.form.parcela_atual ? Number(this.form.parcela_atual) : null,
          parcela_total: this.form.parcela_total ? Number(this.form.parcela_total) : null,
          observacoes: this.form.observacoes.trim() || null,
          codigo_barras: this.form.codigo_barras || null,
          qrcode_dados: this.form.qrcode_dados || null,
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

        // Best-effort (mesmo padrão de avisarPagamento em transactionTable.js): a
        // despesa já foi salva com sucesso acima, então uma falha aqui (ex.: RLS
        // ainda não migrada no Supabase do usuário) não pode derrubar o resto do
        // save() — mas precisa aparecer pra alguém, senão "não consigo avisar o
        // grupo" vira um problema invisível que ninguém sabe que precisa corrigir.
        if (!this.pagoAoAbrir && payload.data_pagamento) {
          const memberIds = (store.group?.members || []).map((m) => m.id);
          if (memberIds.length >= 2) {
            notifyPayment({ transaction: salva, payerProfileId: store.profile.id, memberIds })
              .then(() => store.refreshNotifications())
              .catch((e) => {
                console.error('notifyPayment falhou:', e);
                store.notify(e.message || 'Despesa salva, mas não consegui avisar o grupo.', 'danger');
              });
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
