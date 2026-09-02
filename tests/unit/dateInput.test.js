// Campo de data digitável (máscara "dd/mm/aaaa" + seletor nativo ao lado) —
// ver js/utils/dateInput.js. Essas 3 funções puras rodam a cada tecla
// digitada em 16 campos de data do app, então os casos de borda de
// validação/máscara precisam estar bem cobertos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatarDataBR, parseDataBR, aplicarMascaraData } from '../../js/utils/dateInput.js';

// ---------- formatarDataBR ----------

test('formatarDataBR converte ISO pra BR', () => {
  assert.equal(formatarDataBR('2027-03-15'), '15/03/2027');
  assert.equal(formatarDataBR('2028-12-01'), '01/12/2028');
});

test('formatarDataBR: null/undefined/vazio vira string vazia, nunca lança', () => {
  assert.equal(formatarDataBR(null), '');
  assert.equal(formatarDataBR(undefined), '');
  assert.equal(formatarDataBR(''), '');
});

test('formatarDataBR: ISO malformado (faltando parte) vira string vazia em vez de "undefined/undefined/..."', () => {
  assert.equal(formatarDataBR('2027-03'), '');
  assert.equal(formatarDataBR('2027'), '');
  assert.equal(formatarDataBR('lixo'), '');
});

test('formatarDataBR tolera timestamp completo (defensivo, mesmo o app só usando `date` puro)', () => {
  assert.equal(formatarDataBR('2027-03-15T00:00:00'), '15/03/2027');
});

// ---------- parseDataBR ----------

test('parseDataBR converte BR pra ISO quando a data é real e completa', () => {
  assert.equal(parseDataBR('15/03/2027'), '2027-03-15');
  assert.equal(parseDataBR('01/12/2028'), '2028-12-01');
  assert.equal(parseDataBR('31/01/2027'), '2027-01-31');
});

test('parseDataBR: ano bissexto aceita 29/02, ano comum rejeita', () => {
  assert.equal(parseDataBR('29/02/2028'), '2028-02-29'); // 2028 é bissexto
  assert.equal(parseDataBR('29/02/2027'), null); // 2027 não é bissexto
  assert.equal(parseDataBR('29/02/2000'), '2000-02-29'); // bissexto (divisível por 400)
  assert.equal(parseDataBR('29/02/1900'), null); // NÃO bissexto (divisível por 100, não por 400)
});

test('parseDataBR rejeita dia/mês fora do calendário', () => {
  assert.equal(parseDataBR('32/01/2027'), null); // dia inexistente
  assert.equal(parseDataBR('31/02/2027'), null); // fevereiro nunca tem 31 dias
  assert.equal(parseDataBR('31/04/2027'), null); // abril tem 30 dias
  assert.equal(parseDataBR('00/13/2027'), null); // mês 13 não existe
  assert.equal(parseDataBR('00/01/2027'), null); // dia 0 não existe
  assert.equal(parseDataBR('15/00/2027'), null); // mês 0 não existe
});

test('parseDataBR: texto vazio ou parcial (qualquer ponto da digitação) retorna null sem lançar', () => {
  assert.equal(parseDataBR(''), null);
  assert.equal(parseDataBR('1'), null);
  assert.equal(parseDataBR('15'), null);
  assert.equal(parseDataBR('15/'), null);
  assert.equal(parseDataBR('15/0'), null);
  assert.equal(parseDataBR('15/03'), null);
  assert.equal(parseDataBR('15/03/'), null);
  assert.equal(parseDataBR('15/03/2'), null);
  assert.equal(parseDataBR('15/03/202'), null); // ano com 3 dígitos, ainda incompleto
});

test('parseDataBR: ano com 2 dígitos é rejeitado (decisão: só aceita ano de 4 dígitos, sem adivinhar século)', () => {
  assert.equal(parseDataBR('15/03/27'), null);
  assert.equal(parseDataBR('15/03/99'), null);
});

test('parseDataBR: formatos com separador errado ou lixo não quebram, só retornam null', () => {
  assert.equal(parseDataBR('15-03-2027'), null);
  assert.equal(parseDataBR('2027-03-15'), null); // ISO não é o formato aceito aqui, só BR
  assert.equal(parseDataBR('data qualquer'), null);
  assert.equal(parseDataBR(null), null);
  assert.equal(parseDataBR(undefined), null);
  assert.equal(parseDataBR(123), null);
});

test('parseDataBR: dia/mês com zero à esquerda preservado no ISO de volta (sem perder o zero)', () => {
  assert.equal(parseDataBR('05/07/2027'), '2027-07-05');
  assert.equal(parseDataBR('01/01/2030'), '2030-01-01');
});

test('parseDataBR: ano "0099" (quirk do construtor Date de 2 dígitos == 1900+n) é tratado literalmente via setFullYear', () => {
  assert.equal(parseDataBR('15/06/0099'), '0099-06-15');
});

// ---------- aplicarMascaraData ----------

