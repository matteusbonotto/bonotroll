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

// ---------- Moeda por caixinha (2026-08-20) ----------
// Símbolo próprio por moeda em vez de sempre "R$" — sem isso, uma caixinha
// em USDT mostrava o saldo com o cifrão de Real, o que é simplesmente
// errado, não só falta de polimento.
export const MOEDAS_SUPORTADAS = [
  { codigo: 'BRL', simbolo: 'R$', nome: 'Real' },
  { codigo: 'USD', simbolo: '$', nome: 'Dólar americano' },
  { codigo: 'EUR', simbolo: '€', nome: 'Euro' },
  { codigo: 'GBP', simbolo: '£', nome: 'Libra esterlina' },
  { codigo: 'USDT', simbolo: 'USDT', nome: 'Tether (stablecoin)' },
  { codigo: 'BTC', simbolo: '₿', nome: 'Bitcoin' },
  { codigo: 'ETH', simbolo: 'Ξ', nome: 'Ethereum' },
];

export function moedaInfo(codigo) {
  return MOEDAS_SUPORTADAS.find((m) => m.codigo === codigo) || MOEDAS_SUPORTADAS[0];
}

// Formata com o símbolo certo da moeda — cripto usa mais casas decimais
// (2 casas arredondaria qualquer valor pequeno de BTC/ETH pra "0,00").
export function formatMoeda(value, codigoMoeda = 'BRL') {
  const info = moedaInfo(codigoMoeda);
  const n = Number(value ?? 0);
  const casas = codigoMoeda === 'BTC' || codigoMoeda === 'ETH' ? 8 : 2;
  const numero = (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  return `${info.simbolo} ${numero}`;
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

// Bug real corrigido (2026-08-20): usava d.toISOString(), que converte pra
// UTC — em qualquer fuso negativo (ex.: Brasil, UTC-3), isso faz "hoje"
// virar amanhã sempre que já passou das ~21h locais (a mesma classe de bug
// "ontem virou hoje" que o resto do projeto toma cuidado de evitar em todo
// outro lugar). "Hoje" pra uma pessoa é sempre o dia do CALENDÁRIO LOCAL
// dela, nunca UTC — daí ler os campos locais (getFullYear/getMonth/getDate)
// em vez de converter. Usado em quase tudo (status, recorrência, formulário,
// filtro de período), então essa era a correção de mais alavancagem possível.
export function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
