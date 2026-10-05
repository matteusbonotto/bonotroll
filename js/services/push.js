import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';
import { VAPID_PUBLIC_KEY } from '../data/vapid.js';

// applicationServerKey precisa ser Uint8Array, não a string base64url que a
// API de geração de VAPID devolve — conversão padrão recomendada pela MDN.
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Estado REAL das notificações neste aparelho (Palm Business, fase 9). Antes
// o switch só distinguia "concedido / não concedido": permissão BLOQUEADA no
// navegador, iPhone sem o app instalado e inscrição que nunca chegou ao
// servidor apareciam todas como "negado" (e produção tinha 0 inscrições).
//   nao-suportado | precisa-instalar | bloqueado | nao-pedido | ativo | so-no-aparelho
export function ehIphoneSemInstalar() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const instalado = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;
  return ios && !instalado;
}

async function inscricaoNoServidor(endpoint) {
  if (isDemoMode()) return (await mockDb.list('push_subscriptions', (s) => s.endpoint === endpoint)).length > 0;
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('push_subscriptions').select('id').eq('endpoint', endpoint).limit(1);
  if (error) throw error;
  return (data || []).length > 0;
}

export async function estadoPush() {
  if (ehIphoneSemInstalar()) return 'precisa-instalar';
  if (!isPushSupported()) return 'nao-suportado';
  if (Notification.permission === 'denied') return 'bloqueado';
  if (Notification.permission === 'default') return 'nao-pedido';
  const sub = await getExistingSubscription();
  if (!sub) return 'nao-pedido';
  return (await inscricaoNoServidor(sub.endpoint).catch(() => false)) ? 'ativo' : 'so-no-aparelho';
}

// Promessa com prazo: em alguns aparelhos o navegador nunca responde (e a
// tela ficava presa em "Ativando…"). Vira um erro com estado conhecido.
function comPrazo(promessa, ms, codigo) {
  return Promise.race([
    promessa,
    new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error(codigo), { codigoPalm: codigo })), ms)),
  ]);
}

async function registroDoApp() {
  return comPrazo(navigator.serviceWorker.ready, 10000, 'sw-nao-pronto');
}

export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  const reg = await registroDoApp();
  return reg.pushManager.getSubscription();
}

// Erro técnico (geralmente em inglês, vindo do navegador ou do banco) ->
// frase curta em português. O texto original vai só em "Detalhes técnicos".
export function explicarErroPush(e) {
  const nome = e?.name || '';
  const msg = String(e?.message || e || '');
  const tecnico = [nome, msg, e?.code].filter(Boolean).join(' · ');
  let mensagem = 'Não deu para ativar agora. Tente de novo em alguns minutos.';
  if (e?.codigoPalm === 'sw-nao-pronto') mensagem = 'O app ainda está terminando de instalar. Feche o BNTT, abra de novo e tente outra vez.';
  else if (e?.codigoPalm === 'sem-resposta') mensagem = 'O celular não respondeu ao pedido. Verifique a internet, feche e abra o Palm e tente de novo.';
  else if (/failed to fetch|network/i.test(msg)) mensagem = 'Sem conexão com a internet. Conecte e tente de novo.';
  else if (nome === 'NotAllowedError') mensagem = 'O navegador não deixou ativar. Confira se as notificações do BNTT estão permitidas nas configurações do celular.';
  else if (nome === 'AbortError' || /push service/i.test(msg)) mensagem = 'O serviço de avisos do celular não respondeu. No Android, confira se o Google Play Services está atualizado e tente de novo.';
  else if (e?.code === '42501' || /row-level security|permission denied/i.test(msg)) mensagem = 'Sua sessão expirou. Saia e entre de novo na conta e tente outra vez.';
  return { mensagem, tecnico };
}

