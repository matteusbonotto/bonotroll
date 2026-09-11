// Tour guiado de onboarding (TASK-037) — feedback real de usuário de teste
// que nunca acompanhou a construção do app: sem tutorial nenhum, não dava
// pra entender o objetivo do Bõnotto nem como as telas principais se
// relacionam. Linguagem sempre conceitual/de benefício aqui dentro — nunca
// "PWA", "RLS", "Supabase" ou qualquer termo técnico, é o público final que
// vai ler isto, não outro desenvolvedor.
//
// DECISÃO DE ARQUITETURA: reaproveita o mesmo padrão de modal já usado em
// TODO o app (.cg-modal-backdrop + .cg-modal, ver DESIGN-SYSTEM-2027.md §9)
// em vez de importar uma lib de tour (ex. driver.js). Dois motivos: 1) uma
// lib de tour precisaria ter o CSS inteiro sobrescrito pra bater com os
// tokens do design system — mais trabalho e mais risco de conflito de
// especificidade CSS (ver CLAUDE.md, "Armadilhas já conhecidas") do que só
// reusar o que já existe; 2) Esc-fecha-e-devolve-foco JÁ é centralizado em
// setupOverlayBehavior (js/app.js) pra QUALQUER .cg-modal-backdrop visível —
// de graça, sem reimplementar nada aqui.
//
// Store global (Alpine.store('onboarding'), registrado em app.js) — não
// x-data local — pelo mesmo motivo de txModal/csvModal/etc: o ponto de
// abertura automática (app-shell inteiro, ao logar) e o ponto de reabertura
// manual ("Rever tutorial", tela de Perfil) são componentes Alpine
// totalmente diferentes; um store é visível dos dois lugares sem subir
// estado por props.
const CHAVE_VISTO = 'bonotto_onboarding_v1_seen';

export function onboardingStore() {
  return {
    aberto: false,
    passoAtual: 0,

    // 1 boas-vindas + 3 telas principais + 1 encerramento — "tour curto" era
    // pedido explícito, não uma explicação exaustiva de cada funcionalidade.
    passos: [
      {
        icone: 'bi-house-heart-fill',
        titulo: 'Bem-vindo(a) ao Bõnotto!',
        texto: 'Aqui vocês dois controlam o dinheiro, a lista de compras e o que tem em casa — tudo num só lugar, sem precisar ficar trocando de aplicativo.',
      },
      {
        icone: 'bi-cash-coin',
        titulo: 'Controle financeiro',
        texto: 'Registre o que entra e o que sai, marque despesas fixas ou recorrentes, e divida contas entre vocês. O app calcula sozinho quem deve quanto pra quem.',
      },
      {
        icone: 'bi-cart3-fill',
        titulo: 'Lista de compras',
        texto: 'Monte a lista do mercado, marque os itens conforme vão pro carrinho e acompanhe o total gasto na hora — sem precisar somar nada de cabeça.',
      },
      {
        icone: 'bi-box-seam-fill',
        titulo: 'O que tem em casa',
        texto: 'Cadastre o que existe em cada cômodo (despensa, banheiro etc.) e o app avisa sozinho quando algo está acabando ou perto de vencer.',
      },
      {
        icone: 'bi-check2-circle',
        titulo: 'Pronto pra começar!',
        texto: 'Quiser rever isso depois, é só abrir Perfil e procurar "Rever tutorial". E onde tiver um ícone de interrogação (?) ao lado de um campo, é só tocar nele pra entender o que aquilo significa.',
      },
    ],

    get ultimoPasso() {
      return this.passoAtual === this.passos.length - 1;
    },

    // Chamado uma vez, quando o app-shell autenticado monta (ver
    // x-init="$store.onboarding.iniciarSeNecessario()" em index.html) — não
    // faz nada se a pessoa já viu antes NESTE navegador. Isto não é
    // preferência de conta nem dado de negócio (é só "já vi isso aqui"),
    // por isso localStorage direto, sem passar por services/ (ver
    // CLAUDE.md, "Nunca importe mockDb/Supabase direto num componente" —
    // regra é sobre DADO, esta flag não é dado do usuário).
    iniciarSeNecessario() {
      if (localStorage.getItem(CHAVE_VISTO) === '1') return;
      this.abrir();
    },

    // Ponto de reabertura manual (Perfil → "Rever tutorial") — sempre
    // reinicia do passo 1, mesmo que a pessoa já tenha visto antes.
    abrir() {
      this.passoAtual = 0;
      this.aberto = true;
    },

    proximo() {
      if (this.ultimoPasso) { this.concluir(); return; }
      this.passoAtual++;
    },

    anterior() {
      if (this.passoAtual > 0) this.passoAtual--;
    },

    // "Pular" e "Concluir" são a mesma coisa do ponto de vista de "não
    // mostrar de novo sozinho" — só o rótulo do botão muda conforme o passo,
    // e fechar pelo backdrop/Esc (ver setupOverlayBehavior) cai em "pular".
    pular() { this.encerrar(); },
    concluir() { this.encerrar(); },

    encerrar() {
      this.aberto = false;
      localStorage.setItem(CHAVE_VISTO, '1');
    },
  };
}
