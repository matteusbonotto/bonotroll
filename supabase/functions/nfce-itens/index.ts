// Edge Function "nfce-itens" — recebe o link do QR code da NFC-e (cupom do
// mercado), busca a consulta pública na SEFAZ e devolve loja, data, total e
// itens. Toda a regra (validação anti-SSRF, leitura do HTML) está em
// _shared/nfceNucleo.js, testada em tests/unit/nfce-nucleo.test.js.
//
// Nada é gravado aqui: o app mostra os itens para a pessoa conferir e só ele
// salva a compra (com RLS, como qualquer outra escrita).
//
// Publicar: npx supabase functions deploy nfce-itens --no-verify-jwt
// (o token é conferido AQUI com auth.getUser, igual à "ia").
import { createClient } from 'npm:@supabase/supabase-js@2';
import { ErroNfce, LIMITES, buscarNota, origemPermitida, validarPedido } from '../_shared/nfceNucleo.js';

Deno.serve(async (req) => {
  const cors = {
    'Access-Control-Allow-Origin': origemPermitida(req.headers.get('Origin') ?? ''),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const json = (corpo: unknown, status = 200) =>
    new Response(JSON.stringify(corpo), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ ok: false, codigo: 'metodo' }, 405);

  try {
    if (Number(req.headers.get('Content-Length') ?? '0') > LIMITES.bytesCorpo) throw new ErroNfce(413, 'pedido_grande', 'Pedido grande demais.');
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) throw new ErroNfce(401, 'sessao', 'Entre na sua conta de novo e tente outra vez.');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: quem, error } = await admin.auth.getUser(token);
    if (error || !quem?.user) throw new ErroNfce(401, 'sessao', 'Entre na sua conta de novo e tente outra vez.');

    // limite por pessoa: a função busca páginas da SEFAZ e não pode virar proxy em massa
    const { data: liberado } = await admin.rpc('ia_consumir', { p_user: quem.user.id, p_tarefa: 'nfce', p_limite: 60 });
    if (liberado === false) throw new ErroNfce(429, 'limite', 'Muitas notas lidas hoje. Amanhã libera de novo.');
    if (!req.body) throw new ErroNfce(400, 'pedido_invalido', 'Pedido inválido.');
    const bruto = await new Response(req.body.pipeThrough(new TransformStream({
      n: 0, transform(pedaco, ctl) { this.n += pedaco.byteLength; if (this.n > LIMITES.bytesCorpo) ctl.error(new ErroNfce(413, 'pedido_grande', 'Pedido grande demais.')); else ctl.enqueue(pedaco); },
    } as Transformer<Uint8Array, Uint8Array> & { n: number }))).text();
    if (bruto.length > LIMITES.bytesCorpo) throw new ErroNfce(413, 'pedido_grande', 'Pedido grande demais.');
    let corpo: unknown;
    try {
      corpo = JSON.parse(bruto);
    } catch {
      throw new ErroNfce(400, 'pedido_invalido', 'Pedido inválido.');
    }
    const { url } = validarPedido(corpo);
    const nota = await buscarNota(url);
    console.log(JSON.stringify({ host: url.hostname, itens: nota.itens.length, status: 200 }));
    return json({ ok: true, nota });
  } catch (e) {
    const erro = e instanceof ErroNfce ? e : new ErroNfce(500, 'interno', 'Erro inesperado ao ler a nota.');
    console.log(JSON.stringify({ status: erro.status, codigo: erro.codigo }));
    return json({ ok: false, codigo: erro.codigo, erro: erro.message }, erro.status);
  }
});
