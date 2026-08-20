# Design System 2027 — Diretriz de UX/UI e Reconstrução Visual

> Complementa `docs/BONOTTO-2027-BLUEPRINT.md`. Nasce de uma correção direta sua sobre o diagnóstico anterior: eu havia tratado UI/acessibilidade como item P2/P3 espalhado no roadmap — você apontou, com razão, que aparência/layout/design/proporção é a causa raiz real da sua insatisfação, a ponto de motivar o pedido de reconstrução. Este documento trata isso como prioridade de primeira classe, com evidência concreta verificada no código (não crítica genérica), e propõe um Design System próprio antes de qualquer tela nova ser tocada — exatamente na ordem que você descreveu: princípios primeiro, arquitetura das telas depois, implementação visual definitiva por último. Nenhum código foi alterado para escrever isto.

---

## 1. Validação do problema — evidência, não opinião

Verifiquei três das suas queixas diretamente no código antes de escrever qualquer recomendação:

- **Navegação de "voltar" existe em exatamente 3 lugares em todo o app** (`index.html`, 2.494 linhas, 7 telas + 5 modais): a grade de cômodos → subcategoria (linha 1317), subcategoria → itens (linha 1351), e o detalhe de uma Caixinha (linha 1600). Em nenhum outro ponto da hierarquia existe afordance de retorno. E os 3 que existem são exatamente o que você descreveu: `<button class="btn btn-sm btn-outline-secondary">← Cômodos</button>` — um botão retangular, com borda, com texto — nunca um chevron simples. Cada um foi inventado isoladamente (nenhum reaproveita um componente comum), o que confirma sua observação de que a Sonnet "toma decisões visuais diferentes a cada tela".
- **Tipografia não tem escala nenhuma.** Uma varredura em `css/components.css` encontrou pelo menos 15 valores de `font-size` distintos e arbitrários: `0.6rem`, `0.65rem`, `0.68rem`, `0.72rem`, `0.75rem`, `0.8rem`, `0.8125rem`, `0.85rem`, `0.875rem`, `0.95rem`, `1.05rem`, `1.1rem`, `1.2rem`, `1.4rem`, `1.6rem` — cada um escolhido "no olho" pro componente daquele momento, sem nenhuma escala documentada por trás. Isso é a causa técnica exata da sua queixa de tipografia inconsistente.
- **Cards se acumulam sem critério** — 34 usos de `.cg-card` em `index.html`, vários deles aninhados (card dentro de card). Confirma a queixa de "card dentro de card dentro de card".

**Contraponto que também precisa ser dito com honestidade**: nem tudo está ruim. `css/tokens.css` já tem uma base real — paleta semântica (primary/success/danger/warning/info/secondary, não cores soltas), escala de espaçamento definida (4/8/12/16/24/32px), raio consistente, alvo de toque de 48px, e dark mode resolvido corretamente nos 3 estados possíveis (sistema, forçado claro, forçado escuro). O problema não é ausência total de sistema — é que esse sistema **parou na camada de token e nunca foi imposto de verdade na camada de componente**: cada tela ignora a escala de tipografia (que nem existe) e a disciplina de espaçamento quando conveniente. Isso muda a receita: não é "criar um design system do zero", é **terminar o que já foi começado e fazer valer**.

## 2. Princípio fundamental

Sua formulação é a correta e vou usá-la como critério de aceite pra qualquer tela daqui pra frente:

> **Complexidade no sistema, simplicidade para o usuário.**

O Bõnotto vai continuar tendo split de pagador, cadência de recorrência, 7 moedas em Caixinhas, leitura de boleto/Pix, OCR — nenhuma dessas funcionalidades sai do produto (ver blueprint, §14 "Matriz de funcionalidades" — nada foi recomendado pra remoção). O que muda é que **nenhuma dessas complexidades pode aparecer todas de uma vez na tela**. Toda tela responde primeiro à pergunta "o que o usuário precisa decidir agora", e só depois — atrás de "mais opções", de um segundo nível de navegação, de um accordion — o resto.

## 3. Direção de identidade visual (não é cópia do Nubank)

Absorvendo os princípios que você listou (Nubank, Inter, Mercado Pago, Revolut, Apple, Material) sem copiar nenhuma marca — a direção própria do Bõnotto:

