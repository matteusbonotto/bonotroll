# BÕNOTTO 2027 — Master Product & Technical Blueprint

> Segundo e definitivo entregável do PROMPT MASTER (`docs/prompt.txt`, §84). Construído sobre o `docs/RAIO-X-2.0.md`. Nenhum código foi alterado (§85) — este é o documento de arquitetura/produto que precisa de **autorização explícita sua** antes de qualquer implementação, e mesmo depois dela a implementação é incremental, com checkpoints (§74, §85).

---

## 0. Sumário executivo

O Bõnotto de hoje é um produto genuinamente maduro pro que se propõe: 40 arquivos-fonte, zero dependência de IA paga, RLS correta e testada, dinheiro como `numeric` no banco, três domínios (finanças, compras, inventário) mais reserva financeira e notificações reais funcionando ponta a ponta. Não existe caso pra reescrita — nenhum especialista abaixo defendeu isso, e o critério do próprio prompt (§73: custo/risco/benefício de qualquer rewrite) não se sustenta aqui.

O que falta não é tecnologia nova — é **terminar de amadurecer o que já existe**: uma rede de segurança contra regressão (zero testes hoje), rigor monetário no cliente equivalente ao que já existe no banco, uma Home que responde direto "como estou / o que fazer agora", acessibilidade sistemática em vez de incidental, e duas ou três features de alto valor e baixo custo (saldo entre casal, entrada rápida de despesa, alternativa textual a gráfico) que fecham lacunas reais já identificadas no diagnóstico.

**Decisão arquitetural central, adiantada aqui**: manter HTML+Alpine+Bootstrap sem build step. Ver §3 (Arquiteto) para o comparativo completo — a decisão não é por preguiça, é por análise.

---

## 1. Painel de especialistas — análises individuais

### 1.1 Produto & Estratégia (PM · Finanças Pessoais · Comportamento Financeiro · Quality of Life)

**PM**: A pergunta "o que realmente ajuda uma pessoa a viver melhor e ter mais controle" tem uma resposta desconfortável pro Bõnotto de hoje: o produto tem *muita* superfície (7 telas, split de pagador, cadência de recorrência com 4 variações, leitura de boleto/Pix/QR, OCR, importação CSV, Caixinhas multi-moeda) construída em 48h de ritmo altíssimo, e nenhuma medição de quais dessas partes realmente são tocadas semana a semana pelos dois usuários reais. Isso não é acusação de feature bloat confirmado — é a ausência de dado pra saber se é ou não. Recomendação: não construir mais superfície nova até ter uma leitura, ainda que informal ("dos últimos 30 dias, o que vocês dois realmente abriram?"), de uso real.

**Finanças Pessoais**: O conceito que está mais claramente faltando é **"quanto ainda posso gastar"**, versus o que já existe fortemente ("quanto já gastei"). Orçamento por categoria existe como configuração (Perfil → Orçamentos) mas não tem manchete na Home — pra um app que já se orgulha de calcular status/saldo sempre ao vivo, é uma peça que falta no lugar mais visível. Métrica que pode induzir a erro: o card de saldo da Home hoje soma entradas menos saídas sem filtro de período até a correção de 20/08 (RAIO-X §7.4) — corrigido, mas vale checar se "saldo" comunica "quanto sobrou esse mês" ou "acumulado desde sempre" com clareza suficiente pra alguém que abre o app rápido, sem ler com atenção.

**Comportamento Financeiro**: O maior risco comportamental não é falta de funcionalidade, é **fadiga decisória no formulário de despesa** — mesmo com boa parte dos campos atrás de "Mais opções", abrir o modal completo pra uma despesa de mercado de R$40 é mais fricção do que o gesto merece. A categorização automática por palavra-chave já reduz uma decisão; falta reduzir o *número de toques* pra chegar até ali. Reforço positivo: nenhum mecanismo de gamificação hoje — está certo, o prompt (§5) pede exatamente isso ("nunca infantilizar").

**Quality of Life**: A ponte Recursos → Compras → Transações (§34 do prompt, "Casa como sistema") já existe mas em três gestos manuais separados (ver sugestão de compra, adicionar à lista, finalizar lista como despesa) — nenhum totalmente automático, e está certo que não seja 100% automático (o prompt pede "antecipar sem invadir", §60) — mas o *encadeamento visual* de que essas três ações são a mesma jornada ainda não é explícito na UI.

### 1.2 Design & Experiência (Product Designer · UX Senior · UX Mobile-First · UI · Product Designer nível fintech)

**Product Designer**: Aplicando "essa tela é necessária?" em vez de "essa tela é bonita?" — as 7 telas atuais passam no teste (nenhuma é claramente dispensável), mas o Dashboard concentra demais: resumo + ações rápidas + contas a vencer + recursos em falta + 3 gráficos + lançamentos recentes é muita informação pra uma única tela de abertura, mesmo com hierarquia visual cuidada. É genuinamente uma tela de "olhar tudo", não de "decidir rápido".

**UX Senior**: Mapeando a jornada diária (abrir → entender situação → registrar → resolver pendência → sair) — os passos "entender situação" e "resolver pendência" competem pelo mesmo espaço de tela (Dashboard) hoje. Não há um caminho dedicado e único pra "o que precisa da minha atenção agora", só o agregado de tudo.

