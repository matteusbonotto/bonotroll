import { listTransactions, createTransaction } from './transactions.js';

// Empurra uma data ISO ("aaaa-mm-dd") um mês pra frente, grudando no último
// dia do mês seguinte quando o dia de origem não existe nele (ex.: 31/01 →
// 28/02 ou 29/02) — mesma regra que qualquer cobrança recorrente real usa.
function deslocarUmMes(isoDate) {
  const [ano, mes, dia] = isoDate.split('-').map(Number);
  const ultimoDiaMesSeguinte = new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate();
  const diaFinal = Math.min(dia, ultimoDiaMesSeguinte);
  return new Date(Date.UTC(ano, mes, diaFinal)).toISOString().slice(0, 10);
}

// Gera automaticamente os lançamentos recorrentes (recorrente = true) que
// ainda não existem pro mês atual — só olha as transações do PRÓPRIO dono
// (não gera em nome de outro membro do grupo). Cada "série" é identificada
// por título + categoria + tipo; pega a ocorrência mais recente de cada
// série como modelo e avança mês a mês até alcançar o mês atual, pulando
// meses que já têm uma ocorrência (evita duplicar se a pessoa já lançou
// manualmente). Limitado a 3 meses de backfill de uma vez pra não criar uma
// enxurrada de lançamentos se o app ficar muito tempo sem ser aberto.
export async function gerarRecorrentesPendentes({ ownerId, groupId }) {
  const todas = await listTransactions({ ownerId, groupId });
  const recorrentes = todas.filter((t) => t.recorrente && t.owner_id === ownerId);
  if (!recorrentes.length) return [];

  const series = new Map();
  for (const t of recorrentes) {
    const chave = `${t.titulo}::${t.categoria_id || ''}::${t.tipo}`;
    const atual = series.get(chave);
    if (!atual || t.data_cadastro > atual.data_cadastro) series.set(chave, t);
  }

  const mesAtual = new Date().toISOString().slice(0, 7);
  const criadas = [];

  for (const [, ultima] of series) {
    let cursorCadastro = ultima.data_cadastro;
    let cursorVencimento = ultima.data_vencimento;
    let mesCursor = ultima.data_cadastro.slice(0, 7);
    let passos = 0;

    while (mesCursor < mesAtual && passos < 3) {
      const novaDataCadastro = deslocarUmMes(cursorCadastro);
      const novoVencimento = cursorVencimento ? deslocarUmMes(cursorVencimento) : null;
      cursorCadastro = novaDataCadastro;
      cursorVencimento = novoVencimento;
      mesCursor = novaDataCadastro.slice(0, 7);
      passos++;

      const jaExiste = recorrentes.some(
        (t) =>
          t.titulo === ultima.titulo &&
          t.categoria_id === ultima.categoria_id &&
          t.tipo === ultima.tipo &&
          t.data_cadastro.slice(0, 7) === mesCursor
      );
      if (jaExiste) continue;

      const nova = await createTransaction({
        tipo: ultima.tipo,
        titulo: ultima.titulo,
        empresa_servico: ultima.empresa_servico,
        categoria_id: ultima.categoria_id,
        tipo_despesa: ultima.tipo_despesa,
        valor: ultima.valor,
        responsavel_id: ultima.responsavel_id,
        owner_id: ultima.owner_id,
        group_id: ultima.group_id,
        data_cadastro: novaDataCadastro,
        data_vencimento: novoVencimento,
        data_pagamento: null,
        recorrente: true,
        observacoes: ultima.observacoes,
      });
      criadas.push(nova);
    }
  }

  return criadas;
}
