import { isDemoMode } from '../data/config.js';
import { mockDb } from '../data/mockDb.js';
import { getSupabase } from '../data/supabaseClient.js';
import { computeStatus } from '../utils/status.js';
import { todayIso, semAcento } from '../utils/format.js';
import * as format from '../utils/format.js';
import { comFallbackDeColuna } from '../utils/dbFallback.js';

export function withStatus(rows) {
  return rows.map((r) => ({ ...r, _status: computeStatus(r) }));
}

// ---------- Categorização automática (mesma ideia da lista de compras,
// ver guessCategoryByName em services/shoppingList.js) ----------
// Sugere pelo TÍTULO digitado (não pela empresa/serviço, que fica escondida
// atrás de "Mais opções" e pode nem ter sido preenchida ainda quando a
// pessoa já terminou de escrever o título). Só sugere categorias que já
// existem na conta, nunca cria uma nova sozinha; sempre editável — só
// preenche o campo, não trava ele.
const REGRAS_CATEGORIA_DESPESA = [
  { nomes: ['Assinaturas'], palavras: ['netflix', 'spotify', 'amazon prime', 'prime video', 'disney', 'hbo', 'youtube premium', 'icloud', 'google one', 'nubank+', 'assinatura', 'streaming', 'deezer'] },
  { nomes: ['Carro'], palavras: ['gasolina', 'combustivel', 'combustível', 'posto', 'uber', '99', 'estacionamento', 'pedagio', 'pedágio', 'ipva', 'seguro carro', 'oficina', 'mecanico', 'mecânico', 'lavagem', 'financiamento carro'] },
  { nomes: ['Casa'], palavras: ['aluguel', 'condominio', 'condomínio', 'luz', 'energia', 'agua', 'água', ' gas', 'gás', 'internet', 'financiamento casa', 'iptu', 'seguro casa', 'reforma', 'moveis', 'móveis'] },
  // "Eletrodomésticos" primeiro, cai pra "Casa" se essa categoria específica
  // ainda não existir na conta (mesmo padrão de fallback de ['Mercado',
  // 'Alimentos'] logo abaixo — nunca cria categoria nova sozinho).
  { nomes: ['Eletrodomésticos', 'Eletrodomesticos', 'Casa'], palavras: ['geladeira', 'fogao', 'fogão', 'microondas', 'micro-ondas', 'micro ondas', 'liquidificador', 'maquina de lavar', 'máquina de lavar', 'lava louça', 'lava-louça', 'lavadora', 'ventilador', 'ar condicionado', 'ar-condicionado', 'aspirador', 'batedeira', 'cafeteira', 'forno', 'freezer', 'televisao', 'televisão', 'micro-ondas'] },
  { nomes: ['Delivery'], palavras: ['ifood', 'rappi', 'uber eats', 'delivery', 'lanche'] },
  { nomes: ['Pet'], palavras: ['petlove', 'petshop', 'pet shop', 'veterinario', 'veterinário', 'racao', 'ração'] },
  { nomes: ['Curso'], palavras: ['curso', 'faculdade', 'escola', 'mensalidade', 'udemy', 'alura', 'ingles', 'inglês', 'idiomas'] },
  { nomes: ['Salário', 'Salario'], palavras: ['salario', 'salário', 'holerite'] },
  { nomes: ['Alimentos', 'Mercado'], palavras: ['mercado', 'supermercado', 'atacadao', 'atacadão'] },
  // Radicais em vez de palavras inteiras onde dá (ex.: "cabele" em vez de
  // "cabeleireiro") — cobre acentuação e erros de digitação comuns (ex.:
  // "cabelereiro" sem o primeiro "i") sem precisar listar cada variação.
  { nomes: ['Saúde', 'Saude'], palavras: ['farmac', 'drogaria', 'consulta', 'medic', 'dentista', 'plano de saude', 'plano de saúde', 'hospital', 'exame', 'laborator', 'fisioterap', 'psicolog', 'terapia', 'oftalmolog', 'nutricion', 'vacina', 'remedio', 'remédio', 'oculos', 'óculos'] },
  { nomes: ['Beleza'], palavras: ['sobrancelha', 'sombrancelha', 'cabele', 'cabelo', 'salao de beleza', 'salão de beleza', 'barbe', 'manicur', 'pedicur', 'unha', 'esteti', 'depila', 'maquia', 'make', 'spa', 'skincare', 'progressiva', 'tintura', 'colora', 'micropigmenta', 'unhas de gel'] },
];

