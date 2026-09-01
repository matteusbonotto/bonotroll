# Bugs — Bõnotto

Formato por item: ID / Título / Data / Origem / Severidade / Status / Causa / Root Cause / Correção / Teste / Arquivos afetados. Status: `OPEN` · `INVESTIGATING` · `FIXED` · `VERIFIED` · `WONT_FIX`. Bugs corrigidos não são apagados — ver regra de não-destruição em `CLAUDE.md`/`MEMORY.md`.

---

## BUG-001 — Cartão de crédito agrupa na 1ª fatura do mês, não na do responsável certo

- **Data**: relatado 2026-08-22 (já documentado como dívida técnica conhecida desde 2026-08-20, `.claude/docs/roadmap.md`, com a nota "só vale corrigir se for caso real do usuário" — virou caso real).
- **Origem**: usuário (relato direto, com cenário concreto: Matheus tem fatura, Beatriz não; compras de ambos caem na do Matheus).
- **Severidade**: HIGH (atribuição visual errada de dinheiro entre membros de um app financeiro de casal — não duplica valor total, mas mostra a compra errada na fatura errada, o que é o tipo de erro que corrói confiança no produto).
- **Status**: `INVESTIGATING` → decisão de correção registrada em `.claude/discussions/001-cartao-credito-multi-cartao.md`; implementação em `TASK-023` (`.claude/checklist/tasks.json`).
- **Causa**: `groupCartaoCredito` (`js/services/transactions.js:218-241`) monta a chave de agrupamento só por `aaaa-mm` (mês), pegando a primeira fatura daquele mês encontrada na ordem de iteração do array — nunca olha `responsavel_id`.
- **Root cause**: agravado por uma mudança de schema anterior (2026-08-20) que tornou `categories` compartilhada por grupo — a categoria "Cartão de crédito" de Matheus e de Beatriz já é literalmente o mesmo `categoria_id`, então nem por nome de categoria dá pra diferenciar de quem é a fatura. Não existe (ainda) nenhuma entidade "cartão" que carregue essa identidade.
- **Correção**: nova entidade `cartoes` (FK a `banks`, dono da pessoa) + `transactions.cartao_id`; `groupCartaoCredito` passa a agrupar por `cartao_id`, com fallback `responsavel_id+mês` pra dado sem `cartao_id` (nunca mais "só mês"). Ver decisão completa no discussion doc.
- **Teste**: a implementar em `tests/unit/transactions.test.js` (2 faturas/2 pessoas mesmo mês; 2 cartões/1 pessoa mesmo mês; fallback sem `cartao_id`) + `tests/e2e/cartao-credito-fatura.spec.js` (cenário com 2 faturas simultâneas, hoje o seed só tem a do Matheus).
- **Arquivos afetados**: `supabase/schema.sql`, `js/services/transactions.js`, `js/services/cartoes.js` (novo), `js/components/transactionForm.js`, `index.html` (`$store.cartaoModal`), `js/data/mockDb.js`.

---

## BUG-002 — Dados mock demasiado semelhantes a dados reais (privacidade)

