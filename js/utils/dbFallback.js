// PGRST204 (PostgREST) = "coluna X não existe nessa tabela ainda" — acontece
// quando o schema.sql foi atualizado com uma coluna nova (ex.: "prioridade",
// "data_validade", "codigo_barras") mas a pessoa ainda não rodou a migração
// de novo no SQL Editor do Supabase dela. Detecta o NOME da coluna na
// mensagem de erro (em vez de precisar de uma lista fixa de nomes conhecidos
// hardcoded) e tira ela do objeto pra tentar de novo — assim toda escrita
// nova continua funcionando (só sem aquele campo específico) até a pessoa
// rodar a migração, em vez de travar a ação inteira.
function nomeColunaFaltando(e) {
  if (e?.code !== 'PGRST204' && !/could not find the .* column|column .* does not exist/i.test(e?.message || '')) return null;
  const m = /column ['"]?([a-z_]+)['"]?/i.exec(e?.message || '') || /find the ['"]?([a-z_]+)['"]?/i.exec(e?.message || '');
  return m ? m[1] : null;
}

// Insere/atualiza tentando de novo sem colunas que ainda não existem no
// banco do usuário (até 3 vezes — mais que isso e algo mais grave está
// errado, melhor deixar o erro real aparecer). `executar` recebe o objeto
// atual e deve retornar { data, error } (o formato de resposta do
// supabase-js), não lançar exceção direto.
export async function comFallbackDeColuna(executar, objeto) {
  let atual = objeto;
  for (let tentativas = 0; tentativas < 3; tentativas++) {
    const { data, error } = await executar(atual);
    if (!error) return data;
    const coluna = nomeColunaFaltando(error);
    if (!coluna || !(coluna in atual)) throw error;
    const { [coluna]: _omit, ...resto } = atual;
    atual = resto;
  }
  throw new Error('Não foi possível salvar — colunas do banco desatualizadas.');
}
