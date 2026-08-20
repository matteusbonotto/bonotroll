// Banco de dados mockado (localStorage) usado enquanto o Supabase real não está configurado.
// Simula a mesma forma de dados do schema.sql (ver /supabase/schema.sql) para que trocar
// para o backend real depois não exija mudar nenhuma tela — só os services.

const STORAGE_KEY = 'bonotto_demo_db_v1';
const SESSION_KEY = 'bonotto_demo_session';

function uid(prefix) {
  const rand = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
  return prefix ? `${prefix}-${rand}` : rand;
}

function isoDaysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

function seedDatabase() {
  const matheusId = 'demo-matheus';
  const beatrizId = 'demo-beatriz';
  const groupId = 'demo-familia';

  const categories = [
    { id: 'cat-assinaturas', nome: 'Assinaturas', cor: '#0EA5E9', icone: 'bi-collection-play' },
    { id: 'cat-curso', nome: 'Curso', cor: '#22C55E', icone: 'bi-mortarboard' },
    { id: 'cat-casa', nome: 'Casa', cor: '#A855F7', icone: 'bi-house-door' },
    { id: 'cat-carro', nome: 'Carro', cor: '#6366F1', icone: 'bi-car-front' },
    { id: 'cat-pet', nome: 'Pet', cor: '#EF4444', icone: 'bi-heart' },
    { id: 'cat-delivery', nome: 'Delivery', cor: '#F97316', icone: 'bi-bicycle' },
    { id: 'cat-outro', nome: 'Outro', cor: '#64748B', icone: 'bi-three-dots' },
    { id: 'cat-salario', nome: 'Salário', cor: '#EAB308', icone: 'bi-cash-coin' },
    { id: 'cat-alimentos', nome: 'Alimentos', cor: '#16A34A', icone: 'bi-basket' },
    { id: 'cat-limpeza', nome: 'Limpeza', cor: '#06B6D4', icone: 'bi-droplet' },
    { id: 'cat-higiene', nome: 'Higiene', cor: '#EC4899', icone: 'bi-droplet-half' },
    { id: 'cat-bebidas', nome: 'Bebidas', cor: '#D97706', icone: 'bi-cup-straw' },
    { id: 'cat-hortifruti', nome: 'Hortifruti', cor: '#65A30D', icone: 'bi-apple' },
    { id: 'cat-laticinios', nome: 'Laticínios', cor: '#38BDF8', icone: 'bi-cup-fill' },
    { id: 'cat-padaria', nome: 'Padaria', cor: '#B45309', icone: 'bi-basket2-fill' },
    { id: 'cat-acougue', nome: 'Açougue', cor: '#DC2626', icone: 'bi-shop' },
    { id: 'cat-saude', nome: 'Saúde', cor: '#F43F5E', icone: 'bi-heart-pulse' },
    { id: 'cat-beleza', nome: 'Beleza', cor: '#D946EF', icone: 'bi-magic' },
  ].map((c) => ({ ...c, owner_id: matheusId, group_id: groupId, criado_em: new Date().toISOString() }));

  function tx(data) {
    return {
      id: uid('tx'),
      owner_id: matheusId,
      group_id: groupId,
      responsavel_id: matheusId,
      empresa_servico: null,
      observacoes: null,
      comprovante_url: null,
      recorrente: false,
      data_cadastro: isoDaysFromNow(-15),
      data_pagamento: null,
      criado_em: new Date().toISOString(),
      ...data,
    };
  }

  const transactions = [
    tx({ tipo: 'saida', titulo: 'Amazon Prime', categoria_id: 'cat-assinaturas', tipo_despesa: 'fixa', valor: 19.90, data_vencimento: isoDaysFromNow(3) }),
    tx({ tipo: 'saida', titulo: 'Claro Móvel', categoria_id: 'cat-assinaturas', tipo_despesa: 'fixa', valor: 51.91, data_vencimento: isoDaysFromNow(-2) }),
    tx({ tipo: 'saida', titulo: 'Nubank+', categoria_id: 'cat-assinaturas', tipo_despesa: 'fixa', valor: 29.00, data_vencimento: isoDaysFromNow(-10), data_pagamento: isoDaysFromNow(-10) }),
    tx({ tipo: 'saida', titulo: 'Vivo Internet', categoria_id: 'cat-assinaturas', tipo_despesa: 'fixa', valor: 92.34, data_vencimento: isoDaysFromNow(5) }),
    tx({ tipo: 'saida', titulo: 'Open English', categoria_id: 'cat-curso', tipo_despesa: 'fixa', valor: 172.79, data_vencimento: isoDaysFromNow(-15), data_pagamento: isoDaysFromNow(-15) }),
    tx({ tipo: 'saida', titulo: 'Tokio Marine — Seguro casa', categoria_id: 'cat-casa', tipo_despesa: 'fixa', valor: 34.40, data_vencimento: isoDaysFromNow(-20), data_pagamento: isoDaysFromNow(-20) }),
    tx({ tipo: 'saida', titulo: 'CPFL Paulista (energia)', categoria_id: 'cat-casa', tipo_despesa: 'variavel', valor: 196.50, data_vencimento: isoDaysFromNow(-1) }),
    tx({ tipo: 'saida', titulo: 'Sanasa (água)', categoria_id: 'cat-casa', tipo_despesa: 'variavel', valor: 119.64, data_vencimento: isoDaysFromNow(4) }),
    tx({ tipo: 'saida', titulo: 'Condomínio', categoria_id: 'cat-casa', tipo_despesa: 'fixa', valor: 415.90, data_vencimento: null }),
    tx({ tipo: 'saida', titulo: 'Seguro Carro', categoria_id: 'cat-carro', tipo_despesa: 'fixa', valor: 212.58, data_vencimento: isoDaysFromNow(-30), data_pagamento: isoDaysFromNow(-30) }),
    tx({ tipo: 'saida', titulo: 'Financiamento Carro', categoria_id: 'cat-carro', tipo_despesa: 'fixa', valor: 765.87, data_vencimento: isoDaysFromNow(6) }),
    tx({ tipo: 'saida', titulo: 'Gasolina', categoria_id: 'cat-carro', tipo_despesa: 'variavel', valor: 200.00, data_vencimento: isoDaysFromNow(-5), data_pagamento: isoDaysFromNow(-5) }),
    tx({ tipo: 'saida', titulo: 'Petlove', categoria_id: 'cat-pet', tipo_despesa: 'variavel', valor: 44.90, data_vencimento: isoDaysFromNow(-8), data_pagamento: isoDaysFromNow(-8) }),
    tx({ tipo: 'saida', titulo: 'iFood / 99', categoria_id: 'cat-delivery', tipo_despesa: 'variavel', valor: 500.00, data_vencimento: null }),
    tx({ tipo: 'saida', titulo: 'Financiamento Casa', categoria_id: 'cat-casa', tipo_despesa: 'fixa', valor: 1000.00, data_vencimento: isoDaysFromNow(-3) }),
    tx({ tipo: 'saida', titulo: 'Dízimo', categoria_id: 'cat-outro', tipo_despesa: 'variavel', valor: 200.00, data_vencimento: isoDaysFromNow(-7), data_pagamento: isoDaysFromNow(-7) }),
    tx({ tipo: 'entrada', titulo: 'Salário MB Labs', categoria_id: 'cat-salario', tipo_despesa: 'fixa', valor: 6000.00, responsavel_id: matheusId, owner_id: matheusId, data_vencimento: isoDaysFromNow(-11), data_pagamento: isoDaysFromNow(-11), recorrente: true }),
    tx({ tipo: 'entrada', titulo: 'Salário Dinamo', categoria_id: 'cat-salario', tipo_despesa: 'fixa', valor: 5200.00, responsavel_id: beatrizId, owner_id: beatrizId, data_vencimento: isoDaysFromNow(-11), data_pagamento: isoDaysFromNow(-11), recorrente: true }),
    // Propositalmente cadastrada há ~2 meses (não no mês atual) pra
    // demonstrar a geração automática de recorrência (js/services/recurring.js)
    // já no primeiro login demo — vira 2 lançamentos novos sozinha.
    tx({ tipo: 'saida', titulo: 'Spotify Família', categoria_id: 'cat-assinaturas', tipo_despesa: 'fixa', valor: 34.90, data_cadastro: isoDaysFromNow(-70), data_vencimento: isoDaysFromNow(-70), data_pagamento: isoDaysFromNow(-70), recorrente: true }),
  ];

  const shoppingLists = [
    { id: 'demo-lista-1', owner_id: matheusId, group_id: groupId, nome: 'Compras da Semana', status: 'planejando', criado_em: new Date().toISOString(), iniciado_em: null, finalizado_em: null, transacao_id: null },
  ];

  const shoppingListItems = [
    { id: uid('item'), list_id: 'demo-lista-1', nome: 'Arroz 5kg', categoria_id: 'cat-alimentos', unidade: 'kg', quantidade: 5, prioridade: 4, preco_unitario: null, preco_por_kg: null, subtotal: 0, comprado: false, codigo_barras: null, foto_url: null },
    { id: uid('item'), list_id: 'demo-lista-1', nome: 'Feijão 1kg', categoria_id: 'cat-alimentos', unidade: 'kg', quantidade: 1, prioridade: 4, preco_unitario: null, preco_por_kg: null, subtotal: 0, comprado: false, codigo_barras: null, foto_url: null },
    { id: uid('item'), list_id: 'demo-lista-1', nome: 'Detergente', categoria_id: 'cat-limpeza', unidade: 'un', quantidade: 2, prioridade: 2, preco_unitario: null, preco_por_kg: null, subtotal: 0, comprado: false, codigo_barras: null, foto_url: null },
    { id: uid('item'), list_id: 'demo-lista-1', nome: 'Sabonete', categoria_id: 'cat-higiene', unidade: 'un', quantidade: 3, prioridade: 3, preco_unitario: null, preco_por_kg: null, subtotal: 0, comprado: false, codigo_barras: null, foto_url: null },
    { id: uid('item'), list_id: 'demo-lista-1', nome: 'Banana Prata', categoria_id: 'cat-hortifruti', unidade: 'kg', quantidade: 1, prioridade: 3, preco_unitario: null, preco_por_kg: null, subtotal: 0, comprado: false, codigo_barras: null, foto_url: null },
    { id: uid('item'), list_id: 'demo-lista-1', nome: 'Refrigerante 2L', categoria_id: 'cat-bebidas', unidade: 'un', quantidade: 2, prioridade: 1, preco_unitario: null, preco_por_kg: null, subtotal: 0, comprado: false, codigo_barras: null, foto_url: null },
  ];

  // Recursos (inventário doméstico) — mesma lista fixa de cômodos/
  // subcategorias de DEFAULT_ROOMS/DEFAULT_ROOM_CATEGORIES em
  // js/services/resources.js (duplicado aqui em vez de importado, mesmo
  // padrão já usado por "categories" acima com DEFAULT_CATEGORIES — a
  // camada de dados não importa das camadas de serviço).
  const rooms = [
    { id: 'room-quarto', nome: 'Quarto', icone: 'bi-door-closed', ordem: 1 },
    { id: 'room-escritorio', nome: 'Escritório', icone: 'bi-briefcase', ordem: 2 },
    { id: 'room-cozinha', nome: 'Cozinha', icone: 'bi-cup-hot', ordem: 3 },
    { id: 'room-banheiro', nome: 'Banheiro', icone: 'bi-droplet', ordem: 4 },
    { id: 'room-sala', nome: 'Sala', icone: 'bi-tv', ordem: 5 },
    { id: 'room-lavanderia', nome: 'Lavanderia', icone: 'bi-basket2', ordem: 6 },
  ].map((r) => ({ ...r, owner_id: matheusId, group_id: groupId, criado_em: new Date().toISOString() }));

  const roomCategories = [
    { id: 'rc-quarto-guardaroupa', room_id: 'room-quarto', nome: 'Guarda-roupas', ordem: 1 },
    { id: 'rc-escritorio-outros', room_id: 'room-escritorio', nome: 'Outros', ordem: 1 },
    { id: 'rc-cozinha-armario', room_id: 'room-cozinha', nome: 'Armário', ordem: 1 },
    { id: 'rc-cozinha-geladeira', room_id: 'room-cozinha', nome: 'Geladeira', ordem: 2 },
    { id: 'rc-banheiro-armario', room_id: 'room-banheiro', nome: 'Armário', ordem: 1 },
    { id: 'rc-banheiro-prateleira', room_id: 'room-banheiro', nome: 'Prateleira', ordem: 2 },
    { id: 'rc-sala-outros', room_id: 'room-sala', nome: 'Outros', ordem: 1 },
    { id: 'rc-lavanderia-outros', room_id: 'room-lavanderia', nome: 'Outros', ordem: 1 },
  ].map((c) => ({ ...c, criado_em: new Date().toISOString() }));

  const resourceItems = [
    { id: uid('res'), room_id: 'room-cozinha', category_id: 'rc-cozinha-geladeira', nome: 'Leite', quantidade: 2, data_validade: isoDaysFromNow(4), foto_url: null },
    { id: uid('res'), room_id: 'room-cozinha', category_id: 'rc-cozinha-geladeira', nome: 'Iogurte', quantidade: 0, data_validade: isoDaysFromNow(-2), foto_url: null },
    { id: uid('res'), room_id: 'room-cozinha', category_id: 'rc-cozinha-armario', nome: 'Arroz', quantidade: 3, data_validade: null, foto_url: null },
    { id: uid('res'), room_id: 'room-banheiro', category_id: 'rc-banheiro-armario', nome: 'Papel higiênico', quantidade: 0, data_validade: null, foto_url: null },
    { id: uid('res'), room_id: 'room-banheiro', category_id: 'rc-banheiro-prateleira', nome: 'Sabonete líquido', quantidade: 1, data_validade: isoDaysFromNow(180), foto_url: null },
    { id: uid('res'), room_id: 'room-quarto', category_id: 'rc-quarto-guardaroupa', nome: 'Cobertor extra', quantidade: 1, data_validade: null, foto_url: null },
  ].map((i) => ({ ...i, owner_id: matheusId, group_id: groupId, criado_em: new Date().toISOString() }));

  // Caixinhas (dinheiro guardado em bancos) — valor guardado/retirado/saldo
  // NUNCA vêm daqui, são somados de caixinha_movimentacoes no cliente (ver
  // js/services/caixinhas.js), então a seed só precisa da config de cada
  // banco + o histórico de aportes/retiradas.
  const caixinhas = [
    { id: 'caixa-nubank', owner_id: matheusId, group_id: groupId, banco_nome: 'Nubank', moeda: 'BRL', meta: 5000, icone: 'bi-piggy-bank' },
    { id: 'caixa-inter', owner_id: matheusId, group_id: groupId, banco_nome: 'Inter', moeda: 'BRL', meta: 2000, icone: 'bi-piggy-bank' },
    { id: 'caixa-beatriz-c6', owner_id: beatrizId, group_id: groupId, banco_nome: 'C6 Bank', moeda: 'BRL', meta: null, icone: 'bi-piggy-bank' },
  ].map((c) => ({ ...c, criado_em: new Date().toISOString() }));

  const caixinhaMovimentacoes = [
    { id: uid('caixamov'), caixinha_id: 'caixa-nubank', tipo: 'guardado', valor: 1500, data: isoDaysFromNow(-40), observacoes: null },
    { id: uid('caixamov'), caixinha_id: 'caixa-nubank', tipo: 'guardado', valor: 500, data: isoDaysFromNow(-10), observacoes: 'Sobra do mês' },
    { id: uid('caixamov'), caixinha_id: 'caixa-nubank', tipo: 'retirado', valor: 200, data: isoDaysFromNow(-3), observacoes: null },
    { id: uid('caixamov'), caixinha_id: 'caixa-inter', tipo: 'guardado', valor: 800, data: isoDaysFromNow(-20), observacoes: null },
    { id: uid('caixamov'), caixinha_id: 'caixa-beatriz-c6', tipo: 'guardado', valor: 1200, data: isoDaysFromNow(-15), observacoes: null },
  ].map((m) => ({ ...m, criado_em: new Date().toISOString() }));

  return {
    profiles: [
      { id: matheusId, nome: 'Matheus', avatar_url: null, cor: '#2877E8', criado_em: new Date().toISOString() },
      { id: beatrizId, nome: 'Beatriz', avatar_url: null, cor: '#D94E92', criado_em: new Date().toISOString() },
    ],
    groups: [{ id: groupId, nome: 'Família', criado_por: matheusId, codigo: 'FAMILIA-DEMO', criado_em: new Date().toISOString() }],
    group_members: [
      { group_id: groupId, profile_id: matheusId, papel: 'admin', entrou_em: new Date().toISOString() },
      { group_id: groupId, profile_id: beatrizId, papel: 'membro', entrou_em: new Date().toISOString() },
    ],
    categories,
    transactions,
    transaction_payers: [],
    companies: [],
    banks: [],
    shopping_lists: shoppingLists,
    shopping_list_items: shoppingListItems,
    resource_rooms: rooms,
    resource_categories: roomCategories,
    resource_items: resourceItems,
    caixinhas,
    caixinha_movimentacoes: caixinhaMovimentacoes,
    notifications: [],
    push_subscriptions: [],
    category_budgets: [
      { id: uid('budget'), owner_id: matheusId, group_id: groupId, categoria_id: 'cat-delivery', valor_limite: 300, criado_em: new Date().toISOString() },
      { id: uid('budget'), owner_id: matheusId, group_id: groupId, categoria_id: 'cat-casa', valor_limite: 1200, criado_em: new Date().toISOString() },
      { id: uid('budget'), owner_id: matheusId, group_id: groupId, categoria_id: 'cat-pet', valor_limite: 100, criado_em: new Date().toISOString() },
    ],
  };
}

