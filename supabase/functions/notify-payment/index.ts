// Edge Function "notify-payment" — chamada por um trigger de banco (ver
// supabase/notifications_push.sql) sempre que uma transação é marcada como
// paga (data_pagamento passa de nulo pra preenchido). Avisa os OUTROS
// membros do grupo — quem pagou não precisa ser avisado da própria ação.
//
// O payload recebido é o formato padrão de Database Webhook do Supabase:
// { type, table, record, old_record, schema }.
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

type TransactionRecord = {
  id: string;
  titulo: string;
  valor: number;
  responsavel_id: string | null;
  group_id: string | null;
  data_pagamento: string | null;
};

Deno.serve(async (req) => {
  const payload = (await req.json()) as { record?: TransactionRecord; old_record?: TransactionRecord };
  const record = payload.record;
  const oldRecord = payload.old_record;

  // Defesa extra além do "when" do trigger em SQL: só interessa a
  // transição "não paga -> paga", nunca reprocessa uma já paga sendo editada.
  if (!record?.data_pagamento || oldRecord?.data_pagamento || !record.group_id) {
    return new Response(JSON.stringify({ ok: true, skip: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  if (vapidPublic && vapidPrivate) {
    webpush.setVapidDetails('mailto:contato@bonotto.app', vapidPublic, vapidPrivate);
  }

  const { data: membros, error: membrosErro } = await supabase
    .from('group_members')
    .select('profile_id')
    .eq('group_id', record.group_id);
  if (membrosErro) throw membrosErro;

  const destinatarios = (membros ?? []).map((m: { profile_id: string }) => m.profile_id).filter((id) => id !== record.responsavel_id);
  if (!destinatarios.length) {
    return new Response(JSON.stringify({ ok: true, skip: 'sem destinatários' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const rows = destinatarios.map((profileId) => ({
    profile_id: profileId,
    tipo: 'pagamento',
    titulo: `"${record.titulo}" foi paga`,
    corpo: `R$ ${Number(record.valor).toFixed(2)}`,
    referencia_tabela: 'transactions',
    referencia_id: record.id,
    dedupe_key: `pagamento:${record.id}:${record.data_pagamento}`,
    lida: false,
  }));

  const { data: inseridas, error: insErro } = await supabase
    .from('notifications')
    .upsert(rows, { onConflict: 'profile_id,dedupe_key', ignoreDuplicates: true })
    .select('id, profile_id, titulo, corpo');
  if (insErro) throw insErro;

  let pushEnviados = 0;
  const pushErros: Array<{ profile_id: string; statusCode?: number; motivo: string }> = [];
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
          const motivo = (e as { body?: string; message?: string })?.body || (e as Error)?.message || 'erro desconhecido';
          // 404/410 = inscrição morta (navegador desinstalou/expirou). 401/403
          // = a assinatura VAPID não bate com a chave configurada agora —
          // sempre acontece quando alguém se inscreveu ANTES da última troca
          // de chave; como o servidor só tem UMA chave privada ativa por vez,
          // essa inscrição nunca mais vai funcionar até a pessoa desligar e
          // religar o toggle de novo (recriando com a chave atual). Nos três
          // casos apaga de vez — deixar parada só ia gerar o mesmo erro toda
          // vez que essa pessoa recebesse uma notificação nova.
          if (statusCode === 404 || statusCode === 410 || statusCode === 401 || statusCode === 403) {
            await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          } else {
            console.error(`push falhou pra profile_id=${n.profile_id} (status=${statusCode}):`, motivo);
          }
          pushErros.push({ profile_id: n.profile_id, statusCode, motivo });
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ ok: true, notificados: inseridas?.length ?? 0, push_enviados: pushEnviados, push_erros: pushErros }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
