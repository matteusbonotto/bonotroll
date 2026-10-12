// Regras de cálculo do IRPF, VERSIONADAS POR EXERCÍCIO. Cada número tem a
// fonte oficial ao lado (ver docs/IRPF-INVESTIGACAO.md). Valores em centavos.
// Nunca supor que o formato/limite de um exercício vale para o seguinte:
// exercício novo = bloco novo aqui, com a fonte dele.

const FONTE_2025 = 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2025';
const FONTE_2026 = 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/tabelas/2026';

export const REGRAS = {
  2026: {
    exercicio: 2026,
    anoCalendario: 2025,
    // Programa e IN publicados (IN RFB nº 2.312/2026): fichas e códigos
    // conferíveis. Entrega encerrada em 29/05/2026.
    programaOficialPublicado: true,
    tabelaAnual: [
      { ate: 2846720, aliquota: 0, deduzir: 0 },
      { ate: 3391980, aliquota: 0.075, deduzir: 213504 },
      { ate: 4501260, aliquota: 0.15, deduzir: 467903 },
      { ate: 5597616, aliquota: 0.225, deduzir: 805497 },
      { ate: Infinity, aliquota: 0.275, deduzir: 1085378 },
    ],
    deducaoDependente: 227508,
    limiteInstrucaoPorPessoa: 356150,
    descontoSimplificado: { percentual: 0.2, limite: 1675434 }, // P&R IRPF 2026, pergunta 012
    redutor: null,
    obrigatoriedade: { rendimentosTributaveis: 3558400, isentosExclusivos: 20000000, bens: 80000000 }, // IN RFB 2.312/2026
    fontes: [FONTE_2025, 'https://www.gov.br/receitafederal/pt-br/assuntos/meu-imposto-de-renda/quem'],
  },
  2027: {
    exercicio: 2027,
    anoCalendario: 2026,
    // Tabela e redutor publicados; a IN, o programa e a lista de códigos do
    // exercício 2027 AINDA NÃO (saem em fev–mar/2027).
    programaOficialPublicado: false,
    tabelaAnual: [
      { ate: 2914560, aliquota: 0, deduzir: 0 },
      { ate: 3391980, aliquota: 0.075, deduzir: 218592 },
      { ate: 4501260, aliquota: 0.15, deduzir: 472991 },
      { ate: 5597616, aliquota: 0.225, deduzir: 810585 },
      { ate: Infinity, aliquota: 0.275, deduzir: 1090466 },
    ],
    deducaoDependente: 227508,
    limiteInstrucaoPorPessoa: 356150,
    descontoSimplificado: { percentual: 0.2, limite: 1764000 },
    // Lei 15.270/2025 — redução do imposto anual.
    redutor: { isentoAte: 6000000, reducaoMaxima: 269415, constante: 842973, fator: 0.095575, ate: 8820000 },
    obrigatoriedade: null, // não publicada
    altaRendaAPartirDe: 60000000, // tributação mínima: fora do escopo, só avisa
    fontes: [FONTE_2026],
  },
};

export function exerciciosDisponiveis() {
  return Object.keys(REGRAS).map(Number).sort((a, b) => b - a);
}

export function regrasDo(exercicio) {
  const r = REGRAS[exercicio];
  if (!r) throw new Error(`Exercício ${exercicio} não suportado.`);
  return r;
}

// Imposto pela tabela progressiva anual (centavos → centavos, arredondado).
export function impostoPelaTabela(baseCentavos, regras) {
  if (baseCentavos <= 0) return 0;
  const faixa = regras.tabelaAnual.find((f) => baseCentavos <= f.ate);
  return Math.max(0, Math.round(baseCentavos * faixa.aliquota) - faixa.deduzir);
}

// Redução da Lei 15.270/2025 (só exercícios que têm `redutor`). Usa os
// rendimentos tributáveis sujeitos ao ajuste, não a base de cálculo.
export function reducaoDoImposto(rendimentosTributaveis, impostoTabela, regras) {
  const r = regras.redutor;
  if (!r || impostoTabela <= 0) return 0;
  if (rendimentosTributaveis <= r.isentoAte) return Math.min(impostoTabela, r.reducaoMaxima);
  if (rendimentosTributaveis <= r.ate) {
    const reducao = Math.round(r.constante - r.fator * rendimentosTributaveis);
    return Math.max(0, Math.min(impostoTabela, reducao));
  }
  return 0;
}
