// IRPF (BNTT Home) — única fronteira entre a tela irpfView e o dado.
// Mesmo padrão dos outros services: cada função decide mockDb (demo) ou
// Supabase (tabelas irpf_*, supabase/irpf-2026-10.sql). A tela não sabe
// qual dos dois está em uso.
//
// Privacidade (docs/IRPF-INVESTIGACAO.md):
// - Tudo é SÓ do dono (owner_id): nem o parceiro do grupo vê. Nunca filtra
//   por group_id aqui.
// - O arquivo original NÃO é guardado: o texto é lido no aparelho (pdf.js /
//   OCR), e só os valores extraídos (com a linha de origem) são salvos.
// - A IA só é chamada se o leitor do aparelho não reconhecer o documento E a
//   pessoa tiver autorizado (consentimento na declaração). Vai só o TEXTO.
import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';
import { extrairLocal } from '../irpf/extratorLocal.js';
import { validarExtracao } from '../irpf/esquemaExtracao.js';
import { verificarDuplicata, hashDoArquivo } from '../irpf/deduplicar.js';
import { lerCsvBntt } from '../irpf/guia.js';
import { regrasDo } from '../irpf/regras.js';
import { chamarIa, FalhaIa } from './ia.js';

export const LIMITE_BYTES = 10 * 1024 * 1024;
export const LIMITE_ARQUIVOS_POR_LOTE = 20;
export const LIMITE_PAGINAS = 20;

const TIPOS = {
  pdf: { mimes: ['application/pdf'], ext: ['pdf'] },
  imagem: { mimes: ['image/png', 'image/jpeg', 'image/webp'], ext: ['png', 'jpg', 'jpeg', 'webp'] },
  csv: { mimes: ['text/csv', 'application/vnd.ms-excel', 'text/plain'], ext: ['csv'] },
};
export const ACEITA = '.pdf,.png,.jpg,.jpeg,.webp,.csv,application/pdf,image/png,image/jpeg,image/webp,text/csv';

export function tipoDoArquivo(file) {
  const ext = String(file?.name || '').toLowerCase().split('.').pop();
  for (const [tipo, r] of Object.entries(TIPOS)) if (r.ext.includes(ext)) return tipo;
  for (const [tipo, r] of Object.entries(TIPOS)) if (tipo !== 'csv' && r.mimes.includes(file?.type)) return tipo;
  return null;
}

// Motivo de recusa (texto para a pessoa) ou null se o arquivo pode seguir.
export function validarArquivo(file) {
  if (!file) return 'Arquivo inválido.';
  if (!tipoDoArquivo(file)) return 'Tipo de arquivo não aceito. Use PDF, foto (PNG/JPG/WebP) ou a planilha CSV do BNTT.';
  if (!file.size) return 'O arquivo está vazio.';
  if (file.size > LIMITE_BYTES) return 'Arquivo maior que 10 MB. Envie só as páginas do informe.';
  return null;
}

// Assinatura dos primeiros bytes: o conteúdo precisa bater com a extensão
// (um .pdf que não é PDF não segue).
async function conteudoConfere(file, tipo, bytes) {
  const b = new Uint8Array(bytes.slice(0, 12));
  const ascii = String.fromCharCode(...b);
  if (tipo === 'pdf') return ascii.startsWith('%PDF-');
  if (tipo === 'imagem') {
    const png = b[0] === 0x89 && ascii.slice(1, 4) === 'PNG';
    const jpg = b[0] === 0xff && b[1] === 0xd8;
    const webp = ascii.startsWith('RIFF') && ascii.slice(8, 12) === 'WEBP';
    return png || jpg || webp;
  }
  return !b.includes(0); // CSV: texto, sem byte nulo
}

// ---------- linhas do banco <-> objetos da tela/cálculo ----------
function docDaLinha(r) {
  return {
    id: r.id,
    nome: r.nome,
    tipo: r.tipo,
    status: r.status,
    statusExtracao: r.status_extracao,
    motivo: r.motivo || '',
    duplicadoDe: r.duplicado_de || null,
    anoCalendario: r.ano_calendario,
    instituicaoNome: r.instituicao_nome || '',
    instituicaoDocumento: r.instituicao_documento || '',
    duvidas: r.duvidas || [],
    extraidoPor: r.extraido_por,
    paginas: r.paginas,
    hash: r.hash,
    chave: r.chave_conteudo,
    criadoEm: r.criado_em,
  };
}

