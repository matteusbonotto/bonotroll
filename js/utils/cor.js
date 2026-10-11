// Contraste de cor (WCAG 2.x) — usado pelo badge de categoria (cgCategoria):
// a cor de fundo é escolhida pela pessoa, então a cor do ícone/texto por cima
// precisa ser calculada, não fixa em branco (amarelo, verde-claro e azul-claro
// com texto branco ficavam ilegíveis). Funções puras, testadas em
// tests/unit/cor.test.js.

export const TEXTO_CLARO = '#FFFFFF';
export const TEXTO_ESCURO = '#0F172A';

// "#abc" | "#aabbcc" | "aabbcc" → [r, g, b] (0–255), ou null se inválido.
export function hexParaRgb(hex) {
  let h = String(hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

// Luminância relativa (WCAG): 0 = preto, 1 = branco.
export function luminancia(hex) {
  const rgb = hexParaRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// Razão de contraste entre duas cores (1 a 21).
export function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  if (la == null || lb == null) return 1;
  const [claro, escuro] = la > lb ? [la, lb] : [lb, la];
  return (claro + 0.05) / (escuro + 0.05);
}

// Branco ou quase-preto, o que tiver MAIS contraste com o fundo.
export function corDoTexto(fundo) {
  return contraste(fundo, TEXTO_CLARO) >= contraste(fundo, TEXTO_ESCURO) ? TEXTO_CLARO : TEXTO_ESCURO;
}
