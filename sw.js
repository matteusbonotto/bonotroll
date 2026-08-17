// Service worker do CasaGrana: cacheia o "app shell" (HTML/CSS/JS/ícones) para o
// app abrir offline. Chamadas ao Supabase (rede) não passam por aqui — dados
// offline ficam a cargo do modo demonstração (localStorage) e das telas que
// avisam quando estão sem conexão.
const CACHE_NAME = 'casagrana-v2';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/tokens.css',
  './css/components.css',
  './css/app.css',
  './js/app.js',
  './js/data/config.js',
  './js/data/mockDb.js',
  './js/data/supabaseClient.js',
  './js/utils/format.js',
  './js/utils/status.js',
  './js/services/auth.js',
  './js/services/categories.js',
  './js/services/groups.js',
  './js/services/transactions.js',
  './js/services/shoppingList.js',
  './js/services/csvImport.js',
  './js/services/barcode.js',
  './js/components/store.js',
  './js/components/auth.js',
  './js/components/dashboard.js',
  './js/components/transactionForm.js',
  './js/components/transactionTable.js',
  './js/components/shoppingList.js',
  './js/components/csvImportModal.js',
  './js/components/groupView.js',
  './js/components/profileView.js',
  './js/components/charts.js',
  './assets/icons/icon.svg',
  './assets/icons/icon-maskable.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
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

  if (isSameOrigin) {
    // App shell local: cache-first, atualizando o cache em segundo plano.
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
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
