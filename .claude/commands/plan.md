---
description: Planeja uma mudança no Bõnotto antes de implementar (sem escrever/editar código).
---

Antes de qualquer edição, produza um plano cobrindo:

```text
Understanding        — o que o usuário pediu, na linguagem dele, e o que fica fora de escopo
Requirements         — critério de aceite concreto e verificável (ver .claude/agents/product-manager.md)
Affected Files        — quais arquivos reais serão tocados (ler CLAUDE.md pra saber onde cada tipo de mudança mora: index.html+js/components/ pra UI, js/services/ pra dado, supabase/schema.sql pra schema)
Architecture Impact   — toca services/? cria componente/store novo ou reaproveita um .cg-*/x-data existente?
Database Impact       — precisa de tabela/coluna/policy nova? mockDb.js precisa espelhar?
UX Impact             — a tela segue docs/DESIGN-SYSTEM-2027.md? algum pedido subjetivo sem exemplo concreto precisa ser esclarecido antes?
QA Impact             — que teste novo (unit ou e2e) cobre isso depois?
Security Impact       — toca RLS, auth, upload, secret?
Implementation Plan    — passo a passo concreto, na ordem
Risks                  — o que pode quebrar, e como reduzir esse risco
```

Argumento: $ARGUMENTS

Não implemente nada nesta etapa — só planeje. Se `$ARGUMENTS` estiver vazio, peça objetivamente o que precisa ser planejado.
