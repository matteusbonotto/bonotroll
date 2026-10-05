// Auditoria automática de todas as telas (Palm Business, fases 4/10/11):
// para cada largura obrigatória (320–1920) e cada tela, mede alvos de toque
// < 44px, rolagem lateral, botões sem nome acessível, imagens sem alt,
// texto < 12px e palavras em inglês na interface. Roda contra o modo demo.
//   node scripts/auditar-telas.mjs [url-base]   (padrão: http://localhost:5511)
import { chromium } from '@playwright/test';

const BASE = process.argv[2] || 'http://localhost:5511';
const LARGURAS = [320, 375, 768, 1280, 1920];
const TELAS = ['home', 'transacoes', 'caixinhas', 'compras', 'recursos', 'grupo', 'socorros', 'perfil'];
const INGLES = /\b(loading|error|failed|submit|cancel|save|delete|settings|undefined|null|NaN|true|false)\b/i;

const navegador = await chromium.launch();
const relatorio = [];
for (const largura of LARGURAS) {
  const pagina = await navegador.newPage({ viewport: { width: largura, height: 900 } });
  await pagina.goto(`${BASE}/?demo=1`);
  await pagina.getByText('Entrar como', { exact: false }).first().click();
  await pagina.waitForTimeout(1500);
  await pagina.evaluate(() => Alpine.store('onboarding')?.pular?.());
  for (const tela of TELAS) {
    await pagina.evaluate((v) => Alpine.store('app').setView(v), tela);
    await pagina.waitForTimeout(700);
    const r = await pagina.evaluate(({ tela, regexIngles }) => {
      const ingles = new RegExp(regexIngles, 'i');
      const sec = [...document.querySelectorAll('main section[x-show]')].find((s) => s.offsetParent !== null) || document.body;
      const escopo = [sec, document.querySelector('.cg-topbar'), document.querySelector('.cg-nav-inferior')].filter(Boolean);
      const visivel = (e) => { const b = e.getBoundingClientRect(); return e.offsetParent !== null && b.width > 0 && b.height > 0; };
      const nome = (e) => (e.getAttribute('aria-label') || e.innerText || e.title || e.getAttribute('aria-labelledby') || '').trim();
      const interativos = escopo.flatMap((s) => [...s.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=button]')]).filter(visivel)
        .filter((e) => !e.classList.contains('cg-date-field__nativo') && !e.classList.contains('visually-hidden-focusable'));
      // Tabela densa do computador (mouse): mínimo WCAG 2.5.8 de 24px; o resto, 44px.
      const pequenos = interativos.filter((e) => { const b = e.getBoundingClientRect(); const min = e.closest('table') && window.innerWidth >= 992 ? 24 : 44; return b.height < min || b.width < 24; })
        .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join('.')} "${nome(e).slice(0, 25)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
      const semNome = interativos.filter((e) => !nome(e) && !(e.labels && e.labels.length) && !e.placeholder)
        .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].slice(0, 2).join('.')}`);
      const imgs = escopo.flatMap((s) => [...s.querySelectorAll('img')]).filter(visivel).filter((i) => !i.hasAttribute('alt')).length;
      const folhas = escopo.flatMap((s) => [...s.querySelectorAll('*')]).filter((e) => visivel(e) && e.childElementCount === 0 && e.textContent.trim());
      const minusculos = folhas.filter((e) => parseFloat(getComputedStyle(e).fontSize) < 12).map((e) => e.textContent.trim().slice(0, 20));
      const textoIngles = [...new Set(folhas.map((e) => e.textContent.trim()).filter((t) => ingles.test(t)))].slice(0, 5);
      return {
        tela,
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        pequenos: [...new Set(pequenos)],
        semNome: [...new Set(semNome)],
        imgsSemAlt: imgs,
        minusculos: [...new Set(minusculos)].slice(0, 6),
        textoIngles,
      };
    }, { tela, regexIngles: INGLES.source });
    relatorio.push({ largura, ...r });
  }
  await pagina.close();
}
await navegador.close();

let problemas = 0;
for (const r of relatorio) {
  const itens = [];
  if (r.overflow > 0) itens.push(`rolagem lateral ${r.overflow}px`);
  if (r.pequenos.length) itens.push(`${r.pequenos.length} alvos < 44px: ${r.pequenos.slice(0, 4).join(' | ')}`);
  if (r.semNome.length) itens.push(`${r.semNome.length} sem nome: ${r.semNome.slice(0, 4).join(', ')}`);
  if (r.imgsSemAlt) itens.push(`${r.imgsSemAlt} imagens sem alt`);
  if (r.minusculos.length) itens.push(`texto < 12px: ${r.minusculos.join(' | ')}`);
  if (r.textoIngles.length) itens.push(`inglês: ${r.textoIngles.join(' | ')}`);
  if (itens.length) { problemas += itens.length; console.log(`[${r.largura}] ${r.tela}\n  - ${itens.join('\n  - ')}`); }
}
console.log(problemas ? `\n${problemas} problemas.` : 'Nenhum problema encontrado.');
process.exitCode = problemas ? 1 : 0;