function itemDaLinha(r) {
  return {
    id: r.id,
    documentoId: r.documento_id || null,
    campo: r.campo,
    valorOriginal: r.valor_original || '',
    centavos: r.centavos == null ? null : Number(r.centavos),
    pagina: r.pagina,
    trecho: r.trecho || '',
    referencia: r.referencia || '',
    confianca: r.confianca,
    origem: r.origem,
    revisao: r.revisao,
    beneficiario: r.beneficiario || 'titular',
    fonteDocumento: r.fonte_documento || '',
    fonteNome: r.fonte_nome || '',
  };
}

const PATCH_ITEM = { centavos: 'centavos', revisao: 'revisao', referencia: 'referencia', beneficiario: 'beneficiario', campo: 'campo', fonteNome: 'fonte_nome' };

// ---------- acesso a dado ----------
async function listar(tabela, ownerId, filtro) {
  if (isDemoMode()) return mockDb.list(tabela, (r) => r.owner_id === ownerId && Object.entries(filtro).every(([k, v]) => r[k] === v));
  const supabase = await getSupabase();
  let q = supabase.from(tabela).select('*').eq('owner_id', ownerId);
  for (const [k, v] of Object.entries(filtro)) q = q.eq(k, v);
  const { data, error } = await q.order('criado_em');
  if (error) throw error;
  return data;
}

async function inserir(tabela, linha) {
  if (isDemoMode()) return mockDb.insert(tabela, linha);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from(tabela).insert(linha).select().single();
  if (error) throw error;
  return data;
}

