// Pedido do usuário: não existia um jeito de baixar um modelo de CSV com as
// colunas que cada importação entende, e Caixinhas não tinha importação de
// CSV nenhuma (só Transações/Compras/Recursos tinham). Ver
// js/services/csvImport.js (IMPORT_TARGETS.caixinhas, baixarTemplateCsv) e
// js/components/csvImportModal.js.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';

test('botão "Baixar modelo" no import de CSV baixa um cabeçalho com as colunas certas do target', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Transações' }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'Importar CSV' }).click();

  const modal = page.locator('.cg-modal-backdrop', { has: page.getByText('Importar CSV — Transações', { exact: false }) });
  await expect(modal).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await modal.getByRole('button', { name: 'Baixar modelo (.csv)' }).click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe('bonotto-modelo-transacoes.csv');
  const conteudo = fs.readFileSync(await download.path(), 'utf-8');
  const cabecalho = conteudo.replace(/^﻿/, '').split('\r\n')[0].split(',');
  expect(cabecalho).toContain('titulo');
  expect(cabecalho).toContain('valor');
  expect(cabecalho).toContain('data_vencimento');
  expect(cabecalho).toContain('data_pagamento');
});

test('Caixinhas: importar CSV cria a caixinha (valor inicial incluso) e ela aparece na tela', async ({ page }) => {
  await page.goto('/?demo=1');
  await page.getByText('Entrar como', { exact: false }).first().click();

  await page.locator('.cg-sidebar__item, .cg-drawer a', { hasText: 'Caixinhas' }).first().click();
  await page.waitForTimeout(400);
  const secao = page.locator('section[x-data^="caixinhasView"]');
  await expect(secao.getByText('Nubank').first()).toBeVisible({ timeout: 10000 }); // seed demo já carregada

  await secao.getByRole('button', { name: 'Importar CSV' }).click();
  const modal = page.locator('.cg-modal-backdrop', { has: page.getByText('Importar CSV — Caixinhas', { exact: false }) });
  await expect(modal).toBeVisible();

  const csv = 'banco_nome,moeda,meta,valor_inicial,icone\nC6 Bank,BRL,5000,250.50,bi-piggy-bank\n';
  await modal.locator('input[type="file"]').setInputFiles({
    name: 'caixinhas.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv, 'utf-8'),
  });

  // Cabeçalho do CSV usa as MESMAS keys dos campos (banco_nome, moeda...) —
  // o match automático em onFile() deve casar tudo sem precisar escolher
  // coluna manualmente.
  await expect(modal.getByText('Associe cada campo')).toBeVisible();
  const selectBanco = modal.locator('.row', { has: page.getByText('Banco', { exact: true }) }).locator('select');
  await expect(selectBanco).toHaveValue('banco_nome');

  await modal.getByRole('button', { name: 'Continuar' }).click();
  await modal.getByRole('button', { name: 'Importar agora' }).click();
  await page.waitForTimeout(500);

  await expect(modal.getByText('1 registro(s) importado(s) com sucesso.')).toBeVisible();
  await modal.getByRole('button', { name: 'Fechar' }).click();

  await page.waitForTimeout(300);
  await expect(secao.getByText('C6 Bank').first()).toBeVisible();
});
