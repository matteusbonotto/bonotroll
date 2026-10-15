// Cliente do Open Finance (Edge Function "openfinance", Pluggy / Meu Pluggy).
// As credenciais da Pluggy NUNCA passam por aqui — o navegador só manda o
// token de login e a ação; a função confere tudo de novo do lado dela e
// devolve as transações já no formato do importador (csvImport.js).
// Ver docs/OPEN-FINANCE.md.
import { SUPABASE_ANON_KEY, SUPABASE_URL, isDemoMode } from '../data/config.js';
import { getSupabase } from '../data/supabaseClient.js';
import { todayIso } from '../utils/format.js';
import { mockDb } from '../data/mockDb.js';

export class FalhaOpenFinance extends Error {
  constructor(codigo, mensagem, status = 0) {
    super(mensagem);
    this.codigo = codigo;
    this.status = status;
  }
}

const MENSAGENS = {
  sem_rede: 'Sem conexão com o servidor. O Open Finance precisa de internet.',
  sessao: 'Sua sessão expirou. Entre de novo para usar o Open Finance.',
  of_sem_chave: 'O Open Finance ainda não foi ativado no servidor.',
  of_nao_liberado: 'O Open Finance ainda não está liberado para a sua conta.',
  of_sem_credenciais: 'Cadastre primeiro as credenciais da sua Pluggy.',
  of_config: 'O Open Finance não está configurado corretamente no servidor.',
  funcao_ausente: 'O Open Finance ainda não foi publicado no servidor.',
  pluggy_limite: 'Muitas consultas ao Open Finance agora. Espere um minuto.',
};

// Colunas na ordem do importador de transações (IMPORT_TARGETS.transacoes)
// — com o mesmo nome da key, o mapeamento automático casa exato.
export const COLUNAS_OPEN_FINANCE = [
  'tipo', 'titulo', 'empresa_servico', 'categoria_nome', 'valor', 'data_vencimento', 'data_pagamento', 'status', 'parcela_atual', 'parcela_total', 'observacoes',
];

async function tokenAtual() {
  const supabase = await getSupabase();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || null;
}

// Modo demonstração: dados fictícios no mesmo formato da função (permite
// testar a tela inteira sem conta na Pluggy).
const DEMO_ITEM = '00000000-0000-4000-8000-000000000001';
async function respostaDemo(acao, dados) {
  if (acao === 'status') {
    return { credenciais: 'proprias', conexoes: [{ item_id: DEMO_ITEM, apelido: 'Exemplo', banco: 'Banco de Exemplo', logo: '', status: 'UPDATED', atualizado_em: new Date().toISOString(), contas: [{ id: 'demo', banco: 'Banco de Exemplo', logo: '', nome: 'Conta Corrente', tipo: 'conta', final: '1234', saldo: 2450.9, moeda: 'BRL' }, { id: 'demo-cartao', banco: 'Banco de Exemplo', logo: '', nome: 'Cartão', tipo: 'cartao', final: '9876', saldo: 812.4, moeda: 'BRL' }] }] };
  }
  if (acao === 'transacoes') {
    const d = dados.ate || todayIso();
    const linha = (id, tipo, titulo, valor, extra = {}) => ({
      externo_id: `pluggy:demo-${id}`, tipo, titulo, empresa_servico: '', categoria_nome: '', valor, data_vencimento: d, data_pagamento: d,
      status: 'pago', parcela_atual: '', parcela_total: '', observacoes: 'Open Finance · Conta Corrente', conta: 'Conta Corrente', ja_importada: false, ...extra,
    });
    // Mesmo dedupe da função: o que já tem externo_id no banco local sai marcado.
    const ja = new Set((await mockDb.list('transactions')).map((t) => t.externo_id).filter(Boolean));
    const transacoes = [linha(1, 'saida', 'Supermercado Exemplo', '152.30'), linha(2, 'entrada', 'PIX recebido', '300.00'), linha(3, 'saida', 'Farmácia', '45.90')];
    return { truncado: false, transacoes: transacoes.map((t) => ({ ...t, ja_importada: ja.has(t.externo_id) })) };
  }
  return {};
}

// acao: 'status' | 'vincular' | 'desvincular' | 'transacoes'. `deps` existe
// para os testes injetarem fetch/token sem rede.
export async function chamarOpenFinance(acao, dados = {}, deps = {}) {
  if (deps.demo ?? isDemoMode()) return respostaDemo(acao, dados);
  const fetcher = deps.fetch || globalThis.fetch.bind(globalThis);
  const token = await (deps.token || tokenAtual)();
  if (!token) throw new FalhaOpenFinance('sessao', MENSAGENS.sessao, 401);
  let r;
  try {
    r = await fetcher(`${deps.url || SUPABASE_URL}/functions/v1/openfinance`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, apikey: deps.apikey || SUPABASE_ANON_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ acao, ...dados }),
    });
  } catch {
    throw new FalhaOpenFinance('sem_rede', MENSAGENS.sem_rede);
  }
  let corpo = null;
  try {
    corpo = await r.json();
  } catch {
    /* corpo não-JSON: tratado abaixo */
  }
  if (r.status === 404 && !corpo?.codigo) throw new FalhaOpenFinance('funcao_ausente', MENSAGENS.funcao_ausente, 404);
  if (!r.ok || !corpo?.ok) {
    const codigo = corpo?.codigo || (r.status === 401 ? 'sessao' : 'erro');
    throw new FalhaOpenFinance(codigo, MENSAGENS[codigo] || corpo?.erro || 'Não foi possível falar com o Open Finance agora.', r.status);
  }
  return corpo;
}

