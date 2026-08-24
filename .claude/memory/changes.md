# Changelog — Bõnotto (o "porquê", não o "o quê")

## 2026-08-23 — Rodada de bugs reais de uso (mercado) + processo: agentes em background batendo no limite de sessão

Contexto importante pra continuidade: no meio da implementação do cartão de crédito (rodada de 2026-08-22), 2 agentes em background (`database`, `backend`) falharam por "session limit" — mas o trabalho deles JÁ TINHA SIDO commitado em `main` (não numa branch de feature, contrariando a regra do CLAUDE.md) antes da falha, aparentemente por uma continuação autônoma que fugiu do escopo pedido (fez também frontend: `cartaoManager.js`, UI em `index.html`, teste e2e novo). Verificado depois: `main` está em sync com `origin/main` (**já publicado no GitHub público**), testes passando (52 unit, ~26 e2e com 1 flake ambiental conhecido sob paralelismo). Não revertido — o trabalho está correto e testado — mas registrado aqui como um desvio de processo real, não como algo a repetir. Ver `.claude/memory/user-requirements.md`.

Na sequência, o usuário reportou (em tempo real, usando o app no mercado) uma lista de bugs sérios: exclusão de despesa "mentindo" sobre sucesso (BUG-005), crash de memória ao fotografar pra OCR (BUG-006), gráfico de Compras nunca renderizando (BUG-007), além de UX de Compras (confusão Comprar/Excluir na grade, foco depois de adicionar item) e um pedido de verificação (itens não seriam preservados ao encerrar compra — investigado, não reproduzido). Dado que agentes em background continuaram falhando por limite de sessão nesta mesma janela de tempo, a segunda leva de correções foi feita DIRETAMENTE (Read/Edit/Bash do orquestrador), não delegada — mais lento por item, mas confiável, com teste real rodado a cada mudança. Branch usada: `fix/compras-camera-2026-08-23` (a partir de `main`), aguardando revisão final antes de merge/deploy.

Pendente ao final desta sessão: scanner de código de barras/QR não investigado ainda (TASK-029), verificação de performance/layout geral da grade de Compras (TASK-030), e 3 pedidos de feature novos registrados como backlog (FEAT-003 Mercado com limite+aviso; IDEA-004/005/006 exploratórias, precisam de rodada de produto antes de qualquer desenho técnico).

## 2026-08-24 — Scanner (QR) e OCR de foto, com banco de produtos real

Usuário testou a rodada anterior: código de barras ok, QR "não tão bem", foto "péssima" (exemplo concreto: lata de Nescau virou texto aleatório). Causa raiz do QR: caixa de leitura desenhada só pra código de barras 1D (larga e baixa) cortava um QR quadrado fora da área analisada — corrigida pra quadrada, e habilitada a API nativa `BarcodeDetector` do navegador quando suportada (mais precisa, de graça). Causa raiz do OCR: Tesseract sem nenhum pré-processamento de imagem e no modo de segmentação errado pra rótulo de produto (assumia bloco único de texto tipo documento) — corrigido com pré-processamento (contraste por percentil, robusto contra brilho de embalagem) + modo de texto espalhado + uma camada nova: o texto lido agora é usado como busca contra a base pública Open Food Facts em vez de virar o título direto, corrigindo o palpite do OCR quando acha o produto real (também traz imagem/marca — usado pra preencher `foto_url` automaticamente em Compras e Recursos, tanto no scan de código de barras quanto na foto).

Nota de processo: tentei validar o pipeline de OCR ponta a ponta com uma imagem sintética via Playwright, mas o próprio dev server tem live-reload que recarrega a página quando detecta mudança de arquivo — meu script criou um arquivo temporário DENTRO do diretório servido, disparando um reload no meio do teste e mascarando o resultado (parecia bug, era o teste se atropelando). Lição: qualquer diagnóstico futuro com Playwright precisa escrever arquivos temporários FORA da árvore servida pelo `python -m http.server`.


`git log` já é a fonte de verdade de QUAIS arquivos mudaram. Este documento registra o motivo por trás de mudanças não óbvias a partir do diff sozinho — não duplicar aqui o que a mensagem de commit já explica bem.

## 2026-08-22 — Rodada: cartão de crédito multi-banco + privacidade do mock + auditoria visual

Contexto completo: usuário trouxe 2 "master prompts" próprios (MASTER PROJECT BUILDER + BONOBOTT) pedindo pra reorganizar `.claude/` com o que eles descrevem (memória persistente, discussões entre agentes, checklist Kanban) — decisão de adaptação: **não** criar a árvore genérica `IA/` que os prompts descrevem, porque o projeto já tinha adaptado esse mesmo objetivo pra mecanismos nativos do Claude Code (agentes reais em `.claude/agents/`, skills em vez de "comandos" genéricos) numa sessão anterior (`.claude/prompt-agentssr.md`, o prompt que originou essa adaptação). Reorganizar em cima do que já existe, preenchendo só as peças que faltavam (`memory/`, `discussions/`, `checklist/`), é mais fiel ao princípio dos próprios prompts trazidos pelo usuário ("Nunca presumir que uma capacidade existe" / "não duplicar capacidades") do que seguir a árvore literal.

Junto, mesma sessão:
- Correção do bug de cartão de crédito relatado (ver `.claude/memory/bugs.md` BUG-001) via nova entidade `cartoes` — decisão registrada em `.claude/discussions/001-cartao-credito-multi-cartao.md`.
- Regeneração do dado de demo com Faker (BUG-002, privacidade) — dados que pareciam reais (empregador, cidade) substituídos por genéricos, cobrindo os mesmos cenários.
- Auditoria visual completa das 7 telas, usando `docs/DESIGN-SYSTEM-2027.md` como critério objetivo — resultado usado pra finalmente destravar os itens de "redesenho visual" que ficavam em aberto por falta de critério concreto.

Detalhe do antes/depois de cada mudança específica fica nos próprios commits + `.claude/checklist/tasks.json` (histórico por tarefa) — este registro é só o fio condutor entre elas.
