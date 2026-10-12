// Tela "Imposto de Renda" (BNTT Home): organiza documentos e valores para
// a declaração. NÃO transmite nem gera arquivo da Receita — produz uma
// estimativa preliminar e um guia de preenchimento (docs/IRPF-INVESTIGACAO.md).
// Etapas: inicio → documentos → revisao → perguntas → resumo.
import * as irpf from '../services/irpf.js';
import { baixarBlobCsv } from '../services/csvImport.js';
import { calcularResumo } from '../irpf/calculo.js';
import { camposDo, FICHAS } from '../irpf/mapeamento.js';
import { exerciciosDisponiveis, regrasDo } from '../irpf/regras.js';
import { montarGuia, guiaParaCsv } from '../irpf/guia.js';
import { centavosDeTextoBR, formatarCentavos, formatarCnpj } from '../irpf/normalizar.js';

const TIPO_DOC = {
  informe_pj: 'Informe de rendimentos (empresa)',
  informe_bancario: 'Informe de rendimentos (banco)',
  recibo_despesa: 'Recibo de despesa',
  extrato_bancario: 'Extrato bancário',
  planilha_bntt: 'Planilha do BNTT',
  nao_identificado: 'Documento não reconhecido',
};

const CHAVE_EXERCICIO = 'bonotto_irpf_exercicio';

export const ETAPAS = [
  { id: 'documentos', rotulo: 'Documentos' },
  { id: 'revisao', rotulo: 'Conferir' },
  { id: 'perguntas', rotulo: 'Perguntas' },
  { id: 'resumo', rotulo: 'Resumo' },
];

const STATUS_DOC = {
  processado: { rotulo: 'Lido', icone: 'bi-check-circle', classe: 'cg-badge--success' },
  parcial: { rotulo: 'Lido em parte', icone: 'bi-exclamation-circle', classe: 'cg-badge--warning' },
  rejeitado: { rotulo: 'Recusado', icone: 'bi-x-circle', classe: 'cg-badge--danger' },
  duplicado: { rotulo: 'Repetido', icone: 'bi-files', classe: 'cg-badge--secondary' },
  nao_identificado: { rotulo: 'Não reconhecido', icone: 'bi-question-circle', classe: 'cg-badge--warning' },
  ignorado: { rotulo: 'Não usado', icone: 'bi-slash-circle', classe: 'cg-badge--secondary' },
};

const ESTADO_ITEM = {
  importado: { rotulo: 'Lido do documento', icone: 'bi-file-earmark-text', classe: 'cg-badge--secondary' },
  sugerido: { rotulo: 'Sugerido pela IA', icone: 'bi-stars', classe: 'cg-badge--warning' },
  confirmado: { rotulo: 'Confirmado', icone: 'bi-check-circle-fill', classe: 'cg-badge--success' },
  corrigido: { rotulo: 'Corrigido por você', icone: 'bi-pencil-fill', classe: 'cg-badge--success' },
  pendente: { rotulo: 'Pendente', icone: 'bi-exclamation-circle', classe: 'cg-badge--warning' },
  inconsistente: { rotulo: 'Inconsistente', icone: 'bi-x-octagon', classe: 'cg-badge--danger' },
};

function lerPreferencia() {
  try {
    const v = Number(localStorage.getItem(CHAVE_EXERCICIO));
    return exerciciosDisponiveis().includes(v) ? v : null;
  } catch {
    return null;
  }
}

