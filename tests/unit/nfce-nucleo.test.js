// Leitura da nota do mercado: núcleo da Edge Function "nfce-itens" (URL
// segura, HTML da SEFAZ → itens) e leitor da foto do cupom (OCR) do app.
// Nenhuma chamada real à SEFAZ: o fetch é simulado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ErroNfce, validarUrlNfce, validarPedido, hostPermitido, chaveDaUrl, numeroBr, extrairNotaDoHtml, buscarNota,
} from '../../supabase/functions/_shared/nfceNucleo.js';
import { itensDoCupomPorTexto, dadosDoCupomPorTexto, lerNotaPeloQr } from '../../js/services/notaMercado.js';

const CHAVE = '35261012345678000190650010000123451000123450';
const URL_SP = `https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${CHAVE}|2|1|1|ABCDEF`;
const erroCom = (codigo) => (e) => e instanceof ErroNfce && e.codigo === codigo;

// Trecho real do layout padrão (SP/PR/SVRS), com entidades e espaços como vêm.
const HTML_PADRAO = `<html><head><meta charset="utf-8"></head><body>
<div id="u20" class="txtTopo">SUPERMERCADO BOM PRE&Ccedil;O LTDA</div>
<div class="text">CNPJ: 12.345.678/0001-90</div>
<table id="tabResult">
<tr id="Item + 1"><td valign="top"><span class="txtTit2">ARROZ TIPO 1 5KG</span><span class="RCod">(Código: 7896006716112 )</span><br/>
<span class="Rqtd"><strong>Qtde.:</strong>1</span><span class="RUN"><strong>UN: </strong>UN</span><span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;&nbsp;27,9</span></td>
<td align="right" valign="top" class="txtTit noWrap">Vl. Total<br/><span class="valor">27,90</span></td></tr>
<tr id="Item + 2"><td valign="top"><span class="txtTit2">BANANA PRATA</span><span class="RCod">(Código: 2000123 )</span><br/>
<span class="Rqtd"><strong>Qtde.:</strong>1,235</span><span class="RUN"><strong>UN: </strong>KG</span><span class="RvlUnit"><strong>Vl. Unit.:</strong>&nbsp;&nbsp;6,99</span></td>
<td align="right" valign="top" class="txtTit noWrap">Vl. Total<br/><span class="valor">8,63</span></td></tr>
</table>
<div id="linhaTotal"><label>Valor a pagar R$:</label><span class="totalNumb txtMax">36,53</span></div>
<div id="linhaForma"><label>Forma de pagamento:</label><span class="totalNumb txtTit">Valor pago R$:</span></div>
<div><label class="tx">Cartão de Crédito</label><span class="totalNumb">36,53</span></div>
<ul><li><strong>Emissão: </strong>25/10/2026 10:31:45 - Via Consumidor</li></ul>
</body></html>`;

test('URL: só portais .gov.br com chave de NFC-e', () => {
  assert.equal(validarUrlNfce(URL_SP).hostname, 'www.nfce.fazenda.sp.gov.br');
  assert.throws(() => validarUrlNfce('https://evil.com/?p=' + CHAVE), erroCom('url_invalida'));
  assert.throws(() => validarUrlNfce('https://sefaz.gov.br.evil.com/?p=' + CHAVE), erroCom('url_invalida'));
  assert.throws(() => validarUrlNfce('http://169.254.169.254/?p=' + CHAVE), erroCom('url_invalida'));
  assert.throws(() => validarUrlNfce('https://user:x@www.fazenda.pr.gov.br/?p=' + CHAVE), erroCom('url_invalida'));
  assert.throws(() => validarUrlNfce('https://www.fazenda.pr.gov.br:8443/?p=' + CHAVE), erroCom('url_invalida'));
  assert.throws(() => validarUrlNfce('file:///etc/passwd'), erroCom('url_invalida'));
  assert.throws(() => validarUrlNfce('https://www.fazenda.pr.gov.br/nfce/qrcode?p=123'), erroCom('sem_chave'));
  // modelo 55 (NF-e) não é cupom de mercado
  assert.throws(() => validarUrlNfce('https://www.fazenda.pr.gov.br/?p=' + CHAVE.slice(0, 20) + '55' + CHAVE.slice(22)), erroCom('sem_chave'));
  assert.throws(() => validarPedido({ url: 'x'.repeat(2000) }), erroCom('pedido_invalido'));
  assert.equal(hostPermitido('10.0.0.1'), false);
  assert.equal(chaveDaUrl(URL_SP), CHAVE);
});

test('números no formato brasileiro e do MG', () => {
  assert.equal(numeroBr('1.234,56'), 1234.56);
  assert.equal(numeroBr('1,0000'), 1);
  assert.equal(numeroBr('1.0000'), 1);
  assert.equal(numeroBr('27,9'), 27.9);
  assert.equal(numeroBr(''), null);
});

