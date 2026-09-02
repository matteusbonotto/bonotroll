// ---------- Agrupamento de transações por período (mês/ano) ----------
// Extraído de transactionTable.js::gruposPorPeriodo (que já resolvia 1
// nível — mês "aaaa-mm" — corretamente, incluindo o bug real já corrigido
// aqui: comparar "aaaa-mm" como string ingenuamente faz um mês FUTURO
// (ex.: recorrência já gerada com antecedência) aparecer antes do mês
// ATUAL, porque "2026-09" > "2026-08" na comparação de string). Este
// arquivo generaliza a mesma regra pra 2 níveis (Ano > Mês) sem duplicar a
// exceção: mês/ano atual sempre primeiro, "sem-data" sempre por último,
// resto ordenado do mais recente pro mais antigo.
//
// Decisão de divisão (arquitetura pedida: "aninhar o DADO, achatar a
// RENDERIZAÇÃO"): duas funções, não uma só.
//   - ordenarChavesPeriodo: só ORDENA chaves "aaaa-mm"/"sem-data". Pura,
//     sem dependência de forma de transação nenhuma — mais fácil de testar
//     isoladamente e reaproveitável se um dia aparecer um 3º lugar que
//     precise só da ordenação (ex.: outro agrupamento por período).
//   - agruparPorAnoMes: usa ordenarChavesPeriodo por baixo, mas devolve a
//     lista FLAT de seções de mês já decorada com os metadados de ano
//     (ano/isAnoAtual/anoLabel/primeiroDoAno) que o template vai usar pra
//     desenhar um cabeçalho de ano por cima das seções de mês. Continua
//     flat de propósito: o stack não tem partial/include, então um x-for
//     aninhado de verdade (ano -> mês) duplicaria os 3 blocos gigantes de
//     renderização de tabela/grade/mobile que já existem em
//     transactionTable.js/index.html. O template itera essa lista UMA VEZ
//     e usa `primeiroDoAno` pra saber quando inserir o cabeçalho do ano
//     antes da seção do mês corrente.
//
// Responsabilidade de apresentação fica FORA daqui de propósito: a função
// só marca `isAtual`/`isAnoAtual`, nunca decide texto ("Agora" vs "ago/26")
// — quem consome (o template) decide o rótulo. Mantém esta função sem
// nenhum conhecimento de string de exibição além do que `labelMes` (injetado
// pelo chamador) já devolve pro mês.

// Ordena chaves de período "aaaa-mm" (mais "sem-data", se presente) em 2
// níveis — ano, depois mês dentro do ano — preservando as regras já
// testadas em produção pra 1 nível:
//   - Ano atual sempre primeiro entre os anos (mesmo que exista um ano
//     FUTURO na lista, ex.: recorrência anual já gerada com antecedência —
//     não "fura fila" só por ser textualmente maior).
//   - Dentro do ano atual, mês atual sempre primeiro (mesma regra, 1 nível
//     abaixo).
//   - "sem-data" é seu próprio balde, sempre no fim da lista — depois de
//     todo ano/mês com data, nunca misturado a um ano de verdade.
//   - Fora dessas exceções, ordena do mais recente pro mais antigo — só
//     depois de já separados os casos especiais acima (comparação de
//     string "aaaa"/"aaaa-mm" ingênua só é segura nesse ponto, quando os
//     candidatos restantes já não incluem o atual/futuro-com-prioridade).
//
// mesAtualIso: "aaaa-mm" do mês de hoje — o chamador passa (nunca lê o
// relógio aqui dentro), mantendo a função pura e testável com qualquer
// data fixa.
export function ordenarChavesPeriodo(chaves, mesAtualIso) {
  const anoAtual = mesAtualIso ? mesAtualIso.slice(0, 4) : null;
  const semData = chaves.includes('sem-data');
  const comData = chaves.filter((c) => c !== 'sem-data');

  const porAno = new Map();
  for (const chave of comData) {
    const ano = chave.slice(0, 4);
    if (!porAno.has(ano)) porAno.set(ano, []);
    porAno.get(ano).push(chave);
  }

  const anos = [...porAno.keys()].sort((a, b) => {
    if (a === anoAtual) return -1;
    if (b === anoAtual) return 1;
    return b.localeCompare(a);
  });

  const resultado = [];
  for (const ano of anos) {
    const meses = porAno.get(ano).sort((a, b) => {
      if (a === mesAtualIso) return -1;
      if (b === mesAtualIso) return 1;
      return b.localeCompare(a);
    });
    resultado.push(...meses);
  }

  // "Sem data" sempre por último, no conjunto todo — como só existe 1
  // balde "sem-data" (não pertence a nenhum ano real), ele também já é
  // automaticamente "o último dentro do seu próprio ano", trivialmente.
  if (semData) resultado.push('sem-data');
  return resultado;
}

