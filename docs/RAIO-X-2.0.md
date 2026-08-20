# RAIO-X 2.0 — Diagnóstico Multidisciplinar do Bõnotto

> Primeiro entregável do PROMPT MASTER — BÕNOTTO 2027 (`docs/prompt.txt`, §84). Nenhum código foi alterado para produzir este documento (§85). Base: leitura integral de `docs/RAIO-X-DO-PROJETO.md` (documentação técnica já verificada contra produção em três rodadas, 2026-08-19/20) + verificação independente direta no repositório nesta sessão (contagem de arquivos, tamanho de arquivos-chave, varredura de acessibilidade, ausência de testes/CI, spot-check de RLS). Onde este documento diverge do RAIO-X técnico, é porque a verificação independente encontrou algo que o RAIO-X não cobria — não porque o RAIO-X estava errado.

---

## 1. Entendimento atual

O Bõnotto é um PWA doméstico para duas pessoas (Matheus e Beatriz) que unifica três domínios que normalmente vivem em apps separados — controle financeiro (com divisão de despesa entre casal), lista de compras e inventário doméstico — mais um módulo de reserva financeira (Caixinhas) e notificações/push reais. É software sob medida, não um produto comercial hoje, mas construído com a arquitetura consciente de que *poderia* virar um no futuro (ver §50 do prompt).

Em ~48h de trabalho intenso (19–20/08/2026) o projeto passou por três rodadas de mudanças reais, cada uma verificada em produção (não só em modo demo): consolidação de notificações/push, uma leva grande de módulos novos (Caixinhas, recorrência com cadência, agrupamento, CSV para Recursos), e uma rodada de correção de causa raiz sobre bugs que a rodada anterior só remendou parcialmente. Esse padrão — construir rápido, depois o usuário testar de verdade e apontar o que ainda estava errado, depois corrigir a causa raiz — é o padrão de desenvolvimento observável em todo o histórico do projeto, não um evento isolado.

## 2. Arquitetura encontrada

Confirma o que o RAIO-X já documenta (§2–§4 dele): um único `index.html` com sete telas permanentemente montadas, Alpine.js para reatividade, Bootstrap 5 só como CSS, Supabase como backend real, `localStorage` como modo demo espelhando o mesmo schema, sem build step, sem bundler, sem `package.json` de produção.

**Números confirmados de forma independente nesta sessão** (o RAIO-X fala "~40 arquivos" — a contagem real merece precisão):

| Métrica | Valor real | Observação |
|---|---|---|
| Arquivos versionados no repo | 63 | inclui docs, CSVs de exemplo, ícones — os arquivos-fonte que rodam no navegador (`js/`, `css/`, `index.html`, `sw.js`, `manifest`) somam 40 |
| `index.html` | 2.494 linhas | um único arquivo, todas as 7 telas + 5 modais |
| `css/components.css` | 875 linhas | maior arquivo CSS |
| Total JS (`js/`) | ~7.700 linhas em 27 módulos | nenhum arquivo passa de 570 linhas (`transactionForm.js`) |
| `supabase/schema.sql` | 1.062 linhas | schema + RLS completos, idempotente |
| Testes automatizados | **0** | nenhum diretório `tests/`, nenhum `*.test.js`, nenhum config de test runner |
| CI/CD | **inexistente** | sem `.github/workflows`, deploy = `git push origin main` direto |
| `aria-*` no HTML | 44 ocorrências | numa superfície com dezenas de botões só-ícone, 5 modais, drawers, gráficos |
| `role=` no HTML | 21 ocorrências | |
| `alt=` no HTML | 11 ocorrências | |
| `prefers-reduced-motion` no CSS | **0 ocorrências** | não tratado em nenhum dos 3 arquivos CSS |

Nada disso invalida a arquitetura — só quantifica precisamente onde ela está madura (services/RLS/money-as-numeric) e onde ainda não foi exercitada (testes, CI, acessibilidade sistemática, motion preference).

## 3. Funcionalidades encontradas

Cobertas em detalhe file-por-file no RAIO-X (seções 7 a 13, 20): Dashboard com resumo por pessoa/grupo/período e 4 gráficos configuráveis; Transações com divisão multi-pagador, recorrência com cadência+parcela, agrupamento em accordion, importação CSV, OCR/PDF/código de barras/Pix 100% offline; Lista de Compras com máquina de estados, tema "caderno", integração com Open Food Facts; Recursos (inventário em 3 níveis, sugestões automáticas de compra); Caixinhas (reserva por banco, multi-moeda com conversão ao vivo); Notificações (central no app + push real via 3 Edge Functions); Grupo (convite por código); Perfil. Não repito aqui — o RAIO-X é a fonte confiável e recente (verificada há menos de 24h) para "o que existe e como funciona por dentro". Este documento foca no que o RAIO-X **não** é: uma camada avaliativa.

