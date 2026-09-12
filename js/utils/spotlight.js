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