- **Data**: relatado 2026-08-22.
- **Origem**: usuário (marcado como "mega importante").
- **Severidade**: CRITICAL — `?demo=1` é acessível a qualquer visitante do GitHub Pages público (`CLAUDE.md`: "Deployment: git push origin main → GitHub Pages serve a branch main diretamente"). `js/data/mockDb.js::seedDatabase()` usa `empresa_servico: 'MB Labs'` e `'Dinamo'` como empregadores (nomes reais aparentes) e `'Sanasa'` como concessionária — Sanasa é a concessionária de água **específica de Campinas/SP**, revelando a cidade real de quem usa o app a qualquer visitante do site.
- **Status**: `FIXED` (2026-08-22). `npm run test:unit` 47/47, `npm test` 24/24 — nenhum teste precisou de ajuste (os que liam seed literal continuam batendo, os títulos/valores-âncora foram preservados).
- **Causa**: seed de demo escrito à mão com nomes realistas em vez de genéricos, sem revisão de privacidade antes do deploy público. Confirmado depois que o repositório GitHub (`matteusbonotto/bonotroll`) é **público** (`gh repo view`) — não é só o `?demo=1` do site publicado, o repositório inteiro é navegável por qualquer pessoa.
- **Root cause**: ausência de uma convenção explícita de "dado de demo/exemplo nunca pode conter nome específico real (empregador, concessionária regional, cidade)" — nada no processo de desenvolvimento sinalizava isso antes do deploy. `prompt-app-controle-financeiro.md` §8 documenta que o seed original foi "baseado na planilha de referência do usuário" — ou seja, os nomes provavelmente eram mesmo os empregadores reais, não coincidência.
- **Correção**: `js/data/mockDb.js::seedDatabase()` reescrito com nomes genéricos fixos (`Vetor Nimbus Tecnologia`, `Estúdio Alameda Criativa`, `Águas Cristalinas Saneamento`) como padrão síncrono, com `@faker-js/faker` (import dinâmico via esm.sh) entrando só depois, best-effort, pra enriquecer "Restaurar dados de exemplo" — decisão técnica importante: a primeira versão usava top-level `await` no import do Faker e isso **quebrava o boot do Alpine.js inteiro** (o listener de `alpine:init` chegava tarde demais); corrigido tornando o seed síncrono por padrão. Também corrigidos, com os mesmos nomes genéricos, os outros lugares do repo que replicavam o mesmo dado: `supabase/seed.sql`, `importacao/transacoes-exemplo.csv`, `importacao/movimentacoes.csv`, `prompt-app-controle-financeiro.md` §8.
- **Teste**: `npm run test:unit && npm test` — 47/47 + 24/24, verde.
- **Arquivos afetados**: `js/data/mockDb.js`, `supabase/seed.sql`, `importacao/transacoes-exemplo.csv`, `importacao/movimentacoes.csv`, `prompt-app-controle-financeiro.md`.
- **Residual conhecido, não corrigido (decisão consciente)**: o histórico do git (commits antigos) ainda contém os nomes antigos em texto puro — como o repositório é público, tecnicamente visível via `git log -p`/blame por quem procurar. Corrigir isso exigiria reescrever histórico público (`git filter-repo`/force-push), uma operação destrutiva e de alto impacto (quebra qualquer clone/fork existente) — não fiz isso sem autorização explícita do usuário, é uma decisão dele, não minha. Ver `.claude/memory/user-requirements.md`.
- **Prevenção**: nenhum dado de seed/exemplo (demo, CSV, SQL, documentação) pode usar nome de empresa/concessionária/cidade real, mesmo que pareça "só um exemplo realista". Ver `.claude/memory/user-requirements.md`.

---

## BUG-003 — Três fontes de verdade conflitantes pra tokens visuais (CSS)

- **Data**: achado 2026-08-22, auditoria visual completa (`TASK-021`).
- **Origem**: agente `ux-ui`, confirmado via screenshot real + estilo computado (não só leitura de CSS).
- **Severidade**: CRITICAL — sistêmico, não um componente isolado.
- **Status**: `FIXED` (2026-08-22, `TASK-022`) — `npm run test:unit` 47/47, `npm test` 24/24, verificado visualmente em `?demo=1` (mobile/desktop, claro/escuro).
- **Causa**: `css/components.css:1061-1327` ("Product interface refresh") e `css/app.css:661-883` ("Product component refresh") redeclaram `:root` inteiro (cores, raio, sombra) e dezenas de componentes, sem nenhuma menção nos docs de design system, com valores diferentes de `tokens.css` **e diferentes entre si**. Quem vence é ordem de arquivo (a de baixo), não intenção documentada.
- **Root cause**: dois blocos de "refresh" adicionados em algum momento sem atualizar a documentação nem remover a camada anterior — mesma classe de bug já catalogada no CLAUDE.md ("declaração duplicada, a de baixo vence silenciosamente"), aqui em escala de sistema inteiro.
- **Consequências verificadas**: botão genérico do app abaixo do próprio `--touch-target: 48px` documentado (`.btn`/`.cg-btn` em 40-42px); `--radius-lg` com 3 valores diferentes coexistindo (20px documentado, 12px, 14px hardcoded); `.cg-card` com borda E sombra ao mesmo tempo, violando a regra escrita no topo do próprio `components.css`; ícone de título de seção escondido globalmente (`components.css:1218`) enquanto o HTML continua emitindo `<i>` em ~9+ lugares, achando (erradamente) que aparece.
- **Correção planejada**: consolidar em `tokens.css` como única fonte, adotando os valores que já renderizam de fato (sem introduzir regressão visual), exceto onde violam uma regra já documentada (touch target 48px) — nesse caso corrigir pra cima. Remover as duas camadas redundantes de `:root`. Restaurar o ícone de título de seção (remover a regra que o esconde) por não haver justificativa documentada pra escondê-lo enquanto o HTML continua emitindo.
- **Arquivos afetados**: `css/tokens.css`, `css/components.css`, `css/app.css`, `docs/DESIGN-SYSTEM-2027.md`, `.claude/docs/design-system.md`.

