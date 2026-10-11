import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarFila, houveConflito, esperaDaTentativa, ehErroDeRede, MAX_TENTATIVAS } from '../../js/data/filaSync.js';

// "Banco" falso que se comporta como o Postgres para o que importa aqui:
// insert com id repetido falha com 23505; update troca campos.
function servidorFalso() {
  const linhas = new Map();
  let fora = false;
  const executor = async (op) => {
    if (fora) throw new TypeError('Failed to fetch');
    if (op.tipo === 'insert') {
      if (linhas.has(op.registroId)) return {}; // 23505 tratado como sucesso
      linhas.set(op.registroId, { ...op.dados, id: op.registroId });
      return {};
    }
    const atual = linhas.get(op.registroId);
    if (!atual) return { conflito: true, atual: null };
    if (!op.forcar && houveConflito(op.base, atual)) return { conflito: true, atual };
    linhas.set(op.registroId, { ...atual, ...op.dados });
    return {};
  };
  return { linhas, executor, cair: () => (fora = true), voltar: () => (fora = false) };
}

function armazenamentoEmMemoria() {
  const mapa = new Map();
  return {
    mapa,
    listar: async () => [...mapa.values()].map((o) => structuredClone(o)),
    gravar: async (op) => mapa.set(op.id, structuredClone(op)),
    remover: async (id) => mapa.delete(id),
  };
}

const sempreOnline = { disponivel: async () => true };

test('lançamento feito offline é enviado uma vez só, mesmo se reenviado (idempotência)', async () => {
  const srv = servidorFalso();
  const arm = armazenamentoEmMemoria();
  const fila = criarFila({ armazenamento: arm, executor: srv.executor });
  await fila.enfileirar({ tabela: 'transactions', tipo: 'insert', registroId: 't1', dados: { titulo: 'Luz', valor: 120 } });
  // Simula a resposta do servidor se perdendo: o insert entrou, mas a fila
  // não ficou sabendo e manda de novo.
  srv.linhas.set('t1', { id: 't1', titulo: 'Luz', valor: 120 });
  const r = await fila.processar(sempreOnline);
  assert.equal(r.feitas, 1);
  assert.equal(srv.linhas.size, 1);
  assert.equal(arm.mapa.size, 0, 'operação concluída sai do armazenamento');
});

test('a fila sobrevive a recarregar a página (armazenamento durável)', async () => {
  const arm = armazenamentoEmMemoria();
  const f1 = criarFila({ armazenamento: arm, executor: async () => ({}) });
  await f1.enfileirar({ tabela: 'transactions', tipo: 'insert', registroId: 't1', dados: { titulo: 'A' } });
  await f1.enfileirar({ tabela: 'transactions', tipo: 'insert', registroId: 't2', dados: { titulo: 'B' } });
  const f2 = criarFila({ armazenamento: arm, executor: async () => ({}) });
  assert.equal(await f2.carregar(), 2);
  assert.deepEqual(f2.listar().map((o) => o.registroId), ['t1', 't2'], 'mesma ordem');
});

test('"voltou a internet" sem servidor de verdade não envia nada', async () => {
  const srv = servidorFalso();
  const fila = criarFila({ armazenamento: armazenamentoEmMemoria(), executor: srv.executor });
  await fila.enfileirar({ tabela: 'transactions', tipo: 'insert', registroId: 't1', dados: {} });
  const r = await fila.processar({ disponivel: async () => false });
  assert.equal(r.semServidor, true);
  assert.equal(srv.linhas.size, 0);
  assert.equal(fila.resumo().pendentes, 1);
});

test('conexão cai no meio do envio: para e mantém o resto pendente', async () => {
  const srv = servidorFalso();
  let caiu = false;
  const fila = criarFila({ armazenamento: armazenamentoEmMemoria(), executor: async (op) => { if (op.registroId === 't2' && !caiu) { caiu = true; srv.cair(); } return srv.executor(op); } });
  for (const id of ['t1', 't2', 't3']) await fila.enfileirar({ tabela: 'transactions', tipo: 'insert', registroId: id, dados: {} });
  const r = await fila.processar(sempreOnline);
  assert.equal(r.feitas, 1);
  assert.equal(r.semServidor, true);
  assert.equal(fila.resumo().pendentes, 2);
  srv.voltar();
  assert.equal((await fila.processar(sempreOnline)).feitas, 2);
});

