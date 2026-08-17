// Tesseract.js é carregado sob demanda — só baixa (é pesado, ~2MB com o
// modelo de idioma) quando o usuário realmente tenta ler uma foto. Roda
// 100% no navegador, sem custo e sem chave de API (mas menos preciso que
// uma IA de visão — é um ponto de partida pra pessoa confirmar/corrigir).
let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('https://esm.sh/tesseract.js@5');
      return createWorker('por');
    })();
  }
  return workerPromise;
}

export async function recognizeText(file) {
  const worker = await getWorker();
  const { data } = await worker.recognize(file);
  return data.text || '';
}

const PRICE_RE = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+\.\d{2})/gi;
const SKIP_LINE_RE = /^(cnpj|cpf|data|hora|cupom|nota fiscal|via do cliente|total|subtotal|troco|desconto|item|qtd|un\b|www\.|http)/i;

// Extração best-effort a partir do texto bruto do OCR — sem garantia de
// acerto. Preço: maior valor em formato de dinheiro encontrado (geralmente
// é o total). Título: primeira linha "de verdade" (ignora cabeçalhos comuns
// de cupom fiscal e linhas só numéricas).
export function parseReceiptText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let maiorValor = null;
  for (const line of lines) {
    for (const m of line.matchAll(PRICE_RE)) {
      const raw = m[1].includes(',') ? m[1].replace(/\./g, '').replace(',', '.') : m[1];
      const valor = parseFloat(raw);
      if (Number.isFinite(valor) && valor > 0 && (maiorValor === null || valor > maiorValor)) {
        maiorValor = valor;
      }
    }
  }

  let titulo = null;
  for (const line of lines) {
    if (line.length < 3 || SKIP_LINE_RE.test(line) || /^\d+([.,]\d+)?$/.test(line)) continue;
    titulo = line;
    break;
  }

  return { titulo, valor: maiorValor };
}
