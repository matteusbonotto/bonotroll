# Discussões entre agentes — Bõnotto

Registro de decisões com impacto real, quando 2+ agentes especialistas (`.claude/agents/`) analisam um problema de forma independente antes de implementar. Não criar um arquivo aqui para toda decisão pequena — só quando há real risco de divergência técnica ou quando o usuário pede explicitamente uma discussão multiagente.

## Quando criar

- Mudança de schema com trade-off real (nova tabela vs. campo vs. correção mínima).
- Decisão que afeta mais de uma área (ex.: arquitetura + banco + produto ao mesmo tempo).
- Usuário pede explicitamente "discutam antes" ou traz um problema ambíguo o suficiente pra valer múltiplos ângulos.

## Formato (`NNN-titulo-curto.md`)

```
# NNN — Título

**Data**:
**Status**: EM ANÁLISE | DECIDIDO | IMPLEMENTADO | REVERTIDO

## Objetivo
## Contexto
## Participantes
## Análises          (uma seção por agente, resumindo a análise real dele — não uma frase genérica)
## Conflitos          (se não houve, dizer isso explicitamente — não inventar debate artificial)
## Alternativas descartadas
## Decisão
## Impactos
## Ações
## Status
```

Os agentes devem analisar de forma independente sempre que possível (sem ver a conclusão um do outro antes de terminar) — convergência genuína entre análises independentes vale mais como evidência do que um único agente "revisado" por outro depois.

## Índice

- [001 — Cartão de crédito como entidade própria](001-cartao-credito-multi-cartao.md) — `DECIDIDO`, 2026-08-22.
