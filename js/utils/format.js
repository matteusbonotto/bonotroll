const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dateFormatter = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

export function formatCurrency(value) {
  const n = Number(value ?? 0);
  return currencyFormatter.format(Number.isFinite(n) ? n : 0);
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