async function inserirVarios(tabela, linhas) {
  if (!linhas.length) return [];
  if (isDemoMode()) {
    const out = [];
    for (const l of linhas) out.push(await mockDb.insert(tabela, l));
    return out;
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase.from(tabela).insert(linhas).select();
  if (error) throw error;
  return data;
}

async function atualizar(tabela, id, patch) {
  if (isDemoMode()) return mockDb.update(tabela, id, patch);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from(tabela).update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

async function apagar(tabela, id) {
  if (isDemoMode()) return mockDb.remove(tabela, id);
  const supabase = await getSupabase();
  const { error } = await supabase.from(tabela).delete().eq('id', id);
  if (error) throw error;
}

// ---------- declaração ----------
export async function abrirDeclaracao(ownerId, exercicio) {
  regrasDo(exercicio); // exercício não suportado → erro claro
  const [existente] = await listar('irpf_declaracoes', ownerId, { exercicio });
  if (existente) return existente;
  return inserir('irpf_declaracoes', { owner_id: ownerId, exercicio, respostas: {}, consentimento_ia_em: null });
}

export async function carregarDeclaracao(declaracaoId, ownerId) {
  const [docs, itens, dependentes] = await Promise.all([
    listar('irpf_documentos', ownerId, { declaracao_id: declaracaoId }),
    listar('irpf_itens', ownerId, { declaracao_id: declaracaoId }),
    listar('irpf_dependentes', ownerId, { declaracao_id: declaracaoId }),
  ]);
  return {
    documentos: docs.map(docDaLinha),
    itens: itens.map(itemDaLinha),
    dependentes: dependentes.map((d) => ({ id: d.id, nome: d.nome, relacao: d.relacao || '' })),
  };
}

export async function salvarRespostas(declaracaoId, respostas) {
  return atualizar('irpf_declaracoes', declaracaoId, { respostas, atualizado_em: new Date().toISOString() });
}

export async function registrarConsentimentoIa(declaracaoId, aceito) {
  return atualizar('irpf_declaracoes', declaracaoId, { consentimento_ia_em: aceito ? new Date().toISOString() : null });
}

// ---------- importação ----------
async function lerPaginas(file, tipo) {
  const { recognizeText } = await import('./ocr.js');
  if (tipo === 'pdf') {
    const { extrairPaginasDoPdf } = await import('./pdf.js');
    return extrairPaginasDoPdf(file, { recognizeImage: recognizeText, maxPaginas: LIMITE_PAGINAS });
  }
  return { paginas: [{ pagina: 1, texto: await recognizeText(file), ocr: true }], paginasTotal: 1 };
}

function statusDaExtracao(doc, erros) {
  if (doc.tipo === 'nao_identificado') return 'nao_identificado';
  if (doc.tipo === 'extrato_bancario') return 'ignorado';
  if (erros.length || doc.duvidas.length || doc.itens.some((i) => i.centavos == null)) return 'parcial';
  return doc.itens.length ? 'processado' : 'parcial';
}

/**
 * Processa UM arquivo e grava o resultado (documento + itens).
 * `existentes`: documentos já importados nesta declaração (para duplicata).
 * `usarIa`: a pessoa autorizou a IA para documentos não reconhecidos.
 * Devolve { documento, itens, aviso, naoGravado } — naoGravado quando é o
 * MESMO arquivo de antes (não cria outra linha, só avisa).
 */
export async function importarArquivo({ declaracao, ownerId, file, existentes = [], usarIa = false, deps = {} }) {
  const exercicio = declaracao.exercicio;
  const base = { owner_id: ownerId, declaracao_id: declaracao.id, nome: String(file?.name || 'arquivo').slice(0, 160) };
  const recusar = async (motivo, extra = {}) => ({
    documento: docDaLinha(await inserir('irpf_documentos', { ...base, ...extra, tipo: 'nao_identificado', status: 'rejeitado', status_extracao: 'rejeitado', motivo, duvidas: [], extraido_por: null })),
    itens: [],
    aviso: '',
  });

  const motivo = validarArquivo(file);
  if (motivo) return recusar(motivo);
  const tipoArq = tipoDoArquivo(file);
  const bytes = await file.arrayBuffer();
  if (!(await conteudoConfere(file, tipoArq, bytes))) return recusar('O conteúdo do arquivo não corresponde à extensão dele.');
  const hash = await hashDoArquivo(bytes);

  // 1) Mesmo arquivo de antes: nem lê de novo (nem gasta IA).
  const mesmo = existentes.find((e) => e.hash === hash);
  if (mesmo) return { documento: null, itens: [], aviso: `"${base.nome}" é o mesmo arquivo de "${mesmo.nome}" — não importei de novo.`, naoGravado: true };

  // 2) Planilha CSV do BNTT: valores já digitados, entram como "importado".
  if (tipoArq === 'csv') {
    const { itens, erros } = lerCsvBntt(new TextDecoder().decode(bytes));
    const doc = await inserir('irpf_documentos', {
      ...base, hash, tipo: 'planilha_bntt', status: itens.length ? (erros.length ? 'parcial' : 'processado') : 'rejeitado',
      status_extracao: itens.length ? 'processado' : 'rejeitado', motivo: itens.length ? '' : erros[0] || 'Planilha sem linhas válidas.',
      duvidas: erros.slice(0, 20), extraido_por: 'planilha', ano_calendario: regrasDo(exercicio).anoCalendario,
    });
    const linhas = await inserirVarios('irpf_itens', itens.map((i) => ({
      owner_id: ownerId, declaracao_id: declaracao.id, documento_id: doc.id, campo: i.campo, valor_original: String(i.centavos / 100), centavos: i.centavos,
      referencia: i.referencia, beneficiario: i.beneficiario, fonte_nome: i.fonteNome, origem: 'planilha', revisao: 'importado', confianca: 1,
    })));
    return { documento: docDaLinha(doc), itens: linhas.map(itemDaLinha), aviso: '' };
  }

  // 3) Texto no aparelho (pdf.js; OCR só em página sem texto).
  let leitura;
  try {
    leitura = await (deps.lerPaginas || lerPaginas)(file, tipoArq);
  } catch {
    return recusar('Não consegui abrir o arquivo (pode estar corrompido ou protegido por senha).', { hash });
  }
  const paginas = leitura.paginas;
  let aviso = leitura.paginasTotal > LIMITE_PAGINAS ? `Só as primeiras ${LIMITE_PAGINAS} de ${leitura.paginasTotal} páginas foram lidas.` : '';

  // 4) Leitor local primeiro; IA só se ele não deu conta e houve consentimento.
  let bruto = extrairLocal(paginas);
  let extraidoPor = 'local';
  const localFalhou = bruto.tipo === 'nao_identificado' || (bruto.tipo !== 'extrato_bancario' && !bruto.itens.length);
  if (localFalhou && usarIa && paginas.some((p) => p.texto?.trim())) {
    try {
      bruto = await (deps.chamarIa || chamarIa)('irpf_extrair', { paginas: paginas.map(({ pagina, texto }) => ({ pagina, texto })) });
      extraidoPor = 'ia';
    } catch (e) {
      aviso = [aviso, e instanceof FalhaIa ? e.message : 'A IA não respondeu.', 'Usei só o leitor do aparelho.'].filter(Boolean).join(' ');
    }
  }
  const { erros, documento } = validarExtracao(bruto);
  if (extraidoPor === 'ia' && erros.length) documento.duvidas.push(...erros.map((e) => `IA: ${e}`));

  // 5) Mesmo conteúdo (mesma fonte + ano): grava, mas marcado — só um vale.
  const dup = verificarDuplicata({ hash, documento }, existentes);
  const statusExtracao = statusDaExtracao(documento, extraidoPor === 'ia' ? [] : erros);
  const regras = regrasDo(exercicio);
  const motivos = [];
  if (dup.duplicado) motivos.push(dup.motivo);
  if (documento.anoCalendario && documento.anoCalendario !== regras.anoCalendario) {
    motivos.push(`Documento do ano-calendário ${documento.anoCalendario}; este exercício (${exercicio}) usa o ano ${regras.anoCalendario}.`);
  }
  if (statusExtracao === 'ignorado') motivos.push('Extrato não entra como renda (ver dúvidas).');

  const docLinha = await inserir('irpf_documentos', {
    ...base,
    hash,
    chave_conteudo: dup.duplicado ? null : dup.chave || null,
    tipo: documento.tipo,
    status: dup.duplicado ? 'duplicado' : statusExtracao,
    status_extracao: statusExtracao,
    duplicado_de: dup.duplicado ? dup.de : null,
    motivo: motivos.join(' '),
    ano_calendario: documento.anoCalendario,
    instituicao_nome: documento.instituicao.nome,
    instituicao_documento: documento.instituicao.documento,
    duvidas: documento.duvidas.slice(0, 30),
    extraido_por: extraidoPor,
    paginas: paginas.length,
  });

  const linhas = await inserirVarios('irpf_itens', documento.itens.map((i) => ({
    owner_id: ownerId,
    declaracao_id: declaracao.id,
    documento_id: docLinha.id,
    campo: i.campo,
    valor_original: i.valorOriginal,
    centavos: i.centavos,
    pagina: i.pagina,
    trecho: i.trecho,
    referencia: i.referencia,
    confianca: i.confianca,
    origem: extraidoPor === 'ia' ? 'ia' : 'documento',
    revisao: i.centavos == null ? 'pendente' : extraidoPor === 'ia' ? 'sugerido' : 'importado',
    beneficiario: 'titular',
    fonte_documento: documento.instituicao.documento || '',
    fonte_nome: documento.instituicao.nome,
  })));

  return { documento: docDaLinha(docLinha), itens: linhas.map(itemDaLinha), aviso };
}

// ---------- revisão ----------
export async function atualizarItem(id, patch) {
  const linha = {};
  for (const [k, v] of Object.entries(patch)) if (PATCH_ITEM[k]) linha[PATCH_ITEM[k]] = v;
  linha.atualizado_em = new Date().toISOString();
  return itemDaLinha(await atualizar('irpf_itens', id, linha));
}

export async function adicionarItemManual({ declaracao, ownerId, campo, centavos, referencia = '', beneficiario = 'titular', fonteNome = '' }) {
  const r = await inserir('irpf_itens', {
    owner_id: ownerId, declaracao_id: declaracao.id, documento_id: null, campo, valor_original: '', centavos,
    referencia, beneficiario, fonte_nome: fonteNome, origem: 'manual', revisao: 'confirmado', confianca: 1,
  });
  return itemDaLinha(r);
}

export const excluirItem = (id) => apagar('irpf_itens', id);

// Apaga o documento e os valores que vieram dele (os digitados à mão ficam).
export async function excluirDocumento(id, ownerId, declaracaoId) {
  const itens = await listar('irpf_itens', ownerId, { declaracao_id: declaracaoId, documento_id: id });
  for (const i of itens) await apagar('irpf_itens', i.id);
  await apagar('irpf_documentos', id);
}

// Entre dois documentos com o mesmo conteúdo, `escolhido` passa a valer e
// `outro` vira a cópia que não entra na conta.
export async function escolherVersao(escolhido, outro) {
  await atualizar('irpf_documentos', escolhido.id, { status: escolhido.statusExtracao || 'processado', duplicado_de: null });
  await atualizar('irpf_documentos', outro.id, { status: 'duplicado', duplicado_de: escolhido.id });
}

// ---------- dependentes (só nome e relação: o CPF fica no programa oficial) ----------
export async function adicionarDependente({ declaracao, ownerId, nome, relacao }) {
  const r = await inserir('irpf_dependentes', { owner_id: ownerId, declaracao_id: declaracao.id, nome: String(nome).slice(0, 80), relacao: String(relacao || '').slice(0, 40) });
  return { id: r.id, nome: r.nome, relacao: r.relacao || '' };
}
export const removerDependente = (id) => apagar('irpf_dependentes', id);

// Erro de tabela ausente (antes da Fase 8 no servidor) → mensagem clara.
export function mensagemErroIrpf(e) {
  const m = String(e?.message || '').toLowerCase();
  if (e?.code === '23505' || m.includes('duplicate key')) return 'Este arquivo já está nesta declaração.';
  if (m.includes('relation') || m.includes('does not exist') || m.includes('schema cache')) return 'O Imposto de Renda ainda está sendo ativado no servidor. Tente de novo mais tarde.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Sem conexão. O Imposto de Renda precisa de internet.';
  if (m.includes('row-level security') || m.includes('permission')) return 'Sem permissão para este dado.';
  return e?.message || 'Não foi possível concluir agora.';
}