## BUG-004 — Switch (toggle) invisível no escuro pra quem nunca tocou no toggle manual

- **Data**: achado 2026-08-22, auditoria visual (`TASK-021`).
- **Origem**: agente `ux-ui`, confirmado via estilo computado nos dois cenários (SO escuro sem toggle manual vs. toggle manual).
- **Severidade**: HIGH — afeta o switch de notificações push (Perfil) e os 3 switches do modal de lançamento (Pago/Recorrente/Cartão de crédito), numa recorrência nova do mesmo padrão de bug já catalogado (badge/trilho invisível no escuro).
- **Status**: `FIXED` (2026-08-22) — verificado visualmente no switch de Perfil (dark mode via preferência de sistema, sem toggle manual); o switch de notificações e o de Perfil usam a mesma regra CSS genérica, então o efeito é o mesmo, mas os 3 switches do modal de lançamento especificamente não foram vistos renderizados por quem corrigiu — vale uma checagem visual rápida na próxima vez que alguém abrir esse modal.
- **Causa**: `js/components/store.js:237-244` (`applyTheme`) só seta `data-bs-theme="dark"` no toggle manual. Sem esse atributo, o app ainda fica visualmente escuro via `@media (prefers-color-scheme: dark)`, mas o Bootstrap só troca a cor da bolinha do switch quando o atributo está presente — sem ele, a bolinha renderiza `rgba(0,0,0,.25)` (quase preta) sobre fundo quase preto.
- **Correção planejada**: regra explícita pro estado *unchecked* de `.form-check-input[role=switch]` também sob `@media (prefers-color-scheme: dark)`, não só sob `[data-bs-theme=dark]`.
- **Arquivos afetados**: `css/app.css` (ou `tokens.css`, onde os outros overrides de tema escuro já vivem).

## BUG-005 — Exclusão dizia "excluído com sucesso" sem excluir de verdade

- **Data**: relatado 2026-08-23, em uso real (grocery run).
- **Origem**: usuário ("tentei excluir uma despesa e diz que excluiu com sucesso, mas não excluiu").
- **Severidade**: CRITICAL — mentira sobre estado de dado financeiro, sistêmica (3 telas).
- **Status**: `FIXED`.
- **Causa**: `notifyUndo` (`js/components/store.js`) rodava a ação real de exclusão dentro de um `setTimeout(..., 5000)`, só se ninguém clicasse "Desfazer" — mas o toast já dizia "excluído" no passado, antes de qualquer chamada real acontecer.
- **Root cause**: se a aba fechasse, recarregasse, ou o navegador suspendesse o timer (comum no celular: tela apagando, trocando de app) dentro desses 5s, a chamada de API real NUNCA acontecia — perda silenciosa e permanente, sem qualquer sinal de erro.
- **Correção**: `notifyUndo` agora `await`s a ação real ANTES de mostrar o toast — quando a mensagem aparece, já aconteceu de verdade. "Desfazer" deixou de ser "cancelar algo pendente" e virou "recriar o que já foi apagado" (id novo, mesmos dados) — atualizado nos 3 call sites: `transactionForm.js::remove()` (recria transação + `transaction_payers`), `resourcesView.js::removeItem()`, `caixinhasView.js::removerMovimentacao()`.
- **Teste**: `tests/e2e/exclusao-transacao-persiste.spec.js` (novo — exclui sem clicar Desfazer, recarrega a página, confirma que não voltou); `tests/e2e/desfazer-exclusao.spec.js`/`desfazer-recurso.spec.js` (existentes, continuam verdes — provam que o "Desfazer" visual não regrediu).
- **Arquivos afetados**: `js/components/store.js`, `js/components/transactionForm.js`, `js/components/resourcesView.js`, `js/components/caixinhasView.js`.

## BUG-006 — Crash de memória ao tirar foto pra OCR (Compras/Recursos/Transações)

