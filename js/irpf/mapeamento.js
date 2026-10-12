// Mapeamento campo interno → ficha/código OFICIAL do programa IRPF,
// versionado por exercício. `status`:
//   'oficial'  — ficha/código conferidos em documento da Receita (fonte ao lado)
//   'conferir' — só em guias de terceiros: o app mostra "confira no programa"
// O rótulo oficial NUNCA é trocado pela explicação: a explicação vai no
// balão de ajuda (`ajuda`), separada. Ver docs/IRPF-INVESTIGACAO.md §3.
//
// `natureza` diz como o valor entra na conta (calculo.js) — é o que impede
// somar categorias fiscalmente incompatíveis:
//   'tributavel' | 'deducao' | 'imposto_retido' | 'isento' | 'exclusivo' | 'bem' | 'divida'

const PR2026 = 'P&R IRPF 2026 (Receita Federal)';

export const FICHAS = [
  { id: 'rend_pj', nome: 'Rendimentos Tributáveis Recebidos de Pessoa Jurídica pelo Titular' },
  { id: 'isentos', nome: 'Rendimentos Isentos e Não Tributáveis' },
  { id: 'exclusivos', nome: 'Rendimentos Sujeitos à Tributação Exclusiva/Definitiva' },
  { id: 'pagamentos', nome: 'Pagamentos Efetuados' },
  { id: 'bens', nome: 'Bens e Direitos' },
  { id: 'dividas', nome: 'Dívidas e Ônus Reais' },
];

