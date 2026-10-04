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

export async function getExistingSubscription() {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

// Pede permissão, inscreve no push do navegador e salva o endpoint/chaves
// no backend (pra Edge Function saber pra onde mandar depois). Modo demo
// não tem servidor pra enviar nada, mas a inscrição do navegador em si
// ainda funciona — só não persiste em lugar nenhum útil (fica só como
// demonstração da permissão/UI).
export async function subscribeToPush(profileId) {
  if (!isPushSupported()) throw new Error('Este navegador não suporta notificações push.');

  const permissao = await Notification.requestPermission();
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

  const reg = await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = subscription.toJSON();
  const row = {
    profile_id: profileId,
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  };

  if (isDemoMode()) {
    const existentes = await mockDb.list('push_subscriptions', (s) => s.endpoint === row.endpoint);
    if (!existentes.length) await mockDb.insert('push_subscriptions', row);
  } else {
    const supabase = await getSupabase();
    const { error } = await supabase.from('push_subscriptions').upsert(row, { onConflict: 'endpoint' });
    if (error) throw error;
  }

  return subscription;
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
