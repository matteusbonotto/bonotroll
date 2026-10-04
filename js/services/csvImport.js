import { parseDataBR } from '../utils/dateInput.js';

// PapaParse é carregado sob demanda — só baixa esse script quando o usuário
// realmente abre a tela de importação/exportação de CSV.
async function loadPapa() {
  const mod = await import('https://esm.sh/papaparse@5.6.0');
  return mod.default || mod;
}

// Detecta a codificação em vez de assumir UTF-8 cegamente — um CSV salvo
// pelo Excel no Windows (locale pt-BR) sai em ANSI/Windows-1252 por padrão,
// não UTF-8. Alimentar esses bytes direto num parser UTF-8 não dá erro
// nenhum, só produz texto errado silenciosamente ("Salário" vira
// "Sal�rio") — bug real encontrado em produção (categoria criada com
// nome corrompido pela importação). UTF-8 é validado de forma estrita
// (`fatal: true`); só cai pra Windows-1252 se o arquivo não for UTF-8 válido.
async function lerArquivoComoTexto(file) {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder('windows-1252').decode(buffer);
  }
}

export async function parseCsvFile(file) {
  return parseTextoPlanilha(await lerArquivoComoTexto(file));
}

// Texto de planilha: arquivo .csv (vírgula ou ponto e vírgula) ou linhas
// COPIADAS do Excel/Google Planilhas e coladas no app (tabulação). O Papa
// detecta o separador sozinho. (Migração de planilha, 2026-10-04.)
export async function parseTextoPlanilha(texto) {
  const Papa = await loadPapa();
  return new Promise((resolve, reject) => {
    Papa.parse(texto, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve({ headers: results.meta.fields || [], rows: results.data }),
      error: (err) => reject(err),
    });
  });
}

