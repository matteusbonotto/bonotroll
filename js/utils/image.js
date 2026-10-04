// Redimensiona uma imagem antes do upload (Fase 5, docs/DESIGN-SYSTEM-2027.md
// §10/blueprint §1.4 Performance) — foto de celular moderno facilmente passa
// de 4-8MB; sem isso, tempo de upload em rede ruim e consumo do teto de
// Storage gratuito crescem mais rápido do que precisam. Canvas nativo, sem
// biblioteca nova (regra do prompt master §21: "se nativo resolve, não
// adicione dependência"). `maxDim` pequeno (512, o default) é só pra imagem
// puramente decorativa (avatar, ícone de categoria, logo de empresa, ícone
// de caixinha).
//
// CORREÇÃO 2026-08-23 (bug real relatado em uso: "tiro foto e o app reinicia
// dizendo insuficiência de memória"): a regra antiga era "NUNCA redimensionar
// foto que passa por OCR" (comprovante, item de Recursos/Compras), pra não
// prejudicar a leitura de texto — mas "nunca redimensionar NADA" também
// significa entregar uma foto de celular moderno (facilmente 4000×3000px+,
// vários MB) inteira pro Tesseract.js processar, o que é memória demais pra
// muitos navegadores mobile e é exatamente a causa do crash. A correção não
// é voltar a não redimensionar — é usar um `maxDim` bem maior (pense em
// `resizeImage(file, 2000, 0.9)` nos pontos que alimentam OCR), grande o
// suficiente pra manter texto nitidamente legível, mas pequeno o bastante
// pra nunca chegar perto do consumo de memória de uma foto crua de celular.
// Ver js/components/shoppingList.js::onFotoItem, resourcesView.js::onFotoNomeItem,
// transactionForm.js::onComprovanteChange — os 3 pontos que chamam
// recognizeText() agora passam a imagem por aqui primeiro.
// Lê só as dimensões (o cabeçalho) sem decodificar os pixels da foto.
function dimensoes(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve(null); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

// CORREÇÃO 2026-10-04 (Galaxy S21, "erro de memória" de novo): reduzir para
// 2000 px não bastava porque `createImageBitmap(file)` decodificava a foto
// INTEIRA (12–64 MP) antes de reduzir. Aqui a redução acontece na própria
// decodificação (`resizeWidth/resizeHeight`), sem o buffer gigante.
export async function decodificarReduzido(file, maxDim) {
  const d = await dimensoes(file);
  if (d && Math.max(d.w, d.h) > maxDim) {
    const escala = maxDim / Math.max(d.w, d.h);
    const opcoes = { resizeWidth: Math.round(d.w * escala), resizeHeight: Math.round(d.h * escala), resizeQuality: 'high' };
    const reduzido = await createImageBitmap(file, opcoes).catch(() => null);
    if (reduzido) return reduzido;
  }
  return createImageBitmap(file).catch(() => null);
}

export async function resizeImage(file, maxDim = 512, qualidade = 0.85) {
  if (!file.type?.startsWith('image/') || file.type === 'image/svg+xml') return file;

  // Tamanho ORIGINAL (só o cabeçalho): decide se precisa reduzir antes de
  // decodificar — a decodificação já sai reduzida e não serve para isso.
  const original = await dimensoes(file);
  if (original && Math.max(original.w, original.h) <= maxDim) return file; // já pequena, nada a fazer

  const bitmap = await decodificarReduzido(file, maxDim);
  if (!bitmap) return file; // formato não suportado pelo decoder — segue com o arquivo original

  const maior = Math.max(bitmap.width, bitmap.height);
  const escala = Math.min(1, maxDim / maior);
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualidade));
  if (!blob) return file; // toBlob falhou por algum motivo — nunca bloqueia o upload por causa disso

  const nomeBase = (file.name || 'imagem').replace(/\.[^.]+$/, '');
  return new File([blob], `${nomeBase}.jpg`, { type: 'image/jpeg' });
}
