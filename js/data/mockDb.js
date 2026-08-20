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

// Logo de banco/empresa pro seed demo: SVG embutido (data URI), nunca
// hotlinkado de fora (mesma regra já seguida pelo resto do app — ver nota
// em "importação de CSV" no checklist). Não tenta reproduzir a marca real
// de nenhuma empresa (evita qualquer questão de marca registrada) — é só um
// quadrado arredondado colorido com 1-2 letras, propositalmente DIFERENTE
// do círculo+iniciais que já é o fallback quando não há logo nenhum, pra
// ficar claro visualmente qual card "tem logo" de verdade.
function logoDataUri(letras, bg, fg = '#fff') {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${bg}"/><text x="32" y="41" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="${letras.length > 1 ? 22 : 28}" font-weight="700" fill="${fg}" text-anchor="middle">${letras}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
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
    tx({ tipo: 'saida', titulo: 'Amazon Prime', categoria_id: 'cat-assinaturas', tipo_despesa: 'fixa', valor: 19.90, empresa_servico: 'Amazon', data_vencimento: isoDaysFromNow(3) }),
    tx({ tipo: 'saida', titulo: 'Claro Móvel', categoria_id: 'cat-assinaturas', tipo_despesa: 'fixa', valor: 51.91, empresa_servico: 'Claro', data_vencimento: isoDaysFromNow(-2) }),
    tx({ tipo: 'saida', titulo: 'Nubank+', categoria_id: 'cat-assinaturas', tipo_despesa: 'fixa', valor: 29.00, empresa_servico: 'Nubank', data_vencimento: isoDaysFromNow(-10), data_pagamento: isoDaysFromNow(-10) }),
    tx({ tipo: 'saida', titulo: 'Vivo Internet', categoria_id: 'cat-assinaturas', tipo_despesa: 'fixa', valor: 92.34, empresa_servico: 'Vivo', data_vencimento: isoDaysFromNow(5) }),
    tx({ tipo: 'saida', titulo: 'Open English', categoria_id: 'cat-curso', tipo_despesa: 'fixa', valor: 172.79, empresa_servico: 'Open English', data_vencimento: isoDaysFromNow(-15), data_pagamento: isoDaysFromNow(-15) }),
    tx({ tipo: 'saida', titulo: 'Tokio Marine — Seguro casa', categoria_id: 'cat-casa', tipo_despesa: 'fixa', valor: 34.40, empresa_servico: 'Tokio Marine', data_vencimento: isoDaysFromNow(-20), data_pagamento: isoDaysFromNow(-20) }),
    tx({ tipo: 'saida', titulo: 'CPFL Paulista (energia)', categoria_id: 'cat-casa', tipo_despesa: 'variavel', valor: 196.50, empresa_servico: 'CPFL', data_vencimento: isoDaysFromNow(-1) }),
    tx({ tipo: 'saida', titulo: 'Sanasa (água)', categoria_id: 'cat-casa', tipo_despesa: 'variavel', valor: 119.64, empresa_servico: 'Sanasa', data_vencimento: isoDaysFromNow(4) }),
    tx({ tipo: 'saida', titulo: 'Condomínio', categoria_id: 'cat-casa', tipo_despesa: 'fixa', valor: 415.90, data_vencimento: null }),
    tx({ tipo: 'saida', titulo: 'Seguro Carro', categoria_id: 'cat-carro', tipo_despesa: 'fixa', valor: 212.58, empresa_servico: 'Porto Seguro', data_vencimento: isoDaysFromNow(-30), data_pagamento: isoDaysFromNow(-30) }),
    tx({ tipo: 'saida', titulo: 'Financiamento Carro', categoria_id: 'cat-carro', tipo_despesa: 'fixa', valor: 765.87, empresa_servico: 'Santander', data_vencimento: isoDaysFromNow(6) }),
    tx({ tipo: 'saida', titulo: 'Gasolina', categoria_id: 'cat-carro', tipo_despesa: 'variavel', valor: 200.00, empresa_servico: 'Shell', data_vencimento: isoDaysFromNow(-5), data_pagamento: isoDaysFromNow(-5) }),
    tx({ tipo: 'saida', titulo: 'Petlove', categoria_id: 'cat-pet', tipo_despesa: 'variavel', valor: 44.90, empresa_servico: 'Petlove', data_vencimento: isoDaysFromNow(-8), data_pagamento: isoDaysFromNow(-8) }),
    tx({ tipo: 'saida', titulo: 'iFood / 99', categoria_id: 'cat-delivery', tipo_despesa: 'variavel', valor: 500.00, empresa_servico: 'iFood', data_vencimento: null }),
    // Dividida entre os dois membros do grupo (60/40) — exemplo do multi-
    // pagador (transaction_payers) já no primeiro login, senão ninguém vê o
    // avatar-stack/"Dividido" ou o saldo "Entre vocês" sem criar uma despesa
    // dividida manualmente primeiro.
    tx({ tipo: 'saida', titulo: 'Financiamento Casa', categoria_id: 'cat-casa', tipo_despesa: 'fixa', valor: 1000.00, empresa_servico: 'Caixa Econômica', data_vencimento: isoDaysFromNow(-3) }),
    tx({ tipo: 'saida', titulo: 'Dízimo', categoria_id: 'cat-outro', tipo_despesa: 'variavel', valor: 200.00, data_vencimento: isoDaysFromNow(-7), data_pagamento: isoDaysFromNow(-7) }),
    // Parcelada — exemplo de parcela_atual/parcela_total (nenhum outro
    // lançamento do seed usava esse campo).
    tx({ tipo: 'saida', titulo: 'Geladeira nova', categoria_id: 'cat-casa', tipo_despesa: 'variavel', valor: 250.00, empresa_servico: 'Magazine Luiza', parcela_atual: 3, parcela_total: 10, data_vencimento: isoDaysFromNow(9) }),
    tx({ tipo: 'entrada', titulo: 'Salário MB Labs', categoria_id: 'cat-salario', tipo_despesa: 'fixa', valor: 6000.00, empresa_servico: 'MB Labs', responsavel_id: matheusId, owner_id: matheusId, data_vencimento: isoDaysFromNow(-11), data_pagamento: isoDaysFromNow(-11), recorrente: true }),
    tx({ tipo: 'entrada', titulo: 'Salário Dinamo', categoria_id: 'cat-salario', tipo_despesa: 'fixa', valor: 5200.00, empresa_servico: 'Dinamo', responsavel_id: beatrizId, owner_id: beatrizId, data_vencimento: isoDaysFromNow(-11), data_pagamento: isoDaysFromNow(-11), recorrente: true }),
    // Propositalmente cadastrada há ~2 meses (não no mês atual) pra
    // demonstrar a geração automática de recorrência (js/services/recurring.js)
    // já no primeiro login demo — vira 2 lançamentos novos sozinha.
    tx({ tipo: 'saida', titulo: 'Spotify Família', categoria_id: 'cat-assinaturas', tipo_despesa: 'fixa', valor: 34.90, empresa_servico: 'Spotify', data_cadastro: isoDaysFromNow(-70), data_vencimento: isoDaysFromNow(-70), data_pagamento: isoDaysFromNow(-70), recorrente: true }),
  ];

  // Divide "Financiamento Casa" 60/40 entre Matheus/Beatriz — mesma regra
  // de shareForMember (services/transactions.js): existir uma linha aqui é
  // o que faz a despesa contar como "dividida" (avatar-stack, saldo "Entre
  // vocês").
  const txFinanciamentoCasa = transactions.find((t) => t.titulo === 'Financiamento Casa');
  const transactionPayers = [
    { id: uid('txpayer'), transaction_id: txFinanciamentoCasa.id, profile_id: matheusId, percentual: 60, valor: 600, criado_em: new Date().toISOString() },
    { id: uid('txpayer'), transaction_id: txFinanciamentoCasa.id, profile_id: beatrizId, percentual: 40, valor: 400, criado_em: new Date().toISOString() },
  ];

  // Empresas/serviços com logo — sem isso, "empresa_servico" nas transações
  // acima só mostraria o nome (fallback de iniciais), nunca um logo de
  // verdade. Cor de cada uma é só pra variedade visual, não tenta reproduzir
  // a marca real de ninguém (ver comentário de logoDataUri).
  const companies = [
    { id: 'company-amazon', nome: 'Amazon', logo_url: logoDataUri('A', '#FF9900', '#131921') },
    { id: 'company-claro', nome: 'Claro', logo_url: logoDataUri('C', '#DA291C') },
    { id: 'company-nubank', nome: 'Nubank', logo_url: logoDataUri('N', '#820AD1') },
    { id: 'company-vivo', nome: 'Vivo', logo_url: logoDataUri('V', '#00A19A') },
    { id: 'company-open-english', nome: 'Open English', logo_url: logoDataUri('OE', '#0B3D91') },
    { id: 'company-tokio-marine', nome: 'Tokio Marine', logo_url: logoDataUri('TM', '#00573F') },
    { id: 'company-cpfl', nome: 'CPFL', logo_url: logoDataUri('C', '#F5A800', '#1A1A1A') },
    { id: 'company-sanasa', nome: 'Sanasa', logo_url: logoDataUri('S', '#0072BC') },
    { id: 'company-porto-seguro', nome: 'Porto Seguro', logo_url: logoDataUri('PS', '#003DA5') },
    { id: 'company-santander', nome: 'Santander', logo_url: logoDataUri('S', '#EC0000') },
    { id: 'company-shell', nome: 'Shell', logo_url: logoDataUri('S', '#FFD500', '#DD1D21') },
    { id: 'company-petlove', nome: 'Petlove', logo_url: logoDataUri('P', '#6CC24A') },
    { id: 'company-ifood', nome: 'iFood', logo_url: logoDataUri('i', '#EA1D2C') },
    { id: 'company-caixa', nome: 'Caixa Econômica', logo_url: logoDataUri('CX', '#005CA9') },
    { id: 'company-magalu', nome: 'Magazine Luiza', logo_url: logoDataUri('ML', '#0086FF') },
    { id: 'company-mb-labs', nome: 'MB Labs', logo_url: logoDataUri('MB', '#0E9F6E') },
    { id: 'company-dinamo', nome: 'Dinamo', logo_url: logoDataUri('D', '#FF6B4A') },
    { id: 'company-spotify', nome: 'Spotify', logo_url: logoDataUri('S', '#1DB954', '#0A0A0A') },
  ].map((c) => ({ ...c, owner_id: matheusId, group_id: groupId, criado_em: new Date().toISOString() }));

  // Bancos das Caixinhas — mesma ideia (sem isso, "Nubank"/"Inter"/"C6 Bank"
  // nas caixinhas abaixo mostrariam só o ícone genérico de cofrinho).
  const banks = [
    { id: 'bank-nubank', nome: 'Nubank', logo_url: logoDataUri('N', '#820AD1') },
    { id: 'bank-inter', nome: 'Inter', logo_url: logoDataUri('I', '#FF7A00') },
    { id: 'bank-c6', nome: 'C6 Bank', logo_url: logoDataUri('C6', '#1A1A1A', '#FFD700') },
    { id: 'bank-wise', nome: 'Wise', logo_url: logoDataUri('W', '#9FE870', '#163300') },
  ].map((b) => ({ ...b, owner_id: matheusId, group_id: groupId, criado_em: new Date().toISOString() }));

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
    // Moeda estrangeira — exemplo de conversão pra BRL (conversaoBRLFor em
    // js/components/dashboard.js), nenhuma outra caixinha do seed usava.
    { id: 'caixa-wise', owner_id: matheusId, group_id: groupId, banco_nome: 'Wise', moeda: 'USD', meta: 1000, icone: 'bi-piggy-bank' },
  ].map((c) => ({ ...c, criado_em: new Date().toISOString() }));

  const caixinhaMovimentacoes = [
    { id: uid('caixamov'), caixinha_id: 'caixa-nubank', tipo: 'guardado', valor: 1500, data: isoDaysFromNow(-40), observacoes: null },
    { id: uid('caixamov'), caixinha_id: 'caixa-nubank', tipo: 'guardado', valor: 500, data: isoDaysFromNow(-10), observacoes: 'Sobra do mês' },
    { id: uid('caixamov'), caixinha_id: 'caixa-nubank', tipo: 'retirado', valor: 200, data: isoDaysFromNow(-3), observacoes: null },
    { id: uid('caixamov'), caixinha_id: 'caixa-inter', tipo: 'guardado', valor: 800, data: isoDaysFromNow(-20), observacoes: null },
    { id: uid('caixamov'), caixinha_id: 'caixa-beatriz-c6', tipo: 'guardado', valor: 1200, data: isoDaysFromNow(-15), observacoes: null },
    { id: uid('caixamov'), caixinha_id: 'caixa-wise', tipo: 'guardado', valor: 300, data: isoDaysFromNow(-25), observacoes: null },
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
    transaction_payers: transactionPayers,
    companies,
    banks,
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
