// Catálogo de planos do BNTT (Home e Business) — FONTE ÚNICA. A LP, o app
// (limites) e o script do Stripe (scripts/stripe-planos.mjs) leem daqui.
// Preço em centavos de real. Anual = 12 meses com 20% de desconto.
// Mudou preço? Edite aqui e rode `node scripts/stripe-planos.mjs` de novo
// (preço no Stripe não muda: o script cria um novo e arquiva o antigo).

export const DESCONTO_ANUAL = 0.2;
export const DIAS_DE_TESTE = 30;

export const precoAnualCentavos = (mensal) => Math.round(mensal * 12 * (1 - DESCONTO_ANUAL));

// Limites: null = sem limite. Recursos: o que a tela libera.
export const PLANOS = {
  home: [
    {
      id: 'home_gratis',
      nome: 'Grátis',
      mensal: 0,
      chamada: 'Para experimentar',
      destaques: ['30 dias com tudo do plano Família', 'Depois: 1 casa, só você', 'Até 30 lançamentos por mês', '1 lista de compras'],
      limites: { pessoas: 1, lancamentosMes: 30, listas: 1, unidades: 1 },
      recursos: { saude: false, importar: false, divisao: false },
    },
    {
      id: 'home_solteiro',
      nome: 'Solteiro',
      mensal: 990,
      chamada: 'Sua vida financeira e sua casa',
      destaques: ['Só você', 'Lançamentos e listas sem limite', 'Inventário da casa', 'Importar planilha'],
      limites: { pessoas: 1, lancamentosMes: null, listas: null, unidades: 1 },
      recursos: { saude: false, importar: true, divisao: false },
    },
    {
      id: 'home_casal',
      nome: 'Casal',
      mensal: 1490,
      chamada: 'Dividam as contas sem briga',
      destaques: ['2 pessoas', 'Divisão de despesas e "entre vocês"', 'Tudo do Solteiro'],
      limites: { pessoas: 2, lancamentosMes: null, listas: null, unidades: 1 },
      recursos: { saude: false, importar: true, divisao: true },
    },
    {
      id: 'home_familia',
      nome: 'Família',
      mensal: 1990,
      chamada: 'A casa inteira em um lugar',
      destaques: ['Até 6 pessoas', 'Até 2 casas (ex.: casa e casa de praia)', 'Fichas de saúde criptografadas', 'Tudo do Casal'],
      limites: { pessoas: 6, lancamentosMes: null, listas: null, unidades: 2 },
      recursos: { saude: true, importar: true, divisao: true },
      recomendado: true,
    },
  ],
  business: [
    {
      id: 'business_largada',
      nome: 'Largada',
      mensal: 0,
      chamada: 'Para começar a organizar',
      destaques: ['30 dias com tudo do plano Expansão', 'Depois: 1 unidade, só você', 'Até 30 lançamentos por mês'],
      limites: { pessoas: 1, lancamentosMes: 30, listas: 1, unidades: 1 },
      recursos: { papeis: false, importar: false, divisao: false },
    },
    {
      id: 'business_balcao',
      nome: 'Balcão',
      mensal: 2990,
      chamada: 'Seu negócio na palma da mão',
      destaques: ['1 unidade', 'Até 3 pessoas', 'Lançamentos e estoque sem limite', 'Importar planilha'],
      limites: { pessoas: 3, lancamentosMes: null, listas: null, unidades: 1 },
      recursos: { papeis: true, importar: true, divisao: false },
    },
    {
      id: 'business_expansao',
      nome: 'Expansão',
      mensal: 5990,
      chamada: 'Para quem abriu a segunda porta',
      destaques: ['Até 3 unidades (filiais)', 'Até 10 pessoas', 'Papéis: dono, gerente, funcionário, contador'],
      limites: { pessoas: 10, lancamentosMes: null, listas: null, unidades: 3 },
      recursos: { papeis: true, importar: true, divisao: true },
      recomendado: true,
    },
    {
      id: 'business_rede',
      nome: 'Rede',
      mensal: 11990,
      chamada: 'Todas as unidades em 1 tela',
      destaques: ['Unidades sem limite', 'Pessoas sem limite', 'Tudo do Expansão'],
      limites: { pessoas: null, lancamentosMes: null, listas: null, unidades: null },
      recursos: { papeis: true, importar: true, divisao: true },
    },
  ],
};

export const TODOS_OS_PLANOS = [...PLANOS.home, ...PLANOS.business];
export const planoPorId = (id) => TODOS_OS_PLANOS.find((p) => p.id === id) || null;

// Plano em vigor para uma conta, a partir do que o servidor guardou em
// app_metadata (só o servidor/Stripe escreve ali) e da data de criação.
//   tipo: 'home' | 'business' (contas antigas, sem tipo = home)
export function planoEmVigor({ tipo = 'home', plano = null, assinaturaAtiva = false, criadaEm = null } = {}, agora = new Date()) {
  const lista = PLANOS[tipo] || PLANOS.home;
  if (plano && assinaturaAtiva && planoPorId(plano)) return { ...planoPorId(plano), emTeste: false, diasRestantes: null };
  const criada = criadaEm ? new Date(criadaEm) : agora;
  const dias = Math.floor((agora - criada) / 86400000);
  const restantes = DIAS_DE_TESTE - dias;
  if (restantes > 0) {
    const topo = lista.find((p) => p.recomendado) || lista[lista.length - 1];
    return { ...topo, emTeste: true, diasRestantes: restantes };
  }
  return { ...lista[0], emTeste: false, diasRestantes: 0 };
}