**UX Mobile-First**: O app já trata mobile como cidadão de primeira classe — bottom-drawer, FAB separado, filtros recolhíveis abaixo de 992px, área de toque documentada como alvo de 48px. Ponto real de atenção: **nenhum teste real documentado em internet instável ou modo avião durante uma operação de save** (§37/§18 do prompt) — o app tem `podeRodar()` que evita chamadas quando offline pros pollers, mas o comportamento de "salvei uma despesa sem internet, o que acontece" não está mapeado nem testado.

**UI**: O design system (`css/tokens.css`) já evita os clichês que o prompt (§10) pede pra evitar — não é visual bancário genérico, não é verde-em-tudo, não tem gamificação infantil. Ponto de atenção real: **44 `aria-*` / 21 `role=` / 11 `alt=` num HTML de quase 2.500 linhas com dezenas de botões só-ícone** é cobertura incidental, não sistemática — alguém lembrou em alguns lugares, não em todos.

**Product Designer nível fintech**: Comparando com o princípio (não a interface) de produtos como Wise/Revolut — o que esses produtos fazem muito bem e o Bõnotto ainda não é "nunca mostrar um número financeiro aparentemente preciso se ele está incompleto" (§47 do prompt). Hoje, quando a cotação de uma Caixinha em moeda estrangeira ainda não carregou, o texto "Buscando cotação..." já cobre esse caso corretamente (bom sinal, já aplicado) — mas o mesmo princípio não foi generalizado pro resto do app (ex.: um resumo de orçamento calculado antes de todas as transações do mês terminarem de carregar).

### 1.3 Engenharia & Dados (Arquiteto de Software · Fullstack · Engenheiro de Dados · Especialista em Bibliotecas)

**Arquiteto de Software — a pergunta central do prompt (§12): essa arquitetura ainda é a melhor escolha pra 2027?**

Comparação objetiva, como o prompt exige:

| | A — Continuar HTML+Alpine+CSS | B — Migração parcial | C — React | D — Vue | E — Outra |
|---|---|---|---|---|---|
| Complexidade de aprender/manter | Baixa (já dominada) | Média (2 mentalidades convivendo) | Alta (novo paradigma + tooling) | Alta | Variável |
| Performance | Já boa (import dinâmico, sem framework overhead) | Igual ou pior durante a transição | Depende de bundle discipline | Idem | — |
| Bundle/DX | Zero build, zero DX de bundler pra manter | Precisa de build step só pras partes migradas — pior dos dois mundos | Precisa de build step completo | Idem | — |
| PWA/offline | Já funciona, Service Worker simples | Sem mudança de risco relevante | Precisa reconstruir toda a lógica de cache/offline | Idem | — |
| Testabilidade | Baixa hoje (não por causa do framework — por ausência de testes, corrigível sem trocar nada) | Pior — dois padrões de teste | Alta em teoria, mas exige reescrever tudo pra ganhar isso | Idem | — |
| Risco de migração | Zero | Alto — estado inconsistente durante meses | Altíssimo — ~40 arquivos, cada um com regra de negócio e correção de bug acumulada (RAIO-X inteiro documenta isso) | Idem | — |
| Custo | Zero | Alto (tempo) | Muito alto | Muito alto | — |

**Veredito: Opção A — não migrar.** Nenhum dos problemas reais encontrados no diagnóstico (zero testes, aritmética monetária em float, acessibilidade incidental, README desatualizado) é causado pela ausência de um framework moderno — são causados por trabalho ainda não feito, que um framework novo não faria sozinho e que uma migração ativamente atrasaria (todo o tempo gasto migrando é tempo não gasto corrigindo os problemas reais). Isso é literalmente o caso que o prompt (§73) pede pra reconhecer.

O ponto arquitetural que **de fato** merece atenção não está na lista de opções do prompt: é o **barramento de eventos `cg:*-changed`** (RAIO-X §3.3). Funciona, mas já mostrou ser uma fonte recorrente de bug (RAIO-X §10.6: tela de Recursos não atualizando quando o dado mudava por fora dela; §11.6: duplicação de leitura entre dois pollers). Não recomendo substituir por um store central agora (seria reescrita de um mecanismo que funciona, contra o espírito do §73) — recomendo **documentar a convenção explicitamente** (quando um novo componente escreve um dado que outra tela também lê, ele PRECISA disparar o evento correspondente — hoje isso é conhecimento tribal, não uma checklist) e considerar, só se um quarto bug do mesmo tipo aparecer, migrar as coleções mais compartilhadas (transações, recursos) pra dentro de `Alpine.store('app')` como fonte única, eliminando a necessidade do evento por completo pra essas duas.

**Fullstack Engineer**: Nenhuma race condition nova encontrada nesta revisão além das já documentadas e corrigidas (RAIO-X §9.2 debounce de estoque, §11.6 pollers). N+1 evitado deliberadamente em vários lugares (`listPayersFor`, `listMovimentacoesFor` — busca em lote, não por linha). Ponto de atenção real: **nenhuma tela lida com o caso "dois usuários editando a mesma despesa ao mesmo tempo, uma aba de cada"** — não há campo de `updated_at`/`version` pra detectar conflito de escrita; um `UPDATE` simplesmente sobrescreve o outro (last-write-wins silencioso). Baixo risco prático (app de 2 pessoas, uso concorrente exato na mesma linha é raro), mas vale nomear como gap conhecido, não invisível.

**Engenheiro de Dados**: Pra cada campo monetário, a pergunta "precisa existir" já está bem respondida no schema (nada duplicado, tudo `numeric`). O gap real é do lado do cliente: `Number(m.valor)` em `caixinhas.js`, `transactions.js`, `budgets.js`, `shoppingList.js` — ponto flutuante binário pra somar dinheiro. Recomendação concreta: um módulo único `js/utils/money.js` que trabalha em **centavos inteiros** internamente (`Math.round(valor * 100)`, soma/subtrai como inteiro, só formata como decimal na saída) — isolado, testável, sem tocar no schema (que já está certo).

