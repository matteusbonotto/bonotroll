// Regressão Fase 5 (perf): resizeImage() precisa reduzir uma imagem grande
// pro teto de 512px no lado maior, sem quebrar imagens já pequenas.
import { test, expect } from '@playwright/test';

test('resizeImage reduz uma imagem de 2000x1000 para 512x256 (mantém proporção)', async ({ page }) => {
  await page.goto('/?demo=1');

  const resultado = await page.evaluate(async () => {
    const { resizeImage } = await import('/js/utils/image.js');

    const canvas = document.createElement('canvas');
    canvas.width = 2000;
    canvas.height = 1000;
    canvas.getContext('2d').fillRect(0, 0, 2000, 1000);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], 'grande.png', { type: 'image/png' });

    const redimensionada = await resizeImage(file, 512);
    const bitmap = await createImageBitmap(redimensionada);
    const dimensoes = { w: bitmap.width, h: bitmap.height, type: redimensionada.type };
    bitmap.close();
    return dimensoes;
  });

  expect(resultado).toEqual({ w: 512, h: 256, type: 'image/jpeg' });
});

test('resizeImage não mexe numa imagem já pequena', async ({ page }) => {
  await page.goto('/?demo=1');

  const resultado = await page.evaluate(async () => {
    const { resizeImage } = await import('/js/utils/image.js');
    const canvas = document.createElement('canvas');
    canvas.width = 100;
    canvas.height = 80;
    canvas.getContext('2d').fillRect(0, 0, 100, 80);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const file = new File([blob], 'pequena.png', { type: 'image/png' });
    const saida = await resizeImage(file, 512);
    return { mesmoArquivo: saida === file, type: saida.type };
  });

  expect(resultado.mesmoArquivo).toBe(true);
});
