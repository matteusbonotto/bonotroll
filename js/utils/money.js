// Money Engine (Fase 3, docs/BONOTTO-2027-BLUEPRINT.md §9). O banco já usa
// numeric(12,2) — nunca float — pra dinheiro; o lado do cliente somava
// direto com Number (ponto flutuante binário), o que é exatamente a classe
// de erro que já causou os 3 bugs reais de soma documentados em Caixinhas
// (RAIO-X §20.5). Regra: qualquer SOMA/SUBTRAÇÃO/DIVISÃO de dinheiro passa
// por aqui (em centavos inteiros); formatação continua em js/utils/format.js
// e só acontece na borda de saída, nunca antes de somar.

function centavos(valor) {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

// Soma qualquer quantidade de valores (reais, string numérica ou já em
// centavos via {centavos: n}) sem acumular erro de ponto flutuante —
// soma os centavos como inteiro, só converte de volta no final.
export function somar(...valores) {
  const total = valores.reduce((acc, v) => acc + centavos(v), 0);
  return total / 100;
}

export function subtrair(a, b) {
  return (centavos(a) - centavos(b)) / 100;
}

// Divide um valor em `n` partes iguais que somam EXATAMENTE o valor
// original, centavo a centavo — nunca "quase igual" por arredondamento
// (a sobra de centavo, se houver, vai pra primeira parte, mesmo critério
// já usado em splitEqually() no formulário de transação).
export function dividirIgualmente(valor, n) {
  if (!n || n <= 0) return [];
  const totalCentavos = centavos(valor);
  const base = Math.floor(totalCentavos / n);
  const resto = totalCentavos - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i === 0 ? resto : 0)) / 100);
}

// Compara dois valores monetários pelo centavo — nunca com epsilon de
// ponto flutuante (`Math.abs(a-b) < 0.01`), que só seria necessário por
// causa do próprio problema que centavos inteiros elimina.
export function iguais(a, b) {
  return centavos(a) === centavos(b);
}

export function maiorQue(a, b) {
  return centavos(a) > centavos(b);
}

// Percentual de `parte` sobre `total` (0–100), 2 casas — usado por telas
// que mostram "72% do orçamento", "quanto falta pra meta" etc. Nunca reusa
// os centavos crus como percentual: divisão de inteiro por inteiro aqui já
// é segura (não acumula, é um cálculo único), só formaliza o cuidado com
// total 0 (não pode gerar Infinity/NaN na tela).
export function percentual(parte, total) {
  const t = centavos(total);
  if (!t) return 0;
  return Math.round((centavos(parte) / t) * 10000) / 100;
}
