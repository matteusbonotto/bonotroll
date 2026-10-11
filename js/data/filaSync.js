// Fila de operações feitas sem internet (2026-10-11) — núcleo PURO: não
// conhece IndexedDB nem Supabase. Quem guarda as operações é o `armazenamento`
// injetado ({ listar, gravar, remover }) e quem envia é o `executor`
// injetado (op → { conflito?, atual? }). Assim é testável com node --test
// (tests/unit/filaSync.test.js) e o mesmo código roda no navegador
// (js/data/offline.js liga isto ao IndexedDB e ao Supabase).
//
// Garantias:
// - Idempotência: o id do REGISTRO nasce no aparelho (crypto.randomUUID) e
//   vai junto no insert; reenviar a mesma inclusão dá "já existe" no banco,
//   que o executor trata como sucesso — nunca duplica.
// - Ordem: operações do mesmo registro saem na ordem em que foram feitas; se
//   uma falha, as seguintes dele esperam.
// - Conflito: uma edição guarda `base` (o valor de cada campo ANTES da
//   edição). Se o servidor tem outro valor nesse campo, alguém mudou depois —
//   a operação vira 'conflito' e espera a pessoa escolher. Nunca sobrescreve
//   calada um dado mais novo.
// - "Voltou a internet" não basta: processar() só começa se `disponivel()`
//   (ping real ao servidor) disser que sim.

export const MAX_TENTATIVAS = 8;

// 1 s, 2 s, 4 s… até 5 min entre tentativas de uma operação que falhou.
export function esperaDaTentativa(n) {
  return Math.min(1000 * 2 ** Math.max(0, n - 1), 300_000);
}

export function ehErroDeRede(e) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const m = `${e?.name || ''} ${e?.message || ''} ${e?.details || ''}`.toLowerCase();
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet_disconnected|timeout|aborted/.test(m);
}

// null, undefined e '' contam como "vazio"; número e texto numérico iguais
// ("10.50" x 10.5) contam como iguais — o Postgres devolve numeric como
// número e o formulário às vezes manda texto.
function mesmoValor(a, b) {
  const vazio = (v) => v === null || v === undefined || v === '';
  if (vazio(a) && vazio(b)) return true;
  if (vazio(a) || vazio(b)) return false;
  if (typeof a === 'object' || typeof b === 'object') return JSON.stringify(a) === JSON.stringify(b);
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na === nb;
  return String(a) === String(b);
}

// Algum campo que a pessoa editou mudou no servidor desde a versão que ela viu?
export function houveConflito(base, atual) {
  if (!base) return false;
  if (!atual) return true;
  return Object.keys(base).some((k) => !mesmoValor(base[k], atual[k]));
}

