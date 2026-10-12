// Guia de preenchimento + CSV do PRÓPRIO BNTT (não é formato da Receita:
// não existe layout oficial publicado para terceiros — docs/IRPF-INVESTIGACAO.md §4).
// O CSV serve para conferência, para mandar ao contador e para reimportar
// no BNTT (lerCsvBntt), nada além disso.
import { FICHAS, camposDo, CHAVES_DE_CAMPO } from './mapeamento.js';
import { centavosDeTextoBR } from './normalizar.js';

// Só o que entrou na estimativa (resumo.itensUsados), na ordem das fichas.
export function montarGuia({ exercicio, resumo, itens = [], documentos = [] }) {
  const campos = camposDo(exercicio);
  const usados = new Set(resumo?.itensUsados || []);
  const docPorId = new Map(documentos.map((d) => [d.id, d]));
  return FICHAS.map((f) => ({
    ficha: f.id,
    nome: f.nome,
    linhas: itens
      .filter((i) => usados.has(i.id) && campos[i.campo]?.ficha === f.id)
      .map((i) => {
        const def = campos[i.campo];
        const doc = i.documentoId ? docPorId.get(i.documentoId) : null;
        return {
          id: i.id,
          campo: i.campo,
          campoOficial: def.campoOficial,
          codigo: def.codigo,
          codigoConfirmado: def.status === 'oficial',
          centavos: i.centavos,
          referencia: i.referencia || '',
          beneficiario: i.beneficiario || 'titular',
          fonte: i.fonteNome || doc?.instituicaoNome || doc?.nome || (i.origem === 'manual' ? 'digitado por você' : ''),
          documento: doc?.nome || '',
          pagina: i.pagina || null,
        };
      }),
  })).filter((f) => f.linhas.length);
}

// Célula que começa com = + - @ vira texto (evita fórmula ao abrir no Excel).
function celula(v) {
  const t = String(v ?? '');
  const seguro = /^[=+\-@\t\r]/.test(t) ? `'${t}` : t;
  return /[;"\n]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro;
}

const CABECALHO = ['ficha', 'campo_oficial', 'codigo', 'codigo_confirmado', 'valor', 'referencia', 'beneficiario', 'fonte', 'campo_interno'];

export function guiaParaCsv(guia, exercicio) {
  const linhas = [
    `# BNTT - organização do IRPF, exercício ${exercicio}. Formato próprio do BNTT: NÃO é arquivo da Receita Federal.`,
    CABECALHO.join(';'),
  ];
  for (const f of guia) {
    for (const l of f.linhas) {
      const valor = l.centavos == null ? '' : (l.centavos / 100).toFixed(2).replace('.', ',');
      linhas.push([f.nome, l.campoOficial, l.codigo || '', l.codigoConfirmado ? 'sim' : 'conferir', valor, l.referencia, l.beneficiario, l.fonte, l.campo].map(celula).join(';'));
    }
  }
  return linhas.join('\r\n') + '\r\n'; // o BOM do Excel é posto por baixarBlobCsv (services/csvImport.js)
}

function separar(linha, sep) {
  const out = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (aspas) {
      if (c === '"' && linha[i + 1] === '"') { atual += '"'; i++; }
      else if (c === '"') aspas = false;
      else atual += c;
    } else if (c === '"') aspas = true;
    else if (c === sep) { out.push(atual); atual = ''; }
    else atual += c;
  }
  out.push(atual);
  return out.map((s) => s.trim().replace(/^'(?=[=+\-@])/, ''));
}

const LIMITE_LINHAS_CSV = 500;

// CSV do BNTT (ou planilha com colunas "campo_interno"/"campo" e "valor").
// Devolve { itens: [{ campo, centavos, referencia, beneficiario, fonteNome }], erros }.
export function lerCsvBntt(texto) {
  const erros = [];
  const linhas = String(texto || '').replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() && !l.startsWith('#'));
  if (!linhas.length) return { itens: [], erros: ['Arquivo vazio.'] };
  const sep = linhas[0].includes(';') ? ';' : ',';
  const cab = separar(linhas[0], sep).map((c) => c.toLowerCase());
  const iCampo = cab.includes('campo_interno') ? cab.indexOf('campo_interno') : cab.indexOf('campo');
  const iValor = cab.indexOf('valor');
  if (iCampo < 0 || iValor < 0) return { itens: [], erros: ['A planilha precisa das colunas "campo_interno" (ou "campo") e "valor". Use o CSV exportado pelo BNTT como modelo.'] };
  const iRef = cab.indexOf('referencia');
  const iBenef = cab.indexOf('beneficiario');
  const iFonte = cab.indexOf('fonte');
  if (linhas.length - 1 > LIMITE_LINHAS_CSV) erros.push(`Só as primeiras ${LIMITE_LINHAS_CSV} linhas foram lidas.`);
  const itens = [];
  linhas.slice(1, LIMITE_LINHAS_CSV + 1).forEach((l, n) => {
    const col = separar(l, sep);
    const campo = col[iCampo];
    if (!CHAVES_DE_CAMPO.includes(campo)) { erros.push(`Linha ${n + 2}: campo "${String(campo).slice(0, 40)}" desconhecido — ignorada.`); return; }
    const centavos = centavosDeTextoBR(col[iValor]);
    if (centavos === null || centavos < 0) { erros.push(`Linha ${n + 2}: valor "${String(col[iValor]).slice(0, 20)}" ilegível — ignorada.`); return; }
    itens.push({
      campo,
      centavos,
      referencia: iRef >= 0 ? (col[iRef] || '').slice(0, 20) : '',
      beneficiario: iBenef >= 0 && col[iBenef] ? col[iBenef].slice(0, 60) : 'titular',
      fonteNome: iFonte >= 0 ? (col[iFonte] || '').slice(0, 120) : '',
    });
  });
  return { itens, erros };
}
