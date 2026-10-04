import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNfceQr, interpretScannedCode } from '../../js/services/barcode.js';

// Chave de exemplo: SP (35), 2026-09, CNPJ 12345678000195, modelo 65, série 001, nº 000012345.
const CHAVE = '35260912345678000195650010000123451000012345';

test('QR de NFC-e online: extrai estado, mês, CNPJ, modelo e número da chave', () => {
  const n = parseNfceQr(`https://www.nfce.fazenda.sp.gov.br/NFCeConsultaPublica/Paginas/ConsultaQRCode.aspx?p=${CHAVE}|2|1|1|ABCDEF`);
  assert.equal(n.uf, 'SP');
  assert.equal(n.anoMes, '09/2026');
  assert.equal(n.cnpj, '12345678000195');
  assert.equal(n.modelo, 'NFC-e');
  assert.equal(n.numero, '12345');
  assert.equal(n.valor, null);
});

test('QR de NFC-e offline traz o valor total', () => {
  const n = parseNfceQr(`https://sat.sef.sc.gov.br/nfce/consulta?p=${CHAVE}|2|1|05|87.40|abc|1|HASH`);
  assert.equal(n.valor, 87.4);
});

test('interpretScannedCode reconhece a nota e não confunde com boleto ou Pix', () => {
  const lido = interpretScannedCode(`https://x.gov.br/qrcode?p=${CHAVE}|2|1|1|H`);
  assert.equal(lido.tipo, 'nfce');
  assert.equal(lido.nota.cnpj, '12345678000195');
  assert.equal(interpretScannedCode('qualquer coisa').tipo, 'outro');
});

test('chave com modelo que não é nota fiscal é ignorada', () => {
  assert.equal(parseNfceQr('35260912345678000195990010000123451000012345'), null);
});
