import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  situacaoDoCadastro,
  normalizarCodigo,
  registrarEnvioConfirmacao,
  segundosParaReenviar,
  ESPERA_REENVIO_MS,
  erroDoRetornoAuth,
  mensagemErroAuth,
  patchCadastroOAuth,
} from '../../js/services/auth.js';

function storageFalso() {
  const mem = new Map();
  return { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), mem };
}

test('signUp: e-mail já cadastrado (identities vazia) NÃO é "conta criada" — bug do e-mail que nunca chega', () => {
  assert.equal(situacaoDoCadastro({ user: { id: 'x', identities: [] }, session: null }), 'ja_existe');
  assert.equal(situacaoDoCadastro({ user: { id: 'x', identities: [{ id: 'i' }] }, session: null }), 'confirmar_email');
  assert.equal(situacaoDoCadastro({ user: { id: 'x', identities: [{ id: 'i' }] }, session: { access_token: 't' } }), 'logado');
});

test('código de confirmação: aceita espaços/traço, recusa curto, longo ou vazio', () => {
  assert.equal(normalizarCodigo(' 123 456 '), '123456');
  assert.equal(normalizarCodigo('123-456'), '123456');
  assert.equal(normalizarCodigo('12345'), null);
  assert.equal(normalizarCodigo('12345678901'), null);
  assert.equal(normalizarCodigo(''), null);
});

test('espera do reenvio sobrevive a recarregar (fica no storage) e acaba em 60 s', () => {
  const st = storageFalso();
  const t0 = 1_000_000;
  assert.equal(segundosParaReenviar('a@b.com', t0, st), 0);
  registrarEnvioConfirmacao('A@B.com ', t0, st);
  assert.equal(segundosParaReenviar('a@b.com', t0 + 1000, st), 59, 'ignora maiúsculas e espaços');
  assert.equal(segundosParaReenviar('outro@b.com', t0 + 1000, st), 0, 'cada e-mail tem sua espera');
  assert.equal(segundosParaReenviar('a@b.com', t0 + ESPERA_REENVIO_MS, st), 0);
  assert.ok(![...st.mem.values()].join('').includes('a@b.com'), 'não guarda o e-mail em texto');
});

test('espera do reenvio: entradas vencidas são limpas ao registrar outra', () => {
  const st = storageFalso();
  registrarEnvioConfirmacao('um@b.com', 0, st);
  registrarEnvioConfirmacao('dois@b.com', ESPERA_REENVIO_MS + 1, st);
  assert.equal(Object.keys(JSON.parse(st.getItem('bonotto_reenvio_confirmacao'))).length, 1);
});

test('erro que volta do link do e-mail no endereço é reconhecido', () => {
  const e = erroDoRetornoAuth('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  assert.equal(e.code, 'otp_expired');
  assert.match(mensagemErroAuth(e), /expirado ou inválido/);
  assert.equal(erroDoRetornoAuth('#/transacoes'), null);
  assert.equal(erroDoRetornoAuth('#access_token=abc&type=signup'), null);
  assert.equal(erroDoRetornoAuth(''), null);
});

test('mensagens de cada falha do fluxo de confirmação', () => {
  assert.match(mensagemErroAuth({ message: 'Error sending confirmation email' }), /falha no serviço de e-mail/);
  assert.match(mensagemErroAuth({ message: 'Token has expired or is invalid', code: 'otp_expired' }), /expirado ou inválido/);
  assert.match(mensagemErroAuth({ message: 'For security purposes, you can only request this after 42 seconds.' }), /espere 42 segundos/);
  assert.match(mensagemErroAuth({ message: 'x', code: 'over_email_send_rate_limit' }), /Aguarde cerca de 1 hora/);
  assert.match(mensagemErroAuth({ message: 'Email address "x@y" is invalid', code: 'email_address_invalid' }), /não parece válido/);
  assert.match(mensagemErroAuth({ message: 'Signups not allowed for this instance' }), /temporariamente fechado/);
  assert.match(mensagemErroAuth({ message: 'Email not confirmed', code: 'email_not_confirmed' }), /digite o código/);
  assert.match(mensagemErroAuth({ message: 'x', code: 'user_already_exists' }), /Já existe uma conta/);
  assert.match(mensagemErroAuth({ message: 'Invalid login credentials' }), /E-mail ou senha incorretos/, 'senha errada não vira "código inválido"');
});

test('conta do Google: grava tipo escolhido na LP e nome, só quando falta', () => {
  const google = { app_metadata: { provider: 'google' }, user_metadata: { full_name: 'Bia Souza' } };
  assert.deepEqual(patchCadastroOAuth(google, 'business'), { tipo_conta: 'business', nome: 'Bia Souza' });
  assert.deepEqual(patchCadastroOAuth(google, 'qualquer'), { tipo_conta: 'home', nome: 'Bia Souza' });
  assert.equal(patchCadastroOAuth({ app_metadata: { provider: 'google' }, user_metadata: { tipo_conta: 'home', nome: 'Bia' } }, 'business'), null, 'não troca o que já existe');
  assert.equal(patchCadastroOAuth({ app_metadata: { provider: 'email' }, user_metadata: {} }, 'home'), null, 'cadastro por e-mail já leva os dados');
  assert.equal(patchCadastroOAuth(null, 'home'), null);
});