**Especialista em Bibliotecas**: Auditoria rápida das 6 dependências pesadas (todas via `esm.sh`, nenhuma `<script>` estático): Chart.js, PapaParse, html5-qrcode, pdf.js, Tesseract.js, `@supabase/supabase-js` — todas open source, permissivas (MIT/Apache), mantidas ativamente, carregadas só sob demanda. Nenhuma delas é dispensável por uma solução nativa (parsing de CSV/PDF/QR/OCR não tem alternativa razoável em Web API pura). Única observação: **nenhuma tem versão pinada por hash/integrity** — `esm.sh` resolve por versão semver solta o suficiente pra, em teoria, servir um patch diferente do testado. Baixo risco, mas uma correção de uma linha (pinar versão exata + `integrity` onde o CDN suportar) é praticamente grátis.

### 1.4 Confiabilidade & Risco (Segurança · LGPD · QA · QA Adversarial · PWA · Performance)

**Segurança**: Threat model "o que acontece se alguém manipular o frontend" já está coberto pelo desenho — nenhuma autorização depende de código client-side, tudo é RLS. Verificação direta nesta sessão: `WITH CHECK` de `transactions` inclui `is_group_member` (não é o bug documentado em RAIO-X §6.2, que já foi corrigido). Storage: bucket `anexos` privado com signed URL, bucket `avatars` público-leitura reaproveitado pra 5 finalidades diferentes — funcional e sem risco de escrita indevida (write ainda exige pasta = uid), mas é um scope-creep de nomenclatura que vale anotar (não é bug, é organização). Não encontrei uso de `x-html` (que desabilitaria a escapagem automática do Alpine e abriria XSS) em nenhum arquivo verificado — `x-text`/interpolação padrão está em uso, que já escapa por padrão.

**LGPD**: Hoje, com 2 usuários e nenhuma relação de "controlador de dados de terceiros", a obrigação legal real é mínima. O prompt (§16) pede pra separar "necessário agora" de "necessário pra comercialização futura" — nada do "necessário agora" está faltando (não há coleta de dado de terceiro, não há analytics externo, dados financeiros não vazam pra nenhum serviço de telemetria). O único item barato de adicionar **agora**, que fica caro depois, é um caminho de exportação/exclusão de dados própria (mesmo que simples: um botão em Perfil que gera um JSON de tudo que pertence à pessoa) — não por exigência legal hoje, mas porque é a "Future Scalability Boundary" (§50) mais barata de todas: não fecha porta nenhuma, não adiciona complexidade visível agora.

**QA**: Estratégia formal de teste é **inexistente** (não "fraca" — inexistente: zero arquivos de teste no repo). A mitigação até aqui foi 100% manual, via Playwright rodado ad-hoc nas sessões de desenvolvimento e nunca commitado como regressão. É a maior lacuna de todo o diagnóstico, tanto pelo risco que cobre quanto pelo fato de já existir prática (rodar Playwright) que só precisa ser preservada em vez de descartada a cada sessão.

**QA Adversarial**: Casos não cobertos e potencialmente reais, ordenados por probabilidade de acontecer num app de casal de 2 pessoas: (1) os dois editando a mesma despesa ao mesmo tempo — sem detecção, last-write-wins; (2) reconexão depois de salvar offline — não claramente definido o que acontece; (3) categoria excluída enquanto uma transação ainda referencia ela — não testado nesta revisão se a UI trata `categoria_id` órfã com grace; (4) valor extremamente alto (>R$ 999.999,99, testando o `numeric(12,2)` e a formatação de moeda) — não testado; (5) troca de fuso horário do dispositivo (viagem) — `todayIso()` já foi corrigido pra usar calendário local (RAIO-X §14.7), mas o teste especificamente de "fuso mudou no meio do dia" não está documentado como verificado.

**PWA**: Manifest, ícones, estratégia de cache, fluxo de atualização explícito (banner, não silencioso) — tudo já no nível "parece nativo" que o prompt pede (§19). Único gap real: **iOS Safari não dispara `beforeinstallprompt`** (RAIO-X §15.6 já documenta isso) — a instalação em iPhone continua sendo o fluxo manual do Safari ("Adicionar à Tela de Início"), sem nenhuma orientação na própria UI pra quem estiver nesse navegador. Se qualquer um dos dois usuários usa iPhone, esse é um gap de onboarding real, não teórico.

**Performance**: Estratégia de lazy-loading já é disciplinada (nada pesado carrega sem necessidade). Ponto não coberto: **upload de foto vai direto pro Storage sem redimensionamento client-side** — uma foto de celular moderno facilmente passa de 4-8MB; sem resize antes do upload, tanto o tempo de upload em rede ruim quanto o consumo do teto de Storage gratuito crescem mais rápido do que precisariam. Correção é barata (canvas + `toBlob` com qualidade reduzida, sem biblioteca nova) e de alto retorno.

---

## 2. Discussão entre especialistas (§55–56 do prompt — conflitos reais, não simulados)

### Conflito 1 — UX vs. Engenharia: "Formulário de despesa é grande demais"

**UX**: "Quero uma entrada de 1 campo — digita 'Mercado 184,90', confirma, pronto. O formulário completo atrás de 'Mais opções' já ajuda, mas ainda exige abrir modal, tocar em título, tocar em valor, tocar em salvar — mínimo 4 gestos pra uma despesa trivial."

