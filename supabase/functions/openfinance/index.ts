// Edge Function "openfinance" — leitura de contas e transações bancárias via
// Pluggy (plano grátis "Meu Pluggy"). Ver docs/OPEN-FINANCE.md.
//
// Fluxo: token de login → credenciais da Pluggy DA PESSOA (cadastradas por
// ela, cifradas) ou, se ela está em PLUGGY_USUARIOS, as do servidor → ação:
//   credenciais  valida na Pluggy e guarda CLIENT_ID + SECRET (cifrado)
//   remover_credenciais  apaga as credenciais e as conexões da pessoa
//   status       conexões do usuário + contas/saldos de cada uma
//   vincular     guarda um itemId (depois de a Pluggy confirmar que existe)
//   desvincular  apaga a conexão do usuário (não mexe nas transações já importadas)
//   connect_token  token curto para abrir o Pluggy Connect no navegador
//   transacoes   transações do período, normalizadas para o importador do app,
//                marcando as que já foram importadas (transactions.externo_id)
// Nada de banco é gravado aqui além de openfinance_conexoes; importar é o
// app que faz, pela tela de revisão, com as políticas RLS de sempre.
//
// Segredos (npx supabase secrets set ...; valores nunca no repositório):
//   OPENFINANCE_CHAVE                        obrigatório — 32 bytes em base64 (cifra os secrets das pessoas)
//   PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET   opcionais — aplicação do titular (dashboard.pluggy.ai → Aplicação)
//   PLUGGY_USUARIOS                          uuids que usam as credenciais do servidor, separados por vírgula
//
// Publicar: npx supabase functions deploy openfinance --no-verify-jwt
// (o token é conferido AQUI com auth.getUser, igual à ia/excluir-conta).
import { createClient } from 'npm:@supabase/supabase-js@2';
import { origemPermitida } from '../_shared/iaNucleo.js';
import {
  ErroOpenFinance, LIMITES, cifrarSegredo, criarClientePluggy, decifrarSegredo, importarChave, normalizarTransacao, resumoConta, resumoItem,
  usuariosPermitidos, validarPedido,
} from '../_shared/openfinanceNucleo.js';

// Um cliente por aplicação da Pluggy, reaproveitando a apiKey de 2h entre
// chamadas da mesma instância. A chave do mapa inclui o secret para que
// trocar a credencial descarte o cliente antigo.
const clientes = new Map<string, ReturnType<typeof criarClientePluggy>>();
function clientePara(clientId: string, clientSecret: string) {
  const chave = `${clientId}:${clientSecret}`;
  let c = clientes.get(chave);
  if (!c) {
    if (clientes.size > 50) clientes.clear();
    c = criarClientePluggy({ clientId, clientSecret });
    clientes.set(chave, c);
  }
  return c;
}