- **Paleta**: manter a base verde (`--color-primary: #1F7A5C`) — já é uma escolha deliberada e não-genérica (o próprio RAIO-X nota que o app evita "excesso de verde bancário" na aplicação, então o tom já foi escolhido com cuidado). O que falta é **disciplina de uso**: cor primária só em ação principal e estado ativo de navegação — nunca em texto decorativo, nunca em mais de um elemento por tela competindo por atenção.
- **Superfícies calmas, não decoradas**: `--color-bg`/`--color-surface`/`--color-surface-alt` já existem e já são neutros com viés sutil (não cinza puro) — mantém. O que precisa parar: sombra (`--shadow-md`) e borda aplicadas ao mesmo elemento simultaneamente "pra garantir que destaque" — escolher uma ou outra por elemento, nunca as duas.
- **Números com peso tipográfico real**: um valor monetário em destaque (saldo da Home, saldo de Caixinha) precisa parecer inequivocamente o dado mais importante da tela — tamanho e peso maiores que qualquer título de seção ao redor dele, sempre com `font-variant-numeric: tabular-nums` (dígitos alinhados em coluna, já usado em algumas partes do app — precisa virar regra, não exceção).
- **Ícones de uma família só, nunca dois estilos misturados**: Bootstrap Icons já é a base — a disciplina que falta é nunca usar peso "fill" (`bi-xxx-fill`) e "outline" (`bi-xxx`) do mesmo conceito em duas telas diferentes pro mesmo significado.

## 4. Sistema de navegação — o componente "voltar"

Especificação concreta, resolvendo diretamente a queixa central:

```html
<!-- .cg-back — usar em TODA tela ou seção que esteja um nível abaixo da navegação principal -->
<button type="button" class="cg-back" @click="voltar()" aria-label="Voltar para Cômodos">
  <i class="bi bi-chevron-left" aria-hidden="true"></i>
  <span class="cg-back__label">Cômodos</span>
</button>
```

```css
.cg-back {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: var(--touch-target);   /* 48px — já é o token existente, só precisa ser aplicado aqui */
  padding-inline: var(--space-2);
  background: transparent;
  border: none;                       /* nunca .btn-outline-secondary de novo — sem borda, sem fundo */
  color: var(--color-text-muted);
  font-weight: 600;
  font-size: var(--font-size-body-sm); /* ver escala tipográfica, §6 */
}
.cg-back i { font-size: 1.1em; }
.cg-back:hover, .cg-back:focus-visible { color: var(--color-text); }
```

**Regra de uso, sem exceção**: qualquer tela/seção que seja logicamente "filha" de outra (Recursos: cômodo→subcategoria→itens; Caixinhas: grade→detalhe; qualquer tela de detalhe futura) usa exatamente este componente, na mesma posição (topo, alinhado à esquerda, antes do título da seção), nunca reinventado por tela. Isso substitui os 3 botões `btn-outline-secondary` existentes — a única mudança de código que este documento antecipa (fase de implementação, não agora).

**Nível 2 — histórico do navegador**: além do visual, o botão "voltar" físico do Android/gesto de swipe do navegador deveria ter o mesmo efeito de `voltar()` sempre que fizer sentido (sua observação "funcionar tanto visualmente quanto pelo histórico de navegação" é correta e hoje não é verdade — a navegação entre telas principais é só troca de `$store.app.view`, sem `history.pushState`). Fica registrado como item de arquitetura pro roadmap (abaixo), não resolvido só com CSS.

## 5. Navegação vs. ação — nunca visualmente confundidas

Auditoria rápida: hoje o app já separa razoavelmente bem (FAB de "+ nova despesa" é claramente uma ação, não um destino — RAIO-X §15.4 já documenta essa distinção sendo deliberada). O que falta formalizar como regra permanente:

- **Navegação** (ir para trás, trocar de aba, abrir uma seção): sempre `text-muted`/`secondary`, sem preenchimento de fundo, sem borda — nunca a cor primária.
- **Ação primária** (salvar, confirmar, pagar): sempre preenchida, cor primária, uma só por tela/modal visível por vez.
- **Ação destrutiva** (excluir): nunca o mesmo peso visual da ação primária — outline ou texto em `--color-danger`, nunca preenchido em vermelho ocupando o mesmo espaço/proeminência que "Salvar" ocuparia.

