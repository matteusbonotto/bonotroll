---
description: Roda a verificação completa do Bõnotto (testes automatizados + checagem manual do fluxo) e corrige o que achar, se autorizado pelo contexto.
---

Escopo (opcional): $ARGUMENTS — se vazio, verificação completa do app; se preenchido, foco na área/tela citada.

1. `npm run test:unit` — funções puras.
2. `npx playwright test --workers=2` (ou `npm test`) — e2e completo.
3. Para qualquer falha:
   - Se for `browser.newContext: Target page, context or browser has been closed`, reconfirme rodando esse teste sozinho (`npx playwright test <arquivo> --workers=1`) antes de concluir se é flaky de infraestrutura ou regressão real.
   - Se for regressão real, corrija a causa raiz (não só o sintoma) e rode a suite completa de novo.
4. Se `$ARGUMENTS` apontar uma tela específica, abra `?demo=1` localmente e navegue o fluxo de verdade (Playwright ou manual) — console sem erro novo, responsivo em mobile (360–390px) e desktop, tema claro e escuro se a área tem cor.
5. Reporte: quantos testes passaram/falharam, o que foi corrigido, e o que continua falhando (se algo continuar falhando, diga exatamente o quê e por quê — nunca reporte "tudo certo" com um teste vermelho).
