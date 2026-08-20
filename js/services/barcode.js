// html5-qrcode é carregado sob demanda — só baixa esse script quando o usuário
// realmente abre o leitor de código de barras (evita pedir câmera sem necessidade).
let scannerInstance = null;

export async function startBarcodeScanner(elementId, onDetected) {
  const mod = await import('https://esm.sh/html5-qrcode@2.3.8');
  const Html5Qrcode = mod.Html5Qrcode || mod.default?.Html5Qrcode;
  const Formats = mod.Html5QrcodeSupportedFormats || mod.default?.Html5QrcodeSupportedFormats;
  if (!Html5Qrcode) throw new Error('Não foi possível carregar o leitor de código de barras.');

  scannerInstance = new Html5Qrcode(elementId, {
    // Sem isso o leitor cai no default da biblioteca, que prioriza QR — em
    // produto de mercado o código é quase sempre EAN/UPC (código de barras
    // "de verdade", não QR), então precisa listar os formatos 1D
    // explicitamente pra garantir que eles são reconhecidos.
    formatsToSupport: Formats ? [
      Formats.EAN_13, Formats.EAN_8, Formats.UPC_A, Formats.UPC_E,
      Formats.CODE_128, Formats.CODE_39, Formats.ITF, Formats.QR_CODE,
    ] : undefined,
  });
  await scannerInstance.start(
    { facingMode: 'environment' },
    {
      fps: 10,
      // qrbox em pixels fixos (o valor antigo aqui) não acompanha a
      // resolução real da câmera — em celulares com câmera de resolução
      // alta, a caixa mostrada na tela ficava desalinhada com a área que a
      // biblioteca realmente analisa, então a câmera "via" a imagem mas
      // nunca decodificava nada apontando pro código. Como função
      // (recalculada com o tamanho real do viewfinder) sempre bate com o
      // que é mostrado. Mais larga que alta, do jeito que um código de
      // barras 1D realmente é.
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const largura = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.9);
        return { width: largura, height: Math.floor(largura * 0.5) };
      },
    },
    (decodedText) => onDetected(decodedText),
    () => {} // frame sem leitura — ignora, é o comportamento normal enquanto mira no código
  );
}

export async function stopBarcodeScanner() {
  if (!scannerInstance) return;
  try {
    await scannerInstance.stop();
    await scannerInstance.clear();
  } catch {
    // câmera já pode ter sido liberada — sem problema, apenas garante o estado limpo
  } finally {
    scannerInstance = null;
  }
}

// Busca opcional de nome/categoria do produto pelo código de barras via Open Food Facts
// (base pública e gratuita). Se falhar ou não encontrar, a UI cai para preenchimento manual.
export async function lookupProductByBarcode(code) {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1) return null;
    return {
      nome: data.product?.product_name?.trim() || null,
      categoriaSugerida: data.product?.categories?.split(',')[0]?.trim() || null,
    };
  } catch {
    return null;
  }
}

