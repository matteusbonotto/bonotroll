// Cliente Supabase carregado sob demanda (lazy) — em modo demonstração este módulo
// nunca faz nenhuma requisição de rede, então o app funciona 100% offline/local.
import { SUPABASE_URL, SUPABASE_ANON_KEY, isDemoMode } from './config.js';

let clientPromise = null;

export function getSupabase() {
  if (isDemoMode()) {
    throw new Error('Supabase não configurado — o app está em modo demonstração (veja js/data/config.js).');
  }
  if (!clientPromise) {
    clientPromise = import('https://esm.sh/@supabase/supabase-js@2').then(({ createClient }) =>
      createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    );
  }
  return clientPromise;
}