// ---- Pluggy Connect (janela oficial da Pluggy para conectar o banco) ----
// Script fixo na versão + hash de integridade (SRI): se a Pluggy mudar o
// arquivo, o navegador recusa e o app cai no modo manual (itemId). A CSP
// (firebase.json) só libera este host para script e connect.pluggy.ai para frame.
export const PLUGGY_CONNECT_SCRIPT = 'https://cdn.pluggy.ai/pluggy-connect/v2.7.0/pluggy-connect.js';
export const PLUGGY_CONNECT_SRI = 'sha384-EfJtVYPBw2vssrS8cou8sSUccnxm72OwXqa4V+b1injWH0avP4mtCJr2XM6Sb2/7';
let scriptPluggy = null;

function carregarPluggyConnect() {
  if (window.PluggyConnect) return Promise.resolve(window.PluggyConnect);
  scriptPluggy ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PLUGGY_CONNECT_SCRIPT;
    s.integrity = PLUGGY_CONNECT_SRI;
    s.crossOrigin = 'anonymous';
    s.referrerPolicy = 'no-referrer';
    s.onload = () => (window.PluggyConnect ? resolve(window.PluggyConnect) : reject(new Error('sem PluggyConnect')));
    s.onerror = () => reject(new Error('script recusado'));
    document.head.appendChild(s);
  }).catch((e) => {
    scriptPluggy = null;
    throw new FalhaOpenFinance('connect_indisponivel', 'Não consegui abrir a janela da Pluggy. Use "Tenho o código da conexão" ou tente de novo.');
  });
  return scriptPluggy;
}

// Abre o Pluggy Connect com um connect token (30 min, escopo reduzido,
// gerado pela função). Resolve com o itemId criado, ou null se a pessoa fechou.
export async function conectarBancoPluggy(connectToken, conectorId = null) {
  const PluggyConnect = await carregarPluggyConnect();
  return new Promise((resolve, reject) => {
    let terminou = false;
    const widget = new PluggyConnect({
      connectToken,
      includeSandbox: false,
      // Só o conector MeuPluggy, já selecionado: a pessoa não vê a lista de
      // bancos (escolher o banco direto não funciona no plano grátis).
      ...(Number.isInteger(conectorId) ? { connectorIds: [conectorId], selectedConnectorId: conectorId } : {}),
      onSuccess: (dados) => {
        terminou = true;
        resolve(dados?.item?.id || null);
      },
      onError: () => {
        terminou = true;
        reject(new FalhaOpenFinance('connect_erro', 'A Pluggy não conseguiu concluir a conexão. Tente de novo.'));
      },
      onClose: () => {
        if (!terminou) resolve(null);
      },
    });
    widget.init();
  });
}

// Conexões (ação 'status') -> lista plana para o card da Home. Saldo de
// conta soma no total; cartão de crédito é fatura (dívida), fica à parte.
export function resumoSaldos(conexoes) {
  const contas = [];
  for (const c of conexoes || []) {
    for (const conta of c.contas || []) {
      if (conta.saldo === null || conta.saldo === undefined) continue;
      contas.push({
        id: `${c.item_id}:${conta.id}`,
        // Banco da CONTA (no Meu Pluggy a conexão se chama "MeuPluggy").
        banco: conta.banco || c.apelido || c.banco || 'Banco',
        logo: conta.logo || c.logo || '',
        nome: conta.nome,
        final: conta.final,
        tipo: conta.tipo,
        saldo: Number(conta.saldo),
        moeda: conta.moeda || 'BRL',
      });
    }
  }
  const centavos = (n) => Math.round(n * 100) / 100;
  const soma = (lista, tipo) => centavos(lista.filter((x) => x.tipo === tipo && x.moeda === 'BRL').reduce((t, x) => t + x.saldo, 0));
  // Um grupo por banco, na ordem em que aparecem: é o resumo do card fechado.
  const porBanco = new Map();
  for (const conta of contas) {
    if (!porBanco.has(conta.banco)) porBanco.set(conta.banco, { banco: conta.banco, logo: conta.logo, contas: [] });
    const g = porBanco.get(conta.banco);
    g.logo ||= conta.logo;
    g.contas.push(conta);
  }
  const bancos = [...porBanco.values()].map((g) => ({ ...g, total: soma(g.contas, 'conta'), fatura: soma(g.contas, 'cartao') }));
  return { contas, bancos, totalContas: soma(contas, 'conta'), totalCartoes: soma(contas, 'cartao') };
}

// Transações ainda não importadas -> { headers, rows } do importador.
export function paraPlanilha(transacoes) {
  const novas = (transacoes || []).filter((t) => !t.ja_importada);
  return {
    headers: COLUNAS_OPEN_FINANCE,
    rows: novas.map((t) => ({ ...Object.fromEntries(COLUNAS_OPEN_FINANCE.map((c) => [c, t[c] ?? ''])), externo_id: t.externo_id })),
    jaImportadas: (transacoes || []).length - novas.length,
  };
}
