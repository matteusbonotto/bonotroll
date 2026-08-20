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

function deslocarUmAno(isoDate) {
  const [ano, mes, dia] = isoDate.split('-').map(Number);
  // Mesma regra do 31/01→28-29/02 acima, mas pro caso raro de 29/02 num ano
  // que o ano seguinte não é bissexto.
  const ultimoDia = new Date(Date.UTC(ano + 1, mes, 0)).getUTCDate();
  const diaFinal = Math.min(dia, ultimoDia);
  return new Date(Date.UTC(ano + 1, mes - 1, diaFinal)).toISOString().slice(0, 10);
}

function deslocarDias(isoDate, dias) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + (Number(dias) || 30));
  return d.toISOString().slice(0, 10);
}

// Cadência configurável (ver supabase/schema.sql: recorrencia_tipo) — sem
// tipo definido (registro antigo, de antes dessa coluna existir) cai pro
// comportamento de sempre: mensal.
function proximaData(isoDate, tipo, intervaloDias) {
  if (tipo === 'semanal') return deslocarDias(isoDate, 7);
  if (tipo === 'anual') return deslocarUmAno(isoDate);
  if (tipo === 'personalizado') return deslocarDias(isoDate, intervaloDias);
  return deslocarUmMes(isoDate);
}

// Quantas ocorrências no máximo gerar de backfill numa única chamada, por
// cadência — evita uma enxurrada de lançamentos se o app ficar muito tempo
// sem ser aberto (mesma preocupação de antes, só que agora por cadência:
// semanal precisa de mais passos pra cobrir o mesmo período que 1 mensal).
const MAX_PASSOS_POR_TIPO = { semanal: 8, mensal: 3, anual: 1, personalizado: 12 };

// Gera automaticamente os lançamentos recorrentes (recorrente = true) que
// ainda não existem — só olha as transações do PRÓPRIO dono (não gera em
// nome de outro membro do grupo). Cada "série" é identificada por
// recorrencia_serie_id (gerado no formulário na primeira vez que a
// recorrência é ligada) — lançamentos antigos, de antes dessa coluna
// existir, caem no fallback título+categoria+tipo. Pega a ocorrência mais
// recente da série como modelo e avança cadência a cadência até alcançar
// hoje, pulando datas que já têm uma ocorrência (evita duplicar se a pessoa
// já lançou manualmente) e parando se a série tiver parcela_total definido
// e já tiver alcançado a última parcela.
export async function gerarRecorrentesPendentes({ ownerId, groupId }) {
  const todas = await listTransactions({ ownerId, groupId });
  const recorrentes = todas.filter((t) => t.recorrente && t.owner_id === ownerId);
  if (!recorrentes.length) return [];

  const chaveDaSerie = (t) => t.recorrencia_serie_id || `${t.titulo}::${t.categoria_id || ''}::${t.tipo}`;

  const series = new Map();
  for (const t of recorrentes) {
    const chave = chaveDaSerie(t);
    const atual = series.get(chave);
    if (!atual || t.data_cadastro > atual.data_cadastro) series.set(chave, t);
  }

  const hojeIso = new Date().toISOString().slice(0, 10);
  const criadas = [];

  for (const [chave, ultima] of series) {
    const datasExistentes = new Set(recorrentes.filter((t) => chaveDaSerie(t) === chave).map((t) => t.data_cadastro));

    let cursorCadastro = ultima.data_cadastro;
    let cursorVencimento = ultima.data_vencimento;
    let parcelaAtual = ultima.parcela_atual ?? null;
    let passos = 0;
    const maxPassos = MAX_PASSOS_POR_TIPO[ultima.recorrencia_tipo] || 3;
    let serieEncerrada = false;

    while (cursorCadastro < hojeIso && passos < maxPassos && !serieEncerrada) {
      const novaDataCadastro = proximaData(cursorCadastro, ultima.recorrencia_tipo, ultima.recorrencia_intervalo_dias);
      const novoVencimento = cursorVencimento ? proximaData(cursorVencimento, ultima.recorrencia_tipo, ultima.recorrencia_intervalo_dias) : null;
      cursorCadastro = novaDataCadastro;
      cursorVencimento = novoVencimento;
      passos++;

      if (parcelaAtual != null) parcelaAtual += 1;
      if (ultima.parcela_total != null && parcelaAtual != null && parcelaAtual > ultima.parcela_total) {
        serieEncerrada = true;
        break;
      }

      if (datasExistentes.has(cursorCadastro)) continue;

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
        recorrencia_tipo: ultima.recorrencia_tipo || null,
        recorrencia_intervalo_dias: ultima.recorrencia_intervalo_dias || null,
        recorrencia_serie_id: ultima.recorrencia_serie_id || null,
        parcela_atual: parcelaAtual,
        parcela_total: ultima.parcela_total ?? null,
        observacoes: ultima.observacoes,
      });
      criadas.push(nova);
      datasExistentes.add(cursorCadastro);
    }
  }

  return criadas;
}
