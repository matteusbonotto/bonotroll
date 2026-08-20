import * as authService from '../services/auth.js';
import * as categoriesService from '../services/categories.js';
import * as groupsService from '../services/groups.js';
import * as companiesService from '../services/companies.js';
import { findCompanyByName } from '../services/companies.js';
import * as notificationsService from '../services/notifications.js';
import { gerarRecorrentesPendentes } from '../services/recurring.js';
import { isDemoMode } from '../data/config.js';

// Store global (Alpine.store('app')) — sessão, perfil, grupo, categorias e
// navegação. Registrado em app.js.
export function appStore() {
  return {
    ready: false,
    session: null,
    profile: null,
    demoProfiles: [],
    group: null, // { group, members } | null — grupo é sempre opcional
    categories: [],
    companies: [],
    notifications: [],
    // Vem da URL (#/transacoes etc.) pra sobreviver a um F5 — antes sempre
    // recarregava direto na Home, perdendo onde a pessoa estava.
    view: location.hash.replace('#/', '') || 'home',
    online: navigator.onLine,
    isDemoMode: isDemoMode(),
    toasts: [],
    updateAvailable: false,
    // installPrompt guarda o evento "beforeinstallprompt" capturado em
    // app.js (só o navegador consegue reabrir esse prompt, e só uma vez por
    // evento — precisa ficar guardado até a pessoa clicar em "Instalar").
    // Chrome/Edge/Android disparam esse evento sozinhos quando os critérios
    // de instalabilidade batem (manifest válido, HTTPS, service worker já
    // registrado); iOS Safari nunca dispara (lá a instalação é manual via
    // "Adicionar à Tela de Início", sem prompt programático possível).
    installPrompt: null,
    navOpen: false,
    // 'dark' | 'light' | null (null = segue o tema do sistema). O valor
    // inicial já foi aplicado no <html> por um script inline no <head>
    // antes do CSS carregar (evita flash do tema errado) — aqui só
    // sincroniza o estado do Alpine com o que já está no DOM.
    theme: document.documentElement.getAttribute('data-bs-theme') || null,

    async init() {
      window.addEventListener('online', () => { this.online = true; });
      window.addEventListener('offline', () => { this.online = false; });
      // Cobre voltar/avançar do navegador e edição manual da URL — o clique
      // normal em um item de menu já muda this.view direto (ver setView).
      window.addEventListener('hashchange', () => {
        this.view = location.hash.replace('#/', '') || 'home';
      });

      if (this.isDemoMode) {
        this.demoProfiles = await authService.getDemoProfiles();
      }

      try {
        const session = await authService.getSession();
        if (session) await this.loadSession(session);
      } finally {
        this.ready = true;
      }

      authService.onAuthStateChange(async (event, session) => {
        // INITIAL_SESSION dispara na hora em que a gente assina o listener,
        // duplicando a chamada de getSession() logo acima — sem esse filtro,
        // loadSession() (e ensureDefaultCategories) roda duas vezes em
        // paralelo no primeiro carregamento e cria categorias duplicadas.
        if (event === 'INITIAL_SESSION') return;
        if (session) await this.loadSession(session);
        else this.clearSession();
      });
    },

    // Busca perfil, grupo e categorias ANTES de tocar em qualquer propriedade
    // reativa: os templates usam `$store.app.profile` para desenhar a tela
    // autenticada e `$store.app.categories`/`group` para preencher <select>s
    // logo no primeiro render — se a UI montasse antes desses dados chegarem,
    // os <option> criados por x-for depois não re-selecionam o valor já setado.
    async loadSession(session) {
      const profile = await authService.getProfile(session.user.id);
      const group = await groupsService.getMyGroup(profile.id);
      const groupId = group?.group?.id;
      if (!this.isDemoMode) await categoriesService.ensureDefaultCategories(profile.id, groupId);
      const categories = await categoriesService.listCategories({ ownerId: profile.id, groupId });
      const companies = await companiesService.listCompanies({ ownerId: profile.id, groupId });

      this.session = session;
      this.profile = profile;
      this.group = group;
      this.categories = categories;
      this.companies = companies;

      // Best-effort: varredura de notificações não deve travar o login se
      // falhar (ex.: tabela ainda não migrada no Supabase do usuário).
      notificationsService
        .generateForProfile({ profileId: profile.id, groupId })
        .then(() => this.refreshNotifications())
        .catch(() => {});

      // Idem pra recorrência: gera os lançamentos recorrentes pendentes em
      // segundo plano, sem travar o login. Avisa quantos foram criados e
      // avisa as telas abertas (ex.: dashboard/transações já carregadas)
      // pra recarregarem.
      gerarRecorrentesPendentes({ ownerId: profile.id, groupId })
        .then((criadas) => {
          if (!criadas.length) return;
          this.notify(
            criadas.length === 1
              ? '1 lançamento recorrente foi gerado automaticamente.'
              : `${criadas.length} lançamentos recorrentes foram gerados automaticamente.`
          );
          window.dispatchEvent(new CustomEvent('cg:transactions-changed'));
        })
        .catch(() => {});
    },

    clearSession() {
      this.session = null;
      this.profile = null;
      this.group = null;
      this.categories = [];
      this.companies = [];
      this.notifications = [];
      this.view = 'home';
      history.replaceState(null, '', location.pathname + location.search);
    },

    async refreshNotifications() {
      if (!this.profile) return;
      this.notifications = await notificationsService.listNotifications(this.profile.id);
    },

    get unreadNotificationsCount() {
      return this.notifications.filter((n) => !n.lida).length;
    },

    async markNotificationRead(id) {
      await notificationsService.markAsRead(id);
      await this.refreshNotifications();
    },

    async markAllNotificationsRead() {
      if (!this.profile) return;
      await notificationsService.markAllAsRead(this.profile.id);
      await this.refreshNotifications();
    },

    async refreshCategories() {
      if (!this.profile) return;
      const groupId = this.group?.group?.id;
      if (!this.isDemoMode) await categoriesService.ensureDefaultCategories(this.profile.id, groupId);
      this.categories = await categoriesService.listCategories({ ownerId: this.profile.id, groupId });
    },

    async refreshCompanies() {
      if (!this.profile) return;
      const groupId = this.group?.group?.id;
      this.companies = await companiesService.listCompanies({ ownerId: this.profile.id, groupId });
    },

    companyByName(nome) {
      return findCompanyByName(this.companies, nome);
    },

    async refreshGroup() {
      if (!this.profile) return;
      this.group = await groupsService.getMyGroup(this.profile.id);
    },

    async loginDemo(profileId) {
      const profile = await authService.signInDemo(profileId);
      await this.loadSession({ user: { id: profile.id } });
    },

    async loginPassword(email, password) {
      const session = await authService.signInWithPassword(email, password);
      await this.loadSession(session);
    },

    async signup(email, password, nome) {
      const session = await authService.signUp(email, password, nome);
      if (session) await this.loadSession(session);
      return session;
    },

    async logout() {
      await authService.signOut();
      this.clearSession();
    },

    // theme: 'dark' | 'light' | null (null = volta a seguir o sistema).
    applyTheme(theme) {
      if (theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        localStorage.setItem('bonotto_theme', theme);
      } else {
        document.documentElement.removeAttribute('data-bs-theme');
        localStorage.removeItem('bonotto_theme');
      }
      this.theme = theme;
    },

    // Pra decidir qual ícone mostrar (lua/sol) quando theme é null (seguindo
    // o sistema) — sem isso o botão não saberia pra qual lado ele vai virar.
    isDarkNow() {
      return this.theme ? this.theme === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    },

    toggleTheme() {
      this.applyTheme(this.isDarkNow() ? 'light' : 'dark');
    },

    setView(view) {
      this.view = view;
      this.navOpen = false;
      history.replaceState(null, '', '#/' + view);
    },

    // Chamado pelo botão "Atualizar agora" do banner de nova versão (ver
    // updateNotifier em js/app.js, que seta updateAvailable = true quando
    // detecta um service worker novo em estado "waiting").
    async applyUpdate() {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg?.waiting) {
        // Não deveria acontecer (o banner só aparece com um waiting
        // presente), mas se sumiu por algum motivo um reload simples ainda
        // resolve na prática.
        location.reload();
        return;
      }
      // O novo SW assumindo já dispara o próprio "activate" dele (em sw.js),
      // que limpa qualquer cache com nome diferente do CACHE_NAME atual —
      // aqui só falta recarregar pra servir os arquivos novos.
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    },

    // Botão "Limpar cache" (Perfil) — escape hatch manual pra quando algo
    // parece desatualizado/quebrado e trocar de versão sozinho (banner de
    // update) não resolveu. Mais agressivo que applyUpdate(): apaga TODO
    // Cache Storage (não só o do app) e desregistra o service worker
    // inteiro, forçando ele reinstalar do zero no próximo load — o mesmo
    // efeito de "limpar cache e recarregar" do DevTools, só que sem precisar
    // abrir o DevTools.
    async limparCache() {
      if ('caches' in window) {
        const chaves = await caches.keys();
        await Promise.all(chaves.map((k) => caches.delete(k)));
      }
      const reg = await navigator.serviceWorker?.getRegistration();
      if (reg) await reg.unregister();
      location.reload();
    },

    // Lista (não mais um valor único) — uma ação disparando "sucesso" logo
    // seguida de outra "erro" (ou vice-versa) sobrescrevia uma a outra antes
    // de dar tempo da pessoa ler; agora empilha e cada uma some sozinha no
    // seu próprio tempo. Erro fica mais tempo na tela que sucesso — dá mais
    // chance de ler algo que precisa de atenção.
    notify(message, type = 'success') {
      const entry = { message, type, id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}` };
      this.toasts.push(entry);
      const duracao = type === 'danger' ? 6500 : 3800;
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== entry.id);
      }, duracao);
    },

    // Chamado pelo botão "Instalar app" (banner + Perfil). O prompt nativo só
    // pode ser mostrado uma vez por evento capturado — depois de usado (ou
    // recusado), some até o navegador decidir disparar outro.
    async promptInstall() {
      const evento = this.installPrompt;
      if (!evento) return;
      this.installPrompt = null;
      evento.prompt();
      await evento.userChoice;
    },

    dismissToast(id) {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    },

    // Toast com "Desfazer" (docs/BONOTTO-2027-BLUEPRINT.md, Conflito 3) —
    // substitui confirm() nas exclusões frequentes/de baixo dano (uma linha
    // de histórico, um item avulso): a UI já reflete a exclusão na hora
    // (quem chama já removeu do array local antes de chamar isto), e só
    // depois de alguns segundos SEM desfazer é que a exclusão de verdade
    // (a chamada de API) acontece — `aoConfirmar` é essa chamada real,
    // `aoDesfazer` desfaz só o estado local (não precisa saber que a API
    // nunca chegou a ser chamada).
    notifyUndo(message, aoConfirmar, aoDesfazer) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      let desfeito = false;
      const timer = setTimeout(async () => {
        if (desfeito) return;
        this.toasts = this.toasts.filter((t) => t.id !== id);
        try {
          await aoConfirmar();
        } catch (e) {
          this.notify(e.message || 'Não consegui concluir a exclusão.', 'danger');
        }
      }, 5000);
      this.toasts.push({
        id, message, type: 'undo',
        desfazer: () => {
          desfeito = true;
          clearTimeout(timer);
          this.toasts = this.toasts.filter((t) => t.id !== id);
          aoDesfazer();
        },
      });
    },

    categoryById(id) {
      return this.categories.find((c) => c.id === id) || null;
    },

    profileById(id) {
      if (!id) return null;
      if (this.profile?.id === id) return this.profile;
      return this.group?.members?.find((m) => m.id === id) || null;
    },
  };
}
