import * as authService from '../services/auth.js';
import * as categoriesService from '../services/categories.js';
import * as groupsService from '../services/groups.js';
import * as companiesService from '../services/companies.js';
import { findCompanyByName } from '../services/companies.js';
import * as banksService from '../services/banks.js';
import { findBankByName } from '../services/banks.js';
import * as cartoesService from '../services/cartoes.js';
import { findCartaoByName } from '../services/cartoes.js';
import * as notificationsService from '../services/notifications.js';
import { gerarRecorrentesPendentes } from '../services/recurring.js';
import { isDemoMode } from '../data/config.js';
import { normalizarEscala, proximaEscala, podeAumentar, podeDiminuir, PADRAO } from '../utils/tamanhoTexto.js';
import { ligarNarracao, vozDisponivel, falar } from '../utils/narracao.js';
import * as assinatura from '../services/assinatura.js';
import * as unidadesService from '../services/unidades.js';

// Store global (Alpine.store('app')) — sessão, perfil, grupo, categorias e
// navegação. Registrado em app.js.
export function appStore() {
  return {
    ready: false,
    session: null,
    profile: null,
    demoProfiles: [],
    // Linha e plano (BNTT Home / BNTT Business) — ver services/assinatura.js.
    conta: { tipo: 'home', plano: null, assinaturaAtiva: false, cortesia: false, ciclo: null, criadaEm: null },
    intencao: null, // o que a pessoa escolheu na LP (cadastro, plano, ciclo)
    // BNTT Business: unidades (filiais) e a unidade em foco ('' = todas).
    unidades: [],
    unidadeAtual: (() => { try { return localStorage.getItem('bntt_unidade_atual') || ''; } catch { return ''; } })(),
    pagamentoPendente: null, // { plano, ciclo, url, valor, teste } -> aviso "Continuar para o pagamento"
    group: null, // { group, members } | null — grupo é sempre opcional
    categories: [],
    companies: [],
    banks: [],
    cartoes: [],
    notifications: [],
    // Vem da URL (#/transacoes etc.) pra sobreviver a um F5 — antes sempre
    // recarregava direto na Home, perdendo onde a pessoa estava.
    view: location.hash.replace('#/', '') || 'home',
    online: navigator.onLine,
    isDemoMode: isDemoMode(),
    toasts: [],
    // installPrompt guarda o evento "beforeinstallprompt" capturado em
    // app.js (só o navegador consegue reabrir esse prompt, e só uma vez por
    // evento — precisa ficar guardado até a pessoa clicar em "Instalar").
    // Chrome/Edge/Android disparam esse evento sozinhos quando os critérios
    // de instalabilidade batem (manifest válido, HTTPS, service worker já
    // registrado); iOS Safari nunca dispara (lá a instalação é manual via
    // "Adicionar à Tela de Início", sem prompt programático possível).
    installPrompt: null,
    navOpen: false,

    // Fase 5 (DESIGN-SYSTEM-2027.md/blueprint §12) — iOS Safari nunca
    // dispara beforeinstallprompt (comentário acima), então sem isto a
    // pessoa nunca vê NENHUMA orientação de como instalar. `standalone` só
    // existe no Safari; já rodando instalado, não faz sentido mostrar dica
    // de instalar de novo.
    get isIOSSemInstalar() {
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const jaInstalado = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
      return ios && !jaInstalado;
    },
    // 'dark' | 'light' | null (null = segue o tema do sistema). O valor
    // inicial já foi aplicado no <html> por um script inline no <head>
    // antes do CSS carregar (evita flash do tema errado) — aqui só
    // sincroniza o estado do Alpine com o que já está no DOM.
    theme: document.documentElement.getAttribute('data-bs-theme') || null,

    async init() {
      ligarNarracao(this.narracao);
      this.intencao = assinatura.capturarIntencaoDaUrl();
      this.conta = assinatura.contaDaSessao(null);
      if (this.intencao) this.conta = { ...this.conta, tipo: this.intencao.tipo };
      this.aplicarLinha();
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
        // Voltou pelo link de "Esqueci minha senha": pede a nova senha.
        if (event === 'PASSWORD_RECOVERY') this.novaSenhaAberta = true;
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
      // `banks` é tabela nova (js/services/banks.js) — precisa da migração
      // manual em supabase/schema.sql, que nem todo mundo já rodou. Sem
      // isso não pode travar o LOGIN inteiro (era o caso: erro "Could not
      // find the table 'public.banks'" impedia entrar) — cai pra lista
      // vazia (só perde o logo compartilhado de banco até migrar).
      const banks = await banksService.listBanks({ ownerId: profile.id, groupId }).catch(() => []);
      // `cartoes` é tabela nova (js/services/cartoes.js) — mesma ressalva de
      // `banks`: se a migração ainda não rodou no Supabase do usuário, não
      // pode travar o login inteiro, cai pra lista vazia.
      const cartoes = await cartoesService.listCartoes({ ownerId: profile.id, groupId }).catch(() => []);

      this.session = session;
      this.conta = assinatura.contaDaSessao(session);
      this.conta.planoServidor = await assinatura.buscarPlanoNoServidor();
      this.aplicarLinha();
      this.profile = profile;
      this.group = group;
      this.categories = categories;
      this.companies = companies;
      this.banks = banks;
      this.cartoes = cartoes;
      await this.carregarUnidades();

      // Best-effort: varredura de notificações não deve travar o login se
      // falhar (ex.: tabela ainda não migrada no Supabase do usuário).
      notificationsService
        .generateForProfile({ profileId: profile.id, groupId })
        .then(() => this.refreshNotifications())
        .catch(() => {});

      // Orçamento por categoria estourado (ex.: "Mercado") — só faz algo em
      // modo demo (modo real é o trigger notificar_orcamento_estourado no
      // banco, ver supabase/schema.sql); best-effort, mesmo padrão acima.
      notificationsService
        .generateBudgetAlerts({ ownerId: profile.id, groupId })
        .then(() => this.refreshNotifications())
        .catch(() => {});

      // Idem pra recorrência: gera os lançamentos recorrentes pendentes em
      // segundo plano, sem travar o login. Avisa quantos foram criados e
      // avisa as telas abertas (ex.: dashboard/transações já carregadas)
      // pra recarregarem.
      gerarRecorrentesPendentes({ ownerId: profile.id, groupId })
        .then((criadas) => {
          if (!criadas.length) return;
          // Sem aviso flutuante (Palm Business, fase 5): é ação do sistema, não
          // resposta a algo que a pessoa fez, e cobria o topo a cada login. As
          // contas novas aparecem em "Precisa de você" e nas Movimentações.
          window.dispatchEvent(new CustomEvent('cg:transactions-changed'));
        })
        .catch(() => {});

      this.depoisDoLogin();
    },

    // ── Linha e plano (BNTT Home / BNTT Business) ────────────────────────
    get linha() {
      return this.conta.tipo;
    },
    get nomeDaLinha() {
      return this.conta.tipo === 'business' ? 'Business' : 'Home';
    },
    get planoAtual() {
      return assinatura.planoDaConta(this.conta);
    },
    aplicarLinha() {
      document.documentElement.dataset.linha = this.conta.tipo;
      document.title = `BNTT ${this.nomeDaLinha}`;
      const cor = document.querySelector('meta[name="theme-color"]');
      if (cor) cor.content = this.conta.tipo === 'business' ? '#1F5FAF' : '#0E9F6E';
    },
    // Recurso do plano (ex.: 'saude', 'importar', 'divisao'). Durante o teste
    // grátis o plano em vigor já é o mais completo da linha.
    recursoLiberado(nome) {
      return (this.planoAtual.recursos || {})[nome] !== false;
    },
    // Limite numérico do plano (null = sem limite).
    limiteDoPlano(nome) {
      return this.planoAtual.limites?.[nome] ?? null;
    },
    // Planos da linha atual, com o preço já calculado para o ciclo escolhido.
    cicloEscolhido: 'mensal',
    get planosDaLinha() {
      return assinatura.planosDaLinha(this.conta.tipo, this.cicloEscolhido);
    },
    get resumoDoPlano() {
      const p = this.planoAtual;
      if (this.conta.cortesia && this.conta.assinaturaAtiva) return `${p.nome} — cortesia (sem cobrança)`;
      if (p.emTeste) return `Teste grátis do ${p.nome}: ${p.diasRestantes} ${p.diasRestantes === 1 ? 'dia' : 'dias'} restantes`;
      if (this.conta.assinaturaAtiva) return `${p.nome} — ${this.conta.ciclo === 'anual' ? 'anual' : 'mensal'}`;
      return `${p.nome} — com limites`;
    },
    // Aviso "isso é de outro plano" — nunca um erro seco. motivo = frase curta.
    upgrade: null, // { motivo } | null
    pedirUpgrade(motivo) {
      this.upgrade = { motivo };
    },
    verPlanos() {
      this.upgrade = null;
      this.setView('perfil');
      window.dispatchEvent(new CustomEvent('cg:abrir-planos'));
    },
    // true = pode seguir; false = mostrou o aviso de plano.
    exigirRecurso(nome, motivo) {
      if (this.recursoLiberado(nome)) return true;
      this.pedirUpgrade(motivo);
      return false;
    },
    exigirLimite(nome, usados, motivo) {
      const limite = this.limiteDoPlano(nome);
      if (limite === null || usados < limite) return true;
      this.pedirUpgrade(motivo);
      return false;
    },
    get urlDosPlanos() {
      return assinatura.urlDosPlanos(this.conta.tipo);
    },
    // Depois de entrar: (1) voltou do Stripe -> busca o plano novo;
    // (2) escolheu um plano pago na LP -> oferece seguir para o pagamento.
    async depoisDoLogin() {
      const url = new URL(location.href);
      if (url.searchParams.get('assinatura') === 'ok') {
        url.searchParams.delete('assinatura');
        url.searchParams.delete('plano');
        const busca = url.searchParams.toString();
        history.replaceState(history.state, '', url.pathname + (busca ? `?${busca}` : '') + url.hash);
        assinatura.limparIntencao();
        this.notify('Pagamento recebido! Seu plano é ativado em instantes — pode continuar usando.');
        if (!this.isDemoMode) {
          setTimeout(async () => {
            try {
              const s = await authService.atualizarSessao();
              if (s) { this.conta = assinatura.contaDaSessao(s); this.aplicarLinha(); }
            } catch { /* tenta de novo no próximo login */ }
          }, 8000);
        }
        return;
      }
      const i = assinatura.intencaoSalva();
      if (i?.plano && !(this.conta.assinaturaAtiva && this.conta.plano === i.plano)) {
        this.pagamentoPendente = assinatura.pagamentoDoPlano(i.plano, i.ciclo, { userId: this.profile?.id, email: this.session?.user?.email });
      } else if (i && !i.plano) {
        assinatura.limparIntencao();
      }
    },
    escolherPlano(planoId, ciclo) {
      this.pagamentoPendente = assinatura.pagamentoDoPlano(planoId, ciclo, { userId: this.profile?.id, email: this.session?.user?.email });
    },
    irParaPagamento() {
      const destino = this.pagamentoPendente?.url;
      if (!destino) return;
      assinatura.limparIntencao();
      location.href = destino;
    },
    adiarPagamento() {
      assinatura.limparIntencao();
      this.pagamentoPendente = null;
      const dias = this.planoAtual.diasRestantes;
      this.notify(dias ? `Tudo bem! Você continua no teste grátis por mais ${dias} dias.` : 'Tudo bem! Você pode assinar quando quiser, em Configurações.');
    },
    // ── BNTT Business: unidades e papéis ─────────────────────────────────
    async carregarUnidades() {
      const gid = this.group?.group?.id;
      if (this.conta.tipo !== 'business' || !gid) { this.unidades = []; return; }
      try {
        this.unidades = await unidadesService.listarUnidades(gid);
      } catch {
        this.unidades = []; // banco ainda sem a migração: o app segue sem unidades
      }
      if (this.unidadeAtual && !this.unidades.some((u) => u.id === this.unidadeAtual)) this.trocarUnidade('');
    },
    trocarUnidade(id) {
      this.unidadeAtual = id || '';
      try { localStorage.setItem('bntt_unidade_atual', this.unidadeAtual); } catch { /* só nesta sessão */ }
      window.dispatchEvent(new CustomEvent('cg:transactions-changed'));
    },
    // Lançamento entra na visão atual? (sem unidade escolhida = todas)
    naUnidade(t) {
      return !this.unidadeAtual || t.unidade_id === this.unidadeAtual;
    },
    nomeDaUnidade(id) {
      return this.unidades.find((u) => u.id === id)?.nome || '';
    },
    // Papel de quem está usando (Home: sempre pode tudo).
    get meuPapel() {
      if (this.conta.tipo !== 'business') return 'dono';
      const eu = this.group?.members?.find((m) => m.id === this.profile?.id);
      return eu ? unidadesService.papelEfetivo(eu.papel) : 'dono';
    },
    get podeLancar() {
      return this.meuPapel !== 'contador';
    },
    get podeGerirUnidades() {
      return ['dono', 'gerente'].includes(this.meuPapel);
    },
    get podeMudarPapeis() {
      return this.meuPapel === 'dono';
    },
    // Funcionário só mexe no que ele lançou; contador em nada.
    podeEditarLancamento(t) {
      if (this.meuPapel === 'contador') return false;
      if (this.meuPapel === 'funcionario') return t?.owner_id === this.profile?.id;
      return true;
    },

    // Só no modo demonstração: ver o app como Home ou Business.
    trocarLinhaDemo(tipo) {
      assinatura.trocarTipoDemo(tipo);
      this.conta = { ...this.conta, tipo };
      this.aplicarLinha();
      this.carregarUnidades();
      if (!this.AREAS.some((a) => a.abas.some((t) => t.view === this.view))) this.setView('home');
    },

    clearSession() {
      this.session = null;
      this.profile = null;
      this.group = null;
      this.categories = [];
      this.companies = [];
      this.banks = [];
      this.cartoes = [];
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

    async refreshBanks() {
      if (!this.profile) return;
      const groupId = this.group?.group?.id;
      this.banks = await banksService.listBanks({ ownerId: this.profile.id, groupId });
    },

    bankByName(nome) {
      return findBankByName(this.banks, nome);
    },

    bankById(id) {
      return this.banks.find((b) => b.id === id) || null;
    },

    async refreshCartoes() {
      if (!this.profile) return;
      const groupId = this.group?.group?.id;
      // Best-effort: isto roda logo depois de CRIAR um cartão (ver
      // cartaoManager.js::salvar) só pra atualizar a lista reativa que
      // alimenta o seletor de cartão. Se falhar (ex.: RLS/migração), o
      // cartão já foi salvo com sucesso — deixar a exceção subir faria
      // cartaoManager.js mostrar "não foi possível salvar o cartão" por
      // cima de uma criação que na verdade deu certo, e o dropdown só
      // ficaria desatualizado até o próximo refresh (F5/relogin).
      try {
        this.cartoes = await cartoesService.listCartoes({ ownerId: this.profile.id, groupId });
      } catch (e) {
        console.error('Não foi possível atualizar a lista de cartões.', e);
      }
    },

    cartaoById(id) {
      return this.cartoes.find((c) => c.id === id) || null;
    },

    cartaoByName(nome) {
      return findCartaoByName(this.cartoes, nome);
    },

    async refreshGroup() {
      if (!this.profile) return;
      this.group = await groupsService.getMyGroup(this.profile.id);
    },

    async loginDemo(profileId) {
      const profile = await authService.signInDemo(profileId);
      await this.loadSession({ user: { id: profile.id } });
    },

    // "Definir nova senha" (recuperação de senha, 2026-10-04).
    novaSenhaAberta: false,
    novaSenha: '',
    novaSenhaErro: '',
    salvandoNovaSenha: false,
    async salvarNovaSenha() {
      this.novaSenhaErro = '';
      if (this.novaSenha.length < 8) {
        this.novaSenhaErro = 'Use pelo menos 8 caracteres.';
        return;
      }
      this.salvandoNovaSenha = true;
      try {
        await authService.updatePassword(this.novaSenha);
        this.novaSenha = '';
        this.novaSenhaAberta = false;
        this.notify('Senha alterada! Use a nova senha nas próximas vezes.');
      } catch (e) {
        this.novaSenhaErro = authService.mensagemErroAuth(e);
      } finally {
        this.salvandoNovaSenha = false;
      }
    },

    async loginPassword(email, password) {
      const session = await authService.signInWithPassword(email, password);
      await this.loadSession(session);
    },

    async signup(email, password, nome) {
      const session = await authService.signUp(email, password, nome, this.intencao?.tipo || this.conta.tipo);
      if (session) await this.loadSession(session);
      return session;
    },

    async logout() {
      await authService.signOut();
      this.clearSession();
    },

    // "Sair do modo demonstração" (Perfil) — sem isso, quem visitou com
    // ?demo=1 uma vez (ou clicou em "Ver demonstração") ficava PRESO nele
    // pra sempre: a flag persiste em localStorage (bonotto_force_demo,
    // ver js/data/config.js) e nada na UI a limpava, mesmo com credenciais
    // reais do Supabase já configuradas — "Sair da conta" só encerrava o
    // perfil demo escolhido, voltando pra mesma tela de demo (reportado:
    // "impossível voltar pro modo normal"). ?demo=0 é o mecanismo que já
    // existe em config.js pra limpar a flag; só faltava um botão pra isso.
    exitDemoMode() {
      location.href = location.pathname + '?demo=0';
    },

    // theme: 'dark' | 'light' | null (null = volta a seguir o sistema).
    // Tamanho do texto (Configurações): A− / A+ em passos de 12,5%, de 87,5%
    // a 150% (ver utils/tamanhoTexto.js). Guardado como número (%).
    tamanhoTexto: (() => { try { return normalizarEscala(localStorage.getItem('bonotto_tamanho_texto') ?? PADRAO); } catch { return PADRAO; } })(),
    setTamanhoTexto(valor) {
      const escala = normalizarEscala(valor);
      this.tamanhoTexto = escala;
      document.documentElement.style.fontSize = escala === PADRAO ? '' : escala + '%';
      try {
        if (escala === PADRAO) localStorage.removeItem('bonotto_tamanho_texto');
        else localStorage.setItem('bonotto_tamanho_texto', String(escala));
      } catch { /* sem armazenamento: vale só nesta sessão */ }
    },
    mudarTamanhoTexto(direcao) {
      this.setTamanhoTexto(proximaEscala(this.tamanhoTexto, direcao));
    },
    get podeAumentarTexto() { return podeAumentar(this.tamanhoTexto); },
    get podeDiminuirTexto() { return podeDiminuir(this.tamanhoTexto); },

    // Narração (Configurações): lê em voz alta o que for tocado (utils/narracao.js).
    vozDisponivel: vozDisponivel(),
    narracao: (() => { try { return localStorage.getItem('bonotto_narracao') === '1'; } catch { return false; } })(),
    setNarracao(on) {
      this.narracao = !!on;
      ligarNarracao(this.narracao);
      try {
        if (on) localStorage.setItem('bonotto_narracao', '1');
        else localStorage.removeItem('bonotto_narracao');
      } catch { /* vale só nesta sessão */ }
      if (on) falar('Narração ligada. Toque em qualquer botão ou texto para ouvir.');
    },

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

    // pushState (não replaceState): cada troca de tela vira uma entrada de
    // histórico de verdade, então o botão físico "voltar" do Android/gesto
    // do navegador anda por dentro do app (Transações -> Início) em vez de
    // fechar o app direto — antes o replaceState só mantinha a URL/hash
    // bookmarkável, sem empilhar histórico nenhum. Guard de mesma-tela evita
    // empilhar uma entrada idêntica (ex.: clicar de novo no item já ativo
    // da sidebar). O sync de volta (usuário aperta voltar de verdade) é
    // "popstate" em js/app.js — que só LÊ o hash, nunca chama setView, pra
    // não empurrar uma entrada nova por cima da que acabou de ser
    // desempilhada (isso quebraria voltar de novo).
    // Navegação por intenção (Palm Business, fase 5 — docs/palm/NAVIGATION.md):
    // 4 áreas + Adicionar. As telas antigas (view) continuam existindo e são
    // as sub-abas de cada área; rotas antigas (#/transacoes etc.) seguem válidas.
    // Mesmas telas, vocabulário de cada linha (Home: casa; Business: empresa).
    get AREAS() {
      if (this.conta.tipo === 'business') {
        return [
          { id: 'home', rotulo: 'Início', icone: 'bi-speedometer2', abas: [{ view: 'home', rotulo: 'Início' }] },
          { id: 'dinheiro', rotulo: 'Financeiro', icone: 'bi-cash-coin', abas: [{ view: 'transacoes', rotulo: 'Contas' }, { view: 'caixinhas', rotulo: 'Reservas' }] },
          { id: 'casa', rotulo: 'Estoque', icone: 'bi-box-seam', abas: [{ view: 'compras', rotulo: 'Compras' }, { view: 'recursos', rotulo: 'Estoque' }] },
          { id: 'pessoas', rotulo: 'Equipe', icone: 'bi-person-badge', abas: [{ view: 'grupo', rotulo: 'Equipe' }] },
        ];
      }
      return [
        { id: 'home', rotulo: 'Início', icone: 'bi-house-door', abas: [{ view: 'home', rotulo: 'Início' }] },
        { id: 'dinheiro', rotulo: 'Dinheiro', icone: 'bi-cash-stack', abas: [{ view: 'transacoes', rotulo: 'Movimentações' }, { view: 'caixinhas', rotulo: 'Reservas' }] },
        { id: 'casa', rotulo: 'Casa', icone: 'bi-house-heart', abas: [{ view: 'compras', rotulo: 'Lista de compras' }, { view: 'recursos', rotulo: 'Inventário' }] },
        { id: 'pessoas', rotulo: 'Pessoas', icone: 'bi-people', abas: [{ view: 'grupo', rotulo: 'Membros' }, { view: 'socorros', rotulo: 'Saúde' }] },
      ];
    },
    ultimaAbaPorArea: {},
    adicionarAberto: false,

    get areaAtual() {
      return this.AREAS.find((a) => a.abas.some((t) => t.view === this.view)) || null;
    },
    get tituloTela() {
      if (this.view === 'perfil') return 'Configurações';
      const area = this.areaAtual;
      return area ? area.rotulo : 'BNTT';
    },
    irParaArea(id) {
      const area = this.AREAS.find((a) => a.id === id);
      if (!area) return;
      const destino = this.ultimaAbaPorArea[id] || area.abas[0].view;
      this.setView(destino);
    },

    setView(view) {
      this.navOpen = false;
      this.adicionarAberto = false;
      const area = this.AREAS.find((a) => a.abas.some((t) => t.view === view));
      if (area) this.ultimaAbaPorArea[area.id] = view;
      if (view === this.view) return;
      this.view = view;
      history.pushState({ view }, '', '#/' + view);
      // Tutorial curto na 1ª vez em cada tela (ver onboarding.talvezTourDaTela).
      Alpine.store('onboarding')?.talvezTourDaTela?.(view);
    },

    // Botão "Limpar cache" (Perfil) — escape hatch manual pra quando algo
    // parece desatualizado/quebrado mesmo com a auto-atualização (ver
    // controllerchange em js/app.js) já em vigor. Mais agressivo: apaga TODO
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
      // Recusa do servidor por limite do plano: vira o aviso de plano, não erro.
      if (assinatura.ehErroDeLimite(message)) {
        this.pedirUpgrade(assinatura.motivoDoLimite(message));
        return;
      }
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
    // de histórico, um item avulso).
    //
    // BUG REAL CORRIGIDO EM 2026-08-23 (relatado em uso real, "excluí uma
    // despesa, disse que excluiu com sucesso, mas não excluiu"): a versão
    // anterior daqui adiava a chamada de API de verdade (`aoConfirmar`) pra
    // dentro de um `setTimeout(..., 5000)` — se a aba fechasse, recarregasse,
    // ou o navegador suspendesse o timer (comum no celular, tela apagando/
    // trocando de app) ANTES desses 5s, a exclusão de verdade NUNCA
    // acontecia, mas o toast já tinha dito "excluído" no passado, uma
    // mentira otimista sem chance de correção. Agora `aoConfirmar` roda e é
    // aguardado ANTES do toast aparecer — quando a mensagem é mostrada, a
    // ação já aconteceu de verdade, sem depender de nenhum timer sobreviver.
    // "Desfazer" deixou de ser "cancelar algo que ainda não rodou" e virou
    // "desfazer de verdade o que já rodou" — cada chamador agora precisa
    // passar um `aoDesfazer` que recria/restaura o dado (não só o estado
    // local), já que a exclusão real já foi feita.
    async notifyUndo(message, aoConfirmar, aoDesfazer, icone = null) {
      try {
        await aoConfirmar();
      } catch (e) {
        this.notify(e.message || 'Não consegui concluir a ação.', 'danger');
        return;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      let desfeito = false;
      const timer = setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, 5000);
      this.toasts.push({
        id, message, type: 'undo', icone,
        desfazer: async () => {
          if (desfeito) return;
          desfeito = true;
          clearTimeout(timer);
          this.toasts = this.toasts.filter((t) => t.id !== id);
          try {
            await aoDesfazer();
          } catch (e) {
            this.notify(e.message || 'Não consegui desfazer.', 'danger');
          }
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
