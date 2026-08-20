// Preencha com os dados do SEU projeto Supabase quando for conectar o backend real.
// Enquanto os valores abaixo forem os placeholders, o app roda automaticamente
// em MODO DEMONSTRAÇÃO (dados mockados em localStorage, sem nenhuma chamada de rede).
export const SUPABASE_URL = 'https://zkoxuafdcsfrdmlfckxz.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inprb3h1YWZkY3NmcmRtbGZja3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Nzc1MzYsImV4cCI6MjEwMjU1MzUzNn0.8XD_v4pkOXf0VqPp_7prBa7sZMoPHCMOBSAz9GVbE9E';

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
