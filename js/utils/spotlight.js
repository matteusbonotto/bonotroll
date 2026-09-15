// Geometria pura do "buraco" de destaque (spotlight) do passo-a-passo
// interativo de onboarding (js/components/onboarding.js, reconstrução
// TASK-037/038 — ver comentário grande lá pro motivo da reconstrução).
// Extraído pra cá porque é a ÚNICA parte de todo o mecanismo de spotlight
// que é matemática pura, sem DOM/Alpine — a única testável em
// tests/unit sem precisar simular um navegador inteiro (jsdom etc.).
//
// `rect` aceita o MESMO formato de um DOMRect (getBoundingClientRect), mas
// como objeto plano de propósito — desacopla esta função de precisar rodar
// num navegador de verdade pra ser testada.
//
// Devolve dois grupos, sempre em pixels (número puro, sem 'px' — quem
// consome isto, o getter `spotlightStyles` em onboarding.js, é quem
// concatena a unidade na hora de aplicar como `:style`):
//   - hole: a moldura de destaque em volta do elemento real (com respiro).
//   - dims: os 4 retângulos que escurecem TODO o resto da tela — cada um
//     usa duas bordas opostas fixas (ex.: left:0 + right:0 na horizontal, ou
//     top+height na vertical) pra se esticar sozinho via CSS, então nunca
//     precisa saber a largura/altura da janela pra funcionar.
export function computeSpotlightGeometry(rect, padding = 8) {
  const top = Math.max(0, rect.top - padding);
  const left = Math.max(0, rect.left - padding);
  const width = rect.width + padding * 2;
  const height = rect.height + padding * 2;

  return {
    hole: { top, left, width, height },
    dims: {
      top: { top: 0, left: 0, right: 0, height: top },
      bottom: { top: top + height, left: 0, right: 0, bottom: 0 },
      left: { top, left: 0, width: left, height },
      right: { top, left: left + width, right: 0, height },
    },
  };
}

// Geometria pura do "balão" de campo (guia detalhado dentro de um modal já
// aberto, ex.: passo-a-passo do formulário de Nova despesa) — mesma ideia do
// spotlight acima (moldura em volta do alvo real), mas SEM os 4 retângulos de
// escurecer: o modal real já está aberto e a pessoa precisa continuar
// enxergando/preenchendo os campos ao redor, então este balão só marca o
// alvo com uma moldura fina e ancora um textinho curto do lado com espaço
// (embaixo por padrão; em cima quando não sobra altura embaixo).
// `viewport` é { width, height } — passado por quem chama (window.innerWidth/
// innerHeight) porque esta função continua pura/sem DOM, testável com objetos
// simples como computeSpotlightGeometry.
export function computeBalloonGeometry(rect, viewport, padding = 6) {
  const ring = {
    top: Math.max(0, rect.top - padding),
    left: Math.max(0, rect.left - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  };

  const gutter = 12;
  const gap = 10;
  const maxWidth = Math.max(160, Math.min(280, viewport.width - gutter * 2));

  const spaceBelow = viewport.height - (ring.top + ring.height);
  const spaceAbove = ring.top;
  // Prefere embaixo (mais natural de ler, "próximo campo vem depois"); só
  // inverte pra cima quando embaixo realmente não sobra espaço nenhum pro
  // balão (~130px, altura aproximada de um balão de 2-3 linhas + botões) E
  // em cima sobra mais.
  const placement = spaceBelow >= 130 || spaceBelow >= spaceAbove ? 'bottom' : 'top';

  let left = ring.left;
  if (left + maxWidth > viewport.width - gutter) left = viewport.width - gutter - maxWidth;
  if (left < gutter) left = gutter;

  const balloon = { left, maxWidth };
  if (placement === 'bottom') balloon.top = ring.top + ring.height + gap;
  else balloon.bottom = viewport.height - ring.top + gap;

  return { ring, placement, balloon };
}
