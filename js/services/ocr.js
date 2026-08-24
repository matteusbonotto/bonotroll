// Tesseract.js é carregado sob demanda — só baixa (é pesado, ~2MB com o
// modelo de idioma) quando o usuário realmente tenta ler uma foto. Roda
// 100% no navegador, sem custo e sem chave de API (mas menos preciso que
// uma IA de visão — é um ponto de partida pra pessoa confirmar/corrigir).
let workerPromise = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker, PSM } = await import('https://esm.sh/tesseract.js@5.1.1');
      const worker = await createWorker('por');
      // Bug real relatado em uso (2026-08-24): leitura de foto "péssima"
      // (foto de embalagem de produto virou texto sem nexo). O modo padrão
      // do Tesseract (PSM.SINGLE_BLOCK, pensado pra um bloco de texto tipo
      // documento) não é adequado pra rótulo/embalagem de produto, onde o
      // texto está espalhado em tamanhos/posições diferentes (marca, sabor,
      // peso, validade cada um num canto). SPARSE_TEXT ("acha texto em
      // qualquer lugar, sem estrutura") é o modo certo pra essa situação —
      // é uma configuração conhecida do próprio Tesseract, não uma lib nova.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      return worker;
    })();
  }
  return workerPromise;
}

// Pré-processamento antes do OCR (2026-08-24, mesmo bug acima): escala de
// cinza + esticamento de contraste (o pixel mais escuro vira preto, o mais
// claro vira branco, o resto reescalado linearmente entre os dois) — sem
// isso, o brilho/reflexo de uma lata/embalagem plástica e a cor de fundo
// colorida (não branca, como um documento) atrapalham MUITO o
// reconhecimento, porque o Tesseract foi treinado majoritariamente em texto
// escuro sobre fundo claro uniforme. Canvas nativo, sem lib nova (mesma
// regra já seguida em image.js::resizeImage). Só afeta a CÓPIA usada pro
// OCR — nunca a imagem original (upload/comprovante continuam intactos).
async function prepararParaOcr(file) {
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = imgData.data;
    // Luminância perceptual (não média simples R+G+B/3) — combina melhor
    // com como o olho humano (e o que o Tesseract espera) percebe contraste.
    const cinzas = new Uint8ClampedArray(px.length / 4);
    const histograma = new Uint32Array(256);
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const cinza = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      cinzas[j] = cinza;
      histograma[Math.round(cinza)]++;
    }
    // Percentil (não min/max bruto) — uma lata/embalagem brilhante tem
    // reflexo (alguns pixels bem perto de 255) e sombra (alguns bem perto
    // de 0); esticar pelo min/max literal desses poucos pixels extremos não
    // melhora o contraste do TEXTO em si. Corta os 2% mais escuros e os 2%
    // mais claros como "ruído" e estica o resto — bem mais robusto contra
    // brilho pontual de embalagem real (o caso relatado: lata de Nescau).
    const total = cinzas.length;
    const corte = total * 0.02;
    let acumulado = 0;
    let min = 0;
    for (; min < 255; min++) { acumulado += histograma[min]; if (acumulado > corte) break; }
    acumulado = 0;
    let max = 255;
    for (; max > 0; max--) { acumulado += histograma[max]; if (acumulado > corte) break; }
    const alcance = Math.max(max - min, 1); // evita divisão por zero numa foto totalmente uniforme
    for (let i = 0, j = 0; i < px.length; i += 4, j++) {
      const esticado = ((cinzas[j] - min) / alcance) * 255;
      px[i] = px[i + 1] = px[i + 2] = esticado;
    }
    ctx.putImageData(imgData, 0, 0);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    return blob || file;
  } catch {
    return file; // pré-processamento é melhor-esforço — nunca impede o OCR de tentar com o original
  }
}

export async function recognizeText(file) {
  const worker = await getWorker();
  const preparado = await prepararParaOcr(file);
  const { data } = await worker.recognize(preparado);
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
