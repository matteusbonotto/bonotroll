# Requisitos e preferências do usuário — Bõnotto

Só o que não está (ou não deveria estar) em `CLAUDE.md`. Preferências de trabalho/estilo de resposta ficam aqui; convenções de código já documentadas no `CLAUDE.md` raiz não são duplicadas.

## Preferências de processo (observadas, não perguntadas)

- **Binário no checklist, sem meio-termo**: `[x]` feito e verificado (rodando de verdade, não "deveria funcionar"), `[ ]` não feito. Reação explícita a um `[~]` (parcial) que misturava os dois: "ou fez ou não fez, 0 e 1" (`docs/CHECKLIST-REBRAND.md`, 2026-08-20). Aplica-se a qualquer checklist/status reportado ao usuário, incluindo o Kanban (`.claude/checklist/`).
- **Não decidir sozinho o que é "mais moderno"/"mais bonito"** sem critério concreto — vários itens de redesenho visual ficaram deliberadamente em aberto por falta de exemplo/referência do usuário (Perfil, Compras, Recursos, Caixinhas). Ver `.claude/agents/product-manager.md` e `.claude/docs/roadmap.md` §"In Progress". Quando o usuário finalmente dá mandato concreto (como em 2026-08-22, pedindo revisão de toda a plataforma), isso destrava esses itens — mas a auditoria ainda precisa produzir achados objetivos (arquivo:linha, categoria de problema), não "ficou mais bonito".
- **Privacidade do dado de demo é crítica, não estética**: dado mock nunca pode se parecer com dado real da vida do usuário (empregador, cidade, concessionária regional) — o repositório GitHub (`matteusbonotto/bonotroll`) é **público** (confirmado via `gh repo view`, 2026-08-22), não só o site publicado — qualquer pessoa navega o código-fonte, não só `?demo=1`. Ver `.claude/memory/bugs.md` (BUG-002).
- **Pendente de decisão do usuário**: o histórico do git ainda contém os nomes reais antigos (commits anteriores a 2026-08-22) em texto puro, tecnicamente visível por quem for procurar no repositório público. Corrigir isso exigiria reescrever histórico (destrutivo, quebra clones/forks existentes) — não fiz isso sozinho. Se o usuário quiser, é uma conversa separada e explícita antes de qualquer `filter-repo`/force-push.

## Pedidos recorrentes / padrão de trabalho

- Pede para "usar todos os agentes" e "eles discutirem o melhor caminho" quando o problema é arquiteturalmente não-trivial (2026-08-22, feature de cartão de crédito) — nesse caso, produzir uma discussão real registrada (`.claude/discussions/`), não uma decisão só minha apresentada como se fosse consenso.
- Idioma: sempre PT-BR (já formalizado em `CLAUDE.md`).
- Confirma explicitamente antes de ações irreversíveis em produção (ex.: rodar schema.sql contra o Supabase real) — já é o padrão seguido, não mudar.
