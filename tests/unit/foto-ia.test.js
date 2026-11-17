// Leitura de foto por IA (tarefa foto_ler): validação no servidor, corpo do
// Gemini com a imagem, formato da resposta e a normalização no app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ErroIa, LIMITES, TAREFAS, validarPedido, corpoGemini, lerRespostaGemini } from '../../supabase/functions/_shared/iaNucleo.js';
import { normalizarLeituraIa } from '../../js/services/ocr.js';

const erroCom = (codigo) => (e) => e instanceof ErroIa && e.codigo === codigo;
const ok = { tarefa: 'foto_ler', imagem: 'QUJD', mime: 'image/jpeg', contexto: 'cupom' };

test('foto_ler vale para Home e Business', () => {
  assert.equal(TAREFAS.foto_ler.apenasHome, false);
});

test('foto_ler valida imagem, formato e contexto', () => {
  assert.deepEqual(validarPedido(ok), ok);
  assert.equal(validarPedido({ ...ok, contexto: 'qualquer' }).contexto, 'produto');
  assert.throws(() => validarPedido({ ...ok, imagem: '' }), erroCom('sem_imagem'));
  assert.throws(() => validarPedido({ ...ok, imagem: 'não é base64!' }), erroCom('sem_imagem'));
  assert.throws(() => validarPedido({ ...ok, mime: 'image/svg+xml' }), erroCom('sem_imagem'));
  assert.throws(() => validarPedido({ ...ok, imagem: 'A'.repeat(LIMITES.caracteresImagem + 4) }), erroCom('imagem_grande'));
  assert.ok(LIMITES.bytesCorpo > LIMITES.caracteresImagem);
});

test('corpo do Gemini leva a imagem inline e pede JSON', () => {
  const c = corpoGemini(validarPedido(ok));
  assert.deepEqual(c.contents[0].parts[0], { inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } });
  assert.match(c.contents[0].parts[1].text, /cupom/);
  assert.equal(c.generationConfig.responseMimeType, 'application/json');
  assert.equal(c.generationConfig.responseSchema.type, 'OBJECT');
});

test('resposta da foto exige texto; a do IRPF continua exigindo itens', () => {
  const gem = (obj) => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(obj) }] } }] });
  assert.equal(lerRespostaGemini(200, gem({ legivel: true, texto: 'NESCAU 400G' }), 'foto_ler').texto, 'NESCAU 400G');
  assert.throws(() => lerRespostaGemini(200, gem({ legivel: true }), 'foto_ler'), erroCom('ia_resposta_invalida'));
  assert.throws(() => lerRespostaGemini(200, gem({ texto: 'x' })), erroCom('ia_resposta_invalida'));
});

test('normalização da leitura nunca aceita dado fora do formato', () => {
  assert.deepEqual(
    normalizarLeituraIa({ legivel: true, titulo: ' Nescau 2.0 400 g ', valor: 12.499, vencimento: '2027-03-10', texto: 'NESCAU' }),
    { titulo: 'Nescau 2.0 400 g', valor: 12.5, vencimento: '2027-03-10', texto: 'NESCAU' },
  );
  const ruim = normalizarLeituraIa({ legivel: true, titulo: '', valor: -3, vencimento: '2027-02-31', texto: 'x' });
  assert.deepEqual(ruim, { titulo: null, valor: null, vencimento: null, texto: 'x' });
  assert.deepEqual(normalizarLeituraIa(null), { titulo: null, valor: null, vencimento: null, texto: '' });
});

test('IA nas fotos só com autorização guardada; sem resposta = leitor do aparelho', async () => {
  const { iaFotosAutorizada } = await import('../../js/services/ocr.js');
  localStorage.setItem('bonotto_ia_fotos', 'sim');
  assert.equal(iaFotosAutorizada(), true);
  localStorage.setItem('bonotto_ia_fotos', 'nao');
  assert.equal(iaFotosAutorizada(), false);
  localStorage.removeItem('bonotto_ia_fotos');
  assert.equal(iaFotosAutorizada(), false); // sem confirm() (fora do navegador) nunca autoriza sozinho
  assert.equal(localStorage.getItem('bonotto_ia_fotos'), 'nao');
});
