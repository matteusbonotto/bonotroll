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
