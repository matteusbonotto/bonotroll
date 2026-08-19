// pdf.js carregado sob demanda (só quando a pessoa realmente importa um
// PDF) — mesmo padrão de carregamento tardio já usado em ocr.js/barcode.js.
let pdfjsLibPromise = null;
async function getPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = (async () => {
      const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.0.379/build/pdf.mjs');
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';
      return pdfjsLib;
    })();
  }
  return pdfjsLibPromise;
}

// getTextContent() devolve os textos na ordem do stream, sem quebra de
// linha nenhuma — juntar tudo com espaço vira um parágrafo só, e
// parseReceiptText (services/ocr.js) depende de LINHAS separadas pra achar
// título/vencimento corretamente. `transform[5]` de cada item é a posição Y
// dele na página; item.str vazio é só um marcador de espaço do pdf.js, sem
// posição própria, então não conta pra decidir se mudou de linha.
function reconstroiLinhas(items) {
  let linhas = [];
  let linhaAtual = [];
  let yAnterior = null;
  for (const item of items) {
    const y = item.transform?.[5];
    if (item.str === '') continue;
    if (yAnterior !== null && y !== undefined && Math.abs(y - yAnterior) > 2) {
      linhas.push(linhaAtual.join(' '));
      linhaAtual = [];
    }
    linhaAtual.push(item.str);
    if (y !== undefined) yAnterior = y;
  }
  if (linhaAtual.length) linhas.push(linhaAtual.join(' '));
  return linhas.join('\n');
}

// Texto da primeira página de um PDF — tenta a camada de texto nativa
// primeiro (rápido e exato, funciona pra boleto/fatura gerado digitalmente,
// a maioria dos casos); só cai pra imagem+OCR (mais lento, menos preciso)
// quando a página não tem texto nenhum de verdade (PDF escaneado/foto
// salva como PDF). `recognizeImage` é injetado pelo chamador (normalmente
// recognizeText de services/ocr.js) em vez de importado direto aqui, pra
// não puxar o Tesseract (~2MB) quando nem precisa.
export async function extractTextFromPdf(file, { recognizeImage } = {}) {
  const pdfjsLib = await getPdfjs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const page = await doc.getPage(1);

  const textContent = await page.getTextContent();
  const textoNativo = reconstroiLinhas(textContent.items).trim();
  // Threshold pequeno (não "> 0") porque um PDF escaneado às vezes tem uma
  // camada de texto residual mínima (metadado, marca d'água) sem ser o
  // conteúdo de verdade — nesse caso ainda vale a pena tentar OCR.
  if (textoNativo.length > 20 || !recognizeImage) return textoNativo;

  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  return recognizeImage(blob);
}
