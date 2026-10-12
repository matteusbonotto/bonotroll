// Cliente do serviço central de IA (Edge Function "ia", que fala com o
// Gemini). A chave do Gemini NUNCA passa por aqui — o navegador só manda o
// token de login e o pedido; a função confere tudo de novo do lado dela.
// Toda falha vira { codigo, mensagem } compreensível, e quem chama sempre
// tem um caminho sem IA (a IA nunca é obrigatória em nenhuma tela).
import { SUPABASE_ANON_KEY, SUPABASE_URL, isDemoMode } from '../data/config.js';
import { getSupabase } from '../data/supabaseClient.js';

export class FalhaIa extends Error {
  constructor(codigo, mensagem, status = 0) {
    super(mensagem);
    this.codigo = codigo;
    this.status = status;
  }
}

const MENSAGENS = {
  demo: 'A IA não funciona no modo demonstração. O leitor do aparelho continua funcionando.',
  sem_rede: 'Sem conexão com o servidor. A leitura por IA precisa de internet.',
  sessao: 'Sua sessão expirou. Entre de novo para usar a IA.',
  ia_sem_chave: 'A IA ainda não foi ativada no servidor.',
  ia_tier_gratuito: 'A leitura de documentos fiscais por IA ainda não foi ativada (exige a conta paga do Gemini, por privacidade).',
  ia_config: 'A IA não está configurada corretamente no servidor.',
  ia_limite_diario: 'Você chegou ao limite diário de leituras por IA. Amanhã libera de novo.',
  ia_limite_provedor: 'A IA está no limite de uso agora. Tente de novo em alguns minutos.',
  ia_indisponivel: 'A IA está indisponível agora. Tente de novo mais tarde.',
  ia_tempo: 'A IA demorou demais para responder. Tente de novo.',
  ia_resposta_invalida: 'A IA devolveu uma resposta fora do formato. Nada foi aproveitado.',
  ia_recusou: 'A IA não conseguiu analisar este documento.',
  linha: 'Este recurso é do BNTT Home.',
  funcao_ausente: 'O serviço de IA ainda não foi publicado no servidor.',
};

export function mensagemIa(codigo, padrao) {
  return MENSAGENS[codigo] || padrao || 'Não foi possível usar a IA agora.';
}

async function tokenAtual() {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

// tarefa: chave de TAREFAS na função (ex.: 'irpf_extrair'). `deps` existe
// para os testes injetarem fetch/token sem rede.
export async function chamarIa(tarefa, dados, deps = {}) {
  const demo = deps.demo ?? isDemoMode();
  if (demo) throw new FalhaIa('demo', MENSAGENS.demo);
  const fetcher = deps.fetch || globalThis.fetch.bind(globalThis);
  const token = await (deps.token || tokenAtual)();
  if (!token) throw new FalhaIa('sessao', MENSAGENS.sessao, 401);
  const url = `${deps.url || SUPABASE_URL}/functions/v1/ia`;
  let r;
  try {
    r = await fetcher(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, apikey: deps.apikey || SUPABASE_ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ tarefa, ...dados }),
    });
  } catch {
    throw new FalhaIa('sem_rede', MENSAGENS.sem_rede);
  }
  let corpo = null;
  try {
    corpo = await r.json();
  } catch {
    /* corpo não-JSON: tratado abaixo */
  }
  if (r.status === 404 && !corpo?.codigo) throw new FalhaIa('funcao_ausente', MENSAGENS.funcao_ausente, 404);
  if (!r.ok || !corpo?.ok) {
    const codigo = corpo?.codigo || (r.status === 401 ? 'sessao' : r.status === 429 ? 'ia_limite_provedor' : r.ok ? 'ia_resposta_invalida' : 'ia_indisponivel');
    throw new FalhaIa(codigo, mensagemIa(codigo, corpo?.erro), r.status);
  }
  if (!corpo.resultado || typeof corpo.resultado !== 'object') throw new FalhaIa('ia_resposta_invalida', MENSAGENS.ia_resposta_invalida, r.status);
  return corpo.resultado;
}
