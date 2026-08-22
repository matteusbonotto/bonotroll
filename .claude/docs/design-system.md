# Design System — Bõnotto (referência rápida)

Diretriz completa e a evidência que a motivou: `docs/DESIGN-SYSTEM-2027.md` — leia lá antes de revisar qualquer tela. Este arquivo só lista os valores reais (`css/tokens.css`) pra consulta rápida.

## Cores (`css/tokens.css`)

```text
--color-primary: #126B5C        (verde-esmeralda fechado/teal — ação principal, estado ativo de navegação, NUNCA texto decorativo)
--color-primary-dark: #0A4D42   (vira #5EEAB0 no escuro — é usado como TEXTO em cima de --color-primary-soft)
--color-primary-soft: #E3F2ED
--color-accent: #D96B45         (usado em "encerrar"/estado de conclusão — ver .cg-shopping-toggle--finish)
--color-success: #168360        --color-danger: #C8374E
--color-warning: #D97706        --color-info: #0EA5E9
--color-secondary: #64748B
--color-bg / --color-surface / --color-surface-alt / --color-text / --color-text-muted / --color-border
   (cada um redefinido em 3 estados: claro padrão, escuro via prefers-color-scheme, escuro/claro forçado via [data-bs-theme])
```

2026-08-22: estes eram os valores que já renderizavam de fato (havia 3 declarações de `:root` conflitantes — `tokens.css`, e uma redeclaração inteira cada em `components.css`/`app.css` — sem nenhuma decisão documentada, "quem vencia" era só ordem de carregamento do arquivo). Consolidado numa fonte só (`tokens.css`); os valores antigos documentados aqui antes (`#0E9F6E` etc., por sua vez uma consolidação anterior de `#1F7A5C`) nunca chegaram a renderizar depois que os blocos "refresh" foram introduzidos.

## Raio — cada um tem um papel fixo, sem exceção

```text
--radius-sm (6px)    controles pequenos, badge, tag — nunca card
--radius-md (8px)    controle padrão: input, select, botão pequeno, tile
--radius-lg (12px)   card/modal/superfície grande — nunca controle
--radius-pill (999px) SÓ botão de ação principal e chip/badge — nunca nav, nunca item de lista largo
```

## Espaçamento e alvo de toque

```text
--space-1..6: 4 / 8 / 12 / 16 / 24 / 32px
--touch-target: 48px
```

`.btn`/`.cg-btn` estavam em 40-42px (uma das duplicações de componente do item acima) — corrigido em 2026-08-22 pra respeitar `--touch-target` de verdade. Toolbars compactas que precisam de botão menor (`.cg-agrupar-toggle`, `.cg-shopping-toggle`, `.cg-btn.btn-sm` no mobile) têm seletor mais específico com seu próprio `min-height`, então continuam compactas.

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