export function irpfView() {
  return {
    ETAPAS,
    FICHAS,
    exercicios: exerciciosDisponiveis(),
    etapa: 'inicio',
    carregando: false,
    erro: '',
    declaracao: null,
    documentos: [],
    itens: [],
    dependentes: [],
    respostas: {},
    lote: [], // resultado do último lote importado (inclui o que não foi gravado)
    importando: false,
    arrastando: false,
    consentimentoAberto: false,
    editandoId: null,
    valorEdicao: '',
    novo: null, // item digitado à mão
    novoDependente: { nome: '', relacao: '' },
    fmt: formatarCentavos,
    ACEITA: irpf.ACEITA,

    get ownerId() {
      return this.$store.app.profile?.id;
    },
    get regras() {
      return this.declaracao ? regrasDo(this.declaracao.exercicio) : null;
    },
    get campos() {
      return this.declaracao ? camposDo(this.declaracao.exercicio) : {};
    },
    get usarIa() {
      return !!this.declaracao?.consentimento_ia_em;
    },
    get resumo() {
      if (!this.declaracao) return null;
      return calcularResumo({ exercicio: this.declaracao.exercicio, documentos: this.documentos, itens: this.itens, dependentes: this.dependentes, respostas: this.respostas });
    },
    get guia() {
      if (!this.declaracao) return [];
      return montarGuia({ exercicio: this.declaracao.exercicio, resumo: this.resumo, itens: this.itens, documentos: this.documentos });
    },
    // Itens agrupados por ficha oficial, para a conferência.
    get fichasComItens() {
      return FICHAS.map((f) => ({ ...f, itens: this.itens.filter((i) => this.campos[i.campo]?.ficha === f.id && !this.itemForaDaConta(i)) })).filter((f) => f.itens.length);
    },
    get aConferir() {
      return this.itens.filter((i) => !this.itemForaDaConta(i) && !['confirmado', 'corrigido'].includes(i.revisao) && i.origem !== 'manual').length;
    },
    get indiceEtapa() {
      return ETAPAS.findIndex((e) => e.id === this.etapa);
    },

    async init() {
      // Troca de conta no mesmo aparelho: nunca mostra a declaração do outro.
      this._dono = this.ownerId || null;
      this.$watch('$store.app.profile?.id', async (id) => {
        if ((id || null) === this._dono) return; // mesmo dono: nada a fazer
        this._dono = id || null;
        this.sair();
        const ex = lerPreferencia();
        if (id && ex) await this.abrir(ex);
      });
      const ex = lerPreferencia();
      if (ex && this.ownerId) await this.abrir(ex);
    },

    sair() {
      this.declaracao = null;
      this.documentos = [];
      this.itens = [];
      this.dependentes = [];
      this.lote = [];
      this.etapa = 'inicio';
    },

    async abrir(exercicio) {
      // IRPF é pessoa física: a linha Business não tem esta área.
      if (!this.ownerId || this.$store.app.linha === 'business') return;
      this.carregando = true;
      this.erro = '';
      try {
        this._dono = this.ownerId;
        this.declaracao = await irpf.abrirDeclaracao(this.ownerId, exercicio);
        this.respostas = { ...(this.declaracao.respostas || {}) };
        await this.recarregar();
        try { localStorage.setItem(CHAVE_EXERCICIO, String(exercicio)); } catch { /* preferência é opcional */ }
        this.etapa = this.documentos.length || this.itens.length ? 'revisao' : 'documentos';
      } catch (e) {
        this.erro = irpf.mensagemErroIrpf(e);
      } finally {
        this.carregando = false;
      }
    },

    async recarregar() {
      const d = await irpf.carregarDeclaracao(this.declaracao.id, this.ownerId);
      this.documentos = d.documentos;
      this.itens = d.itens;
      this.dependentes = d.dependentes;
    },

    trocarExercicio() {
      this.sair();
      try { localStorage.removeItem(CHAVE_EXERCICIO); } catch { /* opcional */ }
    },

    irPara(etapa) {
      this.etapa = etapa;
      this.editandoId = null;
    },

    descricaoExercicio(ex) {
      const r = regrasDo(ex);
      return r.programaOficialPublicado
        ? `Rendimentos de ${r.anoCalendario}. Regras e programa oficial publicados.`
        : `Rendimentos de ${r.anoCalendario}. Tabela publicada; o programa oficial ainda não saiu.`;
    },

    // ---------- documentos ----------
    descricaoDoc(d) {
      const partes = [TIPO_DOC[d.tipo] || 'Documento'];
      if (d.instituicaoNome) partes.push(d.instituicaoNome);
      else if (d.instituicaoDocumento) partes.push(formatarCnpj(d.instituicaoDocumento));
      if (d.anoCalendario) partes.push(`ano ${d.anoCalendario}`);
      if (d.extraidoPor === 'ia') partes.push('lido pela IA');
      else if (d.extraidoPor === 'local') partes.push('lido no aparelho');
      return partes.join(' · ');
    },
    statusDoc(d) {
      return STATUS_DOC[d.status] || STATUS_DOC.parcial;
    },
    estadoItem(i) {
      if (i.origem === 'manual') return { rotulo: 'Digitado por você', icone: 'bi-keyboard', classe: 'cg-badge--success' };
      return ESTADO_ITEM[i.revisao] || ESTADO_ITEM.importado;
    },
    itensDoDoc(d) {
      return this.itens.filter((i) => i.documentoId === d.id);
    },
    docOriginal(d) {
      return this.documentos.find((x) => x.id === d.duplicadoDe) || null;
    },
    itemForaDaConta(i) {
      if (!i.documentoId) return false;
      const d = this.documentos.find((x) => x.id === i.documentoId);
      return !d || ['duplicado', 'rejeitado'].includes(d.status);
    },

    async importar(lista) {
      const arquivos = [...(lista || [])];
      const decl = this.declaracao;
      if (!arquivos.length || this.importando) return;
      if (!decl) {
        this.$store.app.notify('Escolha o ano da declaração antes de importar os documentos.', 'warning');
        return;
      }
      if (!this.$store.app.online) {
        this.$store.app.notify('Sem internet: importe os documentos quando a conexão voltar.', 'warning');
        return;
      }
      this.erro = '';
      if (arquivos.length > irpf.LIMITE_ARQUIVOS_POR_LOTE) {
        this.$store.app.notify(`Até ${irpf.LIMITE_ARQUIVOS_POR_LOTE} arquivos por vez. Os primeiros ${irpf.LIMITE_ARQUIVOS_POR_LOTE} serão lidos.`, 'warning');
      }
      this.importando = true;
      this.lote = arquivos.slice(0, irpf.LIMITE_ARQUIVOS_POR_LOTE).map((f) => ({ nome: f.name, estado: 'recebido', texto: 'Na fila', aviso: '' }));
      for (const [n, file] of arquivos.slice(0, irpf.LIMITE_ARQUIVOS_POR_LOTE).entries()) {
        const linha = this.lote[n];
        linha.estado = 'lendo';
        linha.texto = 'Lendo…';
        try {
          const r = await irpf.importarArquivo({ declaracao: decl, ownerId: decl.owner_id, file, existentes: this.documentos, usarIa: this.usarIa });
          if (this.declaracao?.id !== decl.id) break; // trocou de conta/ano no meio do lote
          if (r.naoGravado) {
            linha.estado = 'duplicado';
            linha.texto = 'Repetido';
          } else {
            this.documentos.push(r.documento);
            this.itens.push(...r.itens);
            linha.estado = r.documento.status;
            linha.texto = this.statusDoc(r.documento).rotulo;
            linha.motivo = r.documento.motivo;
          }
          linha.aviso = r.aviso || '';
        } catch (e) {
          linha.estado = 'rejeitado';
          linha.texto = 'Erro';
          linha.aviso = irpf.mensagemErroIrpf(e);
        }
      }
      this.importando = false;
      const lidos = this.lote.filter((l) => ['processado', 'parcial'].includes(l.estado)).length;
      this.$store.app.notify(`${lidos} de ${this.lote.length} documento(s) lido(s). Confira os valores antes de usar.`);
    },

    aoSoltar(ev) {
      this.arrastando = false;
      this.importar(ev.dataTransfer?.files);
    },

    async excluirDocumento(d) {
      if (!confirm(`Apagar "${d.nome}" e os valores lidos dele? Os valores que você digitou à mão continuam.`)) return;
      try {
        await irpf.excluirDocumento(d.id, this.ownerId, this.declaracao.id);
        await this.recarregar();
      } catch (e) {
        this.$store.app.notify(irpf.mensagemErroIrpf(e), 'danger');
      }
    },

    async usarEstaVersao(d) {
      const outro = this.docOriginal(d);
      if (!outro) return;
      try {
        await irpf.escolherVersao(d, outro);
        await this.recarregar();
        this.$store.app.notify(`"${d.nome}" passou a valer; "${outro.nome}" ficou como cópia.`);
      } catch (e) {
        this.$store.app.notify(irpf.mensagemErroIrpf(e), 'danger');
      }
    },

    // ---------- IA (consentimento) ----------
    async definirIa(aceito) {
      try {
        this.declaracao = { ...this.declaracao, ...(await irpf.registrarConsentimentoIa(this.declaracao.id, aceito)) };
        this.consentimentoAberto = false;
        this.$store.app.notify(aceito ? 'IA autorizada para documentos que o aparelho não reconhecer.' : 'IA desligada. Só o leitor do aparelho será usado.');
      } catch (e) {
        this.$store.app.notify(irpf.mensagemErroIrpf(e), 'danger');
      }
    },

    // ---------- conferência ----------
    ajuda(campo) {
      const a = this.campos[campo]?.ajuda;
      if (!a) return '';
      return `${a.simples} Exemplo: ${a.exemplo} Onde achar: ${a.ondeAchar} Não confunda: ${a.naoConfundir}`;
    },
    origem(i) {
      const d = this.documentos.find((x) => x.id === i.documentoId);
      if (!d) return i.origem === 'manual' ? 'Digitado por você' : '';
      return [d.nome, i.pagina ? `página ${i.pagina}` : ''].filter(Boolean).join(', ');
    },

    async confirmar(i) {
      if (i.centavos == null) { this.editar(i); return; }
      await this._salvarItem(i, { revisao: 'confirmado' });
    },
    editar(i) {
      this.editandoId = i.id;
      this.valorEdicao = i.centavos == null ? '' : (i.centavos / 100).toFixed(2).replace('.', ',');
    },
    async salvarEdicao(i) {
      const c = centavosDeTextoBR(this.valorEdicao);
      if (c === null || c < 0) { this.$store.app.notify('Valor inválido. Use o formato 1.234,56.', 'warning'); return; }
      await this._salvarItem(i, { centavos: c, revisao: c === i.centavos && i.revisao !== 'pendente' ? 'confirmado' : 'corrigido' });
      this.editandoId = null;
    },
    async marcarInconsistente(i) {
      await this._salvarItem(i, { revisao: 'inconsistente' });
    },
    async excluirItem(i) {
      if (!confirm('Apagar este valor?')) return;
      try {
        await irpf.excluirItem(i.id);
        this.itens = this.itens.filter((x) => x.id !== i.id);
      } catch (e) {
        this.$store.app.notify(irpf.mensagemErroIrpf(e), 'danger');
      }
    },
    async _salvarItem(i, patch) {
      try {
        const novo = await irpf.atualizarItem(i.id, patch);
        const idx = this.itens.findIndex((x) => x.id === i.id);
        if (idx >= 0) this.itens.splice(idx, 1, novo);
      } catch (e) {
        this.$store.app.notify(irpf.mensagemErroIrpf(e), 'danger');
      }
    },

    abrirNovo() {
      this.novo = { campo: 'pagamento_medico', valor: '', referencia: '', beneficiario: 'titular', fonteNome: '' };
    },
    async salvarNovo() {
      const c = centavosDeTextoBR(this.novo.valor);
      if (c === null || c < 0) { this.$store.app.notify('Valor inválido. Use o formato 1.234,56.', 'warning'); return; }
      try {
        const it = await irpf.adicionarItemManual({ declaracao: this.declaracao, ownerId: this.ownerId, campo: this.novo.campo, centavos: c, referencia: this.novo.referencia, beneficiario: this.novo.beneficiario, fonteNome: this.novo.fonteNome.trim() });
        this.itens.push(it);
        this.novo = null;
      } catch (e) {
        this.$store.app.notify(irpf.mensagemErroIrpf(e), 'danger');
      }
    },

    // ---------- perguntas ----------
    async responder(chave, valor) {
      this.respostas = { ...this.respostas, [chave]: valor };
      try {
        await irpf.salvarRespostas(this.declaracao.id, this.respostas);
      } catch (e) {
        this.$store.app.notify(irpf.mensagemErroIrpf(e), 'danger');
      }
    },
    async adicionarDependente() {
      const nome = this.novoDependente.nome.trim();
      if (!nome) return;
      try {
        this.dependentes.push(await irpf.adicionarDependente({ declaracao: this.declaracao, ownerId: this.ownerId, nome, relacao: this.novoDependente.relacao }));
        this.novoDependente = { nome: '', relacao: '' };
      } catch (e) {
        this.$store.app.notify(irpf.mensagemErroIrpf(e), 'danger');
      }
    },
    async removerDependente(d) {
      try {
        await irpf.removerDependente(d.id);
        this.dependentes = this.dependentes.filter((x) => x.id !== d.id);
      } catch (e) {
        this.$store.app.notify(irpf.mensagemErroIrpf(e), 'danger');
      }
    },

    // ---------- resumo ----------
    get comparacao() {
      const r = this.resumo;
      if (!r) return [];
      const linha = (rotulo, chave) => ({ rotulo, simplificado: r.simplificado[chave], completo: r.completo[chave] });
      return [
        { rotulo: 'Rendimentos tributáveis', simplificado: r.totais.tributavel, completo: r.totais.tributavel },
        linha('Deduções / desconto', 'deducao'),
        linha('Base de cálculo', 'base'),
        linha('Imposto pela tabela', 'impostoTabela'),
        ...(this.regras?.redutor ? [linha('Redução (Lei 15.270/2025)', 'reducao')] : []),
        linha('Imposto devido', 'devido'),
        { rotulo: 'Imposto já retido', simplificado: r.totais.irrf, completo: r.totais.irrf },
      ];
    },

    exportarCsv() {
      baixarBlobCsv(guiaParaCsv(this.guia, this.declaracao.exercicio), `bntt-irpf-${this.declaracao.exercicio}-organizacao.csv`);
    },
  };
}