async function lerCorpoLimitado(req: Request, limite: number): Promise<string> {
  if (!req.body) return '';
  const leitor = req.body.getReader();
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await leitor.cancel().catch(() => {});
      throw new ErroOpenFinance(413, 'pedido_grande', 'Pedido grande demais.');
    }
    pedacos.push(value);
  }
  const tudo = new Uint8Array(total);
  let pos = 0;
  for (const p of pedacos) {
    tudo.set(p, pos);
    pos += p.byteLength;
  }
  return new TextDecoder().decode(tudo);
}

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': origemPermitida(req.headers.get('Origin') ?? ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, codigo: 'metodo' }, 405);

  let acao = '?';
  try {
    const chaveCifra = Deno.env.get('OPENFINANCE_CHAVE');
    if (!chaveCifra) throw new ErroOpenFinance(503, 'of_sem_chave', 'O Open Finance ainda não foi ativado no servidor.');

    if (Number(req.headers.get('Content-Length') ?? '0') > LIMITES.bytesCorpo) throw new ErroOpenFinance(413, 'pedido_grande', 'Pedido grande demais.');

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) throw new ErroOpenFinance(401, 'sessao', 'Entre na sua conta de novo e tente outra vez.');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: quem, error: erroLogin } = await admin.auth.getUser(token);
    if (erroLogin || !quem?.user) throw new ErroOpenFinance(401, 'sessao', 'Entre na sua conta de novo e tente outra vez.');
    const userId = quem.user.id;

    let corpo: unknown;
    try {
      corpo = JSON.parse(await lerCorpoLimitado(req, LIMITES.bytesCorpo));
    } catch (e) {
      if (e instanceof ErroOpenFinance) throw e;
      throw new ErroOpenFinance(400, 'pedido_invalido', 'Pedido inválido.');
    }
    const pedido = validarPedido(corpo);
    acao = pedido.acao;

    const chave = await importarChave(chaveCifra);

    if (pedido.acao === 'credenciais') {
      // Só guarda o que a Pluggy aceitou de verdade.
      try {
        await criarClientePluggy({ clientId: pedido.clientId, clientSecret: pedido.clientSecret }).apiKey();
      } catch (e) {
        if (e instanceof ErroOpenFinance && e.codigo === 'pluggy_credencial') {
          throw new ErroOpenFinance(400, 'credencial_recusada', 'A Pluggy não aceitou esse Client ID / Client Secret. Confira no painel e cole de novo.');
        }
        throw e;
      }
      const segredo = await cifrarSegredo(chave, pedido.clientSecret, userId);
      const { error } = await admin.from('openfinance_credenciais')
        .upsert({ owner_id: userId, client_id: pedido.clientId, segredo_cifrado: segredo, atualizado_em: new Date().toISOString() });
      if (error) throw new ErroOpenFinance(503, 'of_config', 'Não foi possível salvar as credenciais.');
      return json({ ok: true });
    }

    if (pedido.acao === 'remover_credenciais') {
      // As conexões pertencem à aplicação removida: saem junto.
      await admin.from('openfinance_conexoes').delete().eq('owner_id', userId);
      const { error } = await admin.from('openfinance_credenciais').delete().eq('owner_id', userId);
      if (error) throw new ErroOpenFinance(503, 'of_config', 'Não foi possível remover as credenciais.');
      return json({ ok: true });
    }

    // Qual aplicação da Pluggy usar: a da própria pessoa; senão a do
    // servidor, só para quem está em PLUGGY_USUARIOS. Falha fechada.
    const { data: cred, error: erroCred } = await admin.from('openfinance_credenciais')
      .select('client_id, segredo_cifrado').eq('owner_id', userId).maybeSingle();
    if (erroCred) throw new ErroOpenFinance(503, 'of_config', 'O Open Finance não está configurado no banco.');
    let pluggy: ReturnType<typeof criarClientePluggy> | null = null;
    let origem: 'proprias' | 'servidor' | null = null;
    const idServidor = Deno.env.get('PLUGGY_CLIENT_ID');
    const segredoServidor = Deno.env.get('PLUGGY_CLIENT_SECRET');
    if (cred) {
      pluggy = clientePara(cred.client_id, await decifrarSegredo(chave, cred.segredo_cifrado, userId));
      origem = 'proprias';
    } else if (idServidor && segredoServidor && usuariosPermitidos(Deno.env.get('PLUGGY_USUARIOS')).has(userId.toLowerCase())) {
      pluggy = clientePara(idServidor, segredoServidor);
      origem = 'servidor';
    }
    if (!pluggy) {
      if (pedido.acao === 'status') return json({ ok: true, credenciais: null, conexoes: [] });
      throw new ErroOpenFinance(403, 'of_sem_credenciais', 'Cadastre primeiro as credenciais da sua Pluggy.');
    }

    // Toda consulta abaixo é filtrada por owner_id = userId (service_role
    // ignora RLS, então o filtro é obrigatório em cada uma).
    const conexoesDoUsuario = async () => {
      const { data, error } = await admin.from('openfinance_conexoes').select('item_id, apelido, criado_em').eq('owner_id', userId).order('criado_em');
      if (error) throw new ErroOpenFinance(503, 'of_config', 'O Open Finance não está configurado no banco.');
      return data ?? [];
    };

    if (pedido.acao === 'connect_token') {
      return json({ ok: true, connectToken: await pluggy.connectToken(userId) });
    }

    if (pedido.acao === 'vincular') {
      // Erro comum: colar o Client ID da aplicação no lugar do código da conexão.
      if ([cred?.client_id, idServidor].some((id) => id && id.toLowerCase() === pedido.itemId)) {
        throw new ErroOpenFinance(400, 'item_e_client_id', 'Esse é o Client ID da sua aplicação, não o código da conexão. Use o botão "Conectar banco" — ele vincula sozinho.');
      }
      const atuais = await conexoesDoUsuario();
      if (atuais.some((c) => c.item_id === pedido.itemId)) return json({ ok: true, jaExistia: true });
      if (atuais.length >= LIMITES.conexoesPorUsuario) throw new ErroOpenFinance(400, 'of_limite', `O plano grátis permite até ${LIMITES.conexoesPorUsuario} conexões.`);
      const item = await pluggy.item(pedido.itemId);
      if (!item) throw new ErroOpenFinance(404, 'item_nao_encontrado', 'Esse código não é de uma conexão da sua aplicação. O código do endereço do meu.pluggy.ai não serve: use o botão "Conectar banco".');
      const { error } = await admin.from('openfinance_conexoes').insert({ owner_id: userId, item_id: pedido.itemId, apelido: pedido.apelido });
      // 23505 = unique(item_id): a conexão já é de outra pessoa.
      if (error) throw new ErroOpenFinance(409, error.code === '23505' ? 'item_em_uso' : 'of_config', error.code === '23505' ? 'Essa conexão já está vinculada a outra conta.' : 'Não foi possível salvar a conexão.');
      return json({ ok: true, conexao: { item_id: pedido.itemId, ...resumoItem(item) } });
    }

    if (pedido.acao === 'desvincular') {
      const { error } = await admin.from('openfinance_conexoes').delete().eq('owner_id', userId).eq('item_id', pedido.itemId);
      if (error) throw new ErroOpenFinance(503, 'of_config', 'Não foi possível remover a conexão.');
      return json({ ok: true });
    }

    const conexoes = await conexoesDoUsuario();

    if (pedido.acao === 'status') {
      const lista = [];
      for (const c of conexoes) {
        const item = await pluggy.item(c.item_id);
        lista.push({
          item_id: c.item_id,
          apelido: c.apelido,
          ...(item ? resumoItem(item) : { banco: 'Conexão indisponível', status: 'INDISPONIVEL' }),
          contas: item ? (await pluggy.contas(c.item_id)).map(resumoConta) : [],
        });
      }
      return json({ ok: true, credenciais: origem, conexoes: lista });
    }

    // transacoes
    const linhas = [];
    let truncado = false;
    for (const c of conexoes) {
      if (!(await pluggy.item(c.item_id))) continue;
      for (const conta of await pluggy.contas(c.item_id)) {
        const r = await pluggy.transacoes(conta.id, pedido.de, pedido.ate);
        truncado ||= r.truncado;
        for (const t of r.transacoes) {
          const linha = normalizarTransacao(t, conta);
          if (linha) linhas.push(linha);
        }
      }
    }
    // Marca o que já foi importado por ESTE usuário (dedupe no banco também:
    // índice único owner_id + externo_id).
    const importadas = new Set<string>();
    const ids = linhas.map((l) => l.externo_id);
    for (let i = 0; i < ids.length; i += 500) {
      const { data, error } = await admin.from('transactions').select('externo_id').eq('owner_id', userId).in('externo_id', ids.slice(i, i + 500));
      if (error) throw new ErroOpenFinance(503, 'of_config', 'O Open Finance não está configurado no banco.');
      for (const r of data ?? []) importadas.add(r.externo_id);
    }
    linhas.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
    console.log(JSON.stringify({ acao, status: 200, total: linhas.length }));
    return json({ ok: true, truncado, transacoes: linhas.map((l) => ({ ...l, ja_importada: importadas.has(l.externo_id) })) });
  } catch (e) {
    const erro = e instanceof ErroOpenFinance ? e : new ErroOpenFinance(500, 'interno', 'Erro inesperado no Open Finance.');
    // Nunca registra corpo, token ou dado bancário — só ação e código.
    console.log(JSON.stringify({ acao, status: erro.status, codigo: erro.codigo }));
    return json({ ok: false, codigo: erro.codigo, erro: erro.message }, erro.status);
  }
});