**Engenharia**: "Um campo de texto livre parseado por regex pra extrair título+valor introduz ambiguidade real: 'Mercado 184,90' é fácil, mas 'Almoço com Ana 45' (valor no fim sem vírgula) ou 'Uber 23,50 ida' (texto depois do valor) quebram um parser ingênuo, e cada caso de borda vira uma issue de confiança — o usuário perde a certeza de que o app leu certo."

**Decisão**: Fazer a entrada rápida como **complemento**, não substituto — um campo único no topo do modal (não uma tela nova) que tenta parsear "texto + valor" com uma regra simples e explícita (**último número decimal da string = valor, resto = título**), pré-preenche os dois campos do formulário de sempre (que continua visível e editável embaixo), sem nunca salvar sem confirmação visual. Ambíguo? A pessoa só edita o campo errado antes de confirmar — nunca pior que hoje, sempre potencialmente mais rápido.

### Conflito 2 — Financeiro vs. UX: "Quanto ainda posso gastar" precisa de manchete própria

**Financeiro**: "Esse número é mais acionável que 'quanto já gastei' — dá pra decidir com ele. Merece estar no topo da Home."

**UX**: "A Home já tem 7 blocos de informação (RAIO-X §7.1) — mais um card de destaque aumenta a carga cognitiva de abrir o app, indo contra o princípio 'ação > informação' do próprio prompt (§82)."

**Decisão**: Não adicionar um bloco novo — **substituir** parte do que já existe. O card de saldo em destaque (que já é o elemento mais proeminente da Home) ganha uma segunda linha discreta: "Restam R$ X do orçamento de [categoria mais próxima do limite]" quando há orçamento configurado e algum limite está a menos de 20% de ser estourado; se nenhum estiver perto, essa linha simplesmente não aparece (silêncio é informação também, aplicando §60 "antecipar sem invadir"). Não é um card novo — é enriquecer o que já é o ponto de maior atenção da tela.

### Conflito 3 — Segurança vs. Conveniência: confirmação de exclusão

**Segurança/Confiabilidade**: "Toda exclusão (transação, categoria, item de recurso, movimentação de caixinha) deveria confirmar, porque dinheiro apagado sem querer é dado perdido."

**UX**: "Confirmação em toda exclusão é fricção que o próprio prompt pede pra evitar (§46: 'evite confirmações inúteis') — e o app já tem um padrão melhor em outros lugares: undo."

**Decisão**: Time do UX ganha, com uma condição. Manter `confirm()` só nas exclusões estruturalmente destrutivas e raras (excluir grupo, excluir categoria com transações associadas — já é o padrão hoje). Para exclusões frequentes e de baixo dano (uma linha do histórico de Caixinha, um item de Recursos, uma transação avulsa), substituir a confirmação por um toast com "Desfazer" por alguns segundos antes da exclusão ser definitiva — já é uma capacidade que o app não tem hoje em lugar nenhum, e resolve os dois lados: zero fricção, zero perda de dado real.

### Conflito 4 — Performance vs. Bibliotecas: vale adicionar algo pra resize de imagem?

**Performance**: "Fotos sem resize antes do upload desperdiçam banda e Storage."

**Bibliotecas**: "Existe tentação de usar uma lib de compressão de imagem (`browser-image-compression` etc.) — mas Canvas API nativa já resolve isso em ~15 linhas, sem dependência nova."

**Decisão**: Bibliotecas ganha — Canvas nativo, zero dependência nova. Seguindo a própria regra do prompt (§21): "se uma solução nativa resolve melhor, não adicione biblioteca."

### Conflito 5 — Produto vs. Engenharia: saldo entre casal

**Produto**: "Alto valor percebido, é literalmente o cenário mais comum do app (2 pessoas, despesas divididas) e hoje exige conta de cabeça."

**Engenharia**: "Não é trivial: precisa agregar `transaction_payers` × `responsavel_id` de todas as transações não quitadas entre os dois membros, decidir o que conta como 'quitada' (pagamento registrado, não status de vencimento), e desenhar o caso de 3+ membros num grupo (quem deve pra quem, não só 'o saldo')."

**Decisão**: Construir para 2 membros primeiro (o caso real de uso hoje), com a query desenhada de forma que já generalize pra N membros sem redesenho (uma matriz devedor×credor, não um par fixo) — cobre o "não implementar comercial cedo demais" (§0 do prompt) enquanto entrega o valor real imediato.

---

## 3. Segunda revisão — refinamento técnico (§57)

Reavaliando as decisões acima contra as perguntas do prompt:

- **Criamos complexidade demais?** Não — todas as decisões dos 5 conflitos evitaram a opção mais complexa (parser NLP amplo, confirmação universal, lib nova, redesign de Home, modelagem N-a-N prematura).
- **Alguma tecnologia é desnecessária?** Não foi introduzida nenhuma.
- **Alguma funcionalidade contradiz outra?** Não identificado.
- **Algum cálculo está errado?** A regra de parsing de entrada rápida ("último número decimal = valor") falha silenciosamente em "Gastei 2 sacolas por 45,90" (dois números) — mitigado porque o resultado sempre é visível e editável antes de salvar, nunca aplicado direto.
- **Alguma decisão financeira é perigosa?** Não — nenhuma decisão muda como dinheiro é calculado, só como é somado no cliente (money.js) e exibido.
- **Alguma solução cria dívida técnica nova?** O toast "Desfazer" precisa de um mecanismo de exclusão adiada (guardar a linha, um timer, cancelar se "Desfazer" for clicado) — é a peça nova mais complexa desta rodada, mas é um padrão isolado e reaproveitável, não dívida espalhada.
- **Alguma proposta depende de API paga ou IA?** Não, nenhuma.
- **Alguma proposta viola offline-first ou segurança?** Não.

