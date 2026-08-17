import * as authService from '../services/auth.js';
import * as categoriesService from '../services/categories.js';
import * as groupsService from '../services/groups.js';
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
    view: 'home',
    online: navigator.onLine,
    isDemoMode: isDemoMode(),
    toast: null,

    async init() {
      window.addEventListener('online', () => { this.online = true; });
      window.addEventListener('offline', () => { this.online = false; });

      if (this.isDemoMode) {
        this.demoProfiles = await authService.getDemoProfiles();
      }

      try {
        const session = await authService.getSession();
        if (session) await this.loadSession(session);
      } finally {
        this.ready = true;
      }

      authService.onAuthStateChange(async (session) => {
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

      this.session = session;
      this.profile = profile;
      this.group = group;
      this.categories = categories;
    },

    clearSession() {
      this.session = null;
      this.profile = null;
      this.group = null;
      this.categories = [];
      this.view = 'home';
    },

    async refreshCategories() {
      if (!this.profile) return;
      const groupId = this.group?.group?.id;
      if (!this.isDemoMode) await categoriesService.ensureDefaultCategories(this.profile.id, groupId);
      this.categories = await categoriesService.listCategories({ ownerId: this.profile.id, groupId });
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

    setView(view) {
      this.view = view;
    },

    notify(message, type = 'success') {
      const entry = { message, type, id: Date.now() };
      this.toast = entry;
      setTimeout(() => {
        if (this.toast && this.toast.id === entry.id) this.toast = null;
      }, 3800);
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