## 4. Pontos fortes (preservar, não redesenhar)

- **`services/` como fronteira única entre UI e dado.** Nenhuma tela sabe se está em modo demo ou real. Isso é exatamente o tipo de decisão arquitetural que o prompt (§38) pede pra preservar se estiver certa — está.
- **Nada calculado é persistido.** Status de pagamento, saldo de caixinha, total de compra — tudo derivado ao vivo do dado bruto. Elimina uma classe inteira de bug (duas fontes de verdade divergentes) antes que ela possa existir.
- **`numeric(12,2)` para dinheiro no banco, nunca `float`.** Já segue a regra do §14 do prompt no lado do Postgres.
- **RLS como linha de defesa real, não decorativa.** A saga documentada em RAIO-X §6.3 (três tentativas até chegar num trigger `security definer`) é evidência de rigor genuíno, não de sorte — o time (você) continuou até achar a causa raiz em vez de abrir uma exceção frouxa na policy.
- **Import dinâmico consistente para tudo pesado.** Chart.js, Tesseract.js, pdf.js, html5-qrcode, PapaParse, supabase-js — nenhum paga custo de carregamento inicial se a sessão não usar aquela feature.
- **Padrão "best-effort" para ação secundária** (RAIO-X §14.4) é uma disciplina real e replicável: notificar nunca trava salvar.
- **Correção de causa raiz sobre remendo.** A rodada de 20/08 (categorias, agrupamento, `todayIso()`) é o oposto de dívida técnica acumulando — é dívida técnica sendo paga de propósito.
- **Zero dependência de IA paga**, já hoje — o produto já entrega "parece inteligente" via categorização por palavra-chave, leitura offline de boleto/Pix, sugestões de compra — sem nenhuma chamada a LLM.

## 5. Problemas

- **Zero testes automatizados de qualquer tipo.** Toda verificação até aqui foi manual (Playwright rodado ad-hoc durante o desenvolvimento, depois descartado — não vira regressão). Isso significa que **cada nova rodada de mudança corre o risco real de reintroduzir um bug já corrigido** (o próprio histórico já mostra 3+ variações do mesmo bug de `x-show`/`!important` reaparecendo em lugares diferentes — prova de que "lembrar de não repetir o erro" não está escalando só na cabeça de quem programa).
- **`index.html` com 2.494 linhas é um god-file.** Ainda navegável hoje, mas cada tela nova (Caixinhas foi a mais recente) engorda o mesmo arquivo. Sem build step, dividir em arquivos físicos exigiria `fetch()`+`innerHTML` (adiciona latência/FOUC) — é uma tensão real, não um erro óbvio a corrigir (ver discussão do arquiteto, blueprint §Arquitetura).
- **Aritmética monetária no JS é `Number` de ponto flutuante, não inteiro de centavos.** O banco está certo (`numeric`); a soma/divisão/conversão no cliente (`Number(m.valor) || 0`, em `caixinhas.js`, `transactions.js`, `shoppingList.js`) herda os erros clássicos de ponto flutuante (`0.1 + 0.2 !== 0.3`) em somas com muitas parcelas. Ainda não observado como bug relatado, mas é uma bomba-relógio, não uma hipótese — o próprio histórico de Caixinhas (3 bugs de soma de moeda em 2 dias) mostra que esse é exatamente o tipo de erro que o projeto já cometeu por descuido aritmético.
- **Nenhum gráfico tem alternativa textual.** O prompt (§45) é explícito: "Gráficos nunca devem ser a única forma de transmitir informação." Hoje, os 4 gráficos configuráveis do Dashboard são só canvas — sem tabela equivalente, sem resumo em texto pra leitor de tela.
- **Acessibilidade é parcial, não sistemática.** 44 `aria-*`/21 `role=`/11 `alt=` é evidência de atenção pontual (existe onde alguém lembrou), não de uma passada completa. `prefers-reduced-motion` está ausente por completo.
- **README genuinamente desatualizado** — não só nos itens que o RAIO-X já achou (OCR, recorrência automática, CRUD de cômodo), mas também "Múltiplas moedas... não implementado", que hoje é parcialmente falso (Caixinhas já suporta 7 moedas com conversão). Um README errado é um risco de confiança pra qualquer colaborador futuro (mesmo que hoje sejam só vocês dois).
- **Sem CI de nenhum tipo.** Push direto pra `main` é o próprio "deploy". Sem lint, sem verificação de sintaxe, sem teste — o primeiro sinal de erro de digitação em produção é a tela quebrada de alguém real.
- **"Quanto ainda posso gastar?" não tem resposta direta na Home.** O prompt (§32) marca essa pergunta como potencialmente mais importante que "quanto já gastei" — hoje o orçamento existe (Perfil → Orçamentos) mas não tem manchete própria no Dashboard desde que o card de "Orçamentos do mês" foi removido de lá (RAIO-X §7.1, "Removido").
- **Notificações não têm nível de severidade.** O prompt (§33) pede INFO/ATTENTION/WARNING/CRITICAL — hoje todo evento (vencimento, estoque, validade, pagamento) chega com o mesmo peso visual, sem prioridade nem snooze.
- **Sem "saldo entre o casal" explícito.** `transaction_payers` sabe calcular quanto cada um deve por transação, mas não existe uma tela que agregue "Beatriz deve R$ X pra Matheus" (estilo Splitwise) — pra saber isso hoje é preciso somar mentalmente.

