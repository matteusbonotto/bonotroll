// Resumo e ESTIMATIVA PRELIMINAR do IRPF — função pura, centavos inteiros.
// Não é o cálculo oficial (quem calcula é o programa da Receita). Regras:
// - Só entra na conta o que a pessoa CONFIRMOU (ou corrigiu/digitou). O que
//   a extração sugeriu e ninguém conferiu fica de fora e vira pendência.
// - Cada natureza fiscal soma separada (mapeamento.js → natureza): isento e
//   exclusivo NUNCA entram na base de cálculo; 13º nunca soma ao salário.
// - Documento duplicado (ou a cópia não escolhida) não entra. O mesmo campo
//   da mesma fonte, no mesmo ano e referência, conta UMA vez — valores
//   diferentes viram divergência.
// - Faltou o essencial → resultado marcado como parcial, com o que falta.
import { regrasDo, impostoPelaTabela, reducaoDoImposto } from './regras.js';
import { camposDo } from './mapeamento.js';

const CONTA = new Set(['confirmado', 'corrigido']);

function itemConta(item) {
  return item.centavos != null && (item.origem === 'manual' || CONTA.has(item.revisao));
}

export function calcularResumo({ exercicio, documentos = [], itens = [], dependentes = [], respostas = {} }) {
  const regras = regrasDo(exercicio);
  const campos = camposDo(exercicio);
  const docPorId = new Map(documentos.map((d) => [d.id, d]));
  const pendencias = [];
  const divergencias = [];
  const avisos = [];

  // 1) Documentos que não contam.
  const docForaDaConta = (d) => !d || d.status === 'duplicado' || d.status === 'rejeitado' || d.vale === false;
  for (const d of documentos) {
    if (d.status === 'nao_identificado') pendencias.push({ tipo: 'documento', ref: d.id, texto: `"${d.nome}": não reconheci o documento. Diga o que é ou digite os valores.` });
    if (d.status === 'duplicado' && d.vale !== true) continue;
    if (d.anoCalendario && d.anoCalendario !== regras.anoCalendario && d.status !== 'rejeitado') {
      divergencias.push({ ref: d.id, texto: `"${d.nome}" é do ano-calendário ${d.anoCalendario}, mas este exercício (${regras.exercicio}) é do ano ${regras.anoCalendario}. Os valores dele não entram.` });
    }
  }

  // 2) Itens que contam, sem contar duas vezes.
  const vistos = new Map(); // chave lógica → item
  const usados = [];
  for (const it of itens) {
    const def = campos[it.campo];
    if (!def) continue;
    const doc = it.documentoId ? docPorId.get(it.documentoId) : null;
    if (it.documentoId && docForaDaConta(doc)) continue;
    if (doc?.anoCalendario && doc.anoCalendario !== regras.anoCalendario) continue;
    if (it.revisao === 'inconsistente') {
      pendencias.push({ tipo: 'item', ref: it.id, texto: `${def.campoOficial}: marcado como inconsistente — corrija ou exclua.` });
      continue;
    }
    if (!itemConta(it)) {
      if (it.centavos == null) pendencias.push({ tipo: 'item', ref: it.id, texto: `${def.campoOficial}: valor ilegível — digite o valor do documento.` });
      else pendencias.push({ tipo: 'item', ref: it.id, texto: `${def.campoOficial}: confira e confirme o valor sugerido.` });
      continue;
    }
    const fonte = it.fonteDocumento || doc?.instituicaoDocumento || it.documentoId || it.id;
    const chave = `${it.campo}|${fonte}|${it.referencia || ''}|${it.beneficiario || 'titular'}`;
    const anterior = vistos.get(chave);
    if (anterior && def.natureza !== 'deducao') {
      if (anterior.centavos !== it.centavos) {
        divergencias.push({ ref: it.id, texto: `${def.campoOficial}: a mesma fonte aparece com dois valores (${anterior.centavos / 100} e ${it.centavos / 100}). Só o primeiro entrou na conta — confira qual é o certo.` });
      }
      continue; // conta uma vez só
    }
    if (!anterior) vistos.set(chave, it);
    usados.push({ ...it, natureza: def.natureza, def });
  }

  // 3) Somas por natureza (nunca misturadas).
  const soma = (fn) => usados.filter(fn).reduce((s, i) => s + i.centavos, 0);
  const tributavel = soma((i) => i.natureza === 'tributavel');
  const previdenciaOficial = soma((i) => i.campo === 'previdencia_oficial');
  const irrf = soma((i) => i.natureza === 'imposto_retido');
  const isentos = soma((i) => i.natureza === 'isento');
  const exclusivos = soma((i) => i.natureza === 'exclusivo');

  // Instrução: teto POR PESSOA (titular e cada dependente).
  const instrucaoPorPessoa = new Map();
  for (const i of usados.filter((x) => x.campo === 'pagamento_instrucao')) {
    const quem = i.beneficiario || 'titular';
    instrucaoPorPessoa.set(quem, (instrucaoPorPessoa.get(quem) || 0) + i.centavos);
  }
  const instrucaoInformada = [...instrucaoPorPessoa.values()].reduce((a, b) => a + b, 0);
  const instrucaoDedutivel = [...instrucaoPorPessoa.values()].reduce((a, v) => a + Math.min(v, regras.limiteInstrucaoPorPessoa), 0);
  const medico = soma((i) => i.campo === 'pagamento_medico');
  const planoSaude = soma((i) => i.campo === 'pagamento_plano_saude');
  const previdenciaComplementarInformada = soma((i) => i.campo === 'pagamento_previdencia_complementar');
  const previdenciaComplementar = Math.min(previdenciaComplementarInformada, Math.round(tributavel * 0.12));
  const dependentesValor = dependentes.length * regras.deducaoDependente;

  // 4) Completo x simplificado (o programa oficial também compara os dois).
  const deducoesCompleto = previdenciaOficial + dependentesValor + instrucaoDedutivel + medico + planoSaude + previdenciaComplementar;
  const calcular = (deducao) => {
    const base = Math.max(0, tributavel - deducao);
    const impostoTabela = impostoPelaTabela(base, regras);
    const reducao = reducaoDoImposto(tributavel, impostoTabela, regras);
    const devido = Math.max(0, impostoTabela - reducao);
    return { deducao, base, impostoTabela, reducao, devido, saldo: devido - irrf };
  };
  const completo = calcular(deducoesCompleto);
  const simplificado = calcular(Math.min(Math.round(tributavel * regras.descontoSimplificado.percentual), regras.descontoSimplificado.limite));
  const melhor = simplificado.devido <= completo.devido ? 'simplificado' : 'completo';
  const escolhido = melhor === 'simplificado' ? simplificado : completo;

  // 5) Bens e dívidas (só listagem — não somam com renda).
  const bens = usados.filter((i) => i.natureza === 'bem').map((i) => ({ campo: i.campo, rotulo: i.def.campoOficial, codigo: i.def.codigo, referencia: i.referencia, centavos: i.centavos, documentoId: i.documentoId, fonte: i.fonteNome || docPorId.get(i.documentoId)?.instituicaoNome || '' }));
  const dividas = usados.filter((i) => i.natureza === 'divida').map((i) => ({ rotulo: i.def.campoOficial, centavos: i.centavos, documentoId: i.documentoId }));

  // 6) Quando o resultado é só parcial.
  const motivosParcial = [];
  if (!tributavel) motivosParcial.push('Nenhum rendimento tributável confirmado (informe de rendimentos do empregador ou outra fonte).');
  if (respostas.temDependentes == null) motivosParcial.push('Falta responder se você tem dependentes.');
  if (respostas.outrosRendimentos == null) motivosParcial.push('Falta responder se recebeu rendimentos sem documento importado (aluguel, pensão, trabalho como autônomo).');
  if (respostas.outrosRendimentos === true) motivosParcial.push('Você disse que teve rendimentos que o BNTT ainda não organiza (aluguel, pensão, trabalho como autônomo, exterior): a estimativa não os inclui. Lance-os no programa oficial.');
  if (respostas.temDependentes === true && !dependentes.length) motivosParcial.push('Você disse que tem dependentes, mas nenhum foi cadastrado.');
  if (pendencias.length) motivosParcial.push(`${pendencias.length} item(ns) aguardando sua conferência.`);
  if (divergencias.length) motivosParcial.push(`${divergencias.length} divergência(s) entre documentos.`);

  if (!regras.programaOficialPublicado) avisos.push(`O programa oficial do exercício ${regras.exercicio} ainda não foi publicado: tabela e redutor seguem a Receita, mas fichas e códigos podem mudar.`);
  if (regras.altaRendaAPartirDe && tributavel + isentos + exclusivos > regras.altaRendaAPartirDe) avisos.push('Rendimentos acima de R$ 600 mil no ano: a tributação mínima de altas rendas (Lei 15.270/2025) não é calculada aqui. Procure orientação.');
  if (previdenciaComplementarInformada > previdenciaComplementar) avisos.push('A previdência complementar passou de 12% dos rendimentos tributáveis: só o limite entra na dedução.');
  if (instrucaoInformada > instrucaoDedutivel) avisos.push('Despesas com instrução passaram do teto por pessoa: só o teto entra.');

  let obrigacao = 'indefinida';
  if (regras.obrigatoriedade) {
    const o = regras.obrigatoriedade;
    if (tributavel > o.rendimentosTributaveis || isentos + exclusivos > o.isentosExclusivos) obrigacao = 'obrigado';
    else obrigacao = 'talvez_nao';
  }

  return {
    exercicio: regras.exercicio,
    anoCalendario: regras.anoCalendario,
    preliminar: true,
    parcial: motivosParcial.length > 0,
    motivosParcial,
    totais: { tributavel, previdenciaOficial, irrf, isentos, exclusivos, instrucaoInformada, instrucaoDedutivel, medico, planoSaude, previdenciaComplementar, dependentes: dependentesValor },
    completo,
    simplificado,
    melhor,
    resultado: escolhido.saldo > 0 ? 'pagar' : escolhido.saldo < 0 ? 'restituir' : 'zero',
    valor: Math.abs(escolhido.saldo),
    bens,
    dividas,
    pendencias,
    divergencias,
    avisos,
    obrigacao,
    itensUsados: usados.map((i) => i.id),
  };
}
