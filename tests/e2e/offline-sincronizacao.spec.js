// Modo offline (2026-10-11) de ponta a ponta, sem Supabase real: o app vê
// um "Supabase" falso (config.js trocado + page.route) que o teste derruba e
// religa. Cobre: abrir sem servidor usando a cópia local, lançamento feito
// sem servidor vai para a fila, a fila sobrevive a recarregar, sincroniza
// UMA vez quando o servidor volta, e o logout apaga a cópia local.
import { test, expect } from '@playwright/test';

const REF = 'testebnttfalso00000';
const SB = `https://${REF}.supabase.co`;
const UID = '11111111-1111-4111-8111-111111111111';
test.use({ serviceWorkers: 'block' });

function servidorFalso() {
  return {
    fora: false,
    inserts: [],
    tabelas: {
      profiles: [{ id: UID, nome: 'Teste Offline', email: 'offline@exemplo.com', cor: '#0E9F6E' }],
      transactions: [{ id: 'aaaaaaaa-0000-4000-8000-000000000001', owner_id: UID, titulo: 'Conta de luz', valor: 120, tipo: 'saida', data_vencimento: '2026-10-20', data_cadastro: '2026-10-01', criado_em: '2026-10-01T10:00:00Z' }],
    },
  };
}

async function prepararApp(page, srv) {
  await page.route('**/js/data/config.js', async (route) => {
    const original = await (await route.fetch()).text();
    await route.fulfill({ contentType: 'application/javascript', body: original.replace('https://SEU-PROJETO.supabase.co', SB).replace('SUA-ANON-KEY', 'sb_publishable_teste') });
  });
  await page.route(`${SB}/**`, async (route) => {
    if (srv.fora) return route.abort('internetdisconnected');
    const req = route.request();
    const url = new URL(req.url());
    if (url.pathname === '/auth/v1/health') return route.fulfill({ status: 200, contentType: 'application/json', body: '{"name":"GoTrue"}' });
    if (url.pathname.startsWith('/auth/v1/logout')) return route.fulfill({ status: 204, body: '' });
    if (url.pathname.startsWith('/rest/v1/rpc/')) return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
    const tabela = url.pathname.replace('/rest/v1/', '');
    const objeto = (req.headers()['accept'] || '').includes('vnd.pgrst.object');
    if (req.method() === 'POST') {
      const corpo = req.postDataJSON();
      const linhas = Array.isArray(corpo) ? corpo : [corpo];
      for (const l of linhas) {
        srv.inserts.push({ tabela, ...l });
        const lista = (srv.tabelas[tabela] ||= []);
        if (l.id && lista.some((x) => x.id === l.id)) {
          return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'duplicate key value violates unique constraint' }) });
        }
        lista.push(l);
      }
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(objeto ? linhas[0] : linhas) });
    }
    const lista = srv.tabelas[tabela] || [];
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(objeto ? lista[0] ?? null : lista) });
  });
  // Sessão já salva (como quem entrou ontem): o supabase-js lê do storage.
  await page.addInitScript(([chave, uid]) => {
    if (localStorage.getItem(chave) || sessionStorage.getItem('teste-saiu')) return;
    const agora = Math.floor(Date.now() / 1000);
    localStorage.setItem(chave, JSON.stringify({
      access_token: 'token-falso', token_type: 'bearer', expires_in: 3600, expires_at: agora + 3600, refresh_token: 'refresh-falso',
      user: { id: uid, aud: 'authenticated', role: 'authenticated', email: 'offline@exemplo.com', app_metadata: { provider: 'email' }, user_metadata: { nome: 'Teste Offline', tipo_conta: 'home' }, created_at: '2026-01-01T00:00:00Z' },
    }));
  }, [`sb-${REF}-auth-token`, UID]);
}

const indicador = (page) => page.locator('.cg-sync');

test('sem servidor: abre pela cópia local, guarda o lançamento, envia uma vez quando volta', async ({ page }) => {
  const srv = servidorFalso();
  await prepararApp(page, srv);

  // 1) Online: abre e carrega as movimentações (vira cópia local).
  await page.goto('/app#/transacoes');
  await expect(page.getByText('Conta de luz').first()).toBeVisible({ timeout: 15000 });

  // 2) Servidor cai. Um lançamento novo vai para a fila (com o id do aparelho).
  srv.fora = true;
  const criado = await page.evaluate(async (uid) => {
    const tx = await import('/js/services/transactions.js');
    return tx.createTransaction({ owner_id: uid, titulo: 'Padaria offline', valor: 18.5, tipo: 'saida', data_vencimento: '2026-10-11' });
  }, UID);
  expect(criado._pendente).toBe(true);
  expect(criado.id).toMatch(/^[0-9a-f-]{36}$/);
  await expect(indicador(page)).toContainText('1 a enviar');

  // 3) Recarrega SEM servidor: o app abre com a cópia local e a fila continua lá.
  await page.reload();
  // Abre rápido (sem esperar as repetições do supabase-js para cada consulta).
  await expect(page.getByText('Conta de luz').first()).toBeVisible({ timeout: 6000 });
  await expect(page.getByText('Padaria offline').first()).toBeVisible();
  await expect(indicador(page)).toContainText('1 a enviar');
  expect(srv.inserts.filter((i) => i.tabela === 'transactions')).toHaveLength(0);

  // 4) Servidor volta: sincroniza, uma vez só, com o mesmo id.
  srv.fora = false;
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(indicador(page)).toContainText('Sincronizado', { timeout: 10000 });
  const enviados = srv.inserts.filter((i) => i.tabela === 'transactions' && i.titulo === 'Padaria offline');
  expect(enviados).toHaveLength(1);
  expect(enviados[0].id).toBe(criado.id);

  // Reenviar a mesma inclusão (resposta perdida) não duplica.
  expect(srv.tabelas.transactions.filter((t) => t.id === criado.id)).toHaveLength(1);
});

test('sem conexão, excluir um lançamento é recusado com explicação', async ({ page, context }) => {
  const srv = servidorFalso();
  await prepararApp(page, srv);
  await page.goto('/app#/transacoes');
  await expect(page.getByText('Conta de luz').first()).toBeVisible({ timeout: 15000 });
  await context.setOffline(true);
  const erro = await page.evaluate(async () => {
    const tx = await import('/js/services/transactions.js');
    try {
      await tx.deleteTransaction('aaaaaaaa-0000-4000-8000-000000000001');
      return null;
    } catch (e) {
      return e.message;
    }
  });
  expect(erro).toMatch(/Sem conexão: excluir um lançamento só com internet/);
  await expect(page.locator('.cg-offline-banner')).toBeVisible();
  await context.setOffline(false);
});

test('logout apaga a cópia local deste usuário', async ({ page }) => {
  const srv = servidorFalso();
  await prepararApp(page, srv);
  await page.goto('/app#/transacoes');
  await expect(page.getByText('Conta de luz').first()).toBeVisible({ timeout: 15000 });
  const nomes = () => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name));
  await expect.poll(nomes).toContain(`bntt-offline-${UID}`);
  await page.evaluate(() => sessionStorage.setItem('teste-saiu', '1'));
  await page.evaluate(() => Alpine.store('app').logout());
  await expect.poll(nomes).not.toContain(`bntt-offline-${UID}`);
});