Nenhuma correção necessária nesta rodada — as decisões da discussão sobreviveram ao refinamento técnico.

## 4. Terceira revisão — refinamento de produto (§58)

Como usuário comum, mentalmente:

- *"Isso é fácil? Isso é rápido?"* — a entrada rápida resolve a fricção mais repetida (lançar despesa comum). Sim.
- *"Eu sei o que fazer?"* — a linha de orçamento no card de saldo só aparece quando é acionável (perto do limite) — sim, sem ruído quando não há nada a decidir.
- *"Tenho medo de errar?"* — o toast "Desfazer" reduz especificamente esse medo em ações que hoje ou exigem confirmação (fricção) ou não tinham rede de segurança nenhuma.
- *"Confio nos números?"* — o money.js em centavos inteiros é justamente sobre isso, mesmo que invisível pro usuário — a confiança é ganha por nunca quebrar, não por aparecer.
- *"O app me poupa trabalho?"* — saldo entre casal poupa uma conta que hoje é feita de cabeça ou em outro app (WhatsApp, papel).
- *"Eu voltaria amanhã?"* — nenhuma mudança proposta piora esse critério; várias melhoram (menos fricção, mais confiança).

Nenhuma proposta reprovou no teste de produto. Seguem pro blueprint final.

---

## 5. Visão Bõnotto 2027

Um produto maduro, simples, confiável, rápido, mobile-first, acessível, seguro, automatizado sem IA, offline-capaz, e — a frase do prompt (§59) cabe literalmente aqui — onde o casal sente **"eu não preciso administrar minhas finanças, o Bõnotto me ajuda a administrá-las"**. Concretamente: abrir o app e em segundos saber se está tudo bem, o que precisa de atenção, e quanto ainda dá pra gastar — sem esforço de agregação mental. Nenhuma dessas metas exige tecnologia nova; exigem terminar de amadurecer o que já existe (§9 acima) e fechar as 3-4 lacunas de produto identificadas na discussão.

## 6. Arquitetura de informação e navegação

O prompt pede pra não assumir que a navegação atual (Início/Transações/Compras/Recursos/Grupo/Perfil/Caixinhas) é a melhor. Três alternativas avaliadas:

| Proposta | Destinos | Prós | Contras |
|---|---|---|---|
| **Atual (mantida)** | Início · Transações · Compras · Recursos · Caixinhas · Grupo · Perfil | Já reflete os domínios reais de dado; sem custo de reaprendizado pro casal | 7 destinos é o limite superior confortável de um drawer mobile |
| **Consolidação temática** (§26 do prompt: Hoje/Dinheiro/Casa/Planejamento/Config) | 5 destinos | Menos itens no menu | "Dinheiro" precisaria conter Transações+Caixinhas+Orçamento, "Casa" conter Compras+Recursos — cada tela vira uma sub-navegação por dentro, movendo a complexidade de "quantos destinos" pra "quantos níveis" |
| **Híbrida** | Início · Dinheiro (Transações+Caixinhas) · Casa (Compras+Recursos) · Grupo · Perfil | Reduz destinos de topo (7→5) sem perder nenhuma tela — só agrupa duas duplas correlatas | Cada dupla precisa de uma sub-navegação (abas) dentro da tela combinada — trabalho de implementação real, não cosmético |

**Escolha: manter a navegação atual.** A consolidação temática é conceitualmente elegante mas troca "7 destinos simples" por "5 destinos + sub-navegação" — não é claramente menos complexo pro usuário, só desloca onde a complexidade mora, e o prompt (§54) pede pra reduzir complexidade de verdade, não realocá-la. Revisitar essa decisão só se o casal relatar de forma concreta que 7 itens no drawer é difícil de navegar — hoje não há esse sinal.

## 7. Home ideal

Quatro versões comparadas (§62 do prompt):

- **V1 — Minimalista**: só saldo + contas a vencer + 1 ação. Rápida, mas descarta gráficos e recursos-em-falta que hoje já têm uso real documentado.
- **V2 — Fintech**: card de saldo grande, gráficos como elemento central. É essencialmente o que existe hoje.
- **V3 — Assistiva**: organizada inteiramente em torno das 5 perguntas do §25 (como estou / o que precisa atenção / o que fazer agora / melhor ou pior / existe risco), com os gráficos rebaixados pra uma seção secundária/expansível.
- **V4 — Casa + Dinheiro**: adiciona um bloco de Recursos/Compras com peso igual ao financeiro.

**Escolha: V3, mas evoluindo a V2 existente, não substituindo-a.** A Home atual já contém quase todos os blocos certos (RAIO-X §7.1) — o gap é de **ordem e enquadramento**, não de conteúdo faltando. Reordenar para: (1) card de saldo com a nova linha de orçamento restante [pergunta "como estou"], (2) contas a vencer + recursos em falta juntos como "o que precisa de atenção" [hoje já existem, só não estão emparelhados sob o mesmo rótulo conceitual], (3) ações rápidas como "o que fazer agora", (4) comparativo com mês anterior como "melhor ou pior", (5) gráficos rebaixados pra depois desses quatro blocos (continuam existindo, só não competem mais pela primeira dobra). V4 fica descartada — misturar Casa e Dinheiro com peso igual dilui exatamente a clareza que V3 busca.