## 6. Riscos

- **Regressão silenciosa.** Sem testes, qualquer correção futura em `caixinhas.js`, `transactions.js` ou `recurring.js` (os três arquivos com mais lógica de negócio sensível a dinheiro/data) pode reintroduzir um bug já resolvido sem que ninguém perceba até acontecer em produção de novo.
- **Ponto flutuante em soma de dinheiro** (acima) — risco crescente conforme mais transações/parcelas/caixinhas se acumulam.
- **Single point of authorship.** Todo o conhecimento de "por que essa decisão foi tomada" vive em comentários no código e no RAIO-X — não há segunda pessoa técnica pra revisar mudanças antes de irem pra produção (aceitável dado o contexto — projeto de 2 pessoas — mas vale nomear como risco estrutural, não ignorá-lo).
- **Dependência de 6 serviços externos gratuitos sem chave** (Frankfurter, CoinGecko, Open Food Facts, esm.sh, Google Fonts, Supabase free tier) — todos podem mudar de domínio, aposentar endpoint ou impor rate limit sem aviso (já aconteceu uma vez: Frankfurter mudou de domínio e quebrou silenciosamente). Sem teste de integração automatizado, a única forma de descobrir é um humano notando que "parou de funcionar".
- **Supabase free tier tem teto de banda/invocação mensal** — os dois pollers (60s e 2min, RAIO-X §3.6) rodam o dia inteiro em qualquer aba aberta; hoje protegidos por `podeRodar()` (pula se aba oculta/sem sessão/offline), mas não há visibilidade de quanto do teto mensal está sendo consumido.

## 7. Inconsistências (documentação × código × comportamento)

| Onde | O que diz | O que é real |
|---|---|---|
| `README.md` | "OCR de nota fiscal... não implementado" | Implementado (`js/services/ocr.js`) |
| `README.md` | "Geração automática de lançamentos futuros... não implementado" | Implementado (`js/services/recurring.js`) |
| `README.md` | "CRUD de cômodo/subcategoria... lista fixa" | CRUD completo implementado |
| `README.md` | "Múltiplas moedas... não implementado" | Parcialmente implementado (Caixinhas, 7 moedas) — só Transações/Compras continuam BRL-only |
| `README.md` | "Push notifications... infraestrutura opcional, não verificada" | Confirmado funcionando ponta a ponta em produção há dias |
| `docs/prompt.txt` §2 | descreve o estado do produto | **Está correto e atualizado** — foi mantido em sincronia manualmente ao longo da sessão; nenhuma divergência encontrada |

O README é o único artefato realmente defasado. O `docs/prompt.txt` e o `RAIO-X-DO-PROJETO.md` estão, pela minha verificação independente, alinhados com o código real.

## 8. Dívida técnica

- Ausência total de suite de testes (a maior dívida do projeto, por volume de risco que mitiga por real quanto custa pra montar).
- `README.md` desatualizado (dívida pequena, correção rápida).
- Aritmética monetária em ponto flutuante no cliente (dívida média — não é reescrita, é isolar num módulo `money.js` com regras testadas).
- `x-show`/`!important` como padrão de bug recorrente (já mitigado pontualmente com `x-if`, mas não existe uma convenção documentada tipo "nunca use `x-show` com uma classe utilitária Bootstrap no mesmo elemento" pra prevenir a próxima ocorrência antes dela acontecer).
- `index.html` como god-file crescendo a cada tela nova, sem separação física (mitigado até agora pela disciplina de nomeação `.cg-*`, mas o arquivo só cresce).

## 9. Gaps (o que falta, não o que está quebrado)

