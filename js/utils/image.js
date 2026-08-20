// Redimensiona uma imagem antes do upload (Fase 5, docs/DESIGN-SYSTEM-2027.md
// §10/blueprint §1.4 Performance) — foto de celular moderno facilmente passa
// de 4-8MB; sem isso, tempo de upload em rede ruim e consumo do teto de
// Storage gratuito crescem mais rápido do que precisam. Canvas nativo, sem
// biblioteca nova (regra do prompt master §21: "se nativo resolve, não
// adicione dependência"). Só usado em imagens puramente decorativas (avatar,
// ícone de categoria, logo de empresa, ícone de caixinha) — NUNCA em fotos
// que passam por OCR (comprovante, item de Recursos/Compras), onde
// redimensionar poderia prejudicar a leitura de texto.
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
