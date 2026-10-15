// Núcleo puro da Edge Function "openfinance" (Pluggy / Meu Pluggy) —
// validação de pedido, cliente da API da Pluggy e normalização de transação.
// Sem Deno.* aqui: roda igual no Deno (função) e no node --test
// (tests/unit/openfinance-nucleo.test.js), com fetch injetável.
//
// Regras de segurança (docs/OPEN-FINANCE.md):
//  - CLIENT_ID/CLIENT_SECRET e a apiKey (acesso total por 2h) só existem no
//    servidor; o navegador nunca recebe nada disso.
//  - A função só LÊ na Pluggy (GET). O único POST é /connect_token, que gera
//    um token de 30 min com escopo reduzido para abrir o Pluggy Connect no
//    navegador — nenhum endpoint de pagamento é chamado.
//  - itemId só é aceito no formato UUID e só depois de a Pluggy confirmar que
//    ele pertence à aplicação configurada (GET /items/{id} = 200).
//  - Plano grátis do Meu Pluggy = só contas do PRÓPRIO titular, até 5
//    conexões. Por isso cada pessoa usa a PRÓPRIA aplicação da Pluggy:
//    cadastra CLIENT_ID/SECRET uma vez (ação 'credenciais'), o segredo é
//    cifrado com AES-GCM (chave OPENFINANCE_CHAVE, só na função) e nunca mais
//    sai do servidor. Quem está em PLUGGY_USUARIOS usa as credenciais do
//    servidor (configuração original do titular).

export const PLUGGY_API = 'https://api.pluggy.ai';
export const LIMITES = {
  bytesCorpo: 4_096,
  conexoesPorUsuario: 5,
  diasPorConsulta: 366,
  paginasPorConta: 20, // 20 × 500 = 10 mil transações por conta numa consulta
  tempoMs: 20_000,
};
export const ACOES = ['status', 'vincular', 'desvincular', 'transacoes', 'credenciais', 'remover_credenciais', 'connect_token'];

export class ErroOpenFinance extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export const ehUuid = (v) => typeof v === 'string' && UUID.test(v);

