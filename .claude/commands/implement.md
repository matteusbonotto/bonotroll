---
description: Implementa uma tarefa no Bõnotto (planejada antes, ou direta se for simples), testa e reporta.
---

Tarefa: $ARGUMENTS

1. Revise o estado atual do repositório relevante (`git status`, arquivos envolvidos) antes de editar — nunca sobrescrever trabalho existente sem checar primeiro.
2. Se a tarefa não tiver sido planejada ainda e for não-trivial (toca mais de 1 arquivo, ou é ambígua), rode `/plan` primeiro.
3. Implemente seguindo os padrões documentados em `CLAUDE.md` e nos agentes relevantes (`.claude/agents/frontend.md`, `backend.md`, `database.md` conforme o caso) — procure um `.cg-*`/função de `services/` equivalente antes de criar algo novo.
4. Rode de verdade (`python -m http.server 5500`, `?demo=1`) e verifique o fluxo que a tarefa descreve — nunca declare feito sem ter visto funcionar.
5. Rode `npm run test:unit && npm test`. Se algo falhar, corrija antes de reportar. Se um teste do Playwright falhar com `browser.newContext: Target page, context or browser has been closed`, reconfirme rodando ele sozinho antes de tratar como flaky.
6. Se corrigiu um bug real, adicione um teste de regressão (`tests/e2e/*.spec.js` ou `tests/unit/*.test.js`).
7. Reporte: o que mudou, como foi verificado (comando/resultado real, não "deveria funcionar"), e qualquer trade-off ou limitação genuína.