export function guessCategoryByTitle(titulo, categories) {
  const alvo = semAcento((titulo || '').trim().toLowerCase());
  if (!alvo) return null;
  for (const regra of REGRAS_CATEGORIA_DESPESA) {
    if (!regra.palavras.some((p) => alvo.includes(semAcento(p)))) continue;
    for (const nomeCat of regra.nomes) {
      const achada = categories.find((c) => c.nome.trim().toLowerCase() === nomeCat.toLowerCase());
      if (achada) return achada;
    }
  }
  return null;
}

// comprovante_url guarda um DATA URL (modo demo) ou o CAMINHO dentro do
// bucket privado "anexos" (modo real) — nunca uma URL pública fixa, porque
// o bucket é privado. Pra exibir, sempre passar o valor salvo por
// getComprovanteUrl() (que gera uma signed URL válida por 1h) em vez de
// usar comprovante_url direto num <img>/<a>.
export async function uploadComprovante(userId, file) {
  if (isDemoMode()) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  const supabase = await getSupabase();
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from('anexos').upload(path, file);
  if (error) throw error;
  return path;
}

export async function getComprovanteUrl(path) {
  if (!path) return null;
  if (isDemoMode() || path.startsWith('data:')) return path;
  const supabase = await getSupabase();
  const { data, error } = await supabase.storage.from('anexos').createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// ownerId = usuário logado · groupId = grupo dele (opcional). Traz tudo que é dele
// OU do grupo, e depois aplica os filtros (tipo, categoria, responsável, status...) em memória.
export async function listTransactions({ ownerId, groupId, filters = {} } = {}) {
  let rows;
  if (isDemoMode()) {
    rows = await mockDb.list('transactions', (t) => t.owner_id === ownerId || (groupId && t.group_id === groupId));
  } else {
    const supabase = await getSupabase();
    let query = supabase.from('transactions').select('*');
    query = groupId ? query.or(`owner_id.eq.${ownerId},group_id.eq.${groupId}`) : query.eq('owner_id', ownerId);
    const { data, error } = await query;
    if (error) throw error;
    rows = data;
  }

  rows = withStatus(rows);
  if (filters.tipo) rows = rows.filter((r) => r.tipo === filters.tipo);
  if (filters.categoriaId) rows = rows.filter((r) => r.categoria_id === filters.categoriaId);
  if (filters.responsavelId) rows = rows.filter((r) => r.responsavel_id === filters.responsavelId);
  if (filters.status) rows = rows.filter((r) => r._status === filters.status);
  if (filters.tipoDespesa) rows = rows.filter((r) => r.tipo_despesa === filters.tipoDespesa);
  // Comparação de string funciona porque as datas já vêm em "aaaa-mm-dd"
  // (ISO), que ordena igual a data real. Lançamento sem vencimento some da
  // lista quando o filtro de período está ativo (não dá pra saber se ele
  // "cai dentro" do período sem uma data).
  if (filters.dataInicio) rows = rows.filter((r) => r.data_vencimento && r.data_vencimento >= filters.dataInicio);
  if (filters.dataFim) rows = rows.filter((r) => r.data_vencimento && r.data_vencimento <= filters.dataFim);
  if (filters.busca) {
    const termo = filters.busca.toLowerCase();
    rows = rows.filter(
      (r) => r.titulo.toLowerCase().includes(termo) || (r.empresa_servico || '').toLowerCase().includes(termo)
    );
  }

  return rows.sort((a, b) => (b.data_cadastro || '').localeCompare(a.data_cadastro || ''));
}

export async function createTransaction(data) {
  const row = { data_cadastro: todayIso(), ...data };
  if (isDemoMode()) return mockDb.insert('transactions', row);
  const supabase = await getSupabase();
  return comFallbackDeColuna((obj) => supabase.from('transactions').insert(obj).select().single(), row);
}

export async function updateTransaction(id, patch) {
  if (isDemoMode()) return mockDb.update('transactions', id, patch);
  const supabase = await getSupabase();
  return comFallbackDeColuna((obj) => supabase.from('transactions').update(obj).eq('id', id).select().single(), patch);
}

export async function deleteTransaction(id) {
  if (isDemoMode()) return mockDb.remove('transactions', id);
  const supabase = await getSupabase();
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
}

export function markAsPaid(id) {
  return updateTransaction(id, { data_pagamento: todayIso() });
}

export function markAsUnpaid(id) {
  return updateTransaction(id, { data_pagamento: null });
}

// Cálculo puro (sem I/O) — reaproveitado pela Home (pessoal/grupo) e pelos gráficos.
export function computeSummary(transactions) {
  let entradas = 0;
  let saidas = 0;
  let maiorGasto = null;

  for (const t of transactions) {
    const valor = Number(t.valor) || 0;
    if (t.tipo === 'entrada') {
      entradas += valor;
    } else {
      saidas += valor;
      if (!maiorGasto || valor > Number(maiorGasto.valor)) maiorGasto = t;
    }
  }

  return { entradas, saidas, saldo: entradas - saidas, maiorGasto };
}

// ---------- Múltiplos pagadores (divisão de despesa) ----------
// Uma transação sem nenhuma linha em transaction_payers continua 100% do
// responsavel_id (retrocompatível — despesas antigas não precisam de
// migração). Linhas em transaction_payers só existem quando há 2+
// pagadores; nesse caso elas SUBSTITUEM a leitura de responsavel_id pra
// fins de "quem deve quanto" (ver shareForMember).

export async function listPayers(transactionId) {
  if (isDemoMode()) return mockDb.list('transaction_payers', (p) => p.transaction_id === transactionId);
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('transaction_payers').select('*').eq('transaction_id', transactionId);
  if (error) throw error;
  return data;
}

// Carrega os pagadores de várias transações de uma vez (evita N+1 ao montar
// resumos por membro no dashboard). Retorna um Map<transaction_id, linha[]>.
export async function listPayersFor(transactionIds) {
  const ids = transactionIds.filter(Boolean);
  const map = new Map();
  if (!ids.length) return map;

  let rows;
  if (isDemoMode()) {
    rows = await mockDb.list('transaction_payers', (p) => ids.includes(p.transaction_id));
  } else {
    const supabase = await getSupabase();
    const { data, error } = await supabase.from('transaction_payers').select('*').in('transaction_id', ids);
    if (error) throw error;
    rows = data;
  }
  for (const row of rows) {
    const atual = map.get(row.transaction_id) || [];
    atual.push(row);
    map.set(row.transaction_id, atual);
  }
  return map;
}

// Substitui TODOS os pagadores de uma transação pela lista passada (mais
// simples que fazer diff incremental). payers = [{ profile_id, percentual,
// valor }]. Passar [] volta a transação pro caso simples (100% responsavel_id).
export async function setPayers(transactionId, payers) {
  if (isDemoMode()) {
    const atuais = await mockDb.list('transaction_payers', (p) => p.transaction_id === transactionId);
    for (const row of atuais) await mockDb.remove('transaction_payers', row.id);
    for (const p of payers) {
      await mockDb.insert('transaction_payers', { transaction_id: transactionId, ...p });
    }
    return;
  }
  const supabase = await getSupabase();
  const { error: delError } = await supabase.from('transaction_payers').delete().eq('transaction_id', transactionId);
  if (delError) throw delError;
  if (!payers.length) return;
  const { error: insError } = await supabase
    .from('transaction_payers')
    .insert(payers.map((p) => ({ transaction_id: transactionId, ...p })));
  if (insError) throw insError;
}

// Cálculo puro: quanto do valor de "tx" cabe a "profileId", dado o array de
// pagadores JÁ CARREGADO daquela transação (payers === [] é o caso comum:
// cai pro responsavel_id sozinho).
export function shareForMember(tx, payers, profileId) {
  if (payers && payers.length) {
    const linha = payers.find((p) => p.profile_id === profileId);
    return linha ? Number(linha.valor) || 0 : 0;
  }
  return tx.responsavel_id === profileId ? Number(tx.valor) || 0 : 0;
}

// Divide "valor" igualmente entre N membros (o default ao adicionar um 2º+
// pagador). Sobra de centavos (arredondamento) vai pro primeiro membro, pra
// soma bater exatamente com o valor total.
export function splitEqually(valor, profileIds) {
  const total = Number(valor) || 0;
  const n = profileIds.length;
  if (!n) return [];
  const base = Math.floor((total / n) * 100) / 100;
  const resto = Math.round((total - base * n) * 100) / 100;
  return profileIds.map((profile_id, i) => {
    const valorMembro = i === 0 ? Math.round((base + resto) * 100) / 100 : base;
    const percentual = total > 0 ? Math.round((valorMembro / total) * 10000) / 100 : Math.round((100 / n) * 100) / 100;
    return { profile_id, valor: valorMembro, percentual };
  });
}

export function groupByCategory(transactions, categorias) {
  const porCategoria = new Map();
  for (const t of transactions) {
    if (t.tipo !== 'saida') continue;
    const cat = categorias.find((c) => c.id === t.categoria_id);
    const key = cat?.id || 'sem-categoria';
    const atual = porCategoria.get(key) || { nome: cat?.nome || 'Sem categoria', cor: cat?.cor || '#94A3B8', total: 0 };
    atual.total += Number(t.valor) || 0;
    porCategoria.set(key, atual);
  }
  return [...porCategoria.values()].sort((a, b) => b.total - a.total);
}

const CORES_AUXILIARES = ['#0EA5E9', '#22C55E', '#A855F7', '#F97316', '#EF4444', '#EAB308', '#6366F1', '#14B8A6', '#EC4899', '#64748B'];

// Igual a groupByCategory, mas agrupando por "empresa/serviço" (texto livre
// digitado no lançamento) — não tem cor própria como categoria, então
// atribui uma cor estável (mesmo texto sempre cai na mesma cor) de uma
// paleta auxiliar, só pra colorir o gráfico de forma consistente entre
// re-renders.
export function groupByCompany(transactions) {
  const porEmpresa = new Map();
  for (const t of transactions) {
    if (t.tipo !== 'saida') continue;
    const nome = (t.empresa_servico || '').trim() || 'Sem empresa/serviço';
    const atual = porEmpresa.get(nome) || { nome, total: 0 };
    atual.total += Number(t.valor) || 0;
    porEmpresa.set(nome, atual);
  }
  return [...porEmpresa.values()]
    .sort((a, b) => b.total - a.total)
    .map((item, i) => ({ ...item, cor: CORES_AUXILIARES[i % CORES_AUXILIARES.length] }));
}

// Entrada x Saída do período — a quebra mais simples, útil como "visão geral"
// antes de entrar em categoria/empresa/tempo.
export function groupByFlow(transactions) {
  const resumo = computeSummary(transactions);
  // Cores literais (não var(--...)) de propósito: Chart.js desenha em
  // <canvas>, que não resolve custom properties do CSS — precisa do valor
  // final. Mesmo hex usado por --color-success/--color-danger em
  // css/tokens.css (não mudam entre claro/escuro).
  return [
    { nome: 'Entradas', total: resumo.entradas, cor: '#16A34A' },
    { nome: 'Saídas', total: resumo.saidas, cor: '#DC2626' },
  ];
}

// Série temporal (dia/mês/ano) só de saídas — granularidade determina o
// tamanho do "balde" de agrupamento e o rótulo de cada ponto.
export function groupByPeriod(transactions, granularidade = 'mes') {
  const baldes = new Map();
  const chaveDe = (isoData) => {
    if (!isoData) return null;
    if (granularidade === 'dia') return isoData.slice(0, 10);
    if (granularidade === 'ano') return isoData.slice(0, 4);
    return isoData.slice(0, 7); // mes: "aaaa-mm"
  };
  const rotuloDe = (chave) => {
    if (granularidade === 'dia') return format.formatDate(chave);
    if (granularidade === 'ano') return chave;
    const [ano, mes] = chave.split('-');
    return `${MESES_ABREV[Number(mes) - 1]}/${ano.slice(2)}`;
  };

  for (const t of transactions) {
    if (t.tipo !== 'saida') continue;
    const chave = chaveDe(t.data_cadastro);
    if (!chave) continue;
    const atual = baldes.get(chave) || 0;
    baldes.set(chave, atual + (Number(t.valor) || 0));
  }

  return [...baldes.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([chave, total]) => ({ nome: rotuloDe(chave), total, cor: '#1F7A5C' }));
}

const MESES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
