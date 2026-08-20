# Design System — Bõnotto (referência rápida)

Diretriz completa e a evidência que a motivou: `docs/DESIGN-SYSTEM-2027.md` — leia lá antes de revisar qualquer tela. Este arquivo só lista os valores reais (`css/tokens.css`) pra consulta rápida.

## Cores (`css/tokens.css`)

```text
--color-primary: #0E9F6E        (verde-esmeralda — ação principal, estado ativo de navegação, NUNCA texto decorativo)
--color-primary-dark: #06724E
--color-primary-soft: #DCFCE9
--color-accent: #FF6B4A         (usado em "encerrar"/estado de conclusão — ver .cg-shopping-toggle--finish)
--color-success: #16A34A        --color-danger: #E11D48
--color-warning: #D97706        --color-info: #0EA5E9
--color-secondary: #64748B
--color-bg / --color-surface / --color-surface-alt / --color-text / --color-text-muted / --color-border
   (cada um redefinido em 3 estados: claro padrão, escuro via prefers-color-scheme, escuro/claro forçado via [data-bs-theme])
```

## Raio — cada um tem um papel fixo, sem exceção

```text
--radius-sm (10px)   controles pequenos, badge, tag — nunca card
--radius-md (14px)   controle padrão: input, select, botão pequeno, tile
--radius-lg (20px)   card/modal/superfície grande — nunca controle
--radius-pill (999px) SÓ botão de ação principal e chip/badge — nunca nav, nunca item de lista largo
```

## Espaçamento e alvo de toque

```text
--space-1..6: 4 / 8 / 12 / 16 / 24 / 32px
--touch-target: 48px
```

## Tipografia (`--font-size-caption` … `--font-size-display`, ver tokens.css)

```text
caption 12px · body-sm 13px · body 15px (padrão) · body-lg 17px · title-sm 20px · title 24px · display clamp(28–36px, valor monetário em destaque)
```

⏳ **Migração pendente** (`docs/DESIGN-SYSTEM-2027.md` §11): ~66 declarações de `font-size` soltas ainda existem em `css/components.css`/`css/app.css` fora da escala acima — migração é aditiva (nada quebra só pelos tokens existirem) mas muda tamanho visível em vários lugares de uma vez, então precisa de revisão visual tela por tela antes de espalhar, não é seguro automatizar cegamente.

## Regras sem exceção

- Navegação = `.cg-back` (chevron, sem borda/fundo, `text-muted`) — nunca um `btn-outline-secondary` reinventado.
- Ação primária = preenchida, cor de sentido/marca, **uma só por tela/modal**.
- Ação destrutiva = nunca preenchida com o mesmo peso de uma ação primária.
- Card nunca dentro de card — agrupamento interno usa `border-top`/`gap`.
- Dois botões do mesmo grupo de controle (ex.: "Iniciar"/"Pausar" numa mesma tela) usam a mesma família visual (mesmo raio/altura), só variando preenchido vs. contorno.
- Ícone Bootstrap sempre do mesmo peso pro mesmo conceito (nunca misturar `bi-x` outline com `bi-x-fill`).
- Todo valor monetário em destaque usa `font-variant-numeric: tabular-nums`.