// Dispara o download direto no navegador — sem servidor, sem link temporário
// sobrevivendo além do necessário (revogado logo depois do clique). Mesmo
// padrão de baixarComoJson em services/dataExport.js, só que pra CSV; usado
// tanto por exportToCsv (dados de verdade) quanto por baixarTemplateCsv
// (cabeçalho vazio).
function baixarBlobCsv(csv, filename) {
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Separador ";" (padrão do Excel em pt-BR — com "," ele abre tudo numa
// coluna só). O importador aceita os dois.
export async function exportToCsv(rows, filename = 'exportacao.csv') {
  const Papa = await loadPapa();
  baixarBlobCsv(Papa.unparse(rows, { delimiter: ';' }), filename);
}

// Número no formato brasileiro para planilha: 1234.5 -> "1234,50".
export function valorParaPlanilha(n) {
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : '';
}

// Data ISO -> dd/mm/aaaa (o que o Excel pt-BR entende como data).
export function dataParaPlanilha(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
}

// Nomes de coluna comuns em planilhas pessoais e extratos -> campo do BNTT.
const SINONIMOS = {
  tipo: ['movimentacao', 'movimento', 'tipo', 'entrada/saida', 'debito/credito', 'd/c', 'natureza', 'operacao'],
  titulo: ['titulo', 'descricao', 'historico', 'lancamento', 'nome', 'item', 'detalhe'],
  empresa_servico: ['empresa', 'empresa_servico', 'loja', 'estabelecimento', 'fornecedor', 'favorecido', 'servico'],
  categoria_nome: ['categoria', 'categoria_nome', 'grupo', 'classificacao'],
  responsavel_nome: ['responsavel', 'responsavel_nome', 'quem', 'pessoa', 'pagador'],
  tipo_despesa: ['tipo_despesa', 'tipo de despesa', 'fixa/variavel', 'fixa ou variavel', 'recorrencia'],
  valor: ['valor', 'valor (r$)', 'valor r$', 'quantia', 'montante', 'total', 'preco'],
  data_vencimento: ['data_vencimento', 'vencimento', 'data', 'data de vencimento', 'dt', 'dia'],
  data_pagamento: ['data_pagamento', 'pago em', 'data do pagamento', 'data pagamento', 'pagamento'],
  status: ['status', 'situacao', 'pago?', 'pago'],
  observacoes: ['observacoes', 'observacao', 'obs', 'notas', 'nota', 'comentario'],
  nome: ['nome', 'item', 'produto', 'descricao'],
  quantidade: ['quantidade', 'qtd', 'qtde', 'quant'],
  comodo_nome: ['comodo', 'comodo_nome', 'local', 'ambiente'],
  banco_nome: ['banco', 'banco_nome', 'instituicao'],
};

function normalizarCabecalho(h) {
  return (h || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Sugere a coluna do arquivo para cada campo: nome exato do campo, depois
// sinônimos conhecidos, depois o pedaço do nome (comportamento antigo).
export function sugerirMapeamento(fields, headers) {
  const mapping = {};
  const usados = new Set();
  const livre = (h) => h && !usados.has(h);
  for (const f of fields) {
    const exato = headers.find((h) => normalizarCabecalho(h) === f.key.toLowerCase());
    if (livre(exato)) { mapping[f.key] = exato; usados.add(exato); }
  }
  for (const f of fields) {
    if (mapping[f.key]) continue;
    const sin = SINONIMOS[f.key] || [];
    const achado = headers.find((h) => livre(h) && sin.includes(normalizarCabecalho(h)));
    if (achado) { mapping[f.key] = achado; usados.add(achado); }
  }
  for (const f of fields) {
    if (mapping[f.key]) continue;
    const chave = f.key.split('_')[0].toLowerCase();
    const achado = headers.find((h) => livre(h) && normalizarCabecalho(h).includes(chave));
    if (achado) { mapping[f.key] = achado; usados.add(achado); }
  }
  return mapping;
}

// "Entrada"/"Crédito"/"C"/"Receita"/"+" -> entrada; o resto -> saída.
export function normalizarMovimentacao(valor) {
  const t = normalizarCabecalho(valor);
  return /^(entr|cred|receit|\+|c$)/.test(t) ? 'entrada' : 'saida';
}

// Confere as linhas ANTES de importar (o que vai dar certo e o que não).
export function validarLinhas(target, rows) {
  const fields = IMPORT_TARGETS[target].fields;
  const camposValor = new Set(['valor', 'quantidade', 'meta', 'valor_inicial']);
  const camposData = new Set(['data_vencimento', 'data_pagamento', 'data_validade']);
  const erros = [];
  rows.forEach((row, i) => {
    const problemas = [];
    for (const f of fields) {
      const v = (row[f.key] ?? '').toString().trim();
      if (f.required && !v) problemas.push(`"${f.label}" vazio`);
      if (v && camposValor.has(f.key)) {
        try { parseValorBR(v); } catch { problemas.push(`valor "${v}" não entendido`); }
      }
      if (v && camposData.has(f.key) && !normalizarDataCsv(v)) problemas.push(`data "${v}" não entendida`);
    }
    if (problemas.length) erros.push({ linha: i + 2, problemas });
  });
  return { ok: rows.length - erros.length, erros };
}

// Campos que o usuário pode mapear ao importar cada tipo de informação do app.
export const IMPORT_TARGETS = {
  transacoes: {
    label: 'Transações (entradas/saídas)',
    fields: [
      { key: 'tipo', label: 'Movimentação (entrada/saida)', required: true },
      { key: 'titulo', label: 'Título', required: true },
      { key: 'empresa_servico', label: 'Empresa/Serviço' },
      { key: 'empresa_logo_url', label: 'Logo da empresa (URL)' },
      { key: 'categoria_nome', label: 'Categoria' },
      { key: 'responsavel_nome', label: 'Responsável (nome do membro)' },
      { key: 'tipo_despesa', label: 'Tipo (fixa/variavel)' },
      { key: 'valor', label: 'Valor' },
      { key: 'data_vencimento', label: 'Vencimento (aaaa-mm-dd ou dd/mm/aaaa)' },
      { key: 'data_pagamento', label: 'Pago em (aaaa-mm-dd ou dd/mm/aaaa, opcional)' },
      { key: 'status', label: 'Status (pago/pendente)' },
      { key: 'observacoes', label: 'Observações' },
      { key: 'parcela_atual', label: 'Parcela atual (nº)' },
      { key: 'parcela_total', label: 'Parcela total (nº)' },
    ],
  },
  itens_compra: {
    label: 'Itens de lista de compras',
    fields: [
      { key: 'nome', label: 'Nome do item', required: true },
      { key: 'categoria_nome', label: 'Categoria' },
      { key: 'unidade', label: 'Unidade (un/kg/g)' },
      { key: 'quantidade', label: 'Quantidade' },
    ],
  },
  recursos: {
    label: 'Itens do Inventário (doméstico)',
    fields: [
      { key: 'nome', label: 'Nome do item', required: true },
      { key: 'comodo_nome', label: 'Cômodo', required: true },
      { key: 'subcategoria_nome', label: 'Subcategoria' },
      { key: 'quantidade', label: 'Quantidade' },
      { key: 'data_validade', label: 'Validade (aaaa-mm-dd ou dd/mm/aaaa)' },
      { key: 'icone', label: 'Ícone (Bootstrap Icons, ex: bi-basket)' },
      { key: 'foto_url', label: 'Foto (URL)' },
    ],
  },
  caixinhas: {
    label: 'Caixinhas (reserva financeira)',
    fields: [
      { key: 'banco_nome', label: 'Banco', required: true },
      { key: 'moeda', label: 'Moeda (BRL/USD/EUR/..., padrão BRL)' },
      { key: 'meta', label: 'Meta (opcional)' },
      { key: 'valor_inicial', label: 'Valor guardado inicial (opcional)' },
      { key: 'icone', label: 'Ícone (Bootstrap Icons, ex: bi-piggy-bank)' },
    ],
  },
};

// Modelo pra quem quer montar a planilha do zero sabendo exatamente quais
// colunas o BNTT entende, sem precisar abrir o modal e ler campo a campo
// (pedido do usuário — não existia nenhum arquivo assim). Cabeçalho usa a
// KEY de cada campo (não o label com dica de formato) — ao reimportar esse
// mesmo arquivo preenchido, o match automático de coluna em onFile() (ver
// csvImportModal.js) é exato, não depende de casar por substring.
export async function baixarTemplateCsv(target) {
  const Papa = await loadPapa();
  const fields = IMPORT_TARGETS[target].fields.map((f) => f.key);
  // Duas linhas de exemplo (revisão com personas: modelo só com cabeçalho
  // não ensina o formato). Colunas sem exemplo ficam vazias.
  const exemplos = (EXEMPLOS_MODELO[target] || []).map((ex) => fields.map((k) => ex[k] ?? ''));
  baixarBlobCsv(Papa.unparse({ fields, data: exemplos }, { delimiter: ';' }), `bntt-modelo-${target}.csv`);
}

// Aceita tanto "aaaa-mm-dd" (formato documentado nos labels acima, o mesmo
// de <input type="date">) quanto "dd/mm/aaaa" (o formato que qualquer CSV
// exportado de Excel/Google Sheets em pt-BR usa) — sem isso, uma data
// brasileira ia direto pro banco como string crua: ou o insert quebrava, ou
// (pior, silencioso) o Postgres entendia dia e mês trocados. Reaproveita o
// mesmo parser do campo de data digitável manual (parseDataBR). Formato
// desconhecido ou vazio vira null — mesmo comportamento de "não veio nada"
// que o resto do importador já usa pra data opcional.
export function normalizarDataCsv(valor) {
  const texto = (valor ?? '').toString().trim();
  if (!texto) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) return texto;
  return parseDataBR(texto);
}

const EXEMPLOS_MODELO = {
  transacoes: [
    { tipo: 'saida', titulo: 'Conta de luz', empresa_servico: 'Enel', categoria_nome: 'Casa', tipo_despesa: 'fixa', valor: '189,90', data_vencimento: '10/10/2026', status: 'pendente' },
    { tipo: 'entrada', titulo: 'Salário', categoria_nome: 'Salário', tipo_despesa: 'fixa', valor: '4.500,00', data_vencimento: '05/10/2026', data_pagamento: '05/10/2026', status: 'pago' },
  ],
  compras: [
    { nome: 'Arroz 5kg', categoria_nome: 'Mercado', unidade: 'un', quantidade: '1' },
    { nome: 'Tomate', categoria_nome: 'Hortifruti', unidade: 'kg', quantidade: '1,5' },
  ],
  recursos: [
    { nome: 'Detergente', comodo_nome: 'Cozinha', subcategoria_nome: 'Limpeza', quantidade: '3', data_validade: '31/12/2026' },
    { nome: 'Pasta de dente', comodo_nome: 'Banheiro', subcategoria_nome: 'Higiene', quantidade: '2' },
  ],
  caixinhas: [
    { banco_nome: 'Nubank', moeda: 'BRL', meta: '10.000,00', valor_inicial: '1.500,00' },
    { banco_nome: 'Wise', moeda: 'USD', meta: '2.000,00', valor_inicial: '300,00' },
  ],
};

// Valor monetário de planilha (bug crítico achado na revisão de 2026-10-04:
// "1.234,56" e "R$ 10,00" viravam R$ 0,00 sem aviso). Entende:
// "1.234,56" · "1234,56" · "R$ 10,00" · "10,00 R$" · "1,234.56" · "34.9" ·
// "-50" · "(50,00)" · "50,00-". Vazio → null. Texto que não é número → ERRO
// (a linha aparece no relatório de erros), nunca zero silencioso.
export function parseValorBR(valor) {
  let t = (valor ?? '').toString().replace(/R\$|\s| /gi, '').trim();
  if (!t) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(t)) { negativo = true; t = t.slice(1, -1); }
  if (t.endsWith('-')) { negativo = true; t = t.slice(0, -1); }
  if (t.startsWith('-')) { negativo = !negativo; t = t.slice(1); }
  if (t.startsWith('+')) t = t.slice(1);
  if (!/^[\d.,]+$/.test(t)) throw new Error(`valor "${valor}" não entendido`);
  const virgula = t.lastIndexOf(',');
  const ponto = t.lastIndexOf('.');
  if (virgula > -1 && ponto > -1) {
    // O separador que aparece por último é o decimal.
    t = virgula > ponto ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (virgula > -1) {
    if ((t.match(/,/g) || []).length > 1) throw new Error(`valor "${valor}" não entendido`);
    t = t.replace(',', '.');
  } else if (ponto > -1) {
    // Só ponto: "1.234" / "1.234.567" = milhar; "34.9" / "34.90" = decimal.
    const partes = t.split('.');
    if (partes.length > 2 || partes[1].length === 3) t = partes.join('');
  }
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error(`valor "${valor}" não entendido`);
  return negativo ? -n : n;
}

// Aplica o de-para escolhido pelo usuário (target -> cabeçalho do CSV) sobre as linhas cruas.
export function applyMapping(rows, mapping) {
  return rows.map((row) => {
    const mapped = {};
    for (const [target, sourceHeader] of Object.entries(mapping)) {
      if (sourceHeader) mapped[target] = (row[sourceHeader] ?? '').toString().trim();
    }
    return mapped;
  });
}
