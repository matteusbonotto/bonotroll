// Edge Function "push-teste" — manda uma notificação de teste para os
// aparelhos de QUEM CHAMOU (id tirado do token de login). Serve para a
// pessoa (e o suporte) confirmarem a corrente inteira: servidor → serviço de
// push do Google/Apple → celular. Limite: 1 teste a cada 30 s por pessoa.
// Publicar: npx supabase functions deploy push-teste --no-verify-jwt
// (o token é conferido aqui, com auth.getUser).
import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3';

const CORS = {
  'Access-Control-Allow-Origin': 'https://bnttapp.web.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const ultimoTeste = new Map<string, number>();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: quem, error } = await supabase.auth.getUser(token);
  if (error || !quem?.user) return json({ ok: false, erro: 'Entre na sua conta de novo.' }, 401);
  const uid = quem.user.id;

  const agora = Date.now();
  if (agora - (ultimoTeste.get(uid) ?? 0) < 30000) return json({ ok: false, erro: 'Espere alguns segundos antes de testar de novo.' }, 429);
  ultimoTeste.set(uid, agora);

  const pub = Deno.env.get('VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!pub || !priv) return json({ ok: false, erro: 'Servidor de notificações sem configuração.' }, 500);
  webpush.setVapidDetails('mailto:contato@bonotto.app', pub, priv);

  const { data: inscricoes } = await supabase.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('profile_id', uid);
  if (!inscricoes?.length) return json({ ok: false, erro: 'Nenhum aparelho com notificações ativas nesta conta.' }, 404);

  let enviadas = 0;
  const falhas: string[] = [];
  for (const s of inscricoes) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: 'BNTT', body: 'Notificações funcionando neste aparelho. ✅', url: './app' }),
      );
      enviadas++;
    } catch (e) {
      const codigo = (e as { statusCode?: number }).statusCode;
      falhas.push(String(codigo ?? 'erro'));
      if (codigo === 404 || codigo === 410) await supabase.from('push_subscriptions').delete().eq('id', s.id);
    }
  }
  return json({ ok: enviadas > 0, enviadas, falhas, erro: enviadas ? undefined : 'O serviço de push recusou o envio. Desative e ative de novo neste aparelho.' });
});
