// Edge Function "ia" — serviço central de IA do BNTT (Google Gemini).
// A chave NUNCA vai para o navegador: só existe aqui, como segredo.
//
// Fluxo: token de login → tarefa da lista fechada (iaNucleo.TAREFAS) →
// limites de tamanho → limite diário por pessoa (ia_consumir, no banco) →
// Gemini com saída JSON por esquema → resposta. O conteúdo enviado nunca é
// registrado em log (só tarefa, status e código de erro).
//
// Segredos (npx supabase secrets set ...; o valor é digitado por quem
// configura, nunca fica no repositório):
//   GEMINI_API_KEY   obrigatório — sem ele a função responde 503 'ia_sem_chave'
//   GEMINI_MODEL     opcional    — padrão abaixo
//
// Funciona na camada GRATUITA do Gemini (decisão do dono, 2026-10-12). Nela o
// Google pode usar o conteúdo para melhorar produtos — por isso a tela de
// autorização avisa isso e o app mascara o CPF antes de enviar
// (docs/IRPF-INVESTIGACAO.md §5).
//
// Publicar: npx supabase functions deploy ia --no-verify-jwt
// (o token é conferido AQUI com auth.getUser, igual à excluir-conta).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ErroIa, LIMITES, TAREFAS, corpoGemini, lerRespostaGemini, origemPermitida, validarPedido } from '../_shared/iaNucleo.js';

const MODELO_PADRAO = 'gemini-3.5-flash';
const TEMPO_LIMITE_MS = 45_000;

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': origemPermitida(req.headers.get('Origin') ?? ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  const falha = (e: ErroIa) => json({ ok: false, codigo: e.codigo, erro: e.message }, e.status);

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, codigo: 'metodo' }, 405);

  let tarefa = '?';
  try {
    const chave = Deno.env.get('GEMINI_API_KEY');
    if (!chave) throw new ErroIa(503, 'ia_sem_chave', 'A IA ainda não foi ativada no servidor.');

    const tamanho = Number(req.headers.get('Content-Length') ?? '0');
    if (tamanho > LIMITES.bytesCorpo) throw new ErroIa(413, 'pedido_grande', 'Pedido grande demais.');
    const bruto = await req.text();
    if (bruto.length > LIMITES.bytesCorpo) throw new ErroIa(413, 'pedido_grande', 'Pedido grande demais.');

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: quem, error: erroLogin } = await admin.auth.getUser(token);
    if (erroLogin || !quem?.user) throw new ErroIa(401, 'sessao', 'Entre na sua conta de novo e tente outra vez.');
    const user = quem.user;

    let corpo: unknown;
    try {
      corpo = JSON.parse(bruto);
    } catch {
      throw new ErroIa(400, 'pedido_invalido', 'Pedido inválido.');
    }
    const pedido = validarPedido(corpo);
    tarefa = pedido.tarefa;
    const regra = TAREFAS[pedido.tarefa as keyof typeof TAREFAS];

    const linha = user.app_metadata?.tipo ?? user.user_metadata?.tipo_conta;
    if (regra.apenasHome && linha === 'business') throw new ErroIa(403, 'linha', 'Este recurso é do BNTT Home.');

    // Limite diário por pessoa — atômico no banco (supabase/ia-2026-10.sql).
    const { data: liberado, error: erroUso } = await admin.rpc('ia_consumir', { p_user: user.id, p_tarefa: pedido.tarefa, p_limite: LIMITES.chamadasPorDia });
    if (erroUso) throw new ErroIa(503, 'ia_config', 'A IA não está configurada corretamente no servidor.');
    if (!liberado) throw new ErroIa(429, 'ia_limite_diario', `Você chegou ao limite de ${LIMITES.chamadasPorDia} leituras por IA hoje. Amanhã libera de novo.`);

    const modelo = Deno.env.get('GEMINI_MODEL') || MODELO_PADRAO;
    const ctrl = new AbortController();
    const relogio = setTimeout(() => ctrl.abort(), TEMPO_LIMITE_MS);
    let r: Response;
    try {
      r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify(corpoGemini(pedido)),
        signal: ctrl.signal,
      });
    } catch {
      throw new ErroIa(504, 'ia_tempo', 'A IA demorou demais para responder. Tente de novo.');
    } finally {
      clearTimeout(relogio);
    }
    const resposta = await r.json().catch(() => null);
    const extracao = lerRespostaGemini(r.status, resposta);
    console.log(JSON.stringify({ tarefa, status: 200 }));
    return json({ ok: true, resultado: extracao, modelo });
  } catch (e) {
    const erro = e instanceof ErroIa ? e : new ErroIa(500, 'interno', 'Erro inesperado na IA.');
    console.log(JSON.stringify({ tarefa, status: erro.status, codigo: erro.codigo }));
    return falha(erro);
  }
});
