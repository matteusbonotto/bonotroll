// Núcleo puro da Edge Function "nfce-itens" — lê a consulta pública da NFC-e
// (o link do QR code do cupom do mercado) e devolve loja, data, total e ITENS.
// Sem Deno.* aqui: roda igual no Deno (função) e no node --test
// (tests/unit/nfce-nucleo.test.js), com fetch injetável.
//
// Por que no servidor: a página da SEFAZ não libera CORS, então o navegador
// não consegue lê-la. O QR só traz a chave de acesso; os itens só existem lá.
//
// Segurança (a função busca uma URL que veio do usuário — risco de SSRF):
//  - só https/http, porta padrão, host terminando em .gov.br (portais das
//    SEFAZ); IP literal, usuário/senha na URL e qualquer outro host recusados;
//  - a URL precisa trazer uma chave de acesso de NFC-e (44 dígitos, modelo 65);
//  - redirecionamentos seguidos à mão (no máximo 3), revalidando cada destino;
//  - resposta limitada em bytes e em tempo.

export const LIMITES = {
  bytesCorpo: 4_096,
  bytesPagina: 2_000_000,
  tempoMs: 15_000,
  redirecionamentos: 3,
  itens: 400,
};

export class ErroNfce extends Error {
  constructor(status, codigo, mensagem) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

// ---------- Validação da URL do QR ----------
export function chaveDaUrl(texto) {
  const p = String(texto || '').match(/[?&]p=([^&#\s]+)/i);
  const base = p ? decodeURIComponent(p[1]).split('|')[0] : String(texto || '');
  const chave = base.replace(/\D/g, '').match(/\d{44}/)?.[0] || null;
  return chave && chave.slice(20, 22) === '65' ? chave : null;
}

export function hostPermitido(host) {
  const h = String(host || '').toLowerCase();
  if (!h || /^[\d.]+$/.test(h) || h.includes(':') || h.includes('[')) return false;
  return h.endsWith('.gov.br');
}

export function validarUrlNfce(texto) {
  let url;
  try {
    url = new URL(String(texto || '').trim());
  } catch {
    throw new ErroNfce(400, 'url_invalida', 'Esse QR code não é de uma nota fiscal do consumidor (NFC-e).');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || !hostPermitido(url.hostname)) {
    throw new ErroNfce(400, 'url_invalida', 'Esse QR code não aponta para o site da SEFAZ.');
  }
  if (!chaveDaUrl(url.href)) throw new ErroNfce(400, 'sem_chave', 'Não achei a chave de acesso da NFC-e nesse QR code.');
  return url;
}

export function validarPedido(corpo) {
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo) || typeof corpo.url !== 'string' || corpo.url.length > 1_500) {
    throw new ErroNfce(400, 'pedido_invalido', 'Pedido inválido.');
  }
  return { url: validarUrlNfce(corpo.url) };
}

// ---------- Leitura do HTML ----------
const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ordm: 'º', ordf: 'ª' };
// acentos do português: &Ccedil; &atilde; &eacute; &ocirc; ...
const ACENTOS = { cedil: '̧', tilde: '̃', acute: '́', grave: '̀', circ: '̂', uml: '̈' };
export function decodificarEntidades(s) {
  return String(s || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    if (ENTIDADES[e.toLowerCase()]) return ENTIDADES[e.toLowerCase()];
    const acento = e.match(/^([a-z])(cedil|tilde|acute|grave|circ|uml)$/i);
    return acento ? (acento[1] + ACENTOS[acento[2].toLowerCase()]).normalize('NFC') : m;
  });
}

