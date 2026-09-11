// Ícone de ajuda contextual reutilizável (TASK-038) — ".cg-help", ao lado de
// um campo/indicador, explica em linguagem simples o que aquilo representa e
// como influencia o resultado (ex.: "saldo entre vocês", "orçamento
// restante", "status de caixinha", "despesa fixa"/"recorrência"). Nunca
// jargão técnico — quem lê é o usuário final, não outro desenvolvedor.
//
// Padrão de acessibilidade "toggletip": um <button> com aria-describedby
// ligado ao texto, que abre por clique/toque (funciona em touch, não só
// :hover), por hover no desktop, e fecha com Esc — mesma exigência de
// qualquer overlay deste projeto. Cada instância usa Alpine.data('cgHelp',
// ...) (registrado em app.js) — x-data="cgHelp('texto explicativo')".
//
// "aberto" é a ÚNICA fonte de verdade da visibilidade (o popover usa
// x-show.important, ver index.html/css/components.css) — de propósito, não
// duas fontes (JS + CSS :hover) tentando concordar: mais simples de raciocinar
// e evita o próprio bug descrito abaixo se espalhar de novo por outro canto.
//
// BUG REAL ENCONTRADO TESTANDO COM PLAYWRIGHT (que simula mouse de verdade,
// não só clique sintético): a primeira versão daqui tinha @mouseenter/
// @click os dois mexendo direto em "aberto" (hover abria, clique alternava).
// Só que numa interação real de mouse o navegador SEMPRE dispara mouseenter
// ANTES do click — então passar o mouse já abria, e o clique que vinha logo
// em seguida (na MESMA interação) alternava de volta pra fechado. Resultado:
// clicar no ícone parecia não fazer nada (abria e fechava na mesma
// tacada). `abertoPorHover` existe só pra quebrar essa corrida: marca que a
// abertura atual veio do hover (não de uma intenção explícita de
// clicar/tocar); o primeiro clique que vier em seguida só "consome" essa
// marca (confirma/fixa aberto) em vez de alternar — só o PRÓXIMO clique de
// verdade (sem hover recém-acontecido) alterna pra fechado.
let contador = 0;

export function cgHelp(texto) {
  return {
    aberto: false,
    abertoPorHover: false,
    // Precisa ser único por instância (não por classe) porque vira o
    // aria-describedby do botão — dois ".cg-help" na mesma tela com o mesmo
    // id quebraria a associação pra leitor de tela.
    id: `cg-help-${++contador}`,
    texto,

    aoPassarMouse() {
      this.aberto = true;
      this.abertoPorHover = true;
    },

    aoClicar() {
      if (this.abertoPorHover) {
        this.abertoPorHover = false;
        return;
      }
      this.aberto = !this.aberto;
    },

    fechar() {
      this.aberto = false;
      this.abertoPorHover = false;
    },
  };
}
