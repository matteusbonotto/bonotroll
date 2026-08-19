import { appStore } from './components/store.js';
import { txModalStore } from './components/transactionForm.js';
import { csvModalStore } from './components/csvImportModal.js';
import { categoryModalStore } from './components/categoryManager.js';
import { budgetModalStore } from './components/budgetManager.js';
import { authView } from './components/auth.js';
import { dashboardView } from './components/dashboard.js';
import { transactionsView } from './components/transactionTable.js';
import { shoppingView } from './components/shoppingList.js';
import { resourcesView } from './components/resourcesView.js';
import { groupView } from './components/groupView.js';
import { profileView } from './components/profileView.js';
import { categoryChart } from './components/charts.js';
import * as format from './utils/format.js';
import { STATUS_META, statusMeta } from './utils/status.js';

// Exposto globalmente só para uso direto nas expressões do template (index.html),
// que não passa por bundler e não pode importar módulos ES ali.
window.cgFormat = format;
window.cgStatus = { STATUS_META, statusMeta };

// Este listener precisa ser registrado ANTES do script do Alpine (carregado com
// `defer` no index.html, depois deste módulo) para garantir que os stores e
// componentes já existam quando o Alpine disparar o evento "alpine:init".
document.addEventListener('alpine:init', () => {
  Alpine.store('app', appStore());
  Alpine.store('txModal', txModalStore());
  Alpine.store('csvModal', csvModalStore());
  Alpine.store('categoryModal', categoryModalStore());
  Alpine.store('budgetModal', budgetModalStore());

  Alpine.data('authView', authView);
  Alpine.data('dashboardView', dashboardView);
  Alpine.data('transactionsView', transactionsView);
  Alpine.data('shoppingView', shoppingView);
  Alpine.data('resourcesView', resourcesView);
  Alpine.data('groupView', groupView);
  Alpine.data('profileView', profileView);
  Alpine.data('categoryChart', categoryChart);
});

// Trava o scroll do fundo enquanto qualquer modal/drawer está aberto — sem
// isso dava pra rolar a lista de transações (ou qualquer tela) por trás do
// modal no mobile, o que é bem desorientador. Um MutationObserver global em
// vez de cada tela avisar individualmente porque os modais vivem espalhados
// em vários componentes Alpine independentes (txModal, csvModal,
// categoryModal, e estado local de shoppingView/resourcesView/groupView).
(function setupModalScrollLock() {
  function algumOverlayAberto() {
    return [...document.querySelectorAll('.cg-modal-backdrop, .cg-drawer-backdrop')].some(
      (el) => getComputedStyle(el).display !== 'none'
    );
  }
  function atualizar() {
    document.body.style.overflow = algumOverlayAberto() ? 'hidden' : '';
  }
  new MutationObserver(atualizar).observe(document.body, { attributes: true, attributeFilter: ['style'], subtree: true });
  atualizar();
})();

// Pressionar-e-segurar em qualquer botão marcado com data-repeat (steppers
// de quantidade em Compras/Recursos) acelera automaticamente — um toque
// normal (solto antes de ~400ms) já soma/subtrai 1 sozinho via @click do
// Alpine; isso só entra em ação se a pessoa continuar segurando, disparando
// cliques extras enquanto o botão estiver pressionado. Delegado no
// document (não por botão) porque os botões são recriados via x-for toda
// vez que a lista de itens muda.
(function setupPressAndHoldSteppers() {
  let timeoutId = null;
  let intervalId = null;

  function stop() {
    clearTimeout(timeoutId);
    clearInterval(intervalId);
    timeoutId = null;
    intervalId = null;
  }

  function start(btn) {
    stop();
    // Espera a mesma janela de um "toque normal" antes de começar a repetir
    // — se soltar antes disso, foi só o @click nativo mesmo (+1/-1 único).
    timeoutId = setTimeout(() => {
      intervalId = setInterval(() => {
        if (btn.disabled || !document.contains(btn)) { stop(); return; }
        btn.click();
      }, 110);
    }, 400);
  }

  document.addEventListener('mousedown', (e) => {
    const btn = e.target.closest('[data-repeat]');
    if (btn) start(btn);
  });
  document.addEventListener(
    'touchstart',
    (e) => {
      const btn = e.target.closest('[data-repeat]');
      if (btn) start(btn);
    },
    { passive: true }
  );
  ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach((evento) => {
    document.addEventListener(evento, stop);
  });
})();

// Atualiza notificações + a tela aberta a cada 1 min, sem loading nenhum —
// se algo mudou (ex.: o outro membro cadastrou/editou algo), a pessoa vê
// sozinho, sem precisar dar F5. Cada tela expõe um "load(true)"/método
// equivalente que busca os dados de novo SEM mexer na flag "loading" (ver
// dashboard.js/transactionTable.js) — só troca o valor reativo, sem piscar
// spinner nem perder scroll/filtro. Central aqui (não por componente)
// porque só uma tela fica visível por vez (as outras estão x-show:none) e
// não faz sentido gastar rede atualizando telas que ninguém está vendo.
(function setupAutoRefresh() {
  const REFRESH_POR_TELA = {
    home: { seletor: 'section[x-data^="dashboardView"]', chamar: (c) => c.load(true) },
    transacoes: { seletor: 'section[x-data^="transactionsView"]', chamar: (c) => c.load(true) },
    compras: { seletor: 'section[x-data^="shoppingView"]', chamar: (c) => c.refreshItems() },
    recursos: {
      seletor: 'section[x-data^="resourcesView"]',
      chamar: (c) => {
        c.carregarItens();
        c.carregarSugestoes();
      },
    },
  };

  setInterval(() => {
    const store = Alpine.store('app');
    if (!store?.profile) return;
    store.refreshNotifications();

    const config = REFRESH_POR_TELA[store.view];
    if (!config) return;
    const el = document.querySelector(config.seletor);
    if (!el) return;
    const comp = Alpine.$data(el);
    if (comp) config.chamar(comp);
  }, 60000);
})();

// Captura o prompt nativo de instalação (Chrome/Edge/Android) em vez de
// deixar o navegador decidir sozinho quando/como oferecer — preventDefault()
// suprime a UI automática dele (às vezes um infobar discreto, fácil de
// perder) e guarda o evento pra um botão nosso (banner + Perfil) poder
// reabrir explicitamente via $store.app.promptInstall(). Sem suporte no iOS
// Safari (lá não existe esse evento; instalação é manual).
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  Alpine.store('app').installPrompt = e;
});
window.addEventListener('appinstalled', () => {
  Alpine.store('app').installPrompt = null;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => watchForUpdate(reg))
      .catch(() => {
        // ambiente sem suporte (ex.: file://) — segue sem PWA offline
      });
  });
}

// Mostra o banner "Nova versão disponível" (index.html, ligado a
// $store.app.updateAvailable) assim que um SW novo termina de instalar e
// fica esperando pra assumir. Cobre os dois jeitos de isso acontecer: já
// existe um "waiting" no momento do register (aba ficou aberta enquanto um
// deploy novo rodava) ou um instala DEPOIS (evento "updatefound").
function watchForUpdate(registration) {
  const flagWaiting = () => {
    // navigator.serviceWorker.controller só existe se este NÃO é o primeiro
    // SW da aba (ou seja: é atualização, não instalação inicial) — sem essa
    // checagem o banner apareceria também na primeira visita.
    if (registration.waiting && navigator.serviceWorker.controller) {
      Alpine.store('app').updateAvailable = true;
    }
  };

  if (registration.waiting) flagWaiting();

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') flagWaiting();
    });
  });
}
