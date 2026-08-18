import { listBudgets, upsertBudget, deleteBudget } from '../services/budgets.js';

// Modal "Orçamentos" (Perfil → Preferências) — um limite mensal opcional por
// categoria, sempre pessoal (mesmo com grupo). Salva sozinho ao sair do
// campo (sem botão "Salvar" por linha — são várias categorias na lista,
// um botão por linha seria repetitivo).
export function budgetModalStore() {
  return {
    open: false,
    budgets: [],
    valores: {}, // { [categoria_id]: string do input, pra não perder o que a pessoa digitou até salvar }

    async openManage() {
      const store = Alpine.store('app');
      try {
        this.budgets = await listBudgets(store.profile.id);
        this.valores = {};
        for (const b of this.budgets) this.valores[b.categoria_id] = String(b.valor_limite);
        this.open = true;
      } catch (e) {
        store.notify(e.message || 'Não consegui carregar os orçamentos.', 'danger');
      }
    },
    close() {
      this.open = false;
    },

    budgetFor(categoriaId) {
      return this.budgets.find((b) => b.categoria_id === categoriaId) || null;
    },

    async salvarLimite(categoriaId) {
      const store = Alpine.store('app');
      const bruto = this.valores[categoriaId];
      const valor = Number(bruto);

      if (!bruto || !(valor > 0)) {
        const existente = this.budgetFor(categoriaId);
        if (existente) await this.removerLimite(existente.id, categoriaId);
        return;
      }

      try {
        const salvo = await upsertBudget({
          categoriaId,
          valorLimite: valor,
          ownerId: store.profile.id,
          groupId: store.group?.group?.id ?? null,
        });
        const idx = this.budgets.findIndex((b) => b.categoria_id === categoriaId);
        if (idx >= 0) this.budgets[idx] = salvo;
        else this.budgets.push(salvo);
        store.notify('Orçamento salvo.');
        window.dispatchEvent(new CustomEvent('cg:budgets-changed'));
      } catch (e) {
        store.notify(e.message || 'Não foi possível salvar o orçamento.', 'danger');
      }
    },

    async removerLimite(id, categoriaId) {
      const store = Alpine.store('app');
      try {
        await deleteBudget(id);
        this.budgets = this.budgets.filter((b) => b.id !== id);
        this.valores[categoriaId] = '';
        store.notify('Orçamento removido.');
        window.dispatchEvent(new CustomEvent('cg:budgets-changed'));
      } catch (e) {
        store.notify(e.message || 'Não foi possível remover o orçamento.', 'danger');
      }
    },
  };
}