## 8. Fluxos ideais

**Registro de despesa** — atual: abrir modal → título → categoria (auto-sugerida) → valor → [Mais opções] → salvar (mínimo 3-4 toques). Ideal 2027: campo de entrada rápida no topo do mesmo modal (Conflito 1) parseia texto+valor → pré-preenche os campos de sempre → 1 toque de confirmação quando não há ambiguidade a revisar. O caminho completo (todos os campos) continua existindo, inalterado, pra quem precisa dele.

**Compra**: planejar (já existe) → comprar com preço preenchido no mercado (já existe) → finalizar → pergunta se vira despesa (já existe) → estoque atualizado (parcialmente manual hoje: Recursos não é auto-decrementado quando um item comprado corresponde a um item de Recursos por nome). Gap real: a correspondência compra↔recurso não existe hoje — implementá-la exigiria decidir uma regra de matching por nome (arriscado: "Arroz" da lista vs. "Arroz 5kg" do Recursos) — fica como P3/P4 no roadmap, não nesta rodada, por ser uma automação de risco de falso-positivo maior que o benefício imediato.

**Inventário**: fluxo de 3 níveis (cômodo→subcategoria→item) já é rápido; nenhuma mudança de fluxo recomendada, só as melhorias transversais (resize de foto, acessibilidade).

**Casal**: hoje — ver quem pagou (avatar), ver a divisão (%/R$ no formulário), mas não ver o saldo agregado. Ideal 2027: uma seção "Entre vocês" (dentro de Grupo, ou um card na Home quando há saldo pendente relevante) mostrando "Beatriz deve R$ X pra Matheus" — clicável pra ver o detalhamento de quais transações compõem esse valor, com a opção de marcar como "acertado" sem precisar editar cada transação individualmente.

## 9. Money Engine (especificação, §40 do prompt)

- **Unidade interna**: centavos inteiros (`Math.round(valor * 100)`), nunca decimal binário, em qualquer soma/subtração/divisão feita no cliente.
- **Arredondamento**: sempre no centavo mais próximo (`Math.round`), nunca truncamento — consistente com o padrão já usado em `splitEqually()` (sobra de centavos vai pro primeiro pagador).
- **Divisão**: resultado sempre reconciliado contra o total (soma das partes = valor original, centavo a centavo) — já é o comportamento de `divisaoValida`, só precisa passar a rodar sobre inteiros.
- **Conversão de moeda**: nunca fabricar taxa — se a cotação não carregou, o valor fica de fora do agregado (já o comportamento correto de `somaSaldos`, RAIO-X §20.5).
- **Comparação**: sempre por centavo inteiro (`===`), nunca `Math.abs(a - b) < epsilon` — que só é necessário justamente por causa de ponto flutuante; eliminando o float, elimina-se a necessidade do epsilon também.
- **Formatação**: só na borda de saída (`formatMoeda`), nunca antes — hoje já é assim, preservar.

Escopo da mudança: um arquivo novo (`js/utils/money.js`) + trocar `Number(x) || 0` por `money.paraCentavos(x)`/`money.somar(...)` nos ~4 arquivos que fazem aritmética monetária. Não toca no schema (já correto).

## 10. Date Engine (§41)

`todayIso()` já foi corrigido pra calendário local (RAIO-X §14.7) — esse é o núcleo do Date Engine e já está certo. Reforço de convenção: **nenhum novo código deve usar `new Date().toISOString()` pra "hoje"** — só `todayIso()`. Vale um comentário/aviso no topo de `format.js` deixando essa regra explícita pra quem (você, ou eu numa sessão futura) for escrever código novo, prevenindo a próxima reincidência antes de acontecer.

## 11. Modelo de "verdade única" (§68)

Já é uma disciplina real do projeto (RAIO-X confirma em vários pontos: status nunca é coluna, saldo de caixinha nunca é coluna, total de compra nunca é coluna). Consolidado aqui pra referência:

```
Saldo (transação)     → transactions (bruto) + transaction_payers (fatia)
Status (pago/vencido)  → derivado, nunca coluna
Saldo de Caixinha       → caixinha_movimentacoes (soma), nunca coluna
Total de compra          → shopping_list_items (soma), nunca coluna
Estoque                    → resource_items.quantidade (única fonte — SEM ponte automática com Compras, ver §8)
Orçamento restante          → category_budgets.limite − soma(transactions do mês), nunca persistido
```

Nenhuma mudança recomendada aqui — só formalização.

## 12. Segurança, LGPD, PWA, Performance, Testes — resumo consolidado

Já detalhado por especialista em §1.4. Ações concretas resultantes: pinar versão das libs CDN; adicionar exportação de dados em Perfil (LGPD-friendly, barato); orientação de instalação manual pra iOS Safari na tela de entrada; resize de imagem client-side antes de upload; e — a maior — uma suite mínima de testes de regressão via Playwright, cobrindo primeiro os 6 bugs já documentados no RAIO-X que já se repetiram mais de uma vez (categorias duplicadas, `x-show`/`!important`, sincronização entre telas, soma de moeda) antes de expandir pra cobertura ampla.

---

## 13. Matriz de gaps

