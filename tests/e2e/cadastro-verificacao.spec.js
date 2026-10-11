// Cadastro com verificação de e-mail e botão do Google (2026-10-11) — a tela
// de entrada REAL só aparece fora do modo demo. Aqui o app "acha" que tem um
// Supabase: o config.js servido é trocado por um com URL falsa, e toda a API
// de auth dessa URL é respondida pelo próprio teste (page.route). Nenhuma
// conta real, nenhum e-mail de verdade. Precisa de internet só para o
// supabase-js vir do esm.sh (como o resto da suíte, que usa CDN).
import { test, expect } from '@playwright/test';

const SB = 'https://testebnttfalso00000.supabase.co';
test.use({ serviceWorkers: 'block' });
// No dist (npm run test:dist) o config.js é minificado/obfuscado e o texto
// do placeholder não existe mais para trocar — o Supabase falso não liga.
test.skip(!!process.env.PW_DIST, 'Supabase falso depende do config.js legível (só no fonte).');

async function prepararSupabaseFalso(page, respostas = {}) {
  const chamadas = [];
  await page.route('**/js/data/config.js', async (route) => {
    const original = await (await route.fetch()).text();
    await route.fulfill({
      contentType: 'application/javascript',
      body: original.replace('https://SEU-PROJETO.supabase.co', SB).replace('SUA-ANON-KEY', 'sb_publishable_teste'),
    });
  });
  await page.route(`${SB}/**`, async (route) => {
    const url = new URL(route.request().url());
    const caminho = url.pathname.replace('/auth/v1/', '');
    chamadas.push({ caminho, corpo: route.request().postDataJSON?.() ?? null, url: url.toString() });
    const r = respostas[caminho];
    if (r) return route.fulfill({ status: r.status || 200, contentType: 'application/json', body: JSON.stringify(r.body) });
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });
  return chamadas;
}

const usuario = (identities) => ({ id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', email: 'nova@exemplo.com', identities, user_metadata: {}, app_metadata: { provider: 'email' }, created_at: new Date().toISOString() });

async function abrirCadastro(page) {
  await page.goto('/app');
  await page.getByRole('link', { name: 'Criar conta' }).click();
  await page.getByLabel('Seu nome').fill('Nova Pessoa');
  await page.getByLabel('E-mail', { exact: true }).fill('nova@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('senhaForte123');
}

test('conta nova: vai para "Confirmar e-mail", com código e reenvio em espera de 60 s', async ({ page }) => {
  const chamadas = await prepararSupabaseFalso(page, { signup: { body: usuario([{ id: 'i1' }]) } });
  await abrirCadastro(page);
  await page.getByRole('button', { name: 'Criar conta' }).click();

  await expect(page.getByRole('heading', { name: 'Confirmar e-mail' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('Conta criada!');
  await expect(page.getByLabel('Código do e-mail')).toBeVisible();
  const reenviar = page.getByRole('button', { name: /Reenviar e-mail \(aguarde \d+ s\)/ });
  await expect(reenviar).toBeDisabled();
  expect(chamadas.find((c) => c.caminho === 'signup').corpo.data).toMatchObject({ nome: 'Nova Pessoa', tipo_conta: 'home' });

  // A espera continua depois de recarregar a página.
  await page.reload();
  await page.getByRole('link', { name: 'Tenho um código de confirmação' }).click();
  await page.getByLabel('E-mail', { exact: true }).fill('nova@exemplo.com');
  await expect(page.getByRole('button', { name: /aguarde \d+ s/ })).toBeDisabled();
});

test('e-mail já cadastrado: não diz "conta criada" (o Supabase não envia nada nesse caso)', async ({ page }) => {
  await prepararSupabaseFalso(page, { signup: { body: usuario([]) } });
  await abrirCadastro(page);
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('alert')).toContainText('Já existe uma conta com este e-mail');
  await expect(page.getByText('Conta criada!')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});

test('código expirado/inválido mostra o erro e não entra', async ({ page }) => {
  const chamadas = await prepararSupabaseFalso(page, { verify: { status: 403, body: { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' } } });
  await page.goto('/app');
  await page.getByRole('link', { name: 'Tenho um código de confirmação' }).click();
  await page.getByLabel('E-mail', { exact: true }).fill('nova@exemplo.com');
  await page.getByLabel('Código do e-mail').fill('12');
  await page.getByRole('button', { name: 'Confirmar código' }).click();
  await expect(page.getByRole('alert')).toContainText('código de 6 dígitos');
  expect(chamadas.some((c) => c.caminho === 'verify')).toBe(false);

  await page.getByLabel('Código do e-mail').fill('123 456');
  await page.getByRole('button', { name: 'Confirmar código' }).click();
  await expect(page.getByRole('alert')).toContainText('expirado ou inválido');
  expect(chamadas.find((c) => c.caminho === 'verify').corpo).toMatchObject({ email: 'nova@exemplo.com', token: '123456', type: 'signup' });
});

test('reenvio com falha no provedor de e-mail mostra mensagem clara', async ({ page }) => {
  await prepararSupabaseFalso(page, { resend: { status: 500, body: { code: 500, error_code: 'unexpected_failure', msg: 'Error sending confirmation email' } } });
  await page.goto('/app');
  await page.getByRole('link', { name: 'Tenho um código de confirmação' }).click();
  await page.getByLabel('E-mail', { exact: true }).fill('outra@exemplo.com');
  await page.getByRole('button', { name: 'Reenviar e-mail de confirmação' }).click();
  await expect(page.getByRole('alert')).toContainText('falha no serviço de e-mail');
});

test('link do e-mail expirado volta para a confirmação com o motivo', async ({ page }) => {
  await prepararSupabaseFalso(page);
  await page.goto('/app#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.getByRole('heading', { name: 'Confirmar e-mail' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('expirado ou inválido');
  expect(new URL(page.url()).hash).toBe('');
});

test('login de quem não confirmou o e-mail leva para a confirmação', async ({ page }) => {
  await prepararSupabaseFalso(page, { token: { status: 400, body: { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' } } });
  await page.goto('/app');
  await page.getByLabel('E-mail', { exact: true }).fill('nova@exemplo.com');
  await page.getByLabel('Senha', { exact: true }).fill('senhaForte123');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Confirmar e-mail' })).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Confirme seu e-mail');
});

test('"Continuar com o Google" leva ao authorize do Supabase com provider=google e volta para /app', async ({ page }) => {
  const chamadas = await prepararSupabaseFalso(page);
  await page.goto('/app');
  await page.getByRole('button', { name: 'Continuar com o Google' }).click();
  await expect.poll(() => chamadas.find((c) => c.caminho === 'authorize')?.url).toBeTruthy();
  const url = new URL(chamadas.find((c) => c.caminho === 'authorize').url);
  expect(url.searchParams.get('provider')).toBe('google');
  expect(url.searchParams.get('redirect_to')).toMatch(/\/app$/);
});

test('modo demo: botão do Google aparece desabilitado com explicação', async ({ page }) => {
  await page.goto('/?demo=1');
  const botao = page.getByRole('button', { name: 'Continuar com o Google' });
  await expect(botao).toBeDisabled();
  await expect(botao).toHaveAttribute('title', /versão conectada/);
});
