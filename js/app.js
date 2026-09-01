import { appStore } from './components/store.js';
import { txModalStore } from './components/transactionForm.js';
import { csvModalStore } from './components/csvImportModal.js';
import { categoryModalStore } from './components/categoryManager.js';
import { companyModalStore } from './components/companyManager.js';
import { budgetModalStore } from './components/budgetManager.js';
import { caixinhaModalStore } from './components/caixinhaManager.js';
import { bankModalStore } from './components/bankManager.js';
import { cartaoModalStore } from './components/cartaoManager.js';
import { authView } from './components/auth.js';
import { dashboardView } from './components/dashboard.js';
import { transactionsView } from './components/transactionTable.js';
import { shoppingView } from './components/shoppingList.js';
import { resourcesView } from './components/resourcesView.js';
import { caixinhasView } from './components/caixinhasView.js';
import { groupView } from './components/groupView.js';
import { profileView } from './components/profileView.js';
import { categoryChart } from './components/charts.js';
import * as format from './utils/format.js';
import { STATUS_META, statusMeta, severityMeta } from './utils/status.js';
import { generateForProfile } from './services/notifications.js';

// Exposto globalmente só para uso direto nas expressões do template (index.html),
// que não passa por bundler e não pode importar módulos ES ali.
window.cgFormat = format;
window.cgStatus = { STATUS_META, statusMeta, severityMeta };

// Este listener precisa ser registrado ANTES do script do Alpine (carregado com
// `defer` no index.html, depois deste módulo) para garantir que os stores e
// componentes já existam quando o Alpine disparar o evento "alpine:init".
document.addEventListener('alpine:init', () => {
  Alpine.store('app', appStore());
  Alpine.store('txModal', txModalStore());
  Alpine.store('csvModal', csvModalStore());
  Alpine.store('categoryModal', categoryModalStore());
  Alpine.store('companyModal', companyModalStore());
  Alpine.store('budgetModal', budgetModalStore());
  Alpine.store('caixinhaModal', caixinhaModalStore());
  Alpine.store('bankModal', bankModalStore());
  Alpine.store('cartaoModal', cartaoModalStore());

  Alpine.data('authView', authView);
  Alpine.data('dashboardView', dashboardView);
  Alpine.data('transactionsView', transactionsView);
  Alpine.data('shoppingView', shoppingView);
  Alpine.data('resourcesView', resourcesView);
  Alpine.data('caixinhasView', caixinhasView);
  Alpine.data('groupView', groupView);
  Alpine.data('profileView', profileView);
  Alpine.data('categoryChart', categoryChart);
});

// Botão físico "voltar" do Android / gesto do navegador andando por DENTRO
// do app (Transações -> Início), não fechando o app direto — setView (ver
// store.js) empilha uma entrada de histórico de verdade a cada troca de
// tela (pushState); isto aqui só faz o caminho INVERSO, sincronizar
// $store.app.view com o que "voltar" já desempilhou. Nunca chama setView
// de novo aqui — isso empurraria uma entrada nova por cima da que acabou
// de sair, e o próximo "voltar" ficaria preso sem sair do lugar.
window.addEventListener('popstate', () => {
  const store = Alpine.store('app');
  if (!store?.ready) return;
  store.view = location.hash.replace('#/', '') || 'home';
  store.navOpen = false;
});

// Trava o scroll do fundo, fecha com Esc, e devolve o foco — pros ~12
// modais/drawers do app de uma vez, sem tocar em nenhum deles individualmente.
// Um MutationObserver global em vez de cada tela avisar individualmente
// porque os modais vivem espalhados em vários componentes Alpine
// independentes (txModal, csvModal, categoryModal, e estado local de
// shoppingView/resourcesView/groupView/caixinhasView) — cada um já tem seu
// próprio "open"/close(), então em vez de unificar essa camada (mudança
// grande em ~10 arquivos, risco desnecessário), a gente reaproveita o que
// TODO modal já tem em comum de graça: um `.cg-modal-backdrop` com
// `@click.self="fechar...()"` já ligado no HTML (ver DESIGN-SYSTEM-2027.md
// §9) — Esc simula um clique nesse mesmo backdrop, então cada modal fecha
// pela sua própria função de sempre, sem precisar saber qual store é dono
// dele. Os 2 backdrops de câmera/scanner não têm esse @click.self de
// propósito (fechar sem querer no meio de escanear seria pior) — Esc
// continua sem efeito neles, por design, não por lacuna.
(function setupOverlayBehavior() {
  let focoAntesDoOverlay = null;

  function overlayVisivelAberto() {
    return [...document.querySelectorAll('.cg-modal-backdrop, .cg-drawer-backdrop')].find(
      (el) => getComputedStyle(el).display !== 'none'
    ) || null;
  }
  function atualizar() {
    const aberto = overlayVisivelAberto();
    document.body.style.overflow = aberto ? 'hidden' : '';
    if (aberto && !focoAntesDoOverlay) {
      focoAntesDoOverlay = document.activeElement;
    } else if (!aberto && focoAntesDoOverlay) {
      if (focoAntesDoOverlay.isConnected) focoAntesDoOverlay.focus();
      focoAntesDoOverlay = null;
    }
  }
  new MutationObserver(atualizar).observe(document.body, { attributes: true, attributeFilter: ['style'], subtree: true });
  atualizar();

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const aberto = overlayVisivelAberto();
    if (aberto) aberto.click();
  });
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

