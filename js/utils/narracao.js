// Narração (Configurações → Narração): o app lê em voz alta o que a pessoa
// toca ou foca — para quem enxerga pouco, ainda está aprendendo a ler, ou
// prefere ouvir. Usa a voz do próprio aparelho (speechSynthesis), sem enviar
// nada para fora. Não substitui TalkBack/VoiceOver; é um apoio simples.
const ALVOS = 'button, a, [role="button"], input, select, textarea, h1, h2, h3, .cg-atencao__item, .cg-tx-linha__abrir';

let ligada = false;
let instalada = false;
let ultimo = { el: null, quando: 0 };

export function vozDisponivel() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

const limpar = (t) => (t || '').replace(/\s+/g, ' ').trim();

// Texto que faz sentido ouvir para um elemento (puro o bastante para testar).
export function textoDoElemento(el) {
  if (!el) return '';
  const rotulo = el.getAttribute?.('aria-label');
  if (el.matches?.('input, select, textarea')) {
    const lbl = el.labels?.[0]?.textContent || rotulo || el.placeholder || '';
    if (el.type === 'checkbox' || el.type === 'radio') return limpar(`${lbl}, ${el.checked ? 'marcado' : 'desmarcado'}`);
    if (el.type === 'password') return limpar(`${lbl}, campo de senha`);
    const valor = el.tagName === 'SELECT' ? el.selectedOptions?.[0]?.textContent : el.value;
    return limpar(`${lbl}${valor ? ', ' + valor : ', vazio'}`);
  }
  return limpar(rotulo || el.innerText || el.textContent || el.title).slice(0, 240);
}

export function falar(texto) {
  if (!vozDisponivel() || !texto) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'pt-BR';
  u.rate = 0.95;
  const voz = window.speechSynthesis.getVoices().find((v) => (v.lang || '').toLowerCase().startsWith('pt'));
  if (voz) u.voice = voz;
  window.speechSynthesis.speak(u);
}

function aoInteragir(ev) {
  if (!ligada) return;
  const el = ev.target?.closest?.(ALVOS);
  if (!el) return;
  // Toque gera "focus" e "click" no mesmo elemento: fala uma vez só.
  const agora = Date.now();
  if (ultimo.el === el && agora - ultimo.quando < 800) return;
  ultimo = { el, quando: agora };
  falar(textoDoElemento(el));
}

export function ligarNarracao(on) {
  ligada = !!on && vozDisponivel();
  if (ligada && !instalada) {
    document.addEventListener('click', aoInteragir, true);
    document.addEventListener('focusin', aoInteragir, true);
    instalada = true;
  }
  if (!ligada && vozDisponivel()) window.speechSynthesis.cancel();
}

export const narracaoLigada = () => ligada;