test('edição atrasada NÃO sobrescreve um dado mais novo do servidor (conflito)', async () => {
  const srv = servidorFalso();
  srv.linhas.set('t1', { id: 't1', valor: 100, titulo: 'Luz' });
  const fila = criarFila({ armazenamento: armazenamentoEmMemoria(), executor: srv.executor });
  // No aparelho (offline): valor 100 → 150.
  await fila.enfileirar({ tabela: 'transactions', tipo: 'update', registroId: 't1', dados: { valor: 150 }, base: { valor: 100 } });
  // Enquanto isso, outra pessoa mudou para 130 no servidor.
  srv.linhas.get('t1').valor = 130;
  const r = await fila.processar(sempreOnline);
  assert.equal(r.conflitos, 1);
  assert.equal(srv.linhas.get('t1').valor, 130, 'servidor intacto');
  const [conflito] = fila.resumo().conflitos;
  assert.equal(conflito.servidor.valor, 130);

  await fila.resolverConflito(conflito.id, 'minha');
  await fila.processar(sempreOnline);
  assert.equal(srv.linhas.get('t1').valor, 150, '"manter a minha" envia a versão do aparelho');
});

test('conflito: "ficar com a do servidor" descarta a edição local', async () => {
  const srv = servidorFalso();
  srv.linhas.set('t1', { id: 't1', valor: 130 });
  const fila = criarFila({ armazenamento: armazenamentoEmMemoria(), executor: srv.executor });
  await fila.enfileirar({ tabela: 'transactions', tipo: 'update', registroId: 't1', dados: { valor: 150 }, base: { valor: 100 } });
  await fila.processar(sempreOnline);
  await fila.resolverConflito(fila.resumo().conflitos[0].id, 'servidor');
  assert.equal(fila.listar().length, 0);
  assert.equal(srv.linhas.get('t1').valor, 130);
});

test('campo não editado pode mudar no servidor sem gerar conflito; número x texto igual não é conflito', async () => {
  assert.equal(houveConflito({ valor: 100 }, { valor: 100, titulo: 'outro' }), false);
  assert.equal(houveConflito({ valor: '10.50' }, { valor: 10.5 }), false);
  assert.equal(houveConflito({ data_pagamento: null }, { data_pagamento: undefined }), false);
  assert.equal(houveConflito({ data_pagamento: null }, { data_pagamento: '2026-10-01' }), true);
  assert.equal(houveConflito({ valor: 1 }, null), true, 'registro excluído no servidor = conflito');
});

test('editar algo criado offline junta na inclusão (uma operação só)', async () => {
  const srv = servidorFalso();
  const fila = criarFila({ armazenamento: armazenamentoEmMemoria(), executor: srv.executor });
  await fila.enfileirar({ tabela: 'shopping_list_items', tipo: 'insert', registroId: 'i1', dados: { nome: 'Leite', comprado: false } });
  await fila.enfileirar({ tabela: 'shopping_list_items', tipo: 'update', registroId: 'i1', dados: { comprado: true }, base: { comprado: false } });
  assert.equal(fila.listar().length, 1);
  await fila.processar(sempreOnline);
  assert.equal(srv.linhas.get('i1').comprado, true);
});

test('duas edições offline do mesmo registro: guarda a base da primeira', async () => {
  const fila = criarFila({ armazenamento: armazenamentoEmMemoria(), executor: async () => ({}) });
  await fila.enfileirar({ tabela: 'resource_items', tipo: 'update', registroId: 'r1', dados: { quantidade: 2 }, base: { quantidade: 3 } });
  await fila.enfileirar({ tabela: 'resource_items', tipo: 'update', registroId: 'r1', dados: { quantidade: 1 }, base: { quantidade: 2 } });
  const [op] = fila.listar();
  assert.deepEqual(op.dados, { quantidade: 1 });
  assert.deepEqual(op.base, { quantidade: 3 });
});

