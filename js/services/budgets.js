import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';
import { todayIso } from '../utils/format.js';

// Orçamento mensal por categoria — sempre pessoal (owner_id), mesmo com
// grupo: cada pessoa define o próprio limite, não um limite compartilhado.
// Não tem coluna de mês/ano porque o limite vale igual todo mês; "quanto já
// foi gasto" é sempre recalculado a partir das transações reais do mês
// atual (ver computeBudgetProgress), nunca guardado.
export async function listBudgets(ownerId) {
  if (isDemoMode()) return mockDb.list('category_budgets', (b) => b.owner_id === ownerId);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('category_budgets').select('*').eq('owner_id', ownerId);
  if (error) throw error;
  return data;
}

// Uma linha por categoria (unique(owner_id, categoria_id)) — "definir o
// orçamento" é sempre criar-ou-atualizar, nunca duas chamadas diferentes.
export async function upsertBudget({ categoriaId, valorLimite, ownerId, groupId }) {
  if (isDemoMode()) {
    const existente = (await mockDb.list('category_budgets', (b) => b.owner_id === ownerId && b.categoria_id === categoriaId))[0];
    if (existente) return mockDb.update('category_budgets', existente.id, { valor_limite: valorLimite });
    return mockDb.insert('category_budgets', { owner_id: ownerId, group_id: groupId ?? null, categoria_id: categoriaId, valor_limite: valorLimite });
  }
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('category_budgets')
    .upsert({ owner_id: ownerId, group_id: groupId ?? null, categoria_id: categoriaId, valor_limite: valorLimite }, { onConflict: 'owner_id,categoria_id' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBudget(id) {
  if (isDemoMode()) return mockDb.remove('category_budgets', id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('category_budgets').delete().eq('id', id);
  if (error) throw error;
}

// Cálculo puro (sem I/O): quanto já foi gasto este mês em cada categoria
// com orçamento definido, e o % correspondente. "transactions" já deve vir
// filtrado pro escopo certo (ex.: só as do responsavel_id = ownerId).
export function computeBudgetProgress(transactions, budgets, categories) {
  const mesAtual = todayIso().slice(0, 7);
  return budgets
    .map((b) => {
      const categoria = categories.find((c) => c.id === b.categoria_id);
      const gasto = transactions
        .filter((t) => t.tipo === 'saida' && t.categoria_id === b.categoria_id && (t.data_cadastro || '').slice(0, 7) === mesAtual)
        .reduce((soma, t) => soma + (Number(t.valor) || 0), 0);
      const limite = Number(b.valor_limite) || 0;
      const percentual = limite > 0 ? Math.round((gasto / limite) * 100) : 0;
      return { id: b.id, categoriaId: b.categoria_id, categoria, limite, gasto, percentual };
    })
    .sort((a, b) => b.percentual - a.percentual);
}
