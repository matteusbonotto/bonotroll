// Gera um PDF de texto mínimo e válido (PDF 1.4, Helvetica, WinAnsi) a partir
// das páginas sintéticas de sinteticos.js — para os testes e2e importarem um
// PDF de verdade, lido pelo pdf.js do app. Nada de dado real.
// Uso: pdfDePaginas(informeEmpregador()) → Buffer.

function escapar(texto) {
  return texto.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

export function pdfDePaginas(paginas) {
  const objetos = [];
  const add = (corpo) => { objetos.push(corpo); return objetos.length; };
  const catalogo = add(null);
  const raiz = add(null);
  const fonte = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const kids = [];
  for (const p of paginas) {
    const linhas = String(p.texto).split('\n');
    const conteudo = ['BT', '/F1 10 Tf', '14 TL', '40 800 Td', ...linhas.map((l) => `(${escapar(l)}) Tj T*`), 'ET'].join('\n');
    const bytes = Buffer.from(conteudo, 'latin1');
    const stream = add(`<< /Length ${bytes.length} >>\nstream\n${conteudo}\nendstream`);
    kids.push(add(`<< /Type /Page /Parent ${raiz} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fonte} 0 R >> >> /Contents ${stream} 0 R >>`));
  }
  objetos[catalogo - 1] = `<< /Type /Catalog /Pages ${raiz} 0 R >>`;
  objetos[raiz - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;

  let saida = '%PDF-1.4\n';
  const offsets = [];
  objetos.forEach((o, i) => {
    offsets.push(Buffer.byteLength(saida, 'latin1'));
    saida += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(saida, 'latin1');
  saida += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  saida += `trailer\n<< /Size ${objetos.length + 1} /Root ${catalogo} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(saida, 'latin1');
}
