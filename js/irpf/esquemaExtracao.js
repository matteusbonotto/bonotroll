// Esquema da extração de um documento — o MESMO para o extrator local
// (extratorLocal.js) e para o Gemini (Edge Function irpf-extrair, Fase 8,
// via responseSchema). A IA nunca preenche a tela com texto livre: o que
// ela devolve só entra se passar por validarExtracao(). Campo fora do
// esquema é descartado; valor fora do tipo vira pendência, não chute.
import { CHAVES_DE_CAMPO } from './mapeamento.js';
import { centavosDeTextoBR, soDigitos, cnpjValido, cpfValido } from './normalizar.js';

export const TIPOS_DOCUMENTO = ['informe_pj', 'informe_bancario', 'recibo_despesa', 'extrato_bancario', 'nao_identificado'];

// Formato JSON Schema (subconjunto aceito pelo responseSchema do Gemini).
export const ESQUEMA_EXTRACAO = {
  type: 'object',
  properties: {
    tipo: { type: 'string', enum: TIPOS_DOCUMENTO },
    instituicao: {
      type: 'object',
      properties: { nome: { type: 'string' }, documento: { type: 'string', description: 'CNPJ ou CPF da fonte/prestador, só dígitos' } },
    },
    ano_calendario: { type: 'integer' },
    itens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          campo: { type: 'string', enum: CHAVES_DE_CAMPO },
          valor_original: { type: 'string', description: 'O valor exatamente como aparece no documento' },
          pagina: { type: 'integer' },
          trecho: { type: 'string', description: 'Linha do documento de onde o valor saiu' },
          confianca: { type: 'number' },
          referencia: { type: 'string', description: 'Ex.: "31/12/2025" para saldos' },
        },
        required: ['campo', 'valor_original'],
      },
    },
    duvidas: { type: 'array', items: { type: 'string' }, description: 'O que está ilegível ou ambíguo — perguntar ao usuário' },
  },
  required: ['tipo', 'itens'],
};

const LIMITE_ITENS = 60;
const LIMITE_TEXTO = 300;

// Devolve { ok, erros[], documento } — documento já normalizado.
export function validarExtracao(bruto) {
  const erros = [];
  if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) return { ok: false, erros: ['Resposta não é um objeto.'], documento: null };
  const tipo = TIPOS_DOCUMENTO.includes(bruto.tipo) ? bruto.tipo : 'nao_identificado';
  if (tipo !== bruto.tipo) erros.push(`Tipo de documento desconhecido: ${String(bruto.tipo).slice(0, 40)}`);

  const docInst = soDigitos(bruto.instituicao?.documento);
  const documentoValido = (docInst.length === 14 && cnpjValido(docInst)) || (docInst.length === 11 && cpfValido(docInst));
  if (docInst && !documentoValido) erros.push('CPF/CNPJ da instituição inválido.');
  const instituicao = {
    nome: typeof bruto.instituicao?.nome === 'string' ? bruto.instituicao.nome.slice(0, 120).trim() : '',
    documento: documentoValido ? docInst : null,
  };

  const ano = Number.isInteger(bruto.ano_calendario) && bruto.ano_calendario >= 2000 && bruto.ano_calendario <= 2100 ? bruto.ano_calendario : null;
  if (bruto.ano_calendario != null && ano === null) erros.push('Ano-calendário inválido.');

  const itens = [];
  const duvidas = Array.isArray(bruto.duvidas) ? bruto.duvidas.filter((d) => typeof d === 'string').map((d) => d.slice(0, LIMITE_TEXTO)).slice(0, 20) : [];
  for (const it of (Array.isArray(bruto.itens) ? bruto.itens : []).slice(0, LIMITE_ITENS)) {
    if (!it || !CHAVES_DE_CAMPO.includes(it.campo)) {
      erros.push(`Campo fora do esquema descartado: ${String(it?.campo).slice(0, 40)}`);
      continue;
    }
    const original = typeof it.valor_original === 'string' ? it.valor_original.slice(0, 40) : String(it.valor_original ?? '');
    const centavos = centavosDeTextoBR(original);
    const confianca = typeof it.confianca === 'number' && it.confianca >= 0 && it.confianca <= 1 ? it.confianca : 0.5;
    itens.push({
      campo: it.campo,
      valorOriginal: original,
      centavos: centavos !== null && centavos >= 0 ? centavos : null,
      pagina: Number.isInteger(it.pagina) && it.pagina > 0 ? it.pagina : null,
      trecho: typeof it.trecho === 'string' ? it.trecho.slice(0, LIMITE_TEXTO) : '',
      referencia: typeof it.referencia === 'string' ? it.referencia.slice(0, 20) : '',
      // Valor ilegível/negativo: fica como pendência com confiança zero.
      confianca: centavos !== null && centavos >= 0 ? confianca : 0,
    });
    if (centavos === null || centavos < 0) duvidas.push(`Valor ilegível para "${it.campo}": "${original}"`);
  }
  return { ok: erros.length === 0, erros, documento: { tipo, instituicao, anoCalendario: ano, itens, duvidas } };
}
