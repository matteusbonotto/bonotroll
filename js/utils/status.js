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

// ---------- Severidade de notificação (Fase 6, prompt master §33) ----------
// Antes, todo evento (vencimento/estoque/validade/pagamento) chegava com o
// mesmo peso visual — sino sem hierarquia nenhuma. §33 pede 4 níveis
// (info/attention/warning/critical) e "não usar vermelho pra tudo". A tabela
// `notifications` não guarda o sub-estado (vencido × a_vencer, em_falta ×
// vencendo) como coluna própria — em vez de migrar o schema só por isto,
// deriva do texto que generateForProfile já escreve (services/notifications.js),
// que já carrega essa distinção ("está vencida" × "vence em breve" etc.).
export const SEVERITY_META = {
  critical: { label: 'Crítico', badge: 'danger', icon: 'bi-exclamation-octagon-fill' },
  warning: { label: 'Atenção', badge: 'warning', icon: 'bi-clock-fill' },
  attention: { label: 'Info', badge: 'info', icon: 'bi-info-circle-fill' },
  info: { label: 'Novidade', badge: 'success', icon: 'bi-check-circle-fill' },
};

export function severidadeDe(notificacao) {
  const titulo = (notificacao.titulo || '').toLowerCase();
  if (notificacao.tipo === 'pagamento') return 'info';
  if (notificacao.tipo === 'estoque') return 'attention'; // em falta é chato, não é crise
  // vencimento_despesa e validade compartilham a mesma dualidade textual
  if (/vencid|venceu|falta/.test(titulo)) return 'critical'; // já passou/já acabou
  if (/vence|vencendo/.test(titulo)) return 'warning'; // ainda dá tempo de agir
  return 'attention';
}

export function severityMeta(notificacao) {
  return SEVERITY_META[severidadeDe(notificacao)] || SEVERITY_META.attention;
}