function loadDb() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      /* dado corrompido: recria a seed abaixo */
    }
  }
  const seeded = seedDatabase();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}

let db = loadDb();

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function delay(ms = 100) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mockDb = {
  async list(table, filterFn) {
    await delay();
    const rows = db[table] || [];
    return filterFn ? rows.filter(filterFn) : [...rows];
  },
  async get(table, id) {
    await delay();
    return (db[table] || []).find((r) => r.id === id) || null;
  },
  async insert(table, row) {
    await delay();
    const record = { id: uid(), criado_em: new Date().toISOString(), ...row };
    db[table] = db[table] || [];
    db[table].push(record);
    persist();
    return record;
  },
  async update(table, id, patch) {
    await delay();
    const rows = db[table] || [];
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error(`Registro não encontrado em "${table}".`);
    rows[idx] = { ...rows[idx], ...patch };
    persist();
    return rows[idx];
  },
  async remove(table, id) {
    await delay();
    db[table] = (db[table] || []).filter((r) => r.id !== id);
    persist();
  },
  reset() {
    db = seedDatabase();
    persist();
    return db;
  },
};

export const mockSession = {
  getUserId() {
    return localStorage.getItem(SESSION_KEY);
  },
  setUserId(id) {
    localStorage.setItem(SESSION_KEY, id);
  },
  clear() {
    localStorage.removeItem(SESSION_KEY);
  },
};
