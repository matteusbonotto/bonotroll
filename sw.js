// Service worker do Bõnotto: cacheia o "app shell" (HTML/CSS/JS/ícones) para o
// app abrir offline. Chamadas ao Supabase (rede) não passam por aqui — dados
// offline ficam a cargo do modo demonstração (localStorage) e das telas que
// avisam quando estão sem conexão.
//
// Versionamento: todo deploy que muda algum arquivo do APP_SHELL abaixo deve
// bumpar CACHE_NAME. Isso faz o browser detectar um SW novo, instalá-lo em
// segundo plano (evento "install" roda de novo) e ficar em estado "waiting"
// até alguém assumir — é esse "waiting" que js/app.js detecta pra mostrar o
// banner "Nova versão disponível" (ver updateNotifier em js/app.js).
const CACHE_NAME = 'bonotto-v5';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/components.css',
  './css/app.css',
  './js/app.js',
  './js/data/config.js',
  './js/data/vapid.js',
  './js/data/mockDb.js',
  './js/data/supabaseClient.js',
  './js/utils/format.js',
  './js/utils/status.js',
  './js/services/auth.js',
  './js/services/categories.js',
  './js/services/companies.js',
  './js/services/banks.js',
  './js/services/groups.js',
  './js/services/transactions.js',
  './js/services/resources.js',
  './js/services/notifications.js',
  './js/services/push.js',
  './js/services/shoppingList.js',
  './js/services/csvImport.js',
  './js/services/barcode.js',
  './js/services/ocr.js',
  './js/services/caixinhas.js',
  './js/services/budgets.js',
  './js/services/dataExport.js',
  './js/services/fx.js',
  './js/services/pdf.js',
  './js/services/recurring.js',
  './js/components/store.js',
  './js/components/categoryManager.js',
  './js/components/companyManager.js',
  './js/components/budgetManager.js',
  './js/components/caixinhaManager.js',
  './js/components/caixinhasView.js',
  './js/components/auth.js',
  './js/components/dashboard.js',
  './js/components/transactionForm.js',
  './js/components/transactionTable.js',
  './js/components/shoppingList.js',
  './js/components/resourcesView.js',
  './js/components/csvImportModal.js',
  './js/components/groupView.js',
  './js/components/profileView.js',
  './js/components/charts.js',
  './js/utils/dbFallback.js',
  './js/utils/image.js',
  './js/utils/money.js',
  './assets/icons/icon.svg?v=2',
  './assets/icons/icon-maskable.svg?v=2',
  './assets/icons/apple-touch-icon.png?v=2',
  './assets/logos/logo-colorida.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
    // Sem self.skipWaiting() aqui de propósito: um SW novo instalado fica em
    // "waiting" até o cliente mandar SKIP_WAITING (banner de atualização) —
    // se pulasse direto, o usuário nunca veria o aviso e a troca de versão
    // aconteceria por baixo dos panos no meio do uso.
  );
});

// Disparado pelo botão "Atualizar agora" do banner (js/app.js) via
// registration.waiting.postMessage(...). Só depois disso o novo SW assume
// (dispara "controllerchange" no cliente, que então recarrega a página).
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ---------- Web Push ----------
// O payload é montado pelas Edge Functions notify-scan/notify-payment (ver
// supabase/functions/) — sempre JSON com { title, body, tag, url }. "tag"
// evita empilhar notificações repetidas da mesma origem (ex.: duas
// varreduras do mesmo dia pro mesmo item vencendo substituem uma à outra
// em vez de abrir duas notificações).
self.addEventListener('push', (event) => {
  let payload = { title: 'Bõnotto', body: 'Você tem uma notificação nova.' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // payload não-JSON (não deveria acontecer, mas não trava a notificação)
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      // PNG, não SVG: notificação nativa (Android/Chrome) não renderiza SVG
      // aqui — silenciosamente cai num ícone genérico do sistema.
      icon: './assets/icons/apple-touch-icon.png',
      badge: './assets/icons/apple-touch-icon.png',
      tag: payload.tag || 'bonotto-generico',
      data: { url: payload.url || './index.html' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || './index.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Navegação (usuário abrindo/recarregando a página): tenta a rede, cai para o
  // shell em cache quando offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Chamadas de API do Supabase (REST/Storage/Auth/Edge Functions) NUNCA
  // passam pelo cache — o comentário do topo do arquivo já dizia isso, mas
  // faltava de fato excluir: sem esse "return" cedo, elas caíam no mesmo
  // ramo stale-while-revalidate dos CDNs abaixo, e o service worker passava
  // a interceptar/re-cachear resposta de dado DINÂMICO (uma consulta com
  // filtro pode "vazar" resposta de outra). Não chamar respondWith() aqui
  // deixa o fetch seguir 100% normal, direto pro navegador, sem o SW no meio.
  if (url.hostname.endsWith('.supabase.co')) return;

  if (isSameOrigin) {
    // App shell local: rede primeiro (sempre pega o deploy mais novo com um
    // reload normal), cache só como fallback quando estiver offline. Era
    // cache-first antes — parecia funcionar porque HTML é buscado por fora
    // daqui (bloco "navigate" acima), mas os .js/.css continuavam vindo do
    // cache antigo até um SEGUNDO reload (o primeiro só atualizava o cache
    // em segundo plano), o que fazia deploy parecer "não aplicado".
    event.respondWith(
      fetch(request)
        .then((response) => {
          // clone() PRECISA acontecer aqui, síncrono, antes de qualquer coisa
          // assíncrona — chamar depois (ex.: dentro do .then() de
          // caches.open(), como era antes) corre o risco do corpo da
          // resposta já ter começado a ser consumido por quem pediu o
          // fetch, e clonar depois disso lança "body stream already used".
          const copia = response.ok ? response.clone() : null;
          if (copia) caches.open(CACHE_NAME).then((cache) => cache.put(request, copia));
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    // CDNs (Bootstrap, Alpine, ícones, Chart.js etc.): stale-while-revalidate.
    event.respondWith(
      caches.open(CACHE_NAME).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