- **Data**: relatado 2026-08-23, em uso real ("tiro a foto e o app reinicia dizendo insuficiência de memória").
- **Severidade**: CRITICAL — impede o uso do app no fluxo mais comum (compra no mercado).
- **Status**: `FIXED` (causa raiz corrigida; crash exato não reproduzido em teste automatizado, depende de dispositivo real com pouca memória).
- **Causa**: `js/utils/image.js::resizeImage` existia mas era deliberadamente evitada em foto que passa por OCR ("pra não prejudicar a leitura de texto") — 3 pontos (`shoppingList.js::onFotoItem`, `resourcesView.js::onFotoNomeItem`, `transactionForm.js::onComprovanteChange`) mandavam a foto CRUA da câmera (4000×3000px+, vários MB) direto pro Tesseract.js.
- **Correção**: os 3 pontos agora chamam `resizeImage(file, 2000, 0.9)` antes do OCR — grande o bastante pra manter texto legível, pequeno o bastante pra nunca chegar perto do consumo de memória de uma foto crua. Upload do comprovante (Transações) continua guardando o arquivo ORIGINAL — só a cópia que alimenta OCR é redimensionada.
- **Arquivos afetados**: `js/utils/image.js`, `js/components/shoppingList.js`, `js/components/resourcesView.js`, `js/components/transactionForm.js`.

## BUG-007 — Gráfico de gastos por categoria em Compras nunca renderiza

- **Data**: relatado 2026-08-23, em uso real ("os gráficos de gastos por categoria na lista de compras não funciona de maneira alguma").
- **Severidade**: HIGH.
- **Status**: `FIXED`.
- **Causa**: o canvas do gráfico (`categoryChart()`, compartilhado com Home/Dashboard) mora dentro do modal "Ver gráfico", que começa com `x-show="graficoAberto"` (escondido). O `x-init` só observava `resumoPorCategoria` — na prática, os itens costumam ser marcados como comprados ENQUANTO esse modal ainda está fechado, então o Chart.js desenhava (quebrado) num canvas de 0×0, e abrir o modal depois nunca disparava um redesenho.
- **Correção**: `x-init` agora também observa `graficoAberto`, forçando um `render()` novo toda vez que o modal abre (canvas já visível nesse momento).
- **Arquivos afetados**: `index.html`.

## BUG-008 — QR code não escaneia bem (barcode 1D funciona ok)

- **Data**: relatado 2026-08-24, em uso real.
- **Severidade**: HIGH.
- **Status**: `FIXED` (mecanismo verificado com câmera falsa; decodificação real de QR depende de teste no dispositivo do usuário).
- **Causa**: a caixa de leitura em `startBarcodeScanner` (`js/services/barcode.js`) era larga e baixa (metade da altura da largura) — pensada só pra código de barras 1D. A lib recorta a imagem analisada exatamente nessa caixa; um QR é quadrado, então na distância natural de uso o topo/base ficava cortado fora da área analisada.
- **Correção**: caixa quadrada (funciona bem pros dois formatos). Também habilitado `useBarCodeDetectorIfSupported: true` — usa a API nativa `BarcodeDetector` do navegador (Chrome/Android) quando disponível, mais rápida/precisa que o decoder em JS puro, de graça.
- **Arquivos afetados**: `js/services/barcode.js`.

## BUG-009 — Leitura de foto (OCR) muito ruim

- **Data**: relatado 2026-08-24, com exemplo concreto (foto de lata de Nescau virou texto sem nexo).
- **Severidade**: HIGH.
- **Status**: `FIXED` (pipeline confirmado rodando ponta a ponta sem erro; qualidade final em foto real só é confirmável no dispositivo do usuário — nenhum OCR client-side gratuito é garantidamente perfeito).
- **Causa**: Tesseract.js no modo padrão (bloco único de texto, pensado pra documento) sem nenhum pré-processamento de imagem — embalagem colorida/brilhante confunde o reconhecimento (treinado majoritariamente em texto escuro sobre fundo branco uniforme).
- **Correção**: (1) pré-processamento (escala de cinza + contraste esticado por percentil, robusto contra brilho de lata/plástico); (2) modo `PSM.SPARSE_TEXT` (acha texto espalhado, sem assumir bloco único); (3) o texto lido vira termo de busca contra a base de produtos Open Food Facts em vez de virar o título direto — corrige o palpite ruim do OCR quando acha um produto real.
- **Arquivos afetados**: `js/services/ocr.js`, `js/services/barcode.js` (nova `searchProductByName`), `js/components/shoppingList.js`, `js/components/resourcesView.js`.

## BUG-010 — Dado real ainda visível no modo demo (cache local antigo, não o código)