function dataValida(v) {
  if (typeof v !== 'string' || !DATA.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// Lista de usuários liberados (uuids separados por vírgula/espaço). Lista
// vazia = ninguém (falha fechada).
export function usuariosPermitidos(texto) {
  return new Set(String(texto || '').split(/[\s,;]+/).filter(ehUuid).map((u) => u.toLowerCase()));
}

// Valida o corpo já parseado. Devolve um pedido limpo ou lança.
export function validarPedido(corpo, hoje = new Date().toISOString().slice(0, 10)) {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new ErroOpenFinance(400, 'pedido_invalido', 'Pedido inválido.');
  const { acao } = corpo;
  if (!ACOES.includes(acao)) throw new ErroOpenFinance(400, 'acao_desconhecida', 'Ação desconhecida.');
  if (acao === 'vincular' || acao === 'desvincular') {
    if (!ehUuid(corpo.itemId)) throw new ErroOpenFinance(400, 'item_invalido', 'O código da conexão (itemId) não é válido.');
    const apelido = typeof corpo.apelido === 'string' ? corpo.apelido.trim().slice(0, 60) : '';
    return { acao, itemId: corpo.itemId.toLowerCase(), apelido: apelido || null };
  }
  if (acao === 'credenciais') {
    const clientId = typeof corpo.clientId === 'string' ? corpo.clientId.trim() : '';
    const clientSecret = typeof corpo.clientSecret === 'string' ? corpo.clientSecret.trim() : '';
    if (!ehUuid(clientId)) throw new ErroOpenFinance(400, 'credencial_invalida', 'O Client ID tem o formato de um código com traços (ex.: 2339bf8a-…).');
    if (!/^[A-Za-z0-9_\-.~+/=]{16,200}$/.test(clientSecret)) throw new ErroOpenFinance(400, 'credencial_invalida', 'O Client Secret não parece válido. Copie de novo do painel da Pluggy.');
    return { acao, clientId: clientId.toLowerCase(), clientSecret };
  }
  if (acao === 'transacoes') {
    const { de, ate } = corpo;
    if (!dataValida(de) || !dataValida(ate)) throw new ErroOpenFinance(400, 'periodo_invalido', 'Período inválido.');
    if (de > ate) throw new ErroOpenFinance(400, 'periodo_invalido', 'A data inicial é depois da final.');
    if (ate > hoje) throw new ErroOpenFinance(400, 'periodo_invalido', 'A data final não pode ser no futuro.');
    const dias = (Date.parse(ate) - Date.parse(de)) / 86_400_000;
    if (dias > LIMITES.diasPorConsulta) throw new ErroOpenFinance(400, 'periodo_longo', `Escolha no máximo ${LIMITES.diasPorConsulta} dias por vez.`);
    return { acao, de, ate };
  }
  return { acao };
}

// Cliente mínimo da Pluggy. A apiKey vale 2h; renovamos com folga (1h50) e
// guardamos no escopo do módulo para não estourar o limite de /auth.
export function criarClientePluggy({ clientId, clientSecret, fetch: fetcher = globalThis.fetch, agora = () => Date.now() }) {
  let cache = null;
  let logosCache = null;

  async function chamar(caminho, init = {}) {
    const ctrl = new AbortController();
    const relogio = setTimeout(() => ctrl.abort(), LIMITES.tempoMs);
    try {
      return await fetcher(`${PLUGGY_API}${caminho}`, { ...init, signal: ctrl.signal });
    } catch {
      throw new ErroOpenFinance(504, 'pluggy_indisponivel', 'O Open Finance não respondeu. Tente de novo em instantes.');
    } finally {
      clearTimeout(relogio);
    }
  }

  async function apiKey() {
    if (cache && cache.expira > agora()) return cache.chave;
    const r = await chamar('/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    });
    const corpo = await r.json().catch(() => null);
    if (!r.ok || typeof corpo?.apiKey !== 'string') {
      throw new ErroOpenFinance(503, 'pluggy_credencial', 'As credenciais do Open Finance no servidor foram recusadas pela Pluggy.');
    }
    cache = { chave: corpo.apiKey, expira: agora() + 110 * 60_000 };
    return cache.chave;
  }

  // Só GET: a função nunca escreve nada na Pluggy.
  async function get(caminho, { tolerar404 = false } = {}) {
    let r = await chamar(caminho, { headers: { 'X-API-KEY': await apiKey() } });
    if (r.status === 401 || r.status === 403) {
      // apiKey revogada antes da hora: uma nova tentativa com chave nova.
      cache = null;
      r = await chamar(caminho, { headers: { 'X-API-KEY': await apiKey() } });
    }
    if (tolerar404 && (r.status === 404 || r.status === 403)) return null;
    if (r.status === 429) throw new ErroOpenFinance(429, 'pluggy_limite', 'Muitas consultas ao Open Finance agora. Espere um minuto.');
    if (!r.ok) throw new ErroOpenFinance(502, 'pluggy_erro', 'O Open Finance devolveu um erro.');
    const corpo = await r.json().catch(() => null);
    if (!corpo || typeof corpo !== 'object') throw new ErroOpenFinance(502, 'pluggy_erro', 'Resposta inesperada do Open Finance.');
    return corpo;
  }

  return {
    apiKey,
    // Token do Pluggy Connect (widget): 30 min, escopo reduzido. clientUserId
    // identifica a pessoa nos eventos da Pluggy (vai dentro de options).
    async connectToken(clientUserId) {
      const r = await chamar('/connect_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': await apiKey() },
        body: JSON.stringify({ options: { clientUserId } }),
      });
      const corpo = await r.json().catch(() => null);
      if (r.status === 429) throw new ErroOpenFinance(429, 'pluggy_limite', 'Muitas consultas ao Open Finance agora. Espere um minuto.');
      if (!r.ok || typeof corpo?.accessToken !== 'string') throw new ErroOpenFinance(502, 'pluggy_erro', 'Não foi possível abrir a conexão com a Pluggy agora.');
      return corpo.accessToken;
    },
    // Id do conector "MeuPluggy" na lista da Pluggy (procurado pelo nome, não
    // fixo no código). No plano grátis só ele funciona: a janela abre direto
    // nele, sem a lista de bancos (escolher o banco direto dá erro de
    // "contas de teste só podem conectar sandbox").
    async conectorMeuPluggy() {
      const corpo = await get('/connectors?name=MeuPluggy');
      const norm = (t) => String(t || '').toLowerCase().replace(/[^a-z]/g, '');
      const achado = (corpo.results || []).find((c) => norm(c.name) === 'meupluggy');
      return Number.isInteger(achado?.id) ? achado.id : null;
    },
    // Logos oficiais dos bancos: lista de conectores da Pluggy (nome -> imageUrl
    // https), guardada por 6h na instância. Falha = sem logo, nunca erro.
    async logos() {
      if (logosCache && logosCache.expira > agora()) return logosCache.mapa;
      const corpo = await get('/connectors?countries=BR');
      const mapa = new Map();
      for (const c of corpo.results || []) {
        if (typeof c?.imageUrl === 'string' && c.imageUrl.startsWith('https://') && c.name && !mapa.has(normNome(c.name))) mapa.set(normNome(c.name), c.imageUrl);
      }
      logosCache = { mapa, expira: agora() + 6 * 3600_000 };
      return mapa;
    },
    item: (itemId) => get(`/items/${encodeURIComponent(itemId)}`, { tolerar404: true }),
    contas: async (itemId) => (await get(`/accounts?itemId=${encodeURIComponent(itemId)}`)).results ?? [],
    // GET /v2/transactions (cursor) — o /transactions paginado por número
    // deixa de existir depois de 2026-12-31.
    async transacoes(accountId, de, ate) {
      const todas = [];
      let consulta = `?accountId=${encodeURIComponent(accountId)}&dateFrom=${de}&dateTo=${ate}`;
      for (let pagina = 0; pagina < LIMITES.paginasPorConta && consulta; pagina++) {
        const corpo = await get(`/v2/transactions${consulta}`);
        if (Array.isArray(corpo.results)) todas.push(...corpo.results);
        // `next` é uma query string pronta; só aceitamos se continuar sendo
        // uma query string (nunca uma URL de outro host).
        consulta = typeof corpo.next === 'string' && corpo.next.startsWith('?') ? corpo.next : null;
      }
      return { transacoes: todas, truncado: Boolean(consulta) };
    },
  };
}

function texto(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

// Transação da Pluggy -> linha no formato do importador do app
// (IMPORT_TARGETS.transacoes em js/services/csvImport.js) + externo_id para
// nunca importar a mesma transação duas vezes. Devolve null para o que não
// deve virar lançamento (valor inválido/zero).
export function normalizarTransacao(t, conta) {
  if (!t || typeof t !== 'object' || typeof t.id !== 'string') return null;
  const valorBruto = Number(t.amount);
  if (!Number.isFinite(valorBruto) || valorBruto === 0) return null;
  const data = typeof t.date === 'string' && DATA.test(t.date.slice(0, 10)) ? t.date.slice(0, 10) : null;
  if (!data) return null;
  const cartao = conta?.type === 'CREDIT';
  // `type` é a fonte da verdade; o sinal do valor só vale se ele faltar.
  // No cartão, a Pluggy manda a compra como DEBIT e o estorno/pagamento como CREDIT.
  const tipo = t.type === 'CREDIT' ? 'entrada' : t.type === 'DEBIT' ? 'saida' : valorBruto > 0 ? 'entrada' : 'saida';
  const pendente = t.status === 'PENDING';
  const meta = t.creditCardMetadata || {};
  const parcelaAtual = Number.isInteger(meta.installmentNumber) && meta.installmentNumber > 0 ? meta.installmentNumber : null;
  const parcelaTotal = Number.isInteger(meta.totalInstallments) && meta.totalInstallments > 1 ? meta.totalInstallments : null;
  const empresa = texto(t.merchant?.businessName || t.merchant?.name, 120);
  const nomeConta = texto(conta?.name, 60) || (cartao ? 'Cartão' : 'Conta');
  return {
    externo_id: `pluggy:${t.id}`,
    tipo,
    titulo: texto(t.description, 200) || (tipo === 'entrada' ? 'Entrada' : 'Saída'),
    empresa_servico: empresa || '',
    categoria_nome: texto(t.category, 60),
    // Arredonda o ABSOLUTO: Math.round(-1234.5) = -1234 (iria pro lado errado).
    valor: (Math.round(Math.abs(valorBruto) * 100) / 100).toFixed(2),
    data_vencimento: data,
    // Conta corrente: já saiu/entrou. Cartão: vira pendente até a fatura.
    data_pagamento: !cartao && !pendente ? data : '',
    status: !cartao && !pendente ? 'pago' : 'pendente',
    parcela_atual: parcelaAtual && parcelaTotal ? String(parcelaAtual) : '',
    parcela_total: parcelaAtual && parcelaTotal ? String(parcelaTotal) : '',
    observacoes: `Open Finance · ${nomeConta}`,
    conta: nomeConta,
  };
}

// Conta da Pluggy -> resumo seguro para a tela (sem número completo).
// ---- Nome e logo do banco ---------------------------------------------------
// No Meu Pluggy a conexão se chama "MeuPluggy" (é um proxy); o banco de
// verdade vem do nome da conta ("Nu Pagamentos S.A. - Instituição de
// Pagamento"). Esta tabela traduz razão social -> nome conhecido, que também
// é o nome do conector da Pluggy (de onde vem o logo).
export const normNome = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const INSTITUICOES = [
  ['Nubank', /\bnu\s*(pagamentos|financeira|invest)|\bnubank/i],
  ['Itaú', /\bita[uú]/i],
  ['Bradesco', /bradesco/i],
  ['Banco do Brasil', /banco do brasil/i],
  ['Caixa', /caixa econ[oô]mica|\bcaixa\b/i],
  ['Santander', /santander/i],
  ['Inter', /banco inter\b|\binter\s*(s\.?a|&|pag)/i],
  ['C6 Bank', /\bc6\b/i],
  ['BTG Pactual', /\bbtg\b/i],
  ['XP Investimentos', /\bxp\b/i],
  ['Mercado Pago', /mercado\s*pago/i],
  ['PicPay', /picpay/i],
  ['PagBank', /pagbank|pagseguro/i],
  ['Sicoob', /sicoob/i],
  ['Sicredi', /sicredi/i],
  ['Banco Original', /banco original/i],
  ['Neon', /\bneon\b/i],
  ['Banrisul', /banrisul/i],
  ['Safra', /\bsafra\b/i],
  ['Banco Pan', /banco pan\b/i],
  ['Will Bank', /will\s*bank/i],
];
const EH_PROXY = new Set(['meupluggy', 'meupluggyopenfinance']);
export const conectorEhProxy = (nome) => EH_PROXY.has(normNome(nome));

export function nomeDoBanco(textoConta) {
  const t = texto(textoConta, 120);
  const achado = INSTITUICOES.find(([, re]) => re.test(t));
  if (achado) return achado[0];
  // Sem tabela: razão social limpa ("Banco XYZ S.A. - Instituição de Pagamento" -> "Banco XYZ").
  const limpo = t.split(' - ')[0].replace(/\b(s\.?\s?a\.?|ltda\.?|institui[cç][aã]o de pagamento)(?=\s|$)/gi, '').replace(/[\s,.-]+$/, '').trim();
  return limpo || 'Banco';
}

export function logoDoBanco(nome, logos) {
  if (!logos?.size) return '';
  const alvo = normNome(nome);
  if (logos.has(alvo)) return logos.get(alvo);
  // Parcial só com nome específico ("caixa" -> "caixaeconomicafederal"); um
  // genérico como "banco" pegaria o logo de outro banco. Entre os candidatos,
  // o nome mais curto ("itau" antes de "itauempresas").
  if (alvo.length < 4 || alvo === 'banco') return '';
  const candidatos = [...logos.keys()].filter((chave) => chave.startsWith(alvo)).sort((a, b) => a.length - b.length);
  return candidatos.length ? logos.get(candidatos[0]) : '';
}

export function resumoConta(c, banco = null) {
  const numero = texto(c?.number, 40);
  return {
    id: typeof c?.id === 'string' ? c.id : '',
    banco: banco?.nome || '',
    logo: banco?.logo || '',
    nome: texto(c?.name, 60) || 'Conta',
    tipo: c?.type === 'CREDIT' ? 'cartao' : 'conta',
    final: numero ? numero.slice(-4) : '',
    saldo: Number.isFinite(Number(c?.balance)) ? Number(c.balance) : null,
    moeda: texto(c?.currencyCode, 3) || 'BRL',
  };
}

export function resumoItem(item) {
  return {
    banco: texto(item?.connector?.name, 60) || 'Banco',
    logo: typeof item?.connector?.imageUrl === 'string' && item.connector.imageUrl.startsWith('https://') ? item.connector.imageUrl : '',
    status: texto(item?.status, 30),
    atualizado_em: typeof item?.lastUpdatedAt === 'string' ? item.lastUpdatedAt : null,
  };
}

// ---- Cifragem do Client Secret de cada pessoa ------------------------------
// AES-GCM 256, IV aleatório de 12 bytes a cada gravação; o owner_id entra
// como dado adicional autenticado (AAD) — um segredo copiado para a linha
// de outra pessoa não decifra. Formato: "v1.<iv base64>.<cifra base64>".
const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const deB64 = (txt) => Uint8Array.from(atob(txt), (c) => c.charCodeAt(0));

export async function importarChave(base64) {
  let bytes;
  try {
    bytes = deB64(String(base64 || ''));
  } catch {
    bytes = new Uint8Array();
  }
  if (bytes.length !== 32) throw new ErroOpenFinance(503, 'of_config', 'O Open Finance não está configurado corretamente no servidor.');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function cifrarSegredo(chave, texto, ownerId) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifra = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(ownerId) }, chave, new TextEncoder().encode(texto));
  return `v1.${b64(iv)}.${b64(cifra)}`;
}

export async function decifrarSegredo(chave, guardado, ownerId) {
  const [versao, iv, cifra] = String(guardado || '').split('.');
  if (versao !== 'v1' || !iv || !cifra) throw new ErroOpenFinance(503, 'of_config', 'Credencial guardada em formato desconhecido. Cadastre de novo.');
  try {
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv), additionalData: new TextEncoder().encode(ownerId) }, chave, deB64(cifra));
    return new TextDecoder().decode(claro);
  } catch {
    throw new ErroOpenFinance(503, 'of_config', 'Não foi possível ler a credencial guardada. Cadastre de novo.');
  }
}
