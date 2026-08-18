// Edge Function "keepalive" — só existe pra manter o projeto Supabase ativo
// (planos gratuitos pausam o projeto depois de dias sem atividade). Faz uma
// leitura trivial no banco, o que já conta como atividade real.
//
// Agendada via pg_cron a cada ~3 dias — ver supabase/notifications_push.sql.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetadas automaticamente em
// toda Edge Function do projeto (não precisa configurar secret nenhum pra
// esta função específica).
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async () => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { error } = await supabase.from('profiles').select('id').limit(1);
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, checked_at: new Date().toISOString() }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