- **Data**: relatado de novo 2026-09-01, mesmo com BUG-002 corrigido em código desde 22/08.
- **Severidade**: CRITICAL.
- **Status**: `FIXED` — deploy confirmado ao vivo (cache-bust) mostrando a chave nova.
- **Causa**: `js/data/mockDb.js::loadDb()` só semeia dado novo quando `localStorage` está vazio. Qualquer navegador que já tinha aberto `?demo=1` ANTES da correção de privacidade continuava com o dado antigo salvo pra sempre — o código já estava certo há dias, mas o dado JÁ GRAVADO no navegador nunca era substituído.
- **Correção**: chave bumpada (`bonotto_demo_db_v1` → `v2`) + remoção explícita da chave antiga, forçando recriação genérica em qualquer dispositivo. `CACHE_NAME` do service worker também bumpado (v7→v8).
- **Prevenção**: mesma lição do `CACHE_NAME` (ver decisão de 2026-09-01 em `.claude/memory/decisions.md`) — qualquer estrutura de dado local persistente (localStorage, IndexedDB) precisa de versionamento explícito na CHAVE, não só no código, sempre que o CONTEÚDO gerado mudar por motivo de privacidade/correção — nunca assumir que corrigir o gerador corrige quem já gerou.

## BUG-011 — Botões grandes demais / quebra de texto ruim na Lista de Compras

- **Data**: relatado com print, 2026-09-01.
- **Severidade**: HIGH — regressão introduzida pela própria correção de acessibilidade (BUG-003, 22/08).
- **Status**: `FIXED`.
- **Causa**: a correção de touch-target 48px só excluiu `.cg-btn.btn-sm`, nunca `.btn.btn-sm` puro (Bootstrap sem `.cg-btn`) — usado em toda ação secundária de linha densa (editar/excluir em Compras/Recursos/managers). Na visão Lista de Compras isso estourava a linha de 44px do caderno (`--cg-notebook-line`).
- **Correção**: `.btn-sm` ganha altura própria (36px) + ajuste de padding do item-row (6px→4px) pra alinhar de novo com a pauta do caderno.
- **Prevenção**: ao aplicar uma regra de acessibilidade/tamanho globalmente, checar explicitamente TODAS as variantes de classe existentes (`.cg-btn.X` E `.btn.X` puro), não só a mais visível.

## BUG-013 — Fileira de item em Compras (Lista) espremia o nome e cortava/quebrava texto

- **Data**: confirmado com print, 2026-09-01, depois do deploy do BUG-011.
- **Severidade**: CRITICAL — reproduzido e fotografado (Playwright, 390px) antes de corrigir.
- **Status**: `FIXED`.
- **Causa**: era largura, não altura — "Comprar" + lápis + lixeira competindo com o nome do item numa linha só espremiam o texto numa faixa tão estreita que "Detergente" cortava e "Massa para brownie" quebrava em 3 linhas.
- **Correção**: nome numa linha própria (largura total); ações foram pra uma segunda linha, ao lado da quantidade.
- **Prevenção**: ao corrigir altura de botão (BUG-011), eu não tinha verificado LARGURA disponível pro texto ao lado — lição: corrigir uma dimensão não garante que a outra esteja certa, verificar visualmente (screenshot real) antes de dar por certo.

## BUG-014 — Exclusão acidental de item em Compras (dedo escorregava pra "Excluir")

- **Data**: relatado 2026-09-01, uso real de terceiros testando o app.
- **Severidade**: CRITICAL — perda de dado real, sem "Desfazer" nenhum.
- **Status**: `FIXED`.
- **Causa**: `removeItem` em `js/components/shoppingList.js` deletava direto, sem a proteção de "Desfazer" que o BUG-005 já tinha aplicado em Recursos/Caixinha/Transações — Compras ficou de fora daquela rodada.
- **Correção**: `removeItem` agora usa `store.notifyUndo` (mesmo padrão); "Editar" também virou espaçador físico entre "Comprar" e "Excluir".
- **Prevenção**: quando um padrão de segurança (undo) é aplicado a um conjunto de entidades, checar explicitamente TODAS as entidades com exclusão frequente do app, não só as reportadas na hora — Compras tinha exatamente o mesmo risco e ficou sem a correção por quase 10 dias.

## Histórico anterior (rounds já fechadas, resumo — detalhe completo em `docs/CHECKLIST-REBRAND.md`)

Todos os bugs das Rodadas 1-5 do rebrand (sidebar não-sticky, tabela cortando largura, tema escuro incompleto, FAB sobrepondo botões, `x-show`+Bootstrap utility ≥5 ocorrências, CSS duplicado em `.cg-card`/`.cg-main`/`.cg-modal`, ícone de PWA desatualizado, segmentado "Agrupar" esticando no mobile, CSV duplicando item, notificação push com badge sem transparência, "Cancelar" de Compras limpando lista errado, mês futuro não ordenado primeiro) estão todos `FIXED`/`VERIFIED` — não duplicados aqui, ver o documento fonte.
