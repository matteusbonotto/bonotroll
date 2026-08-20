// Exportação de dados (Fase 6, docs/BONOTTO-2027-BLUEPRINT.md §12 —
// "Future Scalability Boundary" mais barata: não é exigência legal hoje (2
// usuários, sem relação de controlador de dados de terceiro), mas fica caro
// de adicionar depois e não fecha nenhuma porta agora). Gera um JSON com
// tudo que a pessoa consegue VER hoje (próprio + compartilhado do grupo,
// mesmo alcance de qualquer tela do app — não tenta separar "só meu" de
// "do grupo", que é uma distinção ambígua pra dado compartilhado por design).
import { listTransactions, listPayersFor } from './transactions.js';
import { listAllItems as listResourceItems } from './resources.js';
import { listCaixinhas, listMovimentacoesFor } from './caixinhas.js';
import { listLists as listShoppingLists, listItems as listShoppingItems } from './shoppingList.js';
import { listBudgets } from './budgets.js';

export async function exportarMeusDados({ profile, categories, groupId }) {
  const ownerId = profile.id;

  const [transactions, resources, caixinhas, shoppingLists, budgets] = await Promise.all([
    listTransactions({ ownerId, groupId }),
    listResourceItems({ ownerId, groupId }),
    listCaixinhas({ ownerId, groupId }),
    listShoppingLists({ ownerId, groupId }),
    listBudgets(ownerId),
  ]);

  const [payersByTx, movByCaixinha, itensPorLista] = await Promise.all([
    listPayersFor(transactions.map((t) => t.id)),
    listMovimentacoesFor(caixinhas.map((c) => c.id)),
    Promise.all(shoppingLists.map((l) => listShoppingItems(l.id))),
  ]);

  return {
    exportado_em: new Date().toISOString(),
    perfil: { id: profile.id, nome: profile.nome, cor: profile.cor },
    categorias: categories,
    transacoes: transactions.map((t) => ({ ...t, pagadores: payersByTx.get(t.id) || [] })),
    orcamentos: budgets,
    caixinhas: caixinhas.map((c) => ({ ...c, movimentacoes: movByCaixinha.get(c.id) || [] })),
    listas_de_compras: shoppingLists.map((l, i) => ({ ...l, itens: itensPorLista[i] || [] })),
    recursos: resources,
  };
}

// Dispara o download direto no navegador — sem servidor, sem link
// temporário sobrevivendo além do necessário (revogado logo depois do clique).
export function baixarComoJson(dados, nomeArquivo) {
  const blob = new Blob([JSON.stringify(dados, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}