const CAMPOS_2026 = {
  rendimento_pj: {
    ficha: 'rend_pj', campoOficial: 'Rendimentos recebidos de pessoa jurídica', codigo: null, natureza: 'tributavel', status: 'oficial', fonte: PR2026,
    ajuda: {
      simples: 'Tudo o que a empresa pagou a você no ano e que paga imposto: salário, férias, horas extras.',
      exemplo: 'Salário de R$ 4.000 por mês durante 12 meses = R$ 48.000.',
      ondeAchar: 'No informe de rendimentos do empregador, quadro 3, linha "Total dos rendimentos (inclusive férias)".',
      naoConfundir: 'Não inclua o 13º salário (vai em Tributação Exclusiva) nem o que o banco depositou de outras origens.',
    },
  },
  previdencia_oficial: {
    ficha: 'rend_pj', campoOficial: 'Contribuição previdenciária oficial', codigo: null, natureza: 'deducao', status: 'oficial', fonte: PR2026,
    ajuda: {
      simples: 'O INSS (ou regime próprio do servidor) que foi descontado do seu salário.',
      exemplo: 'Desconto de R$ 400 de INSS por mês = R$ 4.800 no ano.',
      ondeAchar: 'Informe de rendimentos, quadro 3, linha "Contribuição previdenciária oficial".',
      naoConfundir: 'Previdência privada (PGBL) é outro campo, em Pagamentos Efetuados.',
    },
  },
  irrf: {
    ficha: 'rend_pj', campoOficial: 'Imposto retido na fonte', codigo: null, natureza: 'imposto_retido', status: 'oficial', fonte: PR2026,
    ajuda: {
      simples: 'O imposto de renda que a empresa já descontou do seu salário e pagou por você.',
      exemplo: 'R$ 150 descontados por mês = R$ 1.800 já pagos.',
      ondeAchar: 'Informe de rendimentos, quadro 3, linha "Imposto sobre a renda retido na fonte".',
      naoConfundir: 'O imposto retido sobre o 13º fica junto do 13º, em Tributação Exclusiva.',
    },
  },
  decimo_terceiro: {
    ficha: 'exclusivos', campoOficial: 'Décimo terceiro salário', codigo: '01', natureza: 'exclusivo', status: 'conferir', fonte: 'guias de terceiros',
    ajuda: {
      simples: 'O 13º salário já tem o imposto resolvido na fonte; ele é informado, mas não entra no cálculo do ajuste.',
      exemplo: '13º de R$ 4.000.',
      ondeAchar: 'Informe de rendimentos, quadro 5, linha "13º (décimo terceiro) salário".',
      naoConfundir: 'Não some ao salário dos Rendimentos Tributáveis — seria contar duas vezes.',
    },
  },
  rendimento_aplicacao: {
    ficha: 'exclusivos', campoOficial: 'Rendimentos de aplicações financeiras', codigo: '06', natureza: 'exclusivo', status: 'conferir', fonte: 'guias de terceiros',
    ajuda: {
      simples: 'O que seus investimentos de renda fixa (CDB, Tesouro, fundos) renderam; o banco já reteve o imposto.',
      exemplo: 'CDB rendeu R$ 320 no ano.',
      ondeAchar: 'Informe de rendimentos do banco ou corretora, seção "Rendimentos sujeitos à tributação exclusiva".',
      naoConfundir: 'Rendimento de poupança é isento — vai em outra ficha.',
    },
  },
  rendimento_poupanca: {
    ficha: 'isentos', campoOficial: 'Rendimentos de cadernetas de poupança, letras hipotecárias, LCA/LCI e CRA/CRI', codigo: '12', natureza: 'isento', status: 'conferir', fonte: 'guias de terceiros',
    ajuda: {
      simples: 'O que a poupança (e LCI/LCA) rendeu. Não paga imposto, mas precisa ser informado.',
      exemplo: 'Poupança rendeu R$ 85 no ano.',
      ondeAchar: 'Informe de rendimentos do banco, seção "Rendimentos isentos e não tributáveis".',
      naoConfundir: 'O SALDO da poupança vai em Bens e Direitos; aqui é só o que ela rendeu.',
    },
  },
  pagamento_instrucao: {
    ficha: 'pagamentos', campoOficial: 'Instrução no Brasil', codigo: '01', natureza: 'deducao', status: 'conferir', fonte: 'guias de terceiros', limite: 'instrucao',
    ajuda: {
      simples: 'Escola, faculdade, curso técnico ou pós. Tem teto por pessoa.',
      exemplo: 'Mensalidade de R$ 800 × 12 = R$ 9.600, mas só R$ 3.561,50 podem ser deduzidos.',
      ondeAchar: 'Recibos ou declaração anual da escola (com CNPJ).',
      naoConfundir: 'Curso de idioma, material e uniforme não são dedutíveis.',
    },
  },
  pagamento_medico: {
    ficha: 'pagamentos', campoOficial: 'Médicos no Brasil', codigo: '21', natureza: 'deducao', status: 'conferir', fonte: 'guias de terceiros',
    ajuda: {
      simples: 'Consultas e procedimentos pagos a médicos. Não tem teto, mas precisa de recibo com CPF/CNPJ.',
      exemplo: 'Consulta de R$ 350.',
      ondeAchar: 'Recibo ou nota fiscal do profissional/clínica.',
      naoConfundir: 'O que o plano reembolsou não pode ser deduzido.',
    },
  },
  pagamento_plano_saude: {
    ficha: 'pagamentos', campoOficial: 'Planos de saúde no Brasil', codigo: '26', natureza: 'deducao', status: 'conferir', fonte: 'guias de terceiros',
    ajuda: {
      simples: 'Mensalidades do plano de saúde do titular e dependentes.',
      exemplo: 'R$ 600 por mês = R$ 7.200 no ano.',
      ondeAchar: 'Informe anual da operadora do plano.',
      naoConfundir: 'Se o plano é pago pela empresa e descontado no salário, use o valor do informe da empresa.',
    },
  },
  pagamento_previdencia_complementar: {
    ficha: 'pagamentos', campoOficial: 'Previdência Complementar (inclusive FAPI)', codigo: '36', natureza: 'deducao', status: 'oficial', fonte: PR2026, limite: 'previdencia12',
    ajuda: {
      simples: 'Contribuições para plano PGBL. Pode deduzir até 12% dos rendimentos tributáveis.',
      exemplo: 'Renda de R$ 60.000: até R$ 7.200 de PGBL deduzem.',
      ondeAchar: 'Informe anual da seguradora/entidade de previdência.',
      naoConfundir: 'VGBL não deduz (vai em Bens e Direitos).',
    },
  },
  bem_conta_corrente: {
    ficha: 'bens', campoOficial: 'Depósito em conta corrente ou conta pagamento', codigo: '06.01', natureza: 'bem', status: 'oficial', fonte: PR2026,
    ajuda: {
      simples: 'O saldo que estava na conta no último dia do ano (31/12).',
      exemplo: 'Saldo de R$ 1.250,00 em 31/12.',
      ondeAchar: 'Informe de rendimentos do banco, campo "Saldo em 31/12".',
      naoConfundir: 'Não é a soma das entradas do ano — é só o saldo final.',
    },
  },
  bem_poupanca: {
    ficha: 'bens', campoOficial: 'Depósito em conta poupança', codigo: '04.01', natureza: 'bem', status: 'conferir', fonte: 'guias de terceiros',
    ajuda: {
      simples: 'Saldo da poupança em 31/12.',
      exemplo: 'R$ 3.000 guardados na poupança.',
      ondeAchar: 'Informe de rendimentos do banco.',
      naoConfundir: 'O rendimento da poupança vai em Rendimentos Isentos.',
    },
  },
  bem_aplicacao: {
    ficha: 'bens', campoOficial: 'Títulos públicos e privados sujeitos à tributação (Tesouro Direto, CDB, RDB e outros)', codigo: '04.02', natureza: 'bem', status: 'conferir', fonte: 'guias de terceiros',
    ajuda: {
      simples: 'Saldo das aplicações de renda fixa em 31/12.',
      exemplo: 'CDB com R$ 10.000 em 31/12.',
      ondeAchar: 'Informe do banco/corretora, posição em 31/12.',
      naoConfundir: 'Informe o valor aplicado/posição, não só o rendimento.',
    },
  },
  divida: {
    ficha: 'dividas', campoOficial: 'Dívidas e ônus reais', codigo: null, natureza: 'divida', status: 'conferir', fonte: 'guias de terceiros',
    ajuda: {
      simples: 'Empréstimos e financiamentos com saldo acima de R$ 5 mil em 31/12.',
      exemplo: 'Financiamento com R$ 20.000 ainda a pagar.',
      ondeAchar: 'Informe anual do banco sobre empréstimos.',
      naoConfundir: 'Financiamento de imóvel/veículo já declarado como bem tem regra própria.',
    },
  },
};

// 2027: mesma estrutura, mas TODO código vira 'conferir' até o programa do
// exercício 2027 sair — não se presume que os códigos se mantêm.
const CAMPOS_2027 = Object.fromEntries(
  Object.entries(CAMPOS_2026).map(([k, v]) => [k, { ...v, status: 'conferir', fonte: 'aguardando programa IRPF 2027' }])
);

const POR_EXERCICIO = { 2026: CAMPOS_2026, 2027: CAMPOS_2027 };

export function camposDo(exercicio) {
  const c = POR_EXERCICIO[exercicio];
  if (!c) throw new Error(`Sem mapeamento para o exercício ${exercicio}.`);
  return c;
}

export function campo(exercicio, chave) {
  return camposDo(exercicio)[chave] || null;
}

export function nomeDaFicha(id) {
  return FICHAS.find((f) => f.id === id)?.nome || id;
}

export const CHAVES_DE_CAMPO = Object.keys(CAMPOS_2026);
