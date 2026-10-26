// Atalho para o BNTT Investimentos — publicado junto, em /investir/ (mesmo domínio = mesma sessão do Supabase:
// entrou no BNTT, já está logado lá; as duas abas coordenam a renovação do token pela trava do supabase-js).
// Só aparece para contas autorizadas (ou para todos, se a flag invest.feature_flags 'acesso_publico' for ligada
// no banco) — consulta invest.status_acesso(). O Investimentos confere o acesso de novo do lado dele.
import { isDemoMode } from '../data/config.js';
import { getSupabase } from '../data/supabaseClient.js';

export const URL_INVESTIMENTOS = '/investir/';

export async function podeVerInvestimentos() {
  if (isDemoMode()) return false;
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.schema('invest').rpc('status_acesso');
    if (error || !data) return false;
    return data.publico === true || data.permitido === true;
  } catch {
    return false;
  }
}

/** Componente Alpine: `x-data="atalhoInvestimentos"`. */
export function atalhoInvestimentos() {
  return {
    liberado: false,
    url: URL_INVESTIMENTOS,
    async init() {
      this.liberado = await podeVerInvestimentos();
      // reavalia ao trocar de conta (login/logout)
      this.$watch('$store.app.profile?.id', async () => {
        this.liberado = await podeVerInvestimentos();
      });
    },
  };
}