| Área | Estado atual | Problema | Impacto | Risco | Oportunidade | Prioridade |
|---|---|---|---|---|---|---|
| Testes automatizados | Inexistente | Zero rede contra regressão | Alto | Alto | Formalizar Playwright já em uso | **P0** |
| Aritmética monetária no cliente | `Number` float | Erro de centavo em somas grandes | Médio (ainda não observado) | Médio | Módulo money.js isolado | **P1** |
| "Quanto ainda posso gastar" | Ausente na Home | Pergunta financeira mais acionável sem resposta direta | Médio | Baixo | Linha no card de saldo | **P1** |
| Saldo entre casal | Ausente | Conta feita de cabeça hoje | Médio-Alto (valor percebido) | Baixo | Nova seção em Grupo/Home | **P1** |
| Acessibilidade sistemática | Incidental (44 aria/21 role/11 alt) | Cobertura desigual | Médio | Baixo-Médio | Passada dedicada | **P2** |
| Gráfico sem alternativa textual | Só canvas | Viola §45 do prompt | Baixo-Médio | Baixo | Tabela/resumo equivalente | **P2** |
| Entrada rápida de despesa | Ausente | Fricção em despesa trivial | Médio | Baixo | Campo parseado no modal | **P2** |
| README desatualizado | 4 itens errados | Confunde qualquer leitura futura | Baixo | Baixo | Atualização direta | **P2** |
| Resize de imagem antes de upload | Ausente | Banda/Storage desperdiçados | Baixo | Baixo | Canvas nativo | **P2** |
| Notificação sem severidade | Todas iguais | Risco de fadiga de notificação | Baixo (hoje) | Médio (cresce com uso) | Níveis info/attention/warning/critical | **P3** |
| `prefers-reduced-motion` | Ausente | Não respeita preferência de SO | Baixo | Baixo | Media query | **P3** |
| iOS install onboarding | Ausente | Instalação manual sem orientação | Baixo (depende do device do casal) | Baixo | Texto condicional na tela de entrada | **P3** |
| CI leve | Inexistente | Nenhuma checagem antes do deploy | Baixo (app de 2 pessoas) | Baixo | GitHub Actions rodando os testes novos | **P4** |
| Ponte automática Compras↔Recursos | Manual | Estoque não decrementa sozinho | Baixo | Médio (falso-positivo de matching) | Fica como ideia, não implementar ainda | **P4** |

## 14. Matriz de funcionalidades (decisão por módulo)

| Módulo | Valor | Complexidade | Frequência de uso (estimada) | Decisão |
|---|---|---|---|---|
| Transações (core) | Altíssimo | Alta | Diária | Manter, evoluir (entrada rápida) |
| Divisão multi-pagador | Alto | Média | Frequente (casal) | Manter, adicionar saldo agregado |
| Recorrência com cadência | Alto | Média-Alta | Configurada uma vez, usada sempre | Manter como está |
| Agrupamento em accordion | Médio | Baixa (já simples) | Ocasional | Manter |
| Caixinhas | Médio-Alto | Média | Ocasional (revisão de reserva) | Manter |
| Compras | Alto | Média | Semanal | Manter |
| Recursos | Médio | Média | Ocasional | Manter |
| OCR/PDF/Boleto/Pix scan | Médio | Alta (mas já paga, zero custo marginal) | Ocasional | Manter — já construído e funcionando, custo de remoção > benefício |
| Notificações + push | Alto | Alta (já paga) | Passiva (roda sozinha) | Manter, adicionar severidade |
| Importação CSV | Baixo-Médio | Média | Rara (migração pontual) | Manter, não expandir |
| Dashboard "por membro" | Médio | Baixa | Ocasional | Manter |

Nenhum módulo recomendado para remoção — o inventário de funcionalidades já reflete uso real do domínio (casa + casal + finanças), sem indício de feature claramente supérflua.

## 15. Roadmap / plano de migração (incremental, com checkpoints — §72/§74)

Ordem deliberada: rede de segurança primeiro (senão qualquer fase seguinte corre risco de regressão sem detecção), depois correção monetária (silenciosa, sem mudança visível), depois produto (visível, testável pelo casal), depois polish transversal.

**Fase 0 — Baseline.** Nenhuma mudança de código. Este documento + aprovação explícita sua = o baseline.

**Fase 1 — Rede de segurança.** `tests/*.spec.js` com Playwright, cobrindo primeiro os bugs já documentados que se repetiram (categorias duplicadas, accordion `x-show`, sincronização entre telas, soma de moeda em Caixinhas). Critério de conclusão: os 4 cenários rodam localmente (`npx playwright test`) contra modo demo e passam.

**Fase 2 — Money Engine.** `js/utils/money.js` + substituição nos 4 arquivos que fazem soma monetária. Critério de conclusão: os testes de Fase 1 continuam passando + um teste novo específico de soma com muitas parcelas confirmando ausência de erro de centavo.

**Fase 3 — Produto (visível).** Entrada rápida no modal de despesa; linha de orçamento restante no card de saldo; saldo entre casal (Grupo); toast "Desfazer" nas exclusões frequentes. Cada item shippado e testado (manual + Playwright) antes do próximo começar — não os quatro simultaneamente.

**Fase 4 — Acessibilidade e polish transversal.** Alternativa textual a gráficos; `prefers-reduced-motion`; resize de imagem antes de upload; orientação de instalação iOS; pin de versão das libs CDN.

**Fase 5 — Documentação e housekeeping.** README atualizado; exportação de dados em Perfil (LGPD-friendly); CI leve rodando os testes da Fase 1 a cada push (opcional, só se você quiser esse nível de automação).

**Fase 6 — Severidade de notificação.** Níveis info/attention/warning/critical — deixada por último porque é a que menos urge (RAIO-X não documenta nenhuma reclamação real de fadiga de notificação ainda).