export function semTags(html) {
  return decodificarEntidades(String(html || '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

// "1.234,56" → 1234.56 · "1,0000" → 1 · "1.0000" (MG usa ponto) → 1 · "27,9" → 27.9
export function numeroBr(s) {
  const t = String(s ?? '').replace(/[^\d.,-]/g, '');
  if (!t) return null;
  const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t);
  return Number.isFinite(n) ? n : null;
}

function porClasse(trecho, classe) {
  const m = trecho.match(new RegExp(`<[^>]+class="[^"]*\\b${classe}\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/(?:span|div|td|label)>`, 'i'));
  return m ? semTags(m[1]) : '';
}

const UNIDADES = { UN: 'un', UND: 'un', UNID: 'un', PC: 'un', PCT: 'un', CX: 'un', FD: 'un', DZ: 'un', KG: 'kg', KGS: 'kg', G: 'g', GR: 'g', L: 'l', LT: 'l', ML: 'ml' };
export function unidadeDoApp(un) {
  return UNIDADES[String(un || '').trim().toUpperCase()] || 'un';
}

function montarItem({ nome, codigo, quantidade, unidade, valorUnitario, valorTotal }) {
  const nomeLimpo = String(nome || '').replace(/\s+/g, ' ').trim();
  const total = valorTotal ?? (quantidade && valorUnitario ? Math.round(quantidade * valorUnitario * 100) / 100 : null);
  if (!nomeLimpo || !(total > 0)) return null;
  const qtd = quantidade > 0 ? quantidade : 1;
  return {
    nome: nomeLimpo,
    codigo: codigo && /^\d{8,14}$/.test(codigo) ? codigo : null,
    quantidade: qtd,
    unidade: unidadeDoApp(unidade),
    unidadeNota: String(unidade || 'UN').trim().toUpperCase(),
    valorUnitario: valorUnitario > 0 ? valorUnitario : Math.round((total / qtd) * 100) / 100,
    valorTotal: total,
  };
}

// Layout padrão da consulta da NFC-e (SP, PR, RS/SVRS, SC, BA, GO, DF, ES...):
// <tr id="Item + 1"> <span class="txtTit">NOME</span> <span class="RCod">(Código: 789...)</span>
// <span class="Rqtd"><strong>Qtde.:</strong>2</span> <span class="RUN"><strong>UN: </strong>UN</span>
// <span class="RvlUnit"><strong>Vl. Unit.:</strong> 3,49</span> ... <span class="valor">6,98</span>
function itensLayoutPadrao(html) {
  const blocos = html.split(/<tr[^>]+id="Item\s*\+?\s*\d+"[^>]*>/i).slice(1);
  const itens = [];
  for (const bloco of blocos) {
    const trecho = bloco.split(/<\/tr>/i)[0];
    const item = montarItem({
      nome: porClasse(trecho, 'txtTit2') || porClasse(trecho, 'txtTit'),
      codigo: (porClasse(trecho, 'RCod').match(/\d{6,14}/) || [])[0],
      quantidade: numeroBr(porClasse(trecho, 'Rqtd').replace(/qtde\.?:?/i, '')),
      unidade: porClasse(trecho, 'RUN').replace(/UN:\s*/i, ''),
      valorUnitario: numeroBr(porClasse(trecho, 'RvlUnit').replace(/vl\.?\s*unit\.?:?/i, '')),
      valorTotal: numeroBr(porClasse(trecho, 'valor')),
    });
    if (item) itens.push(item);
  }
  return itens;
}

// Reserva para portais com outro HTML (MG e afins): procura o mesmo padrão
// no TEXTO da página — "NOME (Código: 123) Qtde...: 2 UN: KG ... Vl. Unit.: 3,49 ... Vl. Total 6,98".
const PADRAO_TEXTO = /([^()]{2,120}?)\s*\(\s*C[óo]digo\s*:?\s*(\d*)\s*\)\s*Qtde[^:]*:\s*([\d.,]+)\s*UN\s*:?\s*([A-Za-z]{1,5})\s*(?:Vl\.?\s*Unit\.?\s*:?\s*(?:R\$\s*)?([\d.,]+))?\s*(?:Vl\.?\s*Total|Valor\s+total\s*(?:R\$)?)\s*:?\s*(?:R\$\s*)?([\d.,]+)/gi;
function itensPorTexto(html) {
  // linha a linha da tabela quando houver (evita o nome "engolir" o texto de antes); senão a página toda
  const linhas = String(html).match(/<tr[\s\S]*?<\/tr>/gi)?.map(semTags) || [semTags(html)];
  const itens = [];
  for (const m of linhas.flatMap((l) => [...l.matchAll(PADRAO_TEXTO)])) {
    const item = montarItem({
      nome: m[1].replace(/^.*?(?:Vl\.?\s*Total\s*[\d.,]+|R\$\s*[\d.,]+)\s*/i, ''),
      codigo: m[2],
      quantidade: numeroBr(m[3]),
      unidade: m[4],
      valorUnitario: numeroBr(m[5]),
      valorTotal: numeroBr(m[6]),
    });
    if (item) itens.push(item);
  }
  return itens;
}

function dataEmissao(texto) {
  const m = texto.match(/Emiss[ãa]o\s*:?\s*(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/i) || texto.match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):\d{2}/);
  if (!m) return null;
  const [, d, mes, a, h = '12', min = '00'] = m;
  return `${a}-${mes}-${d}T${h}:${min}:00-03:00`;
}

const FORMAS = [
  [/cart[ãa]o\s+de\s+cr[ée]dito|cr[ée]dito/i, 'credito'],
  [/cart[ãa]o\s+de\s+d[ée]bito|d[ée]bito/i, 'debito'],
  [/\bpix\b|pagamento instant/i, 'pix'],
  [/dinheiro/i, 'dinheiro'],
  [/vale\s+(?:alimenta|refei)/i, 'vale'],
];

export function extrairNotaDoHtml(html) {
  const bruto = String(html || '');
  const texto = semTags(bruto);
  let itens = itensLayoutPadrao(bruto);
  if (!itens.length) itens = itensPorTexto(bruto);
  itens = itens.slice(0, LIMITES.itens);

  const mercado = porClasse(bruto, 'txtTopo') || (texto.match(/^(.{3,80}?)\s+CNPJ\s*:/i) || [])[1] || null;
  const cnpj = (texto.match(/CNPJ\s*:?\s*([\d./-]{14,18})/i) || [])[1]?.replace(/\D/g, '') || null;
  const totalTexto = porClasse(bruto, 'totalNumb\\s+txtMax') || (texto.match(/Valor\s+a\s+pagar\s*R?\$?\s*:?\s*([\d.,]+)/i) || [])[1] || (texto.match(/Valor\s+total\s*R?\$?\s*:?\s*([\d.,]+)/i) || [])[1];
  const somaItens = Math.round(itens.reduce((s, i) => s + i.valorTotal, 0) * 100) / 100;
  const total = numeroBr(totalTexto) || somaItens || null;
  const trechoPagamento = (texto.match(/Forma\s+de\s+pagamento[\s\S]{0,200}/i) || [''])[0];
  const forma = FORMAS.find(([re]) => re.test(trechoPagamento))?.[1] || null;
  return {
    mercado: mercado ? mercado.replace(/\s+/g, ' ').trim() : null,
    cnpj: cnpj && cnpj.length === 14 ? cnpj : null,
    emissao: dataEmissao(texto),
    total,
    formaPagamento: forma,
    itens,
  };
}

// ---------- Busca na SEFAZ (fetch injetável) ----------
function charsetDe(contentType, cabeca) {
  const m = String(contentType || '').match(/charset=([\w-]+)/i) || String(cabeca || '').match(/<meta[^>]+charset=["']?([\w-]+)/i);
  const c = (m?.[1] || 'utf-8').toLowerCase();
  return c === 'iso-8859-1' || c === 'latin1' || c === 'windows-1252' ? 'windows-1252' : 'utf-8';
}

async function lerLimitado(resposta, limite) {
  if (!resposta.body) return new Uint8Array(await resposta.arrayBuffer()).slice(0, limite);
  const leitor = resposta.body.getReader();
  const partes = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await leitor.cancel().catch(() => {});
      throw new ErroNfce(502, 'pagina_grande', 'A página da SEFAZ veio grande demais.');
    }
    partes.push(value);
  }
  const tudo = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    tudo.set(p, pos);
    pos += p.byteLength;
  }
  return tudo;
}

