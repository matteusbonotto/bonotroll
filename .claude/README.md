# `.claude/` — núcleo operacional do Bõnotto

Isto é o que qualquer agente (ou sessão futura, sua ou de outra pessoa) precisa ler pra continuar o projeto sem redescobrir nada. Se você é um agente novo entrando nesta conversa: leia `CLAUDE.md` (raiz) primeiro, depois este arquivo, depois `.claude/checklist/tasks.json` pra saber o que está em andamento agora.

## Por que esta estrutura (e não uma pasta genérica `IA/`)

Em 2026-08-22 o usuário trouxe dois "master prompts" próprios (`MASTER PROJECT BUILDER` e `BONOBOTT`) pedindo uma estrutura de agentes/memória/checklist — mas pediu explicitamente pra montar em `.claude/`, não na árvore genérica `IA/` que os prompts descrevem. Isso combina bem com o que já existia: numa sessão anterior (`.claude/prompt-agentssr.md`, o prompt que originou tudo isto), o projeto já tinha adaptado o mesmo objetivo pra mecanismos **nativos** do Claude Code — agentes reais (`.claude/agents/`, invocáveis como subagentes de verdade, não só personas em markdown) e skills (`.claude/commands/`, mapeadas 1:1 pras skills `audit`/`implement`/`plan`/`review`/`test`) em vez de uma pasta `IA/` que o Claude Code não executa nativamente.

Reorganizar em cima disso — preenchendo só o que faltava (`memory/`, `discussions/`, `checklist/`) — é mais fiel ao princípio dos próprios prompts trazidos pelo usuário ("nunca presumir que uma capacidade existe", "não duplicar capacidades já existentes") do que recriar a árvore literal do zero.

## Mapa

```text
.claude/
├── README.md              este arquivo
├── prompt-agentssr.md      histórico: o prompt que originou a estrutura de agentes/comandos/docs (não apagar — regra de não-destruição)
│
├── agents/                 8 especialistas reais (subagentes do Claude Code, invocáveis via Task/Agent)
│   architect · backend · database · frontend · product-manager · qa · security · ux-ui · code-reviewer
│
├── commands/               espelham as skills audit/implement/plan/review/test (ver raiz do projeto pra invocação real via /audit etc.)
│
├── docs/                   documentos VIVOS — precisam refletir o código real, não o que já foi pedido um dia
│   architecture.md · database.md · business-rules.md · design-system.md · roadmap.md
│
├── memory/                 conhecimento persistente que não é código nem documentação de arquitetura
│   decisions.md · bugs.md · changes.md · user-requirements.md
│   (não existe deprecated.md/changelog.md separados ainda — só serão criados quando houver conteúdo real pra eles; ver regra "não criar arquivo só pra preencher pasta")
│
├── discussions/            registro de decisões com 2+ agentes analisando de forma independente
│   001-cartao-credito-multi-cartao.md
│
└── checklist/              painel Kanban visual (index.html + tasks.json) — ver checklist/README.md
```

**Onde ficam os "standards" de código?** Não há uma pasta `.claude/standards/` separada — de propósito. `CLAUDE.md` (raiz) já documenta convenções (prefixo `cg-`, `services/` como fronteira única, padrão find-or-create, best-effort em ação secundária) e `.claude/docs/business-rules.md`/`architecture.md` documentam o resto. Duplicar isso numa segunda pasta criaria duas fontes de verdade que podem divergir — o mesmo tipo de bug que o projeto já resolveu pra bancos/categorias/empresas (nome único, sem duplicata) se aplica aqui, um nível acima, à própria documentação.

## Como continuar (nova sessão / novo agente)

1. `CLAUDE.md` (raiz) — stack, estrutura, convenções, armadilhas conhecidas.
2. `.claude/checklist/tasks.json` (ou abra `checklist/index.html`) — o que está em `IN_PROGRESS`/`BLOCKED` agora.
3. `.claude/memory/decisions.md` + `.claude/memory/bugs.md` — decisões e bugs que moldam qualquer trabalho novo na mesma área.
4. `.claude/discussions/` — se a tarefa nova tocar uma área com uma discussão já registrada, ler antes de propor algo que já foi descartado.
5. `.claude/docs/roadmap.md` — visão geral Completed/In Progress/Technical Debt, mas **verificar contra o código real antes de confiar** (já aconteceu de ficar desatualizado — ver nota em `.claude/memory/decisions.md`/roadmap sobre a correção de 2026-08-22).

## Pergunta de continuidade (de `BONOBOTT`, adotada aqui)

Antes de considerar qualquer tarefa concluída: *"se outro agente assumir amanhã, ele entende o que foi feito, por quê, quais regras existem, o que foi tentado e descartado, e o que falta?"* Se não, atualizar `memory/`, `discussions/` (se aplicável) e `checklist/tasks.json` antes de encerrar — não depois, não "se sobrar tempo".
