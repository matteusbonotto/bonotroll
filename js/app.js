import { appStore } from './components/store.js';
import { txModalStore } from './components/transactionForm.js';
import { csvModalStore } from './components/csvImportModal.js';
import { categoryModalStore } from './components/categoryManager.js';
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

  Alpine.data('authView', authView);
  Alpine.data('dashboardView', dashboardView);
  Alpine.data('transactionsView', transactionsView);
  Alpine.data('shoppingView', shoppingView);
  Alpine.data('resourcesView', resourcesView);
  Alpine.data('groupView', groupView);
  Alpine.data('profileView', profileView);
  Alpine.data('categoryChart', categoryChart);
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