## 6. Tipografia — escala nova (substitui os 15+ tamanhos arbitrários)

Proposta de tokens novos pra `css/tokens.css` (aditiva — não quebra nada, os componentes migram gradualmente):

```css
--font-size-caption: 0.75rem;    /* 12px — labels, metadados, timestamps */
--font-size-body-sm: 0.8125rem;  /* 13px — texto secundário, badges */
--font-size-body: 0.9375rem;     /* 15px — corpo padrão */
--font-size-body-lg: 1.0625rem;  /* 17px — corpo com ênfase */
--font-size-title-sm: 1.25rem;   /* 20px — título de seção */
--font-size-title: 1.5rem;       /* 24px — título de tela */
--font-size-display: clamp(1.75rem, 5vw, 2.25rem); /* saldo em destaque — já existe como clamp ad hoc num lugar, vira token */

--font-weight-regular: 400;
--font-weight-medium: 600;
--font-weight-bold: 700;
```

Regra de migração: nenhum componente novo usa `font-size` em valor solto — só variável. Componentes existentes migram durante a Fase de polish do roadmap (não uma reescrita de CSS de uma vez).

## 7. Cards — quando usar, quando não usar

Regra explícita, resolvendo "card dentro de card dentro de card":

- Um `.cg-card` existe quando o conteúdo precisa se **destacar da superfície ao redor** (ex.: o card de saldo da Home, um tile de Caixinha). Nunca um card dentro de outro card — se o conteúdo já está dentro de um `.cg-card`, o agrupamento interno usa **divisor** (`border-top` fino) ou **espaçamento** (`gap`), nunca uma segunda superfície com sombra/borda própria.
- Uma **lista** (linhas com divisor, sem sombra individual por linha) é preferível a uma grade de cards sempre que os itens forem homogêneos e a ordem importar mais que a comparação visual lado a lado (ex.: histórico de transações, lançamentos recentes) — cards fazem mais sentido quando os itens são comparados entre si (grade de Caixinhas, grade de cômodos).

## 8. Estados de componente — o que falta formalizar

Botões, inputs e afins já têm alguns estados via Bootstrap nativo (hover/focus/disabled do framework), mas nenhum estado de `loading` visual consistente foi documentado como padrão (hoje cada tela decide sozinha como mostrar "salvando..."). Definir como padrão único: botão de ação primária em loading = texto substituído por spinner do mesmo tamanho, largura do botão mantida fixa (evita o layout "pular" quando o texto some).

## 9. Reaproveitamento de componentes, classes e funções

Este é o mesmo problema do botão de "voltar" (§4), só que na camada de comportamento JS, não só visual — e vale nomear com a mesma clareza, porque é a causa estrutural por trás de várias das inconsistências visuais: **quando cada tela reimplementa a mesma coisa do zero, cada implementação diverge um pouco, e a interface acaba parecendo "cada pedaço feito por uma pessoa diferente"** — exatamente o que você descreveu.

Evidência verificada nesta sessão: o padrão de abrir/fechar modal (`this.open = true` / `this.open = false`) está duplicado, quase palavra por palavra, em pelo menos 4 arquivos independentes — `transactionForm.js`, `budgetManager.js`, `csvImportModal.js`, `categoryManager.js` — cada `Alpine.store` reescrevendo a mesma lógica em vez de compartilhar uma. Consequência prática, não só estética: **nenhum dos 5 modais do app fecha com a tecla Esc** (zero tratamento de teclado encontrado em qualquer um deles) — porque ninguém implementou isso uma vez só; teria sido preciso implementar (e esquecer de implementar) 5 vezes.

O contraponto positivo, que mostra que o projeto já sabe fazer isso direito quando decide: **o scroll-lock (travar o `<body>` quando um overlay está aberto) já é centralizado** — uma função só, `algumOverlayAberto()` em `js/app.js`, usada por todo overlay do app, independente de qual. É a prova de que a disciplina de reaproveitar não é desconhecida do projeto, só não foi aplicada de forma consistente a tudo que deveria.

