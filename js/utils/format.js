const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

// Usado pela categorização automática (transactions.js/shoppingList.js) pra
// "farmácia" e "farmacia", "médico" e "medico" etc. casarem com o mesmo
// radical de palavra-chave sem precisar listar as duas grafias em toda regra.
export function semAcento(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function formatCurrency(value) {
  const n = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(n) ? n : 0);
}

// Versão curta pra espaço apertado (cards, chips, célula de tabela): a
// partir de R$ 10 mil vira "R$ 11,2 mil"/"R$ 1,4 mi" em vez do valor cheio
// quebrando o layout. Abaixo de 10 mil o valor completo já é curto o
// suficiente, então mostra normal. Use formatCurrency (não esta função)
// sempre que precisão exata importar (inputs de formulário, exportação CSV).
export function formatCurrencyCompact(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return formatCurrency(0);
  const abs = Math.abs(n);
  if (abs < 10000) return formatCurrency(n);
  const sinal = n < 0 ? '-' : '';
  if (abs < 1000000) return `${sinal}R$ ${(abs / 1000).toFixed(1).replace('.', ',')} mil`;
  return `${sinal}R$ ${(abs / 1000000).toFixed(1).replace('.', ',')} mi`;
}

// Recebe "yyyy-mm-dd" (formato de <input type="date">) e evita o bug de fuso
// horário que faria a data "voltar" um dia se fosse parseada com `new Date(str)`.
export function formatDate(isoDate) {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return '—';
  return `${day}/${month}/${year}`;
}

export function todayIso() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export function parseCurrencyInput(str) {
  if (typeof str === 'number') return str;
  if (!str) return 0;
  const cleaned = String(str).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3},)/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function initials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
