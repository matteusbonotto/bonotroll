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
export async function resizeImage(file, maxDim = 512, qualidade = 0.85) {
  if (!file.type?.startsWith('image/') || file.type === 'image/svg+xml') return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // formato não suportado pelo decoder — segue com o arquivo original

  const maior = Math.max(bitmap.width, bitmap.height);
  if (maior <= maxDim) { bitmap.close?.(); return file; } // já pequena, nada a fazer

  const escala = maxDim / maior;
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