// Pede permissão, inscreve no push do navegador e salva o endpoint/chaves
// no backend (pra Edge Function saber pra onde mandar depois). Modo demo
// não tem servidor pra enviar nada, mas a inscrição do navegador em si
// ainda funciona — só não persiste em lugar nenhum útil (fica só como
// demonstração da permissão/UI).
export async function subscribeToPush(profileId) {
  if (!isPushSupported()) throw new Error('Este navegador não suporta notificações push.');

  // Às vezes o Chrome NÃO mostra o pedido (já recusado antes, pedidos
  // silenciosos, app instalado sem permissão no Android) e a promessa nunca
  // volta — para quem usa, "não acontece nada". Com prazo, o app explica.
  const permissao = await comPrazo(Notification.requestPermission(), 12000, 'pedido-sem-resposta')
    .catch((e) => {
      if (e.codigoPalm !== 'pedido-sem-resposta') throw e;
      const erro = new Error('O celular não mostrou o pedido de permissão.');
      erro.estado = 'sem-pedido';
      throw erro;
    });
  if (permissao === 'denied') {
    const e = new Error('As notificações estão bloqueadas neste navegador.');
    e.estado = 'bloqueado';
    throw e;
  }
  if (permissao !== 'granted') {
    const e = new Error('Você fechou o pedido sem permitir. Toque em "Ativar" de novo e escolha "Permitir".');
    e.estado = 'nao-pedido';
    throw e;
  }

  const reg = await registroDoApp();
  const chave = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
  const inscrever = () => comPrazo(reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave }), 20000, 'sem-resposta');

  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    try {
      subscription = await inscrever();
    } catch (e) {
      // Inscrição antiga presa com outra chave (InvalidStateError) ou falha
      // passageira do serviço de push: limpa e tenta UMA vez de novo.
      if (e.codigoPalm) throw e;
      await (await reg.pushManager.getSubscription())?.unsubscribe().catch(() => {});
      subscription = await inscrever();
    }
  }

  const salvar = async (sub) => {
    const json = sub.toJSON();
    const row = { profile_id: profileId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
    if (isDemoMode()) {
      const existentes = await mockDb.list('push_subscriptions', (s) => s.endpoint === row.endpoint);
      if (!existentes.length) await mockDb.insert('push_subscriptions', row);
      return;
    }
    const supabase = await getSupabase();
    const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
    if (error) throw error;
  };

  try {
    await salvar(subscription);
  } catch (e) {
    // Causa raiz real: no mesmo aparelho, outra pessoa da casa já tinha
    // ativado com a conta dela. O endereço de push é do APARELHO, então o
    // banco (RLS) recusava trocar o dono da linha. Gera um endereço novo
    // para esta conta e salva de novo.
    if (e?.code !== '42501' && !/row-level security/i.test(e?.message || '')) throw e;
    await subscription.unsubscribe().catch(() => {});
    subscription = await inscrever();
    await salvar(subscription);
  }

  return subscription;
}

// Retrato do que está acontecendo neste aparelho (para a pessoa e o suporte).
export async function diagnosticoPush() {
  const d = {
    suportado: isPushSupported(),
    permissao: typeof Notification !== 'undefined' ? Notification.permission : 'indisponível',
    instalado: window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true,
    serviceWorker: 'sem',
    inscricao: 'não',
    navegador: (navigator.userAgent.match(/(Chrome|CriOS|Firefox|Version)\/[\d.]+/) || [''])[0] + (/Android/.test(navigator.userAgent) ? ' · Android' : /iPhone|iPad/.test(navigator.userAgent) ? ' · iOS' : ''),
  };
  try {
    const reg = await comPrazo(navigator.serviceWorker.getRegistration(), 3000, 'sw');
    d.serviceWorker = reg?.active ? 'ativo' : reg ? 'instalando' : 'sem';
    const sub = await reg?.pushManager?.getSubscription();
    if (sub) d.inscricao = (await inscricaoNoServidor(sub.endpoint).catch(() => false)) ? 'ativa no servidor' : 'só no aparelho';
  } catch { /* fica o que deu para saber */ }
  return d;
}

// Pede ao servidor uma notificação de teste para os aparelhos desta conta.
export async function enviarPushDeTeste() {
  if (isDemoMode()) {
    const reg = await registroDoApp();
    await reg.showNotification('BNTT', { body: 'Notificações funcionando neste aparelho. ✅', icon: './assets/icons/apple-touch-icon.png' });
    return { ok: true, enviadas: 1 };
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase.functions.invoke('push-teste', { method: 'POST' });
  if (error && !data) {
    let corpo = null;
    try { corpo = await error.context?.json?.(); } catch { /* sem corpo */ }
    return corpo || { ok: false, erro: 'Não consegui falar com o servidor agora.' };
  }
  return data;
}

export async function unsubscribeFromPush() {
  const subscription = await getExistingSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();

  if (isDemoMode()) {
    const existentes = await mockDb.list('push_subscriptions', (s) => s.endpoint === endpoint);
    for (const s of existentes) await mockDb.remove('push_subscriptions', s.id);
  } else {
    const supabase = await getSupabase();
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
  }
}
