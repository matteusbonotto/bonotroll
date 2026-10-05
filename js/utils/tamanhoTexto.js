// Tamanho do texto em passos (Configurações → A− / A+). Escala o rem do app
// inteiro. Limites: 87,5% (um pouco menor) até 150% (bem grande) — acima
// disso os layouts de celular de 320px começam a quebrar.
// js/tema-inicial.js repete a leitura (script clássico, não importa módulo).
export const ESCALAS = [87.5, 100, 112.5, 125, 137.5, 150];
export const PADRAO = 100;

// Valores salvos pela versão anterior (botões Normal/Grande/Muito grande).
const LEGADO = { normal: 100, grande: 112.5, 'muito-grande': 125 };

export function normalizarEscala(valor) {
  if (valor === null || valor === undefined || valor === '') return PADRAO;
  if (valor in LEGADO) return LEGADO[valor];
  const n = Number(valor);
  if (!Number.isFinite(n)) return PADRAO;
  return ESCALAS.reduce((melhor, e) => (Math.abs(e - n) < Math.abs(melhor - n) ? e : melhor), PADRAO);
}

// direcao: +1 (A+) ou -1 (A−). Nos limites, fica onde está.
export function proximaEscala(atual, direcao) {
  const i = ESCALAS.indexOf(normalizarEscala(atual));
  return ESCALAS[Math.min(ESCALAS.length - 1, Math.max(0, i + Math.sign(direcao)))];
}

export const podeDiminuir = (atual) => normalizarEscala(atual) > ESCALAS[0];
export const podeAumentar = (atual) => normalizarEscala(atual) < ESCALAS[ESCALAS.length - 1];
