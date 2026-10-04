// Autorização das 3 Edge Functions (keepalive, notify-scan, notify-payment).
//
// Elas são chamadas SÓ pelo próprio banco (pg_cron + trigger via pg_net — ver
// supabase/notifications_push.sql), nunca pelo navegador. Desde a migração
// para o projeto appbntt (2026-09), as chaves do Supabase são do formato novo
// (sb_publishable_…/sb_secret_…), que NÃO são JWT — então a verificação de
// JWT do gateway fica desligada (verify_jwt = false em supabase/config.toml) e
// cada função exige, no lugar dela, o header x-bntt-cron igual ao secret
// BNTT_CRON_SECRET da função. O banco lê o mesmo valor do Vault
// (vault.decrypted_secrets, nome 'bntt_cron_secret'); o valor nunca fica em
// nenhum arquivo do repositório.
//
// Sem BNTT_CRON_SECRET configurado a função recusa TUDO (fail closed) — nunca
// fica aberta por esquecimento de configuração.
export function naoAutorizado(req: Request): Response | null {
  const esperado = Deno.env.get('BNTT_CRON_SECRET');
  const recebido = req.headers.get('x-bntt-cron');
  if (!esperado || !recebido || !iguais(esperado, recebido)) {
    return new Response(JSON.stringify({ ok: false, error: 'não autorizado' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return null;
}

// Comparação em tempo constante (não vaza, pelo tempo de resposta, quantos
// caracteres do segredo alguém já acertou).
function iguais(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
