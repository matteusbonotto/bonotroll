// Edge Function "excluir-conta" — a pessoa apaga a própria conta (LGPD,
// art. 18, VI). Só age sobre QUEM CHAMOU (id tirado do token de login, nunca
// do corpo da requisição).
//
// Ordem: (1) cancela a assinatura no Stripe, se houver — ninguém continua
// sendo cobrado; (2) apaga os arquivos da pessoa (comprovantes e foto);
// (3) apaga a conta — o banco apaga junto, em cascata, tudo o que é dela
// (lançamentos, listas, inventário, fichas, notificações...). Casas/empresas
// compartilhadas continuam existindo para os outros membros.
//
// Publicar: npx supabase functions deploy excluir-conta --no-verify-jwt
// (o token é conferido AQUI, com auth.getUser — funciona com o formato novo
// de chaves do projeto, em que a verificação automática pode recusar tokens).
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': 'https://bnttapp.web.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function apagarPasta(supabase: ReturnType<typeof createClient>, bucket: string, pasta: string) {
  const { data } = await supabase.storage.from(bucket).list(pasta, { limit: 1000 });
  const arquivos = (data ?? []).filter((f) => f.id).map((f) => `${pasta}/${f.name}`);
  for (const sub of (data ?? []).filter((f) => !f.id)) await apagarPasta(supabase, bucket, `${pasta}/${sub.name}`);
  if (arquivos.length) await supabase.storage.from(bucket).remove(arquivos);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false }, 405);

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: quem, error: erroLogin } = await supabase.auth.getUser(token);
  if (erroLogin || !quem?.user) return json({ ok: false, erro: 'Entre na sua conta de novo e tente outra vez.' }, 401);
  const user = quem.user;

  // (1) Stripe: cancela já (sem cobrança futura).
  const assinatura = user.app_metadata?.stripe_subscription;
  const chave = Deno.env.get('STRIPE_SECRET_KEY');
  if (assinatura && chave && user.app_metadata?.assinatura_ativa) {
    const r = await fetch(`https://api.stripe.com/v1/subscriptions/${assinatura}`, { method: 'DELETE', headers: { Authorization: `Bearer ${chave}` } });
    if (!r.ok && r.status !== 404) return json({ ok: false, erro: 'Não consegui cancelar sua assinatura agora. Tente de novo em alguns minutos.' }, 502);
  }

  // (2) Arquivos da pessoa.
  try {
    await apagarPasta(supabase, 'anexos', user.id);
    await apagarPasta(supabase, 'avatars', user.id);
  } catch {
    /* segue: a conta precisa ser apagada mesmo se um arquivo falhar */
  }

  // (3) A conta (e, em cascata, os dados).
  const { error } = await supabase.auth.admin.deleteUser(user.id);
  if (error) return json({ ok: false, erro: 'Não consegui excluir agora. Tente de novo em alguns minutos.' }, 500);
  return json({ ok: true });
});