test('erro que não é de rede: tenta de novo com espera crescente e desiste depois do limite', async () => {
  let t = 0;
  let chamadas = 0;
  const fila = criarFila({
    armazenamento: armazenamentoEmMemoria(),
    executor: async () => { chamadas++; throw new Error('new row violates row-level security policy'); },
    agora: () => t,
  });
  await fila.enfileirar({ tabela: 'transactions', tipo: 'insert', registroId: 't1', dados: {} });
  await fila.processar(sempreOnline);
  assert.equal(chamadas, 1);
  await fila.processar(sempreOnline);
  assert.equal(chamadas, 1, 'respeita a espera antes de tentar de novo');
  for (let i = 0; i < MAX_TENTATIVAS + 2; i++) {
    t += 400_000;
    await fila.processar(sempreOnline);
  }
  assert.equal(chamadas, MAX_TENTATIVAS);
  const { erros } = fila.resumo();
  assert.equal(erros.length, 1);
  assert.match(erros[0].erro, /row-level security/);
});

test('operação travada segura as seguintes DO MESMO registro, não as dos outros', async () => {
  const srv = servidorFalso();
  srv.linhas.set('t1', { id: 't1', valor: 999 });
  const fila = criarFila({ armazenamento: armazenamentoEmMemoria(), executor: srv.executor });
  await fila.enfileirar({ tabela: 'transactions', tipo: 'update', registroId: 't1', dados: { valor: 1 }, base: { valor: 0 } });
  await fila.enfileirar({ tabela: 'transactions', tipo: 'insert', registroId: 't2', dados: { valor: 2 } });
  const r = await fila.processar(sempreOnline);
  assert.equal(r.conflitos, 1);
  assert.equal(r.feitas, 1);
  assert.ok(srv.linhas.has('t2'));
});

test('a tela mostra o que ainda não foi enviado por cima da lista', async () => {
  const fila = criarFila({ armazenamento: armazenamentoEmMemoria(), executor: async () => ({}) });
  await fila.enfileirar({ tabela: 'transactions', tipo: 'insert', registroId: 'novo', dados: { titulo: 'Novo' } });
  await fila.enfileirar({ tabela: 'transactions', tipo: 'update', registroId: 'a', dados: { valor: 5 }, base: { valor: 1 } });
  await fila.enfileirar({ tabela: 'outra', tipo: 'insert', registroId: 'x', dados: {} });
  const linhas = fila.aplicarPendentes('transactions', [{ id: 'a', valor: 1 }, { id: 'b', valor: 2 }]);
  assert.deepEqual(linhas.map((l) => [l.id, l.valor ?? l.titulo, !!l._pendente]), [['a', 5, true], ['b', 2, false], ['novo', 'Novo', true]]);
});

test('erro de rede reconhecido; espera entre tentativas limitada a 5 min', () => {
  assert.equal(ehErroDeRede(new TypeError('Failed to fetch')), true);
  assert.equal(ehErroDeRede({ message: 'TypeError: NetworkError when attempting to fetch resource.' }), true);
  assert.equal(ehErroDeRede({ message: 'duplicate key value' }), false);
  assert.equal(esperaDaTentativa(1), 1000);
  assert.equal(esperaDaTentativa(3), 4000);
  assert.equal(esperaDaTentativa(30), 300_000);
});

test('operação inválida é recusada', async () => {
  const fila = criarFila({ armazenamento: armazenamentoEmMemoria(), executor: async () => ({}) });
  await assert.rejects(fila.enfileirar({ tabela: 'transactions', tipo: 'delete', registroId: 't1' }));
  await assert.rejects(fila.enfileirar({ tipo: 'insert', registroId: 't1' }));
});
