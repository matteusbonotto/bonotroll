// NÃO edite os valores abaixo à mão. Eles ficam como placeholder no código-fonte
// e são trocados pela configuração PÚBLICA do .env (SB_PROJ_ID + SB_PB) só na
// cópia servida por `npm run dev` e na gerada por `npm run build` (ver
// scripts/env.mjs::injetarConfig). Enquanto forem os placeholders — ex.: servir
// a pasta crua com `python -m http.server` — o app roda automaticamente em
// MODO DEMONSTRAÇÃO (dados mockados em localStorage, sem nenhuma chamada de rede).
export const SUPABASE_URL = 'https://SEU-PROJETO.supabase.co';
export const SUPABASE_ANON_KEY = 'SUA-ANON-KEY';

// Além do placeholder acima, o modo demo também pode ser forçado sem tocar
// nas credenciais reais — via ?demo=1 na URL (persiste em localStorage) ou
// limpando a flag com ?demo=0. Usado pela suíte de testes (tests/) pra nunca
// depender de trocar este arquivo, e é a mesma base que um futuro botão
// "ver demonstração" na tela de entrada usaria.
function demoForcadoNaUrl() {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  if (!params.has('demo')) return null;
  const ligado = params.get('demo') !== '0';
  try {
    if (ligado) localStorage.setItem('bonotto_force_demo', '1');
    else localStorage.removeItem('bonotto_force_demo');
  } catch {
    // localStorage indisponível (ex.: alguns contextos de teste) — segue só com o valor da URL desta carga
  }
  return ligado;
}

export function isDemoMode() {
  const forcado = demoForcadoNaUrl();
  if (forcado !== null) return forcado;
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('bonotto_force_demo') === '1') return true;
  } catch {
    // ignora — cai pro critério de placeholder abaixo
  }
  return (
    !SUPABASE_URL ||
    SUPABASE_URL.includes('SEU-PROJETO') ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY.includes('SUA-ANON-KEY')
  );
}
