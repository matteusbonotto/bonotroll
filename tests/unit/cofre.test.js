import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarMaterialDoCofre, abrirComSenha, abrirComCodigo, cifrar, decifrar, reembrulharComNovaSenha } from '../../js/services/cofre.js';
import { paraLista, idade } from '../../js/services/saude.js';

test('cofre: cifra, abre com senha ou código, recusa senha errada e troca a senha sem perder dados', async () => {
  const m = await criarMaterialDoCofre('senha da familia 123');
  assert.match(m.codigo, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){5}$/);
  const ficha = { nome: 'Vó Rosa', tipo_sanguineo: 'O-', alergias: ['Dipirona'] };
  const texto = await cifrar(m.chaveDados, ficha);
  assert.ok(!texto.includes('Dipirona') && !texto.includes('Rosa'), 'servidor nunca vê o conteúdo');
  const cofre = { pela_senha: m.pela_senha, pelo_codigo: m.pelo_codigo };
  assert.deepEqual(await decifrar(await abrirComSenha(cofre, 'senha da familia 123'), texto), ficha);
  assert.deepEqual(await decifrar(await abrirComCodigo(cofre, m.codigo.toLowerCase()), texto), ficha);
  await assert.rejects(abrirComSenha(cofre, 'errada'), /Senha da família incorreta/);
  await assert.rejects(abrirComCodigo(cofre, 'AAAA-BBBB'), /Código de recuperação incorreto/);
  const nova = await reembrulharComNovaSenha(cofre, m.codigo, 'outra senha 456', true);
  assert.deepEqual(await decifrar(await abrirComSenha({ ...cofre, pela_senha: nova }, 'outra senha 456'), texto), ficha);
});

test('saúde: listas e idade', () => {
  assert.deepEqual(paraLista('Dipirona, Penicilina\nCamarão;'), ['Dipirona', 'Penicilina', 'Camarão']);
  assert.equal(idade('2000-10-05', new Date(2026, 9, 4)), 25);
  assert.equal(idade('2000-10-04', new Date(2026, 9, 4)), 26);
  assert.equal(idade(''), null);
});