- Sem "quanto ainda posso gastar" na Home.
- Sem saldo agregado entre o casal.
- Sem alternativa textual pra gráficos.
- Sem níveis de severidade em notificação.
- Sem entrada rápida de despesa (tipo "Mercado 184,90" → confirma e pronto) — o formulário completo sempre abre, mesmo que a maior parte fique atrás de "Mais opções".
- Sem indicador de tendência ("Você está gastando mais ou menos que o mês passado?") fora do card específico de comparativo.
- Sem detecção de anomalia de gasto (§23.4 do prompt: "essa compra está bem acima do seu padrão") — o dado (histórico por categoria) já existe, só falta o cálculo.
- Sem projeção de fim de mês (§23.5).
- Sem `deleted_at`/exportação de dados própria (LGPD-friendly mesmo em uso pessoal — barato de adicionar agora, caro de adicionar depois).

## 10. Oportunidades

- **"Inteligência sem IA" tem terreno fértil e pouco explorado ainda.** O app já categoriza por palavra-chave e já tem histórico rico por pessoa/categoria/empresa — os três exemplos do prompt (defaults inteligentes, detecção de anomalia, projeção determinística) são extensões relativamente baratas do que já existe, não features novas do zero.
- **Consolidar Home em torno de 5 perguntas** (§25 do prompt: como estou / o que precisa de atenção / o que fazer agora / melhor ou pior / existe risco) — a Home de hoje já tem quase todos os blocos certos, só não está organizada explicitamente em torno dessas perguntas.
- **"Casa como sistema"** (§34–35) — as pontes entre Recursos → Compras → Transações já existem parcialmente (sugestão de compra, compra vira despesa) mas ainda são 3 ações manuais separadas, não uma experiência única.
- **Playwright já é usado neste projeto pra verificação manual** — formalizar isso em `tests/*.spec.js` reais (sem precisar de bundler nem build step, Playwright roda puro via `npx playwright test`) é a oportunidade de menor custo/maior retorno do diagnóstico inteiro.

## 11. Possíveis mudanças

Ver blueprint (`docs/BONOTTO-2027-BLUEPRINT.md`) para a lista completa com prioridade — resumo das categorias: consolidar a camada monetária num módulo único e testado; adicionar alternativa textual a gráficos; adicionar níveis de notificação; adicionar saldo entre casal; adicionar entrada rápida; adicionar suite de regressão mínima; atualizar README; adotar convenção explícita contra `x-show`+utilitário Bootstrap.

## 12. Perguntas que precisam de decisão (só você decide)

1. **Testes automatizados**: vale o investimento de tempo agora (2 usuários, app pessoal) ou isso é over-engineering pro estágio atual? Minha recomendação no blueprint é "sim, mas mínimo e focado só no que já mordeu vocês" — mas é uma escolha de custo/benefício sua.
2. **Money Engine dedicado**: refatorar toda soma monetária do cliente pra centavos inteiros é mudança que toca vários arquivos (`caixinhas.js`, `transactions.js`, `shoppingList.js`, `budgets.js`) — vale fazer de uma vez ou só no próximo lugar que quebrar?
3. **Saldo entre casal**: uma tela nova, ou um card dentro de Dashboard/Grupo?
4. **Nível de esforço aceitável para acessibilidade**: alvo real "WCAG 2.2 AA completo" (trabalho substancial) ou "cobrir os piões mais óbvios" (ícones sem label, gráfico sem alternativa textual)?
5. **README**: atualizar agora (rápido) faz parte desta rodada ou fica pro checkpoint de implementação?

## 13. Pontos que não devem ser alterados

- A separação `services/` (demo × real) — está correta, preservar integralmente.
- `numeric(12,2)` no banco, nunca `float`.
- O padrão "nada calculado é persistido" (status, saldo, totais).
- O padrão "best-effort" pra ações secundárias.
- RLS como `owner_id = auth.uid() or is_group_member(group_id)` — já correto e testado.
- A arquitetura sem build step em si — não há indício de que trocar isso resolveria um problema real hoje (ver discussão do arquiteto no blueprint).
- O prefixo `cg-` no CSS — já documentado como decisão deliberada, sem motivo pra reverter.

## 14. Primeira visão do Bõnotto 2027

Um Bõnotto 2027 não muda de stack, não fica "mais bonito" por decoração — fica **mais confiável e mais rápido de usar**, especificamente: cada correção de bug ganha uma rede de segurança que impede reincidência; dinheiro é tratado com o mesmo rigor no cliente que já tem no banco; a Home responde de cara "como estou / o que fazer agora"; o casal enxerga saldo mútuo sem fazer conta de cabeça; e a acessibilidade deixa de ser incidental para ser sistemática. Nada disso exige reescrever nada — exige terminar de amadurecer o que já existe. Desenvolvimento completo desta visão no `docs/BONOTTO-2027-BLUEPRINT.md`.

---

*Próximo passo: `docs/BONOTTO-2027-BLUEPRINT.md` — discussão entre especialistas, refinamento técnico, refinamento de produto, e o blueprint definitivo.*
