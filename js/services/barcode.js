// html5-qrcode é carregado sob demanda — só baixa esse script quando o usuário
// realmente abre o leitor de código de barras (evita pedir câmera sem necessidade).
let scannerInstance = null;

export async function startBarcodeScanner(elementId, onDetected) {
  const mod = await import('https://esm.sh/html5-qrcode@2');
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