// Agrupa transações por mês ("aaaa-mm", "sem-data" pra quem não tem
// nenhuma das duas datas), na mesma forma que gruposPorPeriodo já devolvia
// (chave/label/isAtual/abertoPorPadrao/linhas/resumo) — só ACRESCENTANDO os
// campos de ano (ano/isAnoAtual/anoLabel/primeiroDoAno) que o template novo
// precisa pra desenhar o cabeçalho de Ano > Mês sem duplicar renderização.
//
// @param {Array<object>} transactions - linhas já filtradas/ordenadas (mesma entrada que gruposPorPeriodo recebia)
// @param {object} opts
// @param {string} opts.mesAtualIso - "aaaa-mm" de hoje (chamador passa; ver ordenarChavesPeriodo)
// @param {(t: object) => (string|null)} opts.extrairData - devolve a data "aaaa-mm-dd" (ou null/undefined) que define o período de uma linha (hoje: `t.data_vencimento || t.data_cadastro || null`)
// @param {(linhas: object[]) => object} opts.computeResumo - calcula o resumo (contagens/somas) de um grupo de linhas — mesmo formato de resumoGrupo hoje
// @param {(anoMes: string) => string} opts.labelMes - rótulo de exibição do mês (ex.: "ago/26", "Sem data") — mesma função já usada hoje em transactionTable.js
// @returns {Array<{
//   chave: string,            // "aaaa-mm" ou "sem-data" — únic0 na lista, serve de :key e de chave em overridesAbertura
//   label: string,            // rótulo do MÊS (ex. "ago/26") — igual ao que gruposPorPeriodo já devolvia
//   isAtual: boolean,         // true no mês de hoje — template decide "Agora" vs `label` a partir disto
//   abertoPorPadrao: boolean, // true no mês de hoje (mesma regra de sempre)
//   linhas: object[],
//   resumo: object,
//   ano: string,              // "aaaa" ou "sem-data" (pseudo-ano do balde sem data)
//   isAnoAtual: boolean,      // true quando `ano` é o ano de hoje
//   anoLabel: (string|null),  // "aaaa" pro template desenhar o cabeçalho de ano; null pro balde "sem-data" (o label do mês já diz "Sem data" — cabeçalho de ano duplicaria a mesma informação)
//   primeiroDoAno: boolean,   // true só na primeira seção de cada `ano`, na ordem final — é o gatilho pro template inserir o cabeçalho de ano ANTES desta seção de mês
// }>}
export function agruparPorAnoMes(transactions, { mesAtualIso, extrairData, computeResumo, labelMes }) {
  const anoAtual = mesAtualIso ? mesAtualIso.slice(0, 4) : null;

  const porMes = new Map();
  for (const t of transactions) {
    const base = extrairData(t);
    const anoMes = base ? base.slice(0, 7) : 'sem-data';
    if (!porMes.has(anoMes)) porMes.set(anoMes, []);
    porMes.get(anoMes).push(t);
  }

  const chavesOrdenadas = ordenarChavesPeriodo([...porMes.keys()], mesAtualIso);

  let anoAnterior = null;
  return chavesOrdenadas.map((anoMes) => {
    const linhas = porMes.get(anoMes);
    const ano = anoMes === 'sem-data' ? 'sem-data' : anoMes.slice(0, 4);
    const primeiroDoAno = ano !== anoAnterior;
    anoAnterior = ano;
    return {
      chave: anoMes,
      label: labelMes(anoMes),
      isAtual: anoMes === mesAtualIso,
      abertoPorPadrao: anoMes === mesAtualIso,
      linhas,
      resumo: computeResumo(linhas),
      ano,
      isAnoAtual: ano === anoAtual,
      anoLabel: ano === 'sem-data' ? null : ano,
      primeiroDoAno,
    };
  });
}
