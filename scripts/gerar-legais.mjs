// Gera termos.html e privacidade.html (raiz) a partir de docs/legal/*.md.
// Conversor mínimo de propósito (títulos, parágrafos, listas, tabelas,
// **negrito**): os textos são simples e não vale uma dependência.
// Campos [[...]] ainda não preenchidos aparecem destacados como "a preencher".
//   node scripts/gerar-legais.mjs
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ } from './env.mjs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) => esc(s)
  .replace(/\[\[(.+?)\]\]/g, '<mark title="Ainda não preenchido">a preencher: $1</mark>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

function converter(md) {
  const linhas = md.split(/\r?\n/);
  const html = [];
  let lista = false;
  let tabela = false;
  for (const linha of linhas) {
    if (linha.startsWith('> ')) continue; // nota interna de edição: não publica
    if (/^\s*-\s+/.test(linha)) {
      if (!lista) { html.push('<ul>'); lista = true; }
      html.push(`<li>${inline(linha.replace(/^\s*-\s+/, ''))}</li>`);
      continue;
    }
    if (lista) { html.push('</ul>'); lista = false; }
    if (linha.startsWith('|')) {
      if (/^\|\s*-/.test(linha)) continue;
      const celulas = linha.split('|').slice(1, -1).map((c) => inline(c.trim()));
      if (!tabela) { html.push('<table><thead><tr>' + celulas.map((c) => `<th>${c}</th>`).join('') + '</tr></thead><tbody>'); tabela = true; }
      else html.push('<tr>' + celulas.map((c) => `<td>${c}</td>`).join('') + '</tr>');
      continue;
    }
    if (tabela) { html.push('</tbody></table>'); tabela = false; }
    if (linha.startsWith('# ')) html.push(`<h1>${inline(linha.slice(2).replace(/\s*\(RASCUNHO[^)]*\)/, ''))}</h1>`);
    else if (linha.startsWith('## ')) html.push(`<h2>${inline(linha.slice(3))}</h2>`);
    else if (linha.trim()) html.push(`<p>${inline(linha)}</p>`);
  }
  if (lista) html.push('</ul>');
  if (tabela) html.push('</tbody></table>');
  return html.join('\n');
}

for (const [md, saida, titulo] of [
  ['termos-de-uso.md', 'termos.html', 'Termos de uso'],
  ['politica-de-privacidade.md', 'privacidade.html', 'Política de privacidade'],
]) {
  const corpo = converter(fs.readFileSync(path.join(RAIZ, 'docs', 'legal', md), 'utf8'));
  const pendente = corpo.includes('<mark');
  fs.writeFileSync(path.join(RAIZ, saida), `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${titulo} — BNTT</title>
  <link rel="icon" href="./assets/icons/icon.svg?v=4" type="image/svg+xml" />
  <link rel="stylesheet" href="./landing-assets/legal.css" />
</head>
<body>
  <main>
    <p><a href="./">← Voltar para o BNTT</a></p>
    ${pendente ? '<p class="aviso">Versão preliminar: alguns dados do responsável ainda estão sendo preenchidos.</p>' : ''}
    ${corpo}
  </main>
</body>
</html>
`);
  console.log(`${saida}${pendente ? ' (com campos a preencher)' : ''}`);
}
