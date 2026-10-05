import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { TODOS_OS_PLANOS } from '../../js/data/planos.js';
import { ehErroDeLimite, motivoDoLimite } from '../../js/services/assinatura.js';

// Os limites existem em dois lugares: js/data/planos.js (tela) e o banco
// (supabase/seguranca-planos-2026-10.sql — a trava de verdade). Este teste
// falha se um mudar sem o outro.
const sql = fs.readFileSync(new URL('../../supabase/seguranca-planos-2026-10.sql', import.meta.url), 'utf8');
const json = /select \(\(\s*'(\{[\s\S]*?\})'::jsonb\) -> plano ->> recurso\)::int/.exec(sql)[1];
const NO_BANCO = JSON.parse(json);

test('todo plano do app existe no banco', () => {
  assert.deepEqual(Object.keys(NO_BANCO).sort(), TODOS_OS_PLANOS.map((p) => p.id).sort());
});

test('limites numéricos iguais no app e no banco', () => {
  for (const p of TODOS_OS_PLANOS) {
    for (const recurso of ['pessoas', 'lancamentosMes', 'listas', 'unidades']) {
      const app = p.limites[recurso] ?? null;
      const banco = NO_BANCO[p.id][recurso] ?? null;
      assert.equal(banco, app, `${p.id}.${recurso}: banco=${banco} app=${app}`);
    }
  }
});

test('fichas de saúde: liberadas nos mesmos planos', () => {
  for (const p of TODOS_OS_PLANOS) {
    const app = p.recursos.saude !== false;
    const banco = (NO_BANCO[p.id].saude ?? 1) === 1;
    assert.equal(banco, app, p.id);
  }
});

test('erro do banco por limite vira aviso de plano', () => {
  const msg = 'BNTT_LIMITE: lancamentosMes (30 por mês no seu plano)';
  assert.equal(ehErroDeLimite(msg), true);
  assert.match(motivoDoLimite(msg), /limite de lançamentos/);
  assert.equal(ehErroDeLimite('Failed to fetch'), false);
});
