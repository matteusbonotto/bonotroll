# AUDITORIA — Palm Business (Fase 0)

**Resumo:** a base técnica é boa — services como fronteira, RLS em todas as tabelas, testes automatizados, CSP, build seguro. Os problemas que o usuário sente são de **produto e interface**, e nascem de 5 causas raiz (`ARCHITECTURE.md`). Remendar telas isoladas não resolve; a reconstrução atua nas causas, em fases com checkpoint.

| Área | Estado | Evidência |
|---|---|---|
| Segurança | 2 críticos de banco (grupo) com correção pronta e não aplicada; frontend sem XSS nem segredos | `docs/AUDITORIA-SEGURANCA-2026-10.md` |
| Responsividade | Sem rolagem horizontal em nenhuma resolução; problemas de densidade, toque e hierarquia | `medicao-resolucoes-baseline.txt` |
| Acessibilidade | Tamanho de texto, foco e alvos de 44 px parciais; falta semântica base | `docs/REVISAO-UX-2026-10.md` |
| Navegação / IA | 8 áreas com nomes técnicos; Início sem "o que precisa de mim" | Personas (Fase 1) |
| Notificações | Fluxo binário, sem diagnóstico do estado da permissão | `js/services/push.js:31-34` |
| Pronto Socorro | Só guias estáticos; sem ficha dos membros | `js/data/primeirosSocorros.js` |
| PWA | Manifest e SW ok, network-first, cache versionado | `sw.js`, `manifest.webmanifest` |
| Desempenho | 636 KB de JS+CSS; libs pesadas sob demanda (OCR, PDF, gráficos) | build |
| Dados | Modelo doméstico de 2 pessoas; empresa/unidades/funcionários/ficha médica exigem migração | `supabase/schema.sql` |

Detalhamento: `UX_PROBLEMS.md` (P0–P3), `ARCHITECTURE.md`, `BASELINE.md`.
