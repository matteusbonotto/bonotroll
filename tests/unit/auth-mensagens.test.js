import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mensagemErroAuth } from '../../js/services/auth.js';

test('erros do Supabase Auth viram mensagens claras em português (2026-10-04)', () => {
  assert.match(mensagemErroAuth({ message: 'Invalid login credentials' }), /E-mail ou senha incorretos/);
  assert.match(mensagemErroAuth({ message: 'email rate limit exceeded' }), /Aguarde cerca de 1 hora/);
  assert.match(mensagemErroAuth({ message: 'Email not confirmed' }), /Confirme seu e-mail/);
  assert.match(mensagemErroAuth({ message: 'User already registered' }), /Já existe uma conta/);
  assert.match(mensagemErroAuth({ message: 'Failed to fetch' }), /Sem conexão/);
});
