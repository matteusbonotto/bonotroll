// PapaParse é carregado sob demanda — só baixa esse script quando o usuário
// realmente abre a tela de importação/exportação de CSV.
async function loadPapa() {
  const mod = await import('https://esm.sh/papaparse@5');
  return mod.default || mod;
}

export async function parseCsvFile(file) {
  const Papa = await loadPapa();
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
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
      { key: 'categoria_nome', label: 'Categoria' },
      { key: 'tipo_despesa', label: 'Tipo (fixa/variavel)' },
      { key: 'valor', label: 'Valor' },
      { key: 'data_vencimento', label: 'Vencimento (aaaa-mm-dd)' },
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
