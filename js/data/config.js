// Preencha com os dados do SEU projeto Supabase quando for conectar o backend real.
// Enquanto os valores abaixo forem os placeholders, o app roda automaticamente
// em MODO DEMONSTRAÇÃO (dados mockados em localStorage, sem nenhuma chamada de rede).
export const SUPABASE_URL = 'https://zkoxuafdcsfrdmlfckxz.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inprb3h1YWZkY3NmcmRtbGZja3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY5Nzc1MzYsImV4cCI6MjEwMjU1MzUzNn0.8XD_v4pkOXf0VqPp_7prBa7sZMoPHCMOBSAz9GVbE9E';

export function isDemoMode() {
  return (
    !SUPABASE_URL ||
    SUPABASE_URL.includes('SEU-PROJETO') ||
    !SUPABASE_ANON_KEY ||
    SUPABASE_ANON_KEY.includes('SUA-ANON-KEY')
  );
}
