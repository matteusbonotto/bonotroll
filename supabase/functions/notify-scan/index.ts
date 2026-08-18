// Edge Function "notify-scan" — varredura diária (agendada via pg_cron, ver
// supabase/notifications_push.sql) que gera notificações de:
//   - despesas a vencer/vencidas (responsavel_id da transação)
//   - itens de Recursos em falta / vencendo / vencidos (todos os membros do
//     grupo dono do item — Recursos é inventário COMPARTILHADO da casa)
// e envia Web Push pra quem tiver inscrição salva em push_subscriptions.
//
// Espelha a mesma lógica (e as mesmas dedupe_key) de
// js/services/notifications.js::generateForProfile, que roda no CLIENTE a
// cada login — rodar dos dois lados garante que a central de notificações
// funcione mesmo sem essa função configurada, e que push funcione mesmo com
// o app fechado. upsert com ignoreDuplicates evita notificação duplicada
// quando os dois rodam no mesmo dia.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const DIAS_PARA_VENCER = 7;

function diffInDays(isoA: string, isoB: string) {
  const a = new Date(`${isoA}T00:00:00Z`).getTime();
  const b = new Date(`${isoB}T00:00:00Z`).getTime();
  return Math.round((a - b) / 86400000);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

type NotificationRow = {
  profile_id: string;
  tipo: string;
  titulo: string;
  corpo: string | null;
  referencia_tabela: string;
  referencia_id: string;
  dedupe_key: string;
  lida: boolean;
};

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails('mailto:contato@bonotto.app', vapidPublic, vapidPrivate);
  }

  const hoje = todayIso();
  const rows: NotificationRow[] = [];

  // ---------- Despesas a vencer/vencidas ----------
  const { data: transacoes, error: txErro } = await supabase
    .from('transactions')
    .select('id, titulo, valor, responsavel_id, data_vencimento')
    .eq('tipo', 'saida')
    .is('data_pagamento', null)
    .not('data_vencimento', 'is', null)
    .not('responsavel_id', 'is', null);
  if (txErro) throw txErro;

  for (const t of transacoes ?? []) {
    const dias = diffInDays(t.data_vencimento, hoje);
    if (dias > DIAS_PARA_VENCER) continue;
    const vencido = dias < 0;
    rows.push({
      profile_id: t.responsavel_id,
      tipo: 'vencimento_despesa',
      titulo: vencido ? `"${t.titulo}" está vencida` : `"${t.titulo}" vence em breve`,
      corpo: `R$ ${Number(t.valor).toFixed(2)}`,
      referencia_tabela: 'transactions',
      referencia_id: t.id,
      dedupe_key: `vencimento_despesa:${t.id}:${hoje}`,
      lida: false,
    });
  }

  // ---------- Itens de Recursos (em falta / vencendo / vencidos) ----------
  const { data: itens, error: itensErro } = await supabase
    .from('resource_items')
    .select('id, nome, owner_id, group_id, quantidade, data_validade');
  if (itensErro) throw itensErro;

  const membrosPorGrupo = new Map<string, string[]>();
  async function membrosDoGrupo(groupId: string) {
    if (!membrosPorGrupo.has(groupId)) {
      const { data } = await supabase.from('group_members').select('profile_id').eq('group_id', groupId);
      membrosPorGrupo.set(groupId, (data ?? []).map((m: { profile_id: string }) => m.profile_id));
    }
    return membrosPorGrupo.get(groupId)!;
  }

  for (const item of itens ?? []) {
    let status: 'em_falta' | 'vencido' | 'vencendo' | 'ok' = 'ok';
    if (Number(item.quantidade) === 0) status = 'em_falta';
    else if (item.data_validade) {
      const dias = diffInDays(item.data_validade, hoje);
      if (dias < 0) status = 'vencido';
      else if (dias <= DIAS_PARA_VENCER) status = 'vencendo';
    }
    if (status === 'ok') continue;

    const destinatarios = item.group_id ? await membrosDoGrupo(item.group_id) : [item.owner_id];
    const tipo = status === 'em_falta' ? 'estoque' : 'validade';
    const titulo =
      status === 'em_falta' ? `"${item.nome}" está em falta` : status === 'vencido' ? `"${item.nome}" venceu` : `"${item.nome}" está vencendo`;

    for (const profileId of destinatarios) {
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
  }

  if (!rows.length) {
    return new Response(JSON.stringify({ ok: true, notificacoes: 0 }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  // ON CONFLICT DO NOTHING (ignoreDuplicates) + RETURNING só traz de volta
  // as linhas REALMENTE inseridas agora — é assim que sabemos o que é novo
  // (pra só mandar push do que é novo, não de tudo que já existia).
  const { data: inseridas, error: insErro } = await supabase
    .from('notifications')
    .upsert(rows, { onConflict: 'profile_id,dedupe_key', ignoreDuplicates: true })
    .select('id, profile_id, titulo, corpo');
  if (insErro) throw insErro;

  let pushEnviados = 0;
  if (vapidPublic && vapidPrivate) {
    for (const n of inseridas ?? []) {
      const { data: subs } = await supabase.from('push_subscriptions').select('*').eq('profile_id', n.profile_id);
      for (const sub of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify({ title: n.titulo, body: n.corpo ?? '', tag: `bonotto-${n.id}`, url: './index.html' })
          );
          pushEnviados++;
        } catch (e) {
          const statusCode = (e as { statusCode?: number })?.statusCode;
          if (statusCode === 404 || statusCode === 410) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          }
        }
      }
    }
  }

  return new Response(JSON.stringify({ ok: true, notificacoes: inseridas?.length ?? 0, push_enviados: pushEnviados }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