// Atualiza a tela aberta a cada 1 min, sem loading nenhum — se algo mudou
// (ex.: o outro membro cadastrou/editou algo), a pessoa vê sozinho, sem
// precisar dar F5. Cada tela expõe um "load(true)"/método equivalente que
// busca os dados de novo SEM mexer na flag "loading" (ver dashboard.js/
// transactionTable.js) — só troca o valor reativo, sem piscar spinner nem
// perder scroll/filtro. Central aqui (não por componente) porque só uma
// tela fica visível por vez (as outras estão x-show:none) e não faz
// sentido gastar rede atualizando telas que ninguém está vendo.
//
// generateForProfile (RE-ESCANEIA despesa a vencer/vencida e item de
// Recursos em falta/vencendo, não só relê o que já existe) fica num
// intervalo PRÓPRIO, mais espaçado (5 min) — ela já faz suas próprias
// buscas de transactions/resource_items por dentro; rodar junto com o
// refresh de 1 min duplicava essas duas consultas a cada ciclo (Home e
// Recursos já buscam as duas tabelas por conta própria pra tela em si).
// 5 min ainda é muito melhor que "só no login" sem gerar o dobro de
// leitura o tempo todo — dedupe_key (upsert ignoreDuplicates) garante que
// rodar de novo nunca duplica notificação, então o intervalo maior só
// atrasa a detecção, nunca perde nada.
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

  // Aba em segundo plano/minimizada ou sem internet: pula o ciclo — não tem
  // quem veja o resultado, só gastaria chamada à toa (o plano free do
  // Supabase tem teto de banda/requisições mensal, e isso roda pra qualquer
  // pessoa com o app aberto o dia inteiro, então cada ciclo evitável conta).
  // Quando a aba voltar a ficar visível, o próximo tick já resolve sozinho.
  function podeRodar(store) {
    return !document.hidden && navigator.onLine && !!store?.profile;
  }

  setInterval(() => {
    const store = Alpine.store('app');
    if (!podeRodar(store)) return;
    store.refreshNotifications();

    const config = REFRESH_POR_TELA[store.view];
    if (!config) return;
    const el = document.querySelector(config.seletor);
    if (!el) return;
    const comp = Alpine.$data(el);
    if (comp) config.chamar(comp);
  }, 60000);

  setInterval(() => {
    const store = Alpine.store('app');
    if (!podeRodar(store)) return;
    generateForProfile({ profileId: store.profile.id, groupId: store.group?.group?.id })
      .then(() => store.refreshNotifications())
      .catch(() => {});
  }, 120000);
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

// AUTO-ATUALIZAÇÃO (2026-09-01) — bug real relatado em uso: mesmo limpando
// cache e reinstalando o app manualmente, a pessoa continuava vendo versão
// antiga; e mesmo quando via o banner "Nova versão disponível", precisar
// notar e clicar nele não é o comportamento de nenhum app profissional.
// sw.js agora chama self.skipWaiting() assim que termina de instalar (não
// fica mais esperando ninguém clicar em nada) — isso dispara
// "controllerchange" aqui sozinho, e a página recarrega sozinha, sempre.
// `refreshing` existe só pra garantir UM reload (controllerchange pode
// disparar mais de uma vez em teoria; sem essa trava viraria loop).
if ('serviceWorker' in navigator) {
  let refreshing = false;
  // `controllerchange` dispara tanto na PRIMEIRA ativação (aba nova, sem
  // controller nenhum antes — não é atualização, não recarrega nada) quanto
  // em toda atualização de verdade depois. `tinhaController` guarda esse
  // "antes" pra distinguir os dois casos — e é atualizado a cada disparo
  // (não fixado uma única vez), senão uma aba aberta por muito tempo só
  // pegaria a checagem certa na primeira troca e nunca mais nas seguintes.
  let tinhaController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    const eraAtualizacao = tinhaController;
    tinhaController = true;
    if (!eraAtualizacao || refreshing) return;
    refreshing = true;
    Alpine.store('app')?.notify?.('Atualizando para a versão mais recente…');
    location.reload();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // ambiente sem suporte (ex.: file://) — segue sem PWA offline
    });
  });
}
