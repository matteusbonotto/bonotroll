import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';
import { computeStatus, computeExpiryStatus } from '../utils/status.js';
import { formatCurrency, todayIso } from '../utils/format.js';
import { listTransactions } from './transactions.js';
import { listAllItems } from './resources.js';

export async function listNotifications(profileId) {
  let rows;
  if (isDemoMode()) {
    rows = await mockDb.list('notifications', (n) => n.profile_id === profileId);
  } else {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('profile_id', profileId)
      .order('criado_em', { ascending: false })
      .limit(50);
    if (error) throw error;
    rows = data;
  }
  return [...rows].sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || '')).slice(0, 50);
}

export async function markAsRead(id) {
  if (isDemoMode()) return mockDb.update('notifications', id, { lida: true });
  const supabase = await getSupabase();
  const { error } = await supabase.from('notifications').update({ lida: true }).eq('id', id);
  if (error) throw error;
}

export async function markAllAsRead(profileId) {
  const pendentes = (await listNotifications(profileId)).filter((n) => !n.lida);
  await Promise.all(pendentes.map((n) => markAsRead(n.id)));
}

// Insere só o que ainda não existe (mesmo profile_id + dedupe_key) — sem
// isso, cada load() do app duplicaria a mesma notificação. Em modo real
// usa upsert com ignoreDuplicates (o índice único da tabela garante a regra
// no banco); em modo demo replica a checagem manualmente.
async function inserirSeNovo(rows) {
  if (!rows.length) return;
  if (isDemoMode()) {
    const existentes = await mockDb.list('notifications', () => true);
    const chaves = new Set(existentes.map((n) => `${n.profile_id}::${n.dedupe_key}`));
    for (const row of rows) {
      if (chaves.has(`${row.profile_id}::${row.dedupe_key}`)) continue;
      await mockDb.insert('notifications', row);
    }
    return;
  }
  const supabase = await getSupabase();
  const { error } = await supabase.from('notifications').upsert(rows, { onConflict: 'profile_id,dedupe_key', ignoreDuplicates: true });
  if (error) throw error;
}

// Roda a cada carregamento do app e, com o app aberto, de novo a cada 5min
// (ver init()/setupAutoRefresh em components/store.js e app.js). Em modo
// real, a Edge Function notify-scan faz o MESMO trabalho no servidor (+
// dispara push) numa varredura por hora — rodar aqui também garante que o
// sino já funcione antes/sem essa Edge Function configurada, e é o único
// jeito de funcionar em modo demo (sem backend nenhum). A dedupe_key
// idêntica nos dois lados evita duplicar quando as duas rodam na mesma hora.
//
// IMPORTANTE (RLS): isso roda como o usuário logado, então só pode gravar
// profile_id = a própria pessoa (nunca em nome de outro membro — ver o
// histórico de "new row violates row-level security policy" quando uma
// versão anterior tentou inserir pro colega direto daqui). "Avisar todo o
// grupo" de verdade (o outro membro recebendo notificação de UMA despesa
// que essa pessoa nem tocou) só é possível pelo notify-scan no servidor
// (service_role, ignora RLS de propósito) — aqui só preenche o sino de
// QUEM ESTÁ LOGADO, olhando despesa/item que aparece no escopo dela
// (próprio + grupo), não mais só o que ela é responsavel_id.
export async function generateForProfile({ profileId, groupId }) {
  const hoje = todayIso();
  const rows = [];

  const transacoes = await listTransactions({ ownerId: profileId, groupId });
  for (const t of transacoes) {
    if (t.tipo !== 'saida') continue;
    const status = computeStatus(t);
    if (status !== 'vencido' && status !== 'a_vencer') continue;
    rows.push({
      profile_id: profileId,
      tipo: 'vencimento_despesa',
      titulo: status === 'vencido' ? `"${t.titulo}" está vencida` : `"${t.titulo}" vence em breve`,
      corpo: formatCurrency(t.valor),
      referencia_tabela: 'transactions',
      referencia_id: t.id,
      dedupe_key: `vencimento_despesa:${t.id}:${hoje}`,
      lida: false,
    });
  }

  // Recursos é inventário COMPARTILHADO da casa — ao contrário de despesas
  // (pessoais), qualquer item do escopo (próprio + grupo) gera notificação
  // pra quem está vendo, não só os itens que essa pessoa mesma cadastrou.
  const itens = await listAllItems({ ownerId: profileId, groupId });
  for (const item of itens) {
    const status = computeExpiryStatus(item);
    if (status === 'ok') continue;
    const tipo = status === 'em_falta' ? 'estoque' : 'validade';
    const titulo =
      status === 'em_falta' ? `"${item.nome}" está em falta` : status === 'vencido' ? `"${item.nome}" venceu` : `"${item.nome}" está vencendo`;
    rows.push({
      profile_id: profileId,
      tipo,
      titulo,
      corpo: null,
      referencia_tabela: 'resource_items',
      referencia_id: item.id,
      dedupe_key: `${tipo}:${item.id}:${hoje}`,
      lida: false,
    });
  }

  await inserirSeNovo(rows);
}

// Chamado no momento em que uma despesa é marcada como paga (ver
// togglePago em components/transactionTable.js e save() em
// components/transactionForm.js) — notifica os OUTROS membros do grupo, não
// quem pagou.
//
// Em modo REAL isso não escreve mais nada aqui: um insert do cliente direto
// pro profile_id de OUTRA pessoa, sob RLS normal, se mostrou frágil em teste
// real (passava rodando como postgres/superuser no SQL Editor, mas
// continuava caindo em "new row violates row-level security policy" com a
// sessão de verdade) — a causa exata não valia a pena perseguir mais quando
// existe um caminho estruturalmente mais simples: o trigger
// notificar_pagamento_trigger (ver supabase/schema.sql), que roda security
// definer direto no banco, ignora RLS de propósito, e dispara sozinho no
// UPDATE de data_pagamento sem precisar de nenhuma chamada daqui. Em modo
// DEMO (mockDb, sem RLS/trigger nenhum) esse caminho client-side continua
// sendo o único jeito de existir, então segue rodando normalmente.
export async function notifyPayment({ transaction, payerProfileId, memberIds }) {
  if (!isDemoMode()) return;
  const rows = memberIds
    .filter((id) => id !== payerProfileId)
    .map((id) => ({
      profile_id: id,
      tipo: 'pagamento',
      titulo: `"${transaction.titulo}" foi paga`,
      corpo: formatCurrency(transaction.valor),
      referencia_tabela: 'transactions',
      referencia_id: transaction.id,
      dedupe_key: `pagamento:${transaction.id}:${transaction.data_pagamento}`,
      lida: false,
    }));
  await inserirSeNovo(rows);
}
