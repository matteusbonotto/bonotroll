// Tesseract.js é carregado sob demanda — só baixa (é pesado, ~2MB com o
// modelo de idioma) quando o usuário realmente tenta ler uma foto. Roda
// 100% no navegador, sem custo e sem chave de API (mas menos preciso que
// uma IA de visão — é um ponto de partida pra pessoa confirmar/corrigir).
let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('https://esm.sh/tesseract.js@5.1.1');
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
const DATE_RE = /(\d{2})\/(\d{2})\/(\d{2,4})/;
// Só aceita a data se a palavra "venc"/"valid" aparecer NA MESMA LINHA —
// sem essa âncora daria pra "achar" uma data qualquer (emissão, hoje) e
// preencher errado, o que é pior que deixar em branco. Cobre tanto
// vencimento de fatura/boleto ("Vencimento: ...") quanto validade de
// produto na embalagem ("Validade: ..." / "Val: ...").
const VENCIMENTO_LINE_RE = /venc|valid/i;

function extrairDataValida(linhaComData) {
  const m = DATE_RE.exec(linhaComData);
  if (!m) return null;
  const [, diaStr, mesStr, anoStr] = m;
  const ano = anoStr.length === 2 ? `20${anoStr}` : anoStr;
  const dia = Number(diaStr);
  const mes = Number(mesStr);
  const iso = `${ano}-${mesStr.padStart(2, '0')}-${diaStr.padStart(2, '0')}`;
  const d = new Date(`${iso}T00:00:00Z`);
  // Confere se a data "voltou" exatamente igual — pega dia/mês inválidos
  // (ex.: 32/13/2026) que o Date do JS silenciosamente "corrige" pra outra
  // data em vez de rejeitar.
  const valida = !Number.isNaN(d.getTime()) && d.getUTCFullYear() === Number(ano) && d.getUTCMonth() + 1 === mes && d.getUTCDate() === dia;
  return valida ? iso : null;
}

// Extração best-effort a partir do texto bruto do OCR — sem garantia de
// acerto, sempre editável depois. Preço: maior valor em formato de dinheiro
// encontrado (geralmente é o total). Título: primeira linha "de verdade"
// (ignora cabeçalhos comuns de cupom fiscal e linhas só numéricas).
// Vencimento: só quando há uma data na mesma linha da palavra "vencimento"
// (fatura/boleto fotografado) — em foto de produto/prateleira normalmente
// não tem nada disso e o campo fica null mesmo, o que é o comportamento
// certo (não inventar um vencimento que não está ali).
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

  let vencimento = null;
  for (const line of lines) {
    if (!VENCIMENTO_LINE_RE.test(line)) continue;
    vencimento = extrairDataValida(line);
    if (vencimento) break;
  }

  return { titulo, valor: maiorValor, vencimento };
}
