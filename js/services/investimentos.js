// Atalho para o BNTT Investimentos (projeto experimental, app separado em outro domínio).
// - Só aparece para contas autorizadas (ou para todos, se a flag invest.feature_flags
//   'acesso_publico' for ligada no banco) — consulta invest.status_acesso().
// - No clique, troca a sessão do BNTT por um token de USO ÚNICO (Edge Function invest-sso)
//   e o Investimentos cria a própria sessão. Não repassamos o refresh token: os dois apps
//   usando o mesmo token rotativo fariam o Supabase revogar a sessão por reuso.
import { SUPABASE_ANON_KEY, SUPABASE_URL, isDemoMode } from '../data/config.js';
import { getSupabase } from '../data/supabaseClient.js';

export const URL_INVESTIMENTOS = 'https://bntt-investimentos.web.app/';

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

/** Monta o endereço de entrada: com token de uso único quando der, senão a página normal. */
export async function urlDeEntradaInvestimentos() {
  try {
    const supabase = await getSupabase();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return URL_INVESTIMENTOS;
    const r = await fetch(`${SUPABASE_URL}/functions/v1/invest-sso`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
    });
    if (!r.ok) return URL_INVESTIMENTOS;
    const j = await r.json();
    return j.tokenHash ? `${URL_INVESTIMENTOS}#sso=${encodeURIComponent(j.tokenHash)}` : URL_INVESTIMENTOS;
  } catch {
    return URL_INVESTIMENTOS;
  }
}

/** Componente Alpine: `x-data="atalhoInvestimentos"`. */
export function atalhoInvestimentos() {
  return {
    liberado: false,
    abrindo: false,
    async init() {
      this.liberado = await podeVerInvestimentos();
      // reavalia ao trocar de conta (login/logout)
      this.$watch('$store.app.profile?.id', async () => {
        this.liberado = await podeVerInvestimentos();
      });
    },
    async abrir() {
      if (this.abrindo) return;
      this.abrindo = true;
      // Abre a aba já no clique (senão o bloqueador de pop-up barra) e só depois define o endereço.
      const aba = window.open('', '_blank');
      if (aba) aba.opener = null;
      const url = await urlDeEntradaInvestimentos();
      if (aba) aba.location.href = url;
      else window.location.href = url;
      this.abrindo = false;
    },
  };
}
