// Painel do dono (BNTT Business): um bloco por filial + resumo geral +
// sugestões do que fazer. Puro (sem tela, sem banco) — testado em
// tests/unit/painelNegocio.test.js.
//
// Regras, de propósito simples de explicar:
//   - mês = o que foi PAGO/RECEBIDO neste mês (data de pagamento);
//   - vencida = saída sem pagamento com vencimento antes de hoje;
//   - semana = saída sem pagamento vencendo de hoje até +7 dias;
//   - semáforo: vermelho se tem conta vencida ou gastou mais do que vendeu;
//     amarelo se tem conta na semana ou insumos acima de 40% das vendas;
//     verde nos outros casos.

const somar = (lista) => Math.round(lista.reduce((s, t) => s + (Number(t.valor) || 0), 0) * 100) / 100;
const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
const maisDias = (iso, n) => {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};
const reais = (v) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const LIMITE_INSUMOS = 0.4;

function numeros(transacoes, hoje, ehInsumo) {
  const mes = hoje.slice(0, 7);
  const pagasNoMes = transacoes.filter((t) => (t.data_pagamento || '').startsWith(mes));
  const vendas = somar(pagasNoMes.filter((t) => t.tipo === 'entrada'));
  const gastos = somar(pagasNoMes.filter((t) => t.tipo === 'saida'));
  const abertas = transacoes.filter((t) => t.tipo === 'saida' && !t.data_pagamento && t.data_vencimento);
  const vencidasLista = abertas.filter((t) => t.data_vencimento < hoje);
  const semanaLista = abertas.filter((t) => t.data_vencimento >= hoje && t.data_vencimento <= maisDias(hoje, 7));
  const insumos = somar(transacoes.filter((t) => t.tipo === 'saida' && ehInsumo(t) && ((t.data_pagamento || t.data_vencimento || '').startsWith(mes))));
  return {
    vendas,
    gastos,
    resultado: Math.round((vendas - gastos) * 100) / 100,
    vencidas: { n: vencidasLista.length, valor: somar(vencidasLista), lista: vencidasLista },
    semana: { n: semanaLista.length, valor: somar(semanaLista) },
    insumosPct: vendas > 0 ? Math.round((insumos / vendas) * 100) : 0,
  };
}

function semaforo(n) {
  if (n.vencidas.n > 0) return { status: 'alerta', motivo: `Conta vencida: ${reais(n.vencidas.valor)}` };
  if (n.resultado < 0) return { status: 'alerta', motivo: 'Gastou mais do que vendeu' };
  if (n.insumosPct > LIMITE_INSUMOS * 100) return { status: 'atencao', motivo: `Insumos em ${n.insumosPct}% das vendas` };
  if (n.semana.n > 0) return { status: 'atencao', motivo: `${reais(n.semana.valor)} vencem esta semana` };
  return { status: 'ok', motivo: 'Tudo em dia' };
}

// ehInsumo(t): diz se o lançamento é custo de insumo (ex.: categoria "Insumos").
export function resumoDasFiliais(transacoes, unidades, { hoje, ehInsumo = () => false } = {}) {
  return unidades.map((u) => {
    const n = numeros(transacoes.filter((t) => t.unidade_id === u.id), hoje, ehInsumo);
    return { id: u.id, nome: u.nome, ...n, ...semaforo(n) };
  });
}

export function resumoGeral(transacoes, { hoje, ehInsumo = () => false } = {}) {
  const n = numeros(transacoes, hoje, ehInsumo);
  return { ...n, ...semaforo(n) };
}

// Até 3 sugestões, da mais urgente para a menos.
export function sugestoesDoDia(filiais, geral, { hoje } = {}) {
  const s = [];
  const vencidas = [...geral.vencidas.lista].sort((a, b) => b.valor - a.valor);
  for (const t of vencidas.slice(0, 2)) {
    const dias = diasEntre(t.data_vencimento, hoje);
    const onde = filiais.find((f) => f.id === t.unidade_id)?.nome;
    s.push({ icone: 'bi-exclamation-triangle-fill', nivel: 'alerta', unidadeId: t.unidade_id || null,
      texto: `Pague ${t.titulo.replace(/ — .*$/, '')}${onde ? ` da ${onde.replace(/^Padaria /, '')}` : ''}: ${reais(t.valor)}, venceu há ${dias} ${dias === 1 ? 'dia' : 'dias'}.` });
  }
  for (const f of filiais.filter((x) => x.resultado < 0)) {
    s.push({ icone: 'bi-graph-down-arrow', nivel: 'alerta', unidadeId: f.id, texto: `Na ${f.nome}, os gastos passaram das vendas em ${reais(-f.resultado)}. Veja o que pesou.` });
  }
  for (const f of filiais.filter((x) => x.insumosPct > LIMITE_INSUMOS * 100)) {
    s.push({ icone: 'bi-basket2-fill', nivel: 'atencao', unidadeId: f.id, texto: `Insumos da ${f.nome} em ${f.insumosPct}% das vendas. Vale comparar fornecedores.` });
  }
  if (geral.semana.n > 0) {
    s.push({ icone: 'bi-calendar-week', nivel: 'atencao', unidadeId: null, texto: `Separe ${reais(geral.semana.valor)} para as ${geral.semana.n} contas desta semana.` });
  }
  const melhor = [...filiais].sort((a, b) => b.vendas - a.vendas)[0];
  if (melhor && melhor.vendas > 0) {
    s.push({ icone: 'bi-trophy-fill', nivel: 'ok', unidadeId: melhor.id, texto: `A ${melhor.nome} é a que mais vende: ${reais(melhor.vendas)} no mês.` });
  }
  return s.slice(0, 3);
}
