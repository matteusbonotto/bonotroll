// Precarregado via `node --test --import ./tests/unit/_setup.js` (ver
// package.json). Precisa rodar ANTES de qualquer import estático de módulo
// de app — import estático é hoisted, então um stub dentro do próprio
// arquivo de teste rodaria tarde demais. js/data/mockDb.js lê localStorage
// no escopo do módulo (carrega o "banco" ao ser importado); os testes de
// tests/unit/ só usam funções puras dali, então um stub em memória basta.
globalThis.localStorage = (() => {
  const mem = new Map();
  return {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, String(v)),
    removeItem: (k) => mem.delete(k),
  };
})();
