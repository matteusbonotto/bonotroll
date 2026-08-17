import { appStore } from './components/store.js';
import { txModalStore } from './components/transactionForm.js';
import { csvModalStore } from './components/csvImportModal.js';
import { categoryModalStore } from './components/categoryManager.js';
import { authView } from './components/auth.js';
import { dashboardView } from './components/dashboard.js';
import { transactionsView } from './components/transactionTable.js';
import { shoppingView } from './components/shoppingList.js';
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
  Alpine.data('groupView', groupView);
  Alpine.data('profileView', profileView);
  Alpine.data('categoryChart', categoryChart);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // ambiente sem suporte (ex.: file://) — segue sem PWA offline
    });
  });
}