**Proposta concreta** (fica pro roadmap, não implementada agora): um pequeno helper `js/utils/modalBehavior.js`, no mesmo espírito do `algumOverlayAberto()` que já existe — um objeto/função que cada `Alpine.store` de modal espalha (`...modalBehavior()`) em vez de reescrever, cobrindo: `open`/`close` (a mesma dupla de linhas hoje duplicada 4x), fechar com Esc, e devolver o foco pro elemento que abriu o modal quando ele fecha (acessibilidade — nenhum modal faz isso hoje). Ganho duplo: menos código (sua colocação exata) **e** qualquer correção futura (como adicionar Esc) se propaga pra todo modal de uma vez, em vez de precisar lembrar de aplicar em 5 lugares — o mesmo motivo pelo qual o bug de `x-show`/`!important` (RAIO-X) reapareceu 3 vezes: cada correção ficou local a um componente, nunca virou regra aplicada a todos de uma vez.

A mesma lente vale para os componentes CSS: o app já tem uma base de reaproveitamento real na família `.cg-*` (RAIO-X §15.3) — a tarefa aqui não é criar isso do zero, é **auditar e consolidar os pontos onde uma tela nova ignorou o que já existia** (os 3 botões de voltar são o exemplo mais claro) em vez de estender a família existente.

## 10. Critério de qualidade por tela (aplicar antes de considerar pronta)

Adotando literalmente seus critérios do item 22:

**UX** — o usuário sabe onde está? Sabe como voltar (via `.cg-back` sempre que aplicável)? A ação principal está inequivocamente destacada (uma cor primária, uma só, por tela)? Existe etapa desnecessária no caminho até a ação mais comum?

**UI** — a hierarquia usa a escala tipográfica nova, não valores soltos? Nenhum card está dentro de outro card? Espaçamento vem só da escala `--space-1..6`? Os ícones são todos do mesmo peso (outline ou fill, nunca misturado no mesmo conceito)?

**Componentização** — antes de escrever HTML/CSS/JS novo pra uma tela, existe um `.cg-*`/helper já usado em outra tela que resolve o mesmo problema? Se sim, reaproveitar; se a solução existente não serve mais, evoluir ela em um lugar só (não criar uma segunda variante concorrente).

**Produto** — a tela resolve algo que o usuário realmente faz no dia a dia (ver matriz de funcionalidades do blueprint)? A informação mais importante da tela está tipograficamente maior que qualquer outra coisa nela?

## 11. Como isso recalibra o roadmap do blueprint

O `docs/BONOTTO-2027-BLUEPRINT.md` (§15) tinha o trabalho visual nas Fases 3–4, depois de testes e Money Engine. Sua correção muda a ordem: **visual/navegação sobe pra logo depois da Fase 1 (rede de testes)**, porque (a) é a dor real que você relatou primeiro e com mais intensidade, e (b) mudanças visuais que tocam quase toda tela são exatamente o tipo de mudança que mais se beneficia de já ter testes de regressão prontos antes de começar — a ordem "testes primeiro" continua certa, só o que vem *depois* muda de posição.

**Fase 1 (sem mudança)**: rede de testes Playwright.

**Fase 2 (nova posição — era Fase 3/4)**: Design System aplicado — escala tipográfica nova em `tokens.css`; componente `.cg-back` substituindo os 3 botões atuais; `js/utils/modalBehavior.js` consolidando os 5 modais duplicados (ganha Esc-pra-fechar e devolução de foco de graça, pros 5 de uma vez); auditoria e achatamento de card-dentro-de-card; separação visual formal navegação/ação/destrutiva. Tela por tela, não tudo de uma vez (§74 do prompt — nunca 40 arquivos simultâneos) — sugestão de ordem: Recursos e Caixinhas primeiro (é onde o problema de navegação já está confirmado), depois Transações (tela de maior uso), depois o resto.

**Fase 3 (era Fase 2)**: Money Engine — sem mudança de conteúdo, só de posição no roadmap.

**Fase 4 em diante**: como já estava no blueprint (produto visível — entrada rápida, saldo entre casal —, acessibilidade sistemática, documentação).

---

*Este documento, junto com `docs/RAIO-X-2.0.md` e `docs/BONOTTO-2027-BLUEPRINT.md`, forma o pacote completo de diagnóstico. Nenhuma fase começa sem sua autorização explícita — a Fase 2 (visual) é provavelmente a que você vai querer ver primeiro, dado o que motivou este pedido.*