Nenhuma fase mexe em mais de um punhado de arquivos por vez; cada uma termina com o app num estado funcional e testável — nunca 40 arquivos alterados simultaneamente (§74).

## 16. Definition of Done (§76, aplicada a cada item das fases acima)

Uma mudança só está pronta se: funciona em modo demo E modo real; é responsiva (mobile + desktop); não quebra dark/light; não introduz erro no console; não quebra RLS; não cria segunda fonte de verdade; tem loading/erro/empty state onde aplicável; e — a partir da Fase 1 deste roadmap — tem cobertura de teste Playwright para o caminho principal.

## 17. Mapa do produto

```
Bõnotto
├── Início (Dashboard)
│   ├── Card de saldo (+ linha de orçamento restante — Fase 3)
│   ├── O que precisa de atenção (contas a vencer + recursos em falta)
│   ├── Ações rápidas
│   ├── Comparativo com mês anterior
│   └── Gráficos configuráveis (categoria/empresa/membro/período)
├── Transações
│   ├── Tabela/Lista/Grade/Grade compacta (+ Agrupar, filtro independente)
│   ├── Formulário (+ entrada rápida — Fase 3)
│   └── Importação/Exportação CSV
├── Caixinhas
│   └── Grade de bancos → detalhe (guardado/retirado/saldo/meta, multi-moeda)
├── Compras
│   └── Lista ativa → finalizar → vira despesa (opcional)
├── Recursos
│   └── Cômodo → subcategoria → item (+ sugestões de compra)
├── Grupo
│   ├── Membros, convite por código
│   └── Saldo entre membros (Fase 3, novo)
└── Perfil
    ├── Categorias, Orçamentos
    ├── Notificações push
    └── Exportar meus dados (Fase 5, novo)
```

## 18. Mapa de dados (relações reais)

```
profiles ──┬── categories (pessoal ou de grupo)
           ├── companies
           ├── transactions ── transaction_payers (divisão)
           ├── category_budgets
           ├── caixinhas ── caixinha_movimentacoes
           ├── resource_rooms ── resource_categories ── resource_items
           ├── shopping_lists ── shopping_list_items
           │                  └─→ transactions (compra vira despesa)
           ├── notifications
           └── push_subscriptions

groups ── group_members ── profiles
       └── (transactions/categories/caixinhas/resource_rooms/shopping_lists podem ser de grupo)
```

## 19. Resultado final

**O que construir**: rede de testes mínima (Fase 1); Money Engine em centavos (Fase 2); entrada rápida, orçamento restante na Home, saldo entre casal, undo em exclusões frequentes (Fase 3); acessibilidade sistemática e resize de imagem (Fase 4); README correto e exportação de dados (Fase 5); severidade de notificação (Fase 6).

**Por que construir**: cada item fecha uma lacuna real identificada com evidência (bug já ocorrido, pergunta do usuário sem resposta na UI, requisito explícito do prompt ainda não atendido) — nenhum item é especulativo.

**Como construir**: incrementalmente, fase a fase, sem tocar em mais do que um punhado de arquivos por vez, sempre com o app funcional entre fases (§74).

**O que não construir agora**: ponte automática Compras↔Recursos (risco de falso-positivo maior que o ganho); reorganização da navegação em 5 destinos temáticos (desloca complexidade, não reduz); qualquer forma de IA paga; qualquer feature comercial/multi-tenant (§0 do prompt — cedo demais).

**O que remover**: nada. Nenhum especialista, em nenhuma das quatro rodadas de análise, encontrou uma funcionalidade existente que devesse ser eliminada.

**O que simplificar**: a Home (reordenar em torno das 5 perguntas do §25, sem adicionar bloco novo — só reorganizar o que já existe); confirmações de exclusão (trocar por undo onde a exclusão é frequente e de baixo dano).

**Como testar**: Playwright, começando pelos bugs já documentados que se repetiram — maior retorno por esforço de todo o roadmap.

**Como garantir segurança**: nenhuma mudança nova ao desenho de RLS — já correto; só reforço de convenção (nunca autorização no client) pra qualquer código futuro.

**Como garantir qualidade**: Definition of Done (§16) aplicada a cada item, não só às fases grandes.

**Como manter custo praticamente zero**: nenhuma decisão deste blueprint introduz custo novo — todas as libs continuam gratuitas/sem chave, Supabase continua no free tier, Playwright roda local sem custo de CI a menos que você opte pela Fase 5 (opcional).

**Como garantir excelente experiência mobile**: já é ponto forte hoje (RAIO-X confirma); as mudanças propostas (entrada rápida, undo) reduzem toques em vez de adicionar.

**Como fazer o produto parecer inteligente sem IA**: expandir o que já existe (categorização por palavra-chave, sugestões determinísticas) — não incluído nas fases acima porque nenhuma lacuna concreta e urgente foi identificada aqui (fica como direção pós-roadmap, não descartada, só sem prioridade hoje).

**Como preservar o que já funciona**: nenhuma fase deste roadmap toca a separação `services/`, o schema, a RLS, ou qualquer módulo listado como "manter" na matriz de funcionalidades (§14).

**Como preparar pra escalar futuramente**: exportação de dados (Fase 5) é a única "Future Scalability Boundary" concreta recomendada agora — barata, reversível, não fecha nenhuma porta.

---

*Este é o documento definitivo do PROMPT MASTER. Aguardando autorização explícita sua (§85) para iniciar a Fase 1. Nenhuma fase deste roadmap deve começar sem esse sinal — inclusive a Fase 1, que é a mais barata e menos arriscada de todas.*
