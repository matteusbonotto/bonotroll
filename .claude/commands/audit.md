---
description: Auditoria geral do estado real do Bõnotto — não altera o projeto, só diagnostica.
---

Produza um diagnóstico do estado atual real do repositório, sem alterar nenhum arquivo. Cubra:

```text
Arquitetura       — services/ ainda é a única fronteira? algum componente pulando essa camada?
Código            — duplicação nova desde o último diagnóstico (docs/RAIO-X-2.0.md)?
UX/UI             — telas revisadas desde docs/DESIGN-SYSTEM-2027.md ainda seguem a diretriz? alguma regressão visual?
Segurança         — RLS de tabela nova (se houver) segue o padrão? secret exposto em algum commit novo?
Performance       — algum import pesado deixou de ser dinâmico?
Testes            — cobertura real (tests/unit + tests/e2e) cresceu ou ficou estagnada desde a última rodada de mudanças?
Dependências      — serviços externos gratuitos sem chave (Frankfurter, CoinGecko, Open Food Facts, esm.sh) ainda respondendo?
Banco             — schema.sql e mockDb.js ainda espelham um ao outro?
Documentação      — CLAUDE.md, .claude/docs/*, docs/CHECKLIST-REBRAND.md ainda refletem o estado real, ou já ficaram desatualizados?
Dívida técnica    — o que já está listado em .claude/docs/roadmap.md (seção Technical Debt) continua válido? algo novo apareceu?
```

Base a auditoria em verificação real (grep, leitura de arquivo, `git log`), não em suposição. Ao final, atualize `.claude/docs/roadmap.md` se algo relevante mudou, e produza um plano de ação priorizado — mas não implemente nada nesta rodada.
