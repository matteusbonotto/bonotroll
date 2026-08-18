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
  if (permissao !== 'granted') throw new Error('Permissão de notificações negada.');

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