function novoId() {
  return globalThis.crypto?.randomUUID?.() || `op-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function criarFila({ armazenamento, executor, agora = () => Date.now(), maxTentativas = MAX_TENTATIVAS }) {
  let ops = [];

  const ordenar = () => ops.sort((a, b) => a.criadoEm - b.criadoEm || a.seq - b.seq);
  let seq = 0;

  return {
    async carregar() {
      ops = (await armazenamento.listar()) || [];
      seq = ops.reduce((m, o) => Math.max(m, o.seq || 0), 0);
      ordenar();
      return ops.length;
    },

    listar() {
      return ops.map((o) => ({ ...o }));
    },

    resumo() {
      return {
        pendentes: ops.filter((o) => o.estado === 'pendente').length,
        conflitos: ops.filter((o) => o.estado === 'conflito').map((o) => ({ ...o })),
        erros: ops.filter((o) => o.estado === 'erro').map((o) => ({ ...o })),
      };
    },

    // op: { tabela, tipo: 'insert' | 'update', registroId, dados, base? }
    async enfileirar(op) {
      if (!op?.tabela || !op?.registroId || !['insert', 'update'].includes(op.tipo)) throw new Error('Operação offline inválida.');
      // Editar algo que ainda nem foi enviado: junta na inclusão pendente
      // (uma operação a menos e nenhum conflito consigo mesmo).
      if (op.tipo === 'update') {
        const inclusao = ops.find((o) => o.tipo === 'insert' && o.registroId === op.registroId && o.estado === 'pendente');
        if (inclusao) {
          inclusao.dados = { ...inclusao.dados, ...op.dados };
          await armazenamento.gravar(inclusao);
          return { ...inclusao };
        }
        // Duas edições offline seguidas do mesmo registro: junta, mantendo a
        // base da PRIMEIRA (é ela que diz o que o servidor tinha).
        const edicao = ops.find((o) => o.tipo === 'update' && o.registroId === op.registroId && o.estado === 'pendente');
        if (edicao) {
          edicao.dados = { ...edicao.dados, ...op.dados };
          edicao.base = { ...(op.base || {}), ...(edicao.base || {}) };
          await armazenamento.gravar(edicao);
          return { ...edicao };
        }
      }
      const nova = {
        id: novoId(),
        seq: ++seq,
        tabela: op.tabela,
        tipo: op.tipo,
        registroId: op.registroId,
        dados: op.dados || {},
        base: op.base || null,
        forcar: false,
        criadoEm: agora(),
        tentativas: 0,
        proximaEm: 0,
        estado: 'pendente', // 'pendente' | 'conflito' | 'erro'
        erro: null,
        servidor: null,
      };
      ops.push(nova);
      ordenar();
      await armazenamento.gravar(nova);
      return { ...nova };
    },

    // Mostra na tela o que ainda não foi enviado, por cima do que veio do
    // servidor ou do cache: inclusões entram na lista, edições sobrepõem.
    aplicarPendentes(tabela, linhas) {
      if (!Array.isArray(linhas)) return linhas;
      const resultado = linhas.map((l) => ({ ...l }));
      for (const o of ops) {
        if (o.tabela !== tabela) continue;
        const i = resultado.findIndex((l) => l.id === o.registroId);
        if (o.tipo === 'insert' && i === -1) resultado.push({ ...o.dados, id: o.registroId, _pendente: true });
        else if (i !== -1) resultado[i] = { ...resultado[i], ...o.dados, _pendente: true };
      }
      return resultado;
    },

    async processar({ disponivel }) {
      const r = { feitas: 0, conflitos: 0, erros: 0, semServidor: false };
      if (!ops.some((o) => o.estado === 'pendente')) return r;
      if (!(await disponivel())) return { ...r, semServidor: true };
      const travados = new Set(); // registros com operação anterior não resolvida
      for (const op of [...ops]) {
        if (op.estado !== 'pendente' || travados.has(op.registroId)) {
          if (op.estado !== 'pendente') travados.add(op.registroId);
          continue;
        }
        if (op.proximaEm > agora()) {
          travados.add(op.registroId);
          continue;
        }
        try {
          const res = (await executor(op)) || {};
          if (res.conflito) {
            op.estado = 'conflito';
            op.servidor = res.atual ?? null;
            travados.add(op.registroId);
            r.conflitos++;
            await armazenamento.gravar(op);
          } else {
            ops = ops.filter((o) => o.id !== op.id);
            await armazenamento.remover(op.id);
            r.feitas++;
          }
        } catch (e) {
          if (ehErroDeRede(e)) {
            // Caiu a conexão no meio: para tudo, tenta de novo depois.
            r.semServidor = true;
            break;
          }
          op.tentativas += 1;
          op.erro = e?.message || String(e);
          op.proximaEm = agora() + esperaDaTentativa(op.tentativas);
          if (op.tentativas >= maxTentativas) {
            op.estado = 'erro';
            r.erros++;
          }
          travados.add(op.registroId);
          await armazenamento.gravar(op);
        }
      }
      return r;
    },

    // 'minha': envia a versão do aparelho mesmo assim · 'servidor': descarta
    // a operação (fica valendo o que está no servidor).
    async resolverConflito(id, escolha) {
      const op = ops.find((o) => o.id === id);
      if (!op) return false;
      if (escolha === 'servidor') {
        ops = ops.filter((o) => o.id !== id);
        await armazenamento.remover(id);
        return true;
      }
      op.forcar = true;
      op.estado = 'pendente';
      op.tentativas = 0;
      op.proximaEm = 0;
      op.erro = null;
      await armazenamento.gravar(op);
      return true;
    },

    // Operação que desistiu (erro definitivo): tentar de novo ou descartar.
    async tentarDeNovo(id) {
      const op = ops.find((o) => o.id === id);
      if (!op) return false;
      Object.assign(op, { estado: 'pendente', tentativas: 0, proximaEm: 0, erro: null });
      await armazenamento.gravar(op);
      return true;
    },

    async descartar(id) {
      ops = ops.filter((o) => o.id !== id);
      await armazenamento.remover(id);
    },
  };
}