test('HTML padrão da SEFAZ → loja, data, total, pagamento e itens', () => {
  const nota = extrairNotaDoHtml(HTML_PADRAO);
  assert.equal(nota.mercado, 'SUPERMERCADO BOM PREÇO LTDA');
  assert.equal(nota.cnpj, '12345678000190');
  assert.equal(nota.emissao, '2026-10-25T10:31:00-03:00');
  assert.equal(nota.total, 36.53);
  assert.equal(nota.formaPagamento, 'credito');
  assert.equal(nota.itens.length, 2);
  assert.deepEqual(nota.itens[0], { nome: 'ARROZ TIPO 1 5KG', codigo: '7896006716112', quantidade: 1, unidade: 'un', unidadeNota: 'UN', valorUnitario: 27.9, valorTotal: 27.9 });
  assert.equal(nota.itens[1].unidade, 'kg');
  assert.equal(nota.itens[1].quantidade, 1.235);
  assert.equal(nota.itens[1].codigo, null); // código interno curto não é EAN
});

test('outro layout (texto corrido, estilo MG) cai no leitor por texto', () => {
  const html = `<div>MERCADO MINEIRO</div><table><tr><td><h7>CAFE TORRADO 500G</h7>(Código: 7891234567895)</td><td>Qtde total de ítens: 2.0000</td><td>UN: UN</td><td>Valor total R$: R$ 31,80</td></tr>
  <tr><td><h7>PAO DE QUEIJO</h7>(Código: 123)</td><td>Qtde total de ítens: 0.5000</td><td>UN: KG</td><td>Valor total R$: R$ 14,95</td></tr></table>`;
  const nota = extrairNotaDoHtml(html);
  assert.equal(nota.itens.length, 2);
  assert.equal(nota.itens[0].nome, 'CAFE TORRADO 500G');
  assert.equal(nota.itens[0].quantidade, 2);
  assert.equal(nota.itens[0].valorUnitario, 15.9);
  assert.equal(nota.itens[1].unidade, 'kg');
  assert.equal(nota.total, 46.75);
});

test('busca: segue redirecionamento só para .gov.br e lê latin1', async () => {
  const latin1 = Buffer.from(HTML_PADRAO.replace('charset="utf-8"', 'charset="iso-8859-1"').replace('Código', 'Código'), 'latin1');
  const chamadas = [];
  const fetch = async (url) => {
    chamadas.push(url);
    if (chamadas.length === 1) return new Response(null, { status: 302, headers: { location: 'https://dfe-portal.svrs.rs.gov.br/Dfe/QrCodeNFce?p=' + CHAVE } });
    return new Response(latin1, { status: 200, headers: { 'content-type': 'text/html; charset=iso-8859-1' } });
  };
  const nota = await buscarNota(validarUrlNfce(URL_SP), { fetch });
  assert.equal(nota.itens.length, 2);
  assert.equal(nota.chave, CHAVE);
  assert.match(chamadas[1], /svrs\.rs\.gov\.br/);

  const paraFora = async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/admin' } });
  await assert.rejects(buscarNota(validarUrlNfce(URL_SP), { fetch: paraFora }), erroCom('sefaz_redireciona'));

  const captcha = async () => new Response('<div class="g-recaptcha"></div>', { status: 200 });
  await assert.rejects(buscarNota(validarUrlNfce(URL_SP), { fetch: captcha }), erroCom('sefaz_captcha'));
});

test('foto do cupom: linhas de item viram itens; total e cabeçalho ignorados', () => {
  const texto = `SUPERMERCADO BOM PRECO
CNPJ 12.345.678/0001-90
25/10/2026 10:31
001 7896006716112 ARROZ TIPO 1 5KG 1 UN X 27,90 27,90
002 FEIJAO CARIOCA 1KG 2UN x 8,49 16,98
003 BANANA PRATA 1,235 KG X 6,99 8,63
TOTAL R$ 53,51`;
  const itens = itensDoCupomPorTexto(texto);
  assert.equal(itens.length, 3);
  assert.equal(itens[0].nome, 'ARROZ TIPO 1 5KG');
  assert.equal(itens[1].quantidade, 2);
  assert.equal(itens[2].unidade, 'kg');
  const dados = dadosDoCupomPorTexto(texto);
  assert.equal(dados.mercado, 'SUPERMERCADO BOM PRECO');
  assert.equal(dados.emissao.slice(0, 10), '2026-10-25');
  assert.equal(dados.total, 53.51);
});

test('cliente: QR que não é NFC-e é recusado antes de chamar o servidor', async () => {
  await assert.rejects(lerNotaPeloQr('https://exemplo.com', { demo: false, token: 't', fetch: () => assert.fail('não devia chamar') }), (e) => e.codigo === 'sem_chave');
  const nota = await lerNotaPeloQr(URL_SP, { demo: true });
  assert.ok(nota.itens.length > 0);
});
