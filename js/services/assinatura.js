// Linha (Home/Business), plano e pagamento — a ponte entre a LP, o app e o
// Stripe. Fonte dos planos: js/data/planos.js.
//
// Onde mora cada dado (segurança):
//   - tipo da conta: user_metadata.tipo_conta (escolhido no cadastro; só muda
//     a "cara" do app) — app_metadata.tipo, se existir, tem prioridade;
//   - plano/assinatura: app_metadata (SÓ o servidor escreve — webhook do
//     Stripe ou scripts/stripe-sincronizar.mjs). O usuário não consegue se
//     dar um plano editando a própria conta.
import { isDemoMode } from '../data/config.js';
import { getSupabase } from '../data/supabaseClient.js';
import { PLANOS, planoEmVigor, planoPorId, precoAnualCentavos } from '../data/planos.js';
import { LINKS_STRIPE, MODO_STRIPE } from '../data/stripeLinks.js';

const CHAVE_INTENCAO = 'bntt_intencao';
const CHAVE_TIPO_DEMO = 'bntt_demo_tipo';
const VALIDADE_INTENCAO_MS = 2 * 86400000;

const lerJson = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* só nesta sessão */ } };

// A LP manda ?cadastro=1&tipo=home|business&plano=…&ciclo=mensal|anual.
// Guarda (sobrevive à confirmação por e-mail, que pode abrir outra aba) e
// limpa a URL para um recarregar não repetir nada.
export function capturarIntencaoDaUrl() {
  const url = new URL(location.href);
  const p = url.searchParams;
  if (!['cadastro', 'tipo', 'plano', 'ciclo'].some((k) => p.has(k))) return intencaoSalva();
  const tipo = p.get('tipo') === 'business' ? 'business' : 'home';
  const plano = planoPorId(p.get('plano')) && p.get('plano').startsWith(tipo) ? p.get('plano') : null;
  const intencao = { cadastro: p.get('cadastro') === '1', tipo, plano, ciclo: p.get('ciclo') === 'anual' ? 'anual' : 'mensal', em: Date.now() };
  gravar(CHAVE_INTENCAO, intencao);
  if (isDemoMode()) gravar(CHAVE_TIPO_DEMO, tipo);
  ['cadastro', 'tipo', 'plano', 'ciclo'].forEach((k) => p.delete(k));
  history.replaceState(history.state, '', url.pathname + (p.toString() ? `?${p}` : '') + url.hash);
  return intencao;
}

export function intencaoSalva() {
  const i = lerJson(CHAVE_INTENCAO);
  if (!i || Date.now() - (i.em || 0) > VALIDADE_INTENCAO_MS) return null;
  return i;
}

export function limparIntencao() {
  try { localStorage.removeItem(CHAVE_INTENCAO); } catch { /* nada */ }
}

// Dados da conta a partir da sessão do Supabase (ou do modo demonstração).
export function contaDaSessao(session) {
  const u = session?.user || {};
  const app = u.app_metadata || {};
  const usr = u.user_metadata || {};
  const tipoDemo = isDemoMode() ? lerJson(CHAVE_TIPO_DEMO) : null;
  const tipo = (app.tipo || usr.tipo_conta || tipoDemo) === 'business' ? 'business' : 'home';
  return {
    tipo,
    plano: app.plano || null,
    assinaturaAtiva: app.assinatura_ativa === true,
    cortesia: app.cortesia === true,
    ciclo: app.ciclo || null,
    criadaEm: u.created_at || null,
  };
}

// Plano que vale: o que o SERVIDOR calculou (considera o plano de quem criou
// a casa/empresa) — senão, o cálculo local a partir da conta.
export function planoDaConta(conta) {
  const srv = conta.planoServidor;
  if (srv?.plano && planoPorId(srv.plano)) {
    const dias = Number(srv.dias_de_teste) || 0;
    const emTeste = dias > 0 && !conta.assinaturaAtiva;
    return { ...planoPorId(srv.plano), emTeste, diasRestantes: emTeste ? dias : null };
  }
  return planoEmVigor(conta);
}

// Pergunta ao servidor (função bntt_meu_plano, supabase/seguranca-planos-2026-10.sql).
export async function buscarPlanoNoServidor() {
  if (isDemoMode()) return null;
  try {
    const supabase = await getSupabase();
    const { data, error } = await supabase.rpc('bntt_meu_plano');
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// O banco recusa o que passa do plano com "BNTT_LIMITE: <recurso> (...)".
export function ehErroDeLimite(texto) {
  return /BNTT_LIMITE/.test(String(texto || ''));
}

const MOTIVOS_DE_LIMITE = {
  lancamentosMes: 'Você chegou ao limite de lançamentos do mês no seu plano.',
  listas: 'No seu plano cabe 1 lista de compras aberta. Para ter várias, mude de plano.',
  saude: 'As fichas de saúde fazem parte do plano Família.',
  unidades: 'Seu plano chegou ao limite de unidades. Para abrir mais filiais, mude de plano.',
  pessoas: 'O plano de quem criou o grupo chegou ao limite de pessoas.',
};
export function motivoDoLimite(texto) {
  const recurso = /BNTT_LIMITE:\s*([a-zA-Z]+)/.exec(String(texto || ''))?.[1];
  return MOTIVOS_DE_LIMITE[recurso] || 'Isso passa do limite do seu plano.';
}

export function trocarTipoDemo(tipo) {
  gravar(CHAVE_TIPO_DEMO, tipo === 'business' ? 'business' : 'home');
}

// Link de pagamento do Stripe já identificando a conta (client_reference_id
// = id do usuário; o webhook usa isso para ativar o plano certo).
export function pagamentoDoPlano(planoId, ciclo, { userId, email }) {
  const plano = planoPorId(planoId);
  const link = LINKS_STRIPE[planoId]?.[ciclo];
  if (!plano || !link) return null;
  const url = new URL(link.url);
  if (userId) url.searchParams.set('client_reference_id', userId);
  if (email) url.searchParams.set('prefilled_email', email);
  url.searchParams.set('locale', 'pt-BR');
  return {
    plano,
    ciclo,
    url: url.toString(),
    valor: ciclo === 'anual' ? precoAnualCentavos(plano.mensal) : plano.mensal,
    teste: MODO_STRIPE === 'test',
  };
}

// Página de planos da LP (fora do app), já na linha certa.
export const urlDosPlanos = (tipo) => `/?ver=lp&para=${tipo}#planos`;

const reais = (centavos) => (centavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Lista pronta para a tela de planos dentro do app.
export function planosDaLinha(tipo, ciclo) {
  return (PLANOS[tipo] || PLANOS.home).map((p) => {
    const gratis = p.mensal === 0;
    const anual = ciclo === 'anual' && !gratis;
    return {
      ...p,
      gratis,
      precoTexto: gratis ? 'R$ 0' : reais(Math.round(anual ? precoAnualCentavos(p.mensal) / 12 : p.mensal)),
      detalheTexto: gratis ? 'Com limites' : anual ? `${reais(precoAnualCentavos(p.mensal))} por ano` : 'Cobrado todo mês',
    };
  });
}

export const formatarReais = reais;