export async function buscarNota(url, { fetch: fetcher = globalThis.fetch, tempoMs = LIMITES.tempoMs } = {}) {
  let atual = url instanceof URL ? url : validarUrlNfce(url);
  const ctrl = new AbortController();
  const relogio = setTimeout(() => ctrl.abort(), tempoMs);
  try {
    for (let salto = 0; salto <= LIMITES.redirecionamentos; salto++) {
      let r;
      try {
        r = await fetcher(atual.href, {
          redirect: 'manual',
          signal: ctrl.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (BNTT; leitura de NFC-e)', Accept: 'text/html,application/xhtml+xml' },
        });
      } catch {
        throw new ErroNfce(504, 'sefaz_fora', 'O site da SEFAZ não respondeu. Tente de novo ou use a foto do cupom.');
      }
      if (r.status >= 300 && r.status < 400) {
        const destino = r.headers.get('location');
        if (!destino) break;
        const prox = new URL(destino, atual);
        if (!['https:', 'http:'].includes(prox.protocol) || prox.port || !hostPermitido(prox.hostname)) throw new ErroNfce(502, 'sefaz_redireciona', 'O site da SEFAZ mandou para um endereço não confiável.');
        atual = prox;
        continue;
      }
      if (!r.ok) throw new ErroNfce(502, 'sefaz_erro', `O site da SEFAZ respondeu com erro (${r.status}). Tente de novo ou use a foto do cupom.`);
      const bytes = await lerLimitado(r, LIMITES.bytesPagina);
      const cabeca = new TextDecoder('utf-8').decode(bytes.slice(0, 2048));
      const html = new TextDecoder(charsetDe(r.headers.get('content-type'), cabeca)).decode(bytes);
      const nota = extrairNotaDoHtml(html);
      if (!nota.itens.length) {
        const captcha = /captcha|recaptcha|hcaptcha/i.test(html);
        throw new ErroNfce(422, captcha ? 'sefaz_captcha' : 'sem_itens', captcha
          ? 'O site da SEFAZ deste estado pede uma verificação "não sou robô". Use a foto do cupom.'
          : 'Não consegui ler os itens desta nota no site da SEFAZ. Use a foto do cupom.');
      }
      return { ...nota, chave: chaveDaUrl(url.href || String(url)) };
    }
    throw new ErroNfce(502, 'sefaz_redireciona', 'O site da SEFAZ redirecionou vezes demais.');
  } finally {
    clearTimeout(relogio);
  }
}

// Origens que podem chamar a função (produção + desenvolvimento local).
export const ORIGENS = ['https://bnttapp.web.app', 'http://localhost:5510'];
export function origemPermitida(origem) {
  return ORIGENS.includes(origem) ? origem : ORIGENS[0];
}
