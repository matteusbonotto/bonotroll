import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumoDasFiliais, resumoGeral, sugestoesDoDia } from '../../js/utils/painelNegocio.js';

const hoje = '2026-10-05';
const unidades = [
  { id: 'a', nome: 'Padaria Centro' },
  { id: 'b', nome: 'Padaria Vila Nova' },
  { id: 'c', nome: 'Padaria Jardim' },
  { id: 'd', nome: 'Padaria Shopping' },
];
const tx = [
  // Centro: vendeu, pagou tudo → verde
  { unidade_id: 'a', tipo: 'entrada', valor: 3000, data_pagamento: '2026-10-04' },
  { unidade_id: 'a', tipo: 'saida', valor: 800, data_pagamento: '2026-10-03', data_vencimento: '2026-10-03', categoria: 'Insumos' },
  // Vila Nova: aluguel vencido → vermelho
  { unidade_id: 'b', tipo: 'entrada', valor: 2000, data_pagamento: '2026-10-04' },
  { unidade_id: 'b', tipo: 'saida', titulo: 'Aluguel — Vila Nova', valor: 2400, data_vencimento: '2026-10-02' },
  // Jardim: gastou mais do que vendeu → vermelho
  { unidade_id: 'c', tipo: 'entrada', valor: 1000, data_pagamento: '2026-10-04' },
  { unidade_id: 'c', tipo: 'saida', valor: 3800, data_pagamento: '2026-10-02' },
  // Shopping: insumos caros e conta na semana → amarelo
  { unidade_id: 'd', tipo: 'entrada', valor: 5000, data_pagamento: '2026-10-04' },
  { unidade_id: 'd', tipo: 'saida', valor: 2600, data_vencimento: '2026-10-07', categoria: 'Insumos' },
  // geral (sem filial)
  { unidade_id: null, tipo: 'saida', titulo: 'Folha de pagamento', valor: 18000, data_vencimento: '2026-10-09' },
  // mês passado não conta
  { unidade_id: 'a', tipo: 'entrada', valor: 99999, data_pagamento: '2026-09-30' },
];
const ehInsumo = (t) => t.categoria === 'Insumos';

test('semáforo de cada filial conta a história certa', () => {
  const f = Object.fromEntries(resumoDasFiliais(tx, unidades, { hoje, ehInsumo }).map((x) => [x.id, x]));
  assert.equal(f.a.status, 'ok');
  assert.equal(f.a.resultado, 2200);
  assert.equal(f.b.status, 'alerta');
  assert.match(f.b.motivo, /Conta vencida/);
  assert.equal(f.c.status, 'alerta');
  assert.equal(f.c.motivo, 'Gastou mais do que vendeu');
  assert.equal(f.d.status, 'atencao');
  assert.equal(f.d.insumosPct, 52);
});

test('resumo geral soma todas as filiais e o que é geral; ignora o mês passado', () => {
  const g = resumoGeral(tx, { hoje, ehInsumo });
  assert.equal(g.vendas, 11000);
  assert.equal(g.vencidas.n, 1);
  assert.equal(g.semana.n, 2);
});

test('sugestões: no máximo 3, a mais urgente primeiro', () => {
  const filiais = resumoDasFiliais(tx, unidades, { hoje, ehInsumo });
  const s = sugestoesDoDia(filiais, resumoGeral(tx, { hoje, ehInsumo }), { hoje });
  assert.equal(s.length, 3);
  assert.match(s[0].texto, /^Pague Aluguel da Vila Nova: .*venceu há 3 dias/);
  assert.equal(s[0].unidadeId, 'b');
  assert.match(s[1].texto, /Jardim, os gastos passaram das vendas/);
});
