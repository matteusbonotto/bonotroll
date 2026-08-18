import { todayIso } from './format.js';

export const DIAS_PARA_VENCER = 7;

export const STATUS_META = {
  pago: { label: 'Pago', badge: 'success', icon: 'bi-check-circle-fill' },
  vencido: { label: 'Vencido', badge: 'danger', icon: 'bi-exclamation-triangle-fill' },
  a_vencer: { label: 'A vencer', badge: 'warning', icon: 'bi-clock-fill' },
  pendente: { label: 'Pendente', badge: 'secondary', icon: 'bi-dash-circle' },
};

function diffInDays(isoA, isoB) {
  const a = new Date(`${isoA}T00:00:00Z`).getTime();
  const b = new Date(`${isoB}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86400000);
}

// Regra de negócio (ver seção 4 do prompt de construção):
// pago > vencido > a_vencer > pendente, nessa ordem de prioridade.
export function computeStatus(transaction) {
  if (transaction.data_pagamento) return 'pago';
  if (!transaction.data_vencimento) return 'pendente';

  const today = todayIso();
  const dias = diffInDays(transaction.data_vencimento, today);

  if (dias < 0) return 'vencido';
  if (dias <= DIAS_PARA_VENCER) return 'a_vencer';
  return 'pendente';
}

export function statusMeta(statusKey) {
  return STATUS_META[statusKey] || STATUS_META.pendente;
}

// ---------- Recursos (inventário doméstico) ----------

export const EXPIRY_STATUS_META = {
  em_falta: { label: 'Em falta', badge: 'secondary', icon: 'bi-dash-circle' },
  vencido: { label: 'Vencido', badge: 'danger', icon: 'bi-exclamation-triangle-fill' },
  vencendo: { label: 'Vencendo', badge: 'warning', icon: 'bi-clock-fill' },
  ok: { label: 'Ok', badge: 'success', icon: 'bi-check-circle-fill' },
};

// Mesma lógica de prioridade de computeStatus, adaptada pra item de estoque:
// quantidade 0 é sempre "em falta" (não importa a validade); validade é
// opcional — item sem data_validade nunca aparece como vencido/vencendo.
export function computeExpiryStatus(item) {
  if (Number(item.quantidade) === 0) return 'em_falta';
  if (item.data_validade) {
    const dias = diffInDays(item.data_validade, todayIso());
    if (dias < 0) return 'vencido';
    if (dias <= DIAS_PARA_VENCER) return 'vencendo';
  }
  return 'ok';
}

export function expiryStatusMeta(statusKey) {
  return EXPIRY_STATUS_META[statusKey] || EXPIRY_STATUS_META.ok;
}