test('aplicarMascaraData: digitação linear completa, dígito a dígito, produz "dd/mm/aaaa"', () => {
  let anterior = '';
  const teclas = ['1', '15', '15/0', '15/03', '15/03/2', '15/03/20', '15/03/202', '15/03/2027'];
  // Cada elemento simula o valor bruto que o campo teria após o navegador
  // aplicar aquela tecla (sem a máscara aplicada ainda pelas barras "extras"
  // que só nossa função adiciona) — o teste real de integração digita char a
  // char; aqui simulamos o resultado ficando cada vez mais completo.
  const esperado = ['1', '15/', '15/0', '15/03/', '15/03/2', '15/03/20', '15/03/202', '15/03/2027'];
  teclas.forEach((raw, i) => {
    const resultado = aplicarMascaraData(raw, anterior);
    assert.equal(resultado, esperado[i]);
    anterior = resultado; // a próxima tecla parte do texto já mascarado
  });
});

test('aplicarMascaraData: barra é inserida automaticamente assim que dia (2 dígitos) e mês (mais 2) completam', () => {
  assert.equal(aplicarMascaraData('15', '1'), '15/');
  assert.equal(aplicarMascaraData('15/03', '15/0'), '15/03/');
});

test('aplicarMascaraData: colar uma data completa de uma vez (não dígito a dígito) formata igual', () => {
  assert.equal(aplicarMascaraData('15/03/2027', ''), '15/03/2027');
  assert.equal(aplicarMascaraData('15032027', ''), '15/03/2027'); // colou só os dígitos, sem barras
});

test('aplicarMascaraData: colar substituindo um valor anterior inteiro também funciona', () => {
  assert.equal(aplicarMascaraData('01/12/2028', '15/03/2027'), '01/12/2028');
});

test('aplicarMascaraData: nunca passa de 8 dígitos (dd+mm+aaaa) mesmo digitando/colando mais', () => {
  assert.equal(aplicarMascaraData('15/03/20277777', ''), '15/03/2027');
  assert.equal(aplicarMascaraData('150320277777', ''), '15/03/2027');
});

test('aplicarMascaraData: backspace normal no fim do texto remove o último dígito sem travar', () => {
  assert.equal(aplicarMascaraData('15/03/202', '15/03/2027'), '15/03/202');
  assert.equal(aplicarMascaraData('15/03/20', '15/03/202'), '15/03/20');
});

test('aplicarMascaraData: backspace logo depois de uma barra automática não "trava" (não fica parado no mesmo texto)', () => {
  // Texto "15/" -> backspace -> navegador já removeu só a "/", dígitos
  // intactos ("15/" -> "15", ambos com dígitos "15"). Sem o tratamento da
  // armadilha, remontar de novo daria "15/" outra vez (parece que nada
  // aconteceu). O comportamento correto é remover o dígito "5" também.
  assert.equal(aplicarMascaraData('15', '15/'), '1');
});

test('aplicarMascaraData: mesma armadilha na barra entre mês e ano', () => {
  // "15/03/" -> backspace -> "15/03" (só a barra sumiu, dígitos "1503"
  // intactos) -> deve remover o "3" também, voltando pro dia completo + mês
  // parcial.
  assert.equal(aplicarMascaraData('15/03', '15/03/'), '15/0');
});

test('aplicarMascaraData: sequência real de digitar e depois apagar tudo, sem travar em nenhum ponto', () => {
  const digitados = ['1', '15', '15/0', '15/03', '15/03/2', '15/03/20', '15/03/202', '15/03/2027'];
  let anterior = '';
  const mascarados = [];
  digitados.forEach((raw) => {
    const r = aplicarMascaraData(raw, anterior);
    mascarados.push(r);
    anterior = r;
  });
  assert.equal(anterior, '15/03/2027');

  // Agora apaga de trás pra frente, um backspace real por vez, sempre
  // partindo do texto mascarado anterior e simulando o navegador removendo
  // só o último caractere daquele texto.
  let atual = anterior;
  let guardaAnterior = anterior;
  let iteracoes = 0;
  while (atual.length > 0 && iteracoes < 20) {
    guardaAnterior = atual;
    const bruto = atual.slice(0, -1); // navegador remove 1 caractere do fim
    atual = aplicarMascaraData(bruto, guardaAnterior);
    iteracoes += 1;
    assert.ok(atual.length < guardaAnterior.length || atual !== guardaAnterior, 'backspace nunca pode deixar o texto igual (travado)');
  }
  assert.equal(atual, '');
});

test('aplicarMascaraData: texto vazio digitado a partir de vazio continua vazio, sem lançar', () => {
  assert.equal(aplicarMascaraData('', ''), '');
});

test('aplicarMascaraData: entradas não-string (defensivo) não lançam, tratadas como vazio', () => {
  assert.equal(aplicarMascaraData(null, undefined), '');
  assert.equal(aplicarMascaraData(undefined, null), '');
});

test('aplicarMascaraData: remoção de dígito no MEIO do texto não trava (reconstrói o resto pra frente)', () => {
  // Apagar o "0" de "03" no meio de "15/03/2027" — o navegador entrega
  // "15/3/2027" (comportamento real do <input>, cursor no meio); a função
  // nunca lança e sempre devolve uma máscara válida e mais curta.
  const resultado = aplicarMascaraData('15/3/2027', '15/03/2027');
  assert.doesNotThrow(() => aplicarMascaraData('15/3/2027', '15/03/2027'));
  assert.equal(typeof resultado, 'string');
  assert.ok(resultado.length < '15/03/2027'.length);
});

test('aplicarMascaraData: resultado sempre round-trips com parseDataBR quando a data está completa', () => {
  const r = aplicarMascaraData('15/03/2027', '15/03/202');
  assert.equal(r, '15/03/2027');
  assert.equal(parseDataBR(r), '2027-03-15');
});
