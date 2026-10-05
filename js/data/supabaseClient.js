// Cliente Supabase carregado sob demanda (lazy) — em modo demonstração este módulo
// nunca faz nenhuma requisição de rede, então o app funciona 100% offline/local.
import { SUPABASE_URL, SUPABASE_ANON_KEY, isDemoMode } from './config.js';

let clientPromise = null;

export function getSupabase() {
  if (isDemoMode()) {
    throw new Error('Supabase não configurado — o app está em modo demonstração (veja js/data/config.js).');
  }
  if (!clientPromise) {
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2.112.3').then(({ createClient }) =>
      // 'implicit': o link do e-mail (confirmação/recuperação) funciona mesmo
      // aberto em OUTRO aparelho — no fluxo PKCE ele só funciona no mesmo
      // navegador que pediu (o verificador fica guardado nele).
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { flowType: 'implicit', detectSessionInUrl: true, persistSession: true } })
    );
  }
  return clientPromise;
}
