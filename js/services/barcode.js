// html5-qrcode é carregado sob demanda — só baixa esse script quando o usuário
// realmente abre o leitor de código de barras (evita pedir câmera sem necessidade).
let scannerInstance = null;

export async function startBarcodeScanner(elementId, onDetected) {
  const mod = await import('https://esm.sh/html5-qrcode@2');
  const Html5Qrcode = mod.Html5Qrcode || mod.default?.Html5Qrcode;
  if (!Html5Qrcode) throw new Error('Não foi possível carregar o leitor de código de barras.');

  scannerInstance = new Html5Qrcode(elementId);
  await scannerInstance.start(
    { facingMode: 'environment' },
    { fps: 10, qrbox: { width: 260, height: 160 } },
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
