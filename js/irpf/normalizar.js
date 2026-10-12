// Normalização de valores, datas e documentos do IRPF — funções puras.
// Dinheiro do IRPF vive em CENTAVOS INTEIROS (o resto do app ainda usa
// Number de ponto flutuante, dívida técnica conhecida — aqui não, porque
// imposto é soma de muitos valores e o erro acumularia).

// "1.234,56" | "R$ 1.234,56" | "1234,56" | "1234.56" | "(1.234,56)" → 123456.
// Devolve null se não for um valor legível (nunca chuta).
export function centavosDeTextoBR(texto) {
  if (texto === null || texto === undefined) return null;
  if (typeof texto === 'number') return Number.isFinite(texto) ? Math.round(texto * 100) : null;
  let t = String(texto).trim().replace(/\s/g, '').replace(/^R\$/i, '');
  const negativo = /^\(.*\)$/.test(t) || t.startsWith('-');
  t = t.replace(/[()\-]/g, '');
  if (!t) return null;
  let inteiro;
  let fracao;
  if (/^\d{1,3}(\.\d{3})*,\d{2}$/.test(t) || /^\d+,\d{2}$/.test(t)) {
    [inteiro, fracao] = t.replace(/\./g, '').split(',');
  } else if (/^\d+\.\d{2}$/.test(t)) {
    [inteiro, fracao] = t.split('.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(t) || /^\d+$/.test(t)) {
    inteiro = t.replace(/\./g, '');
    fracao = '00';
  } else {
    return null;
  }
  const c = Number(inteiro) * 100 + Number(fracao);
  if (!Number.isSafeInteger(c)) return null;
  return negativo ? -c : c;
}

export function formatarCentavos(c) {
  if (c === null || c === undefined) return '—';
  return (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// "31/12/2025" | "2025-12-31" → "2025-12-31"; inválida → null.
export function dataIso(texto) {
  const t = String(texto || '').trim();
  let a;
  let m;
  let d;
  let r = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (r) [, d, m, a] = r;
  else if ((r = t.match(/^(\d{4})-(\d{2})-(\d{2})$/))) [, a, m, d] = r;
  else return null;
  const data = new Date(Date.UTC(+a, +m - 1, +d));
  if (data.getUTCFullYear() !== +a || data.getUTCMonth() !== +m - 1 || data.getUTCDate() !== +d) return null;
  return `${a}-${m}-${d}`;
}

export const soDigitos = (t) => String(t || '').replace(/\D/g, '');

export function cpfValido(cpf) {
  const c = soDigitos(cpf);
  if (c.length !== 11 || /^(\d)\1{10}$/.test(c)) return false;
  const dv = (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(c[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(c[9]) && dv(10) === Number(c[10]);
}

export function cnpjValido(cnpj) {
  const c = soDigitos(cnpj);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (n) => {
    const pesos = n === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const s = pesos.reduce((acc, p, i) => acc + Number(c[i]) * p, 0);
    const r = s % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === Number(c[12]) && dv(13) === Number(c[13]);
}

export function formatarCnpj(cnpj) {
  const c = soDigitos(cnpj);
  return c.length === 14 ? c.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : cnpj;
}

export function formatarCpf(cpf) {
  const c = soDigitos(cpf);
  return c.length === 11 ? c.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') : cpf;
}

// CPF ou CNPJ, o que for válido; null se nenhum.
export function documentoFiscal(texto) {
  const d = soDigitos(texto);
  if (d.length === 11 && cpfValido(d)) return { tipo: 'cpf', numero: d };
  if (d.length === 14 && cnpjValido(d)) return { tipo: 'cnpj', numero: d };
  return null;
}
