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
  const Papa = await loadPapa();
  const texto = await lerArquivoComoTexto(file);
  return new Promise((resolve, reject) => {
    Papa.parse(texto, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve({ headers: results.meta.fields || [], rows: results.data }),
      error: (err) => reject(err),
    });
  });
}

export async function exportToCsv(rows, filename = 'exportacao.csv') {
  const Papa = await loadPapa();
  const csv = Papa.unparse(rows);
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
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
      { key: 'data_vencimento', label: 'Vencimento (aaaa-mm-dd)' },
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
    label: 'Itens de Recursos (inventário doméstico)',
    fields: [
      { key: 'nome', label: 'Nome do item', required: true },
      { key: 'comodo_nome', label: 'Cômodo', required: true },
      { key: 'subcategoria_nome', label: 'Subcategoria' },
      { key: 'quantidade', label: 'Quantidade' },
      { key: 'data_validade', label: 'Validade (aaaa-mm-dd)' },
      { key: 'icone', label: 'Ícone (Bootstrap Icons, ex: bi-basket)' },
      { key: 'foto_url', label: 'Foto (URL)' },
    ],
  },
};

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
