---
description: Code review multidisciplinar de uma mudança no Bõnotto (diff atual ou PR).
---

Alvo (opcional): $ARGUMENTS — se vazio, revisa o diff não commitado (`git diff`) e os commits ainda não mergeados em `main` na branch atual.

Avalie, nesta ordem, usando os critérios já documentados no projeto (não invente critério novo):

```text
Architecture   — .claude/agents/architect.md: reaproveita services/js/components/ existente? blast radius avaliado?
Frontend       — .claude/agents/frontend.md: x-show + utility Bootstrap no mesmo elemento? CSS duplicado?
Backend        — .claude/agents/backend.md: services/ continua a única fronteira? mockDb.js sincronizado com o schema?
Database       — .claude/agents/database.md: RLS presente e correta? migração idempotente?
UX             — .claude/agents/ux-ui.md: segue docs/DESIGN-SYSTEM-2027.md?
QA             — .claude/agents/qa.md: suite rodada de verdade, resultado real reportado? teste de regressão adicionado se corrigiu bug?
Security       — .claude/agents/security.md: RLS, secrets, sanitização de input
Performance    — import dinâmico mantido pra lib pesada? nada bloqueando o carregamento inicial sem necessidade?
```

Classifique cada problema encontrado como `CRITICAL` / `HIGH` / `MEDIUM` / `LOW` / `SUGGESTION` (ver `.claude/agents/code-reviewer.md`). Não diga apenas "está bom" — se depois de revisão genuína nenhum problema real foi encontrado, declare isso explicitamente em vez de inventar um.