// ---------- Boleto (código de barras, padrão FEBRABAN, 44 dígitos) ----------
// Diferente de um código de produto: não precisa de nenhuma consulta
// externa, o valor e o vencimento já estão codificados nos próprios
// dígitos — dá pra decodificar 100% offline. Duas variantes:
// - "Cobrança" (a maioria dos boletos de banco/loja): 1º dígito != '8'.
//   Posições 6-9 = fator de vencimento (dias corridos desde 07/10/1997,
//   "0000" = sem vencimento); posições 10-19 = valor em centavos.
// - "Arrecadação" (tributos, água/luz/telecom): 1º dígito == '8'. Não tem
//   vencimento padronizado no código; o valor só é confiável quando o
//   dígito de identificação (posição 3) marca "valor efetivo" (6 ou 8) —
//   "7"/"9" ali significa "valor de referência" (não é dinheiro).
export function parseBoletoBarcode(digitsRaw) {
  const digits = (digitsRaw || '').replace(/\D/g, '');
  if (digits.length !== 44) return null;

  if (digits[0] === '8') {
    const identificacaoValor = digits[2];
    if (identificacaoValor !== '6' && identificacaoValor !== '8') return { valor: null, vencimento: null };
    const valor = parseInt(digits.slice(4, 15), 10) / 100;
    return { valor: Number.isFinite(valor) ? valor : null, vencimento: null };
  }

  const fatorVencimento = parseInt(digits.slice(5, 9), 10);
  const valorCentavos = parseInt(digits.slice(9, 19), 10);
  const valor = Number.isFinite(valorCentavos) && valorCentavos > 0 ? valorCentavos / 100 : null;

  let vencimento = null;
  if (Number.isFinite(fatorVencimento) && fatorVencimento > 0) {
    const baseMs = Date.UTC(1997, 9, 7); // mês 0-indexado: 9 = outubro
    // O campo de 4 dígitos só vai até 9999, que "estourou" em 21/02/2025 —
    // desde então os bancos recomeçam a contagem do zero a partir dali.
    // Sem o boleto físico dizer QUAL rodada ele está usando, a forma segura
    // de decidir é pegar a interpretação (com ou sem o "+9999" da segunda
    // volta) que cai mais perto de hoje — vencimento real não costuma ser
    // anos no passado nem no futuro, então isso raramente erra.
    const semVolta = baseMs + fatorVencimento * 86400000;
    const comVolta = baseMs + (fatorVencimento + 9999) * 86400000;
    const agora = Date.now();
    const escolhida = Math.abs(semVolta - agora) <= Math.abs(comVolta - agora) ? semVolta : comVolta;
    vencimento = new Date(escolhida).toISOString().slice(0, 10);
  }

  return { valor, vencimento };
}

// ---------- Pix "copia e cola" / BR Code (padrão EMVCo, o mesmo formato lido
// de um QR de Pix) ----------
// Estrutura TLV (tag-length-value) concatenada e sem separador — cada campo
// é 2 dígitos de id + 2 dígitos de tamanho + o valor daquele tamanho. O
// valor da cobrança é sempre o campo "54"; "59" é o nome de quem recebe
// (usado aqui como sugestão de empresa/serviço). 100% offline também.
export function parsePixQrPayload(texto) {
  if (!/^000201/.test(texto || '')) return null;
  const campos = {};
  let i = 0;
  while (i < texto.length - 4) {
    const id = texto.slice(i, i + 2);
    const len = parseInt(texto.slice(i + 2, i + 4), 10);
    if (!Number.isFinite(len) || len < 0) break;
    campos[id] = texto.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  const valor = campos['54'] ? parseFloat(campos['54']) : null;
  return {
    valor: Number.isFinite(valor) ? valor : null,
    nomeRecebedor: campos['59']?.trim() || null,
  };
}

// Ponto de entrada único pra depois de um scan: decide se o texto lido é um
// boleto, um Pix, ou "outro" (link de nota fiscal/NFC-e, ou qualquer coisa
// não reconhecida) — nesse último caso só guarda o texto bruto, sem tentar
// extrair mais nada (não dá pra buscar os itens de uma nota fiscal sem um
// backend, já que o portal da SEFAZ varia por estado e bloqueia CORS).
export function interpretScannedCode(texto) {
  const limpo = (texto || '').trim();
  const soDigitos = limpo.replace(/\D/g, '');
  if (soDigitos.length === 44) {
    const boleto = parseBoletoBarcode(soDigitos);
    if (boleto) return { tipo: 'boleto', codigo: limpo, valor: boleto.valor, vencimento: boleto.vencimento, nomeRecebedor: null };
  }
  if (/^000201/.test(limpo)) {
    const pix = parsePixQrPayload(limpo);
    if (pix) return { tipo: 'pix', codigo: limpo, valor: pix.valor, vencimento: null, nomeRecebedor: pix.nomeRecebedor };
  }
  return { tipo: 'outro', codigo: limpo, valor: null, vencimento: null, nomeRecebedor: null };
}
