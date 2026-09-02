// Campo de data digitável com máscara "dd/mm/aaaa" + seletor nativo ao lado
// (pedido: digitar uma data em 2027/2028 clicando no calendário nativo é
// lento demais quando o mês/ano está longe de hoje). Este módulo é só a
// lógica pura (formatação/parsing/máscara) — sem DOM, sem Alpine; a
// integração no HTML (trocar os <input type="date">, escutar @input, exibir
// o botão de calendário) é feita à parte, em cima destas 3 funções.
//
// Formato interno do app (ISO, o mesmo de data_vencimento/data_validade/etc,
// vindo de <input type="date"> ou de uma coluna `date` do Postgres):
// "aaaa-mm-dd". Formato de exibição/digitação (BR): "dd/mm/aaaa".

function apenasDigitos(texto) {
  return String(texto ?? '').replace(/\D/g, '');
}

// Monta "dd/mm/aaaa" a partir de uma sequência de até 8 dígitos, inserindo
// as barras automaticamente — inclusive uma barra "adiantada" assim que um
// grupo de 2 dígitos (dia) ou 4 dígitos (dia+mês) fica completo, mesmo antes
// do próximo dígito ser digitado. Isso é o que faz o campo virar "15/"
// sozinho depois do segundo dígito, convidando a pessoa a continuar pro mês,
// em vez de esperar ela digitar a barra manualmente (ela nem consegue, é
// campo mascarado).
function montarMascara(digitos) {
  let saida = '';
  for (let i = 0; i < digitos.length; i += 1) {
    if (i === 2 || i === 4) saida += '/';
    saida += digitos[i];
  }
  if (digitos.length === 2 || digitos.length === 4) saida += '/';
  return saida;
}

// "aaaa-mm-dd" -> "dd/mm/aaaa". null/undefined/'' -> ''. Nunca lança —
// qualquer coisa que não pareça uma data ISO completa também vira ''.
export function formatarDataBR(isoDate) {
  if (!isoDate) return '';
  const [ano, mes, diaBruto] = String(isoDate).split('-');
  if (!ano || !mes || !diaBruto) return '';
  const dia = diaBruto.slice(0, 2); // defensivo contra timestamp completo ("...T00:00:00"), embora as colunas do app sejam `date` puro
  return `${dia}/${mes}/${ano}`;
}

// "dd/mm/aaaa" -> "aaaa-mm-dd", só quando o texto está COMPLETO e é uma data
// de calendário real (rejeita 32/13/2027, 31/02/2027, 29/02 em ano não
// bissexto etc.). Qualquer coisa incompleta, mal formatada ou inválida
// retorna null — nunca lança exceção (é chamada a cada tecla digitada).
//
// Decisão: só aceita ano com exatamente 4 dígitos (rejeita "15/03/27").
// Menos ambíguo que adivinhar século a partir de 2 dígitos, e o app já lida
// com datas em 2027/2028+ (motivo do pedido original), então digitar o ano
// inteiro não é um custo real de digitação.
export function parseDataBR(textoBR) {
  if (typeof textoBR !== 'string') return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(textoBR.trim());
  if (!m) return null;
  const [, diaStr, mesStr, anoStr] = m;
  const dia = Number(diaStr);
  const mes = Number(mesStr);
  const ano = Number(anoStr);

  // new Date(ano, mes, dia) tem uma armadilha: pra `ano` entre 0 e 99 ela
  // interpreta como "1900 + ano" (só no construtor/Date.parse, não no
  // setFullYear). Usar setFullYear sobre uma data qualquer evita essa
  // reinterpretação e trata o ano literalmente, dígito por dígito.
  const d = new Date(0);
  d.setFullYear(ano, mes - 1, dia);
  // Round-trip: new Date normaliza mês/dia fora do intervalo (mês 13 vira
  // janeiro do ano seguinte, dia 31 de fevereiro vira 2/3 de março etc.) em
  // vez de lançar erro. Se o que voltou não bate exatamente com o que foi
  // digitado, a data não existe no calendário — cobre mês/dia inválidos e
  // ano bissexto (29/02) automaticamente, sem tabela de dias-por-mês.
  const valido = d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia;
  return valido ? `${anoStr}-${mesStr}-${diaStr}` : null;
}

// Chamada a cada tecla digitada (@input) num campo de texto mascarado.
// Recebe o valor atual do campo (já com o que o navegador acabou de aplicar
// — dígito novo, ou backspace/delete já executado) e o valor anterior (antes
// dessa tecla), devolve o texto já remascarado.
//
// Cuida de 3 coisas que uma implementação ingênua ("tira tudo que não é
// dígito e remonta") erra:
// 1. Digitação normal/colar texto completo: sempre funciona, porque
//    reconstrói do zero a partir dos dígitos brutos do texto atual.
// 2. Máximo de 8 dígitos (dd+mm+aaaa) — dígito extra digitado ou colado além
//    disso é ignorado silenciosamente, nunca cresce além de "dd/mm/aaaa".
// 3. A armadilha do backspace na barra automática: quando o cursor está logo
//    depois de uma barra que ESTE módulo inseriu (ex.: texto "15/", pessoa
//    aperta backspace), o navegador já removeu só a barra antes de chegar
//    aqui — os dígitos não mudaram, só o texto ficou 1 caractere mais curto.
//    Sem tratar isso, a remontagem recolocaria a mesma barra no mesmo lugar
//    e o backspace pareceria "não ter feito nada". Detectamos exatamente
//    esse caso (sumiu 1 caractere do texto, mas nenhum dígito sumiu) e
//    removemos o último dígito também, que é o que a pessoa queria de fato.
export function aplicarMascaraData(textoDigitado, textoAnterior = '') {
  const atual = typeof textoDigitado === 'string' ? textoDigitado : '';
  const anterior = typeof textoAnterior === 'string' ? textoAnterior : '';

  const digitosAtuais = apenasDigitos(atual);
  const digitosAnteriores = apenasDigitos(anterior);

  const apagouSoABarra = atual.length === anterior.length - 1
    && digitosAtuais.length > 0
    && digitosAtuais === digitosAnteriores;

  const digitos = (apagouSoABarra ? digitosAtuais.slice(0, -1) : digitosAtuais).slice(0, 8);
  return montarMascara(digitos);
}
