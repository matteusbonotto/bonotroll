# Plano — Complemento de escopo (2026-10-11)

Demandas: (1) bug do e-mail de verificação no cadastro · (2) entrar/criar conta com Google · (3) offline + sincronização · (4) badges de categoria com ícone no mobile · (5) área IRPF no BNTT Home (PF).

**Regra do usuário:** tudo que for banco de dados / configuração do Supabase fica na **última etapa (Fase 8)**. As fases 1–7 mexem só no cliente, em testes e em documentação, e rodam em modo demo (`?demo=1`). Ao fim da Fase 7 eu aviso e paramos até o Supabase correto estar conectado.

Status: `[ ]` não feito · `[x]` feito e verificado (mesma regra binária do CHECKLIST-REBRAND).

---

## Understanding

- **Repositório e produto:** tudo acontece **neste repositório (BNTT)**. O BNTT Home (PF) e o BNTT Business (PJ) são o **mesmo app**, separados por `conta.tipo` (`'home' | 'business'`, ver `js/components/store.js` → `linha`). O **EvangeliGO** é outro repositório (`projetos/EvangeliGO`) e **nenhum** destes 5 itens toca nele. O `BNTT Investimentos` também é outro repositório e fica fora deste plano.
- **Fora de escopo agora:** pagamento/planos, landing page, exportação oficial do IRPF antes de existir especificação oficial confirmada, a parte PJ de imposto (IRPJ/Simples) no Business.

## O que a investigação encontrou (não reler)

| Assunto | Onde | Situação atual |
|---|---|---|
| Cadastro | `js/services/auth.js` (`signUp`, `reenviarConfirmacao`), `js/components/auth.js`, `store.signup` | Confirmação por **link** (`{{ .ConfirmationURL }}` em `supabase/templates/confirmar-cadastro.html`), `flowType: 'implicit'`, redirect para `/app` (rewrite do `firebase.json` para `app.html`). Reenvio com espera de 60 s **só na memória** (some ao recarregar). |
| SMTP | `docs/CONFIGURAR-EMAIL.md`, `docs/CHECKLIST-REBRAND.md:168` | Item **`[ ]` aberto**: o projeto usa o SMTP de teste do Supabase, que **só entrega para membros da equipe do projeto** e com limite de 2–4 por hora. |
| Google | — | Não existe. Nenhum `signInWithOAuth`. |
| Gatilho de perfil | `supabase/schema.sql:479` | Lê `raw_user_meta_data->>'nome'`. O Google envia `full_name`/`name`, então hoje um usuário do Google ficaria com o nome = parte do e-mail antes do `@`. |
| Offline | `sw.js` (`bntt-v19`), `store.online` | O service worker guarda só o **app shell**. Não há cache de dados, fila nem sincronização. Já existe um padrão de IndexedDB com chave AES-GCM não extraível em `js/services/cofre.js` (reaproveitar). |
| Badges de categoria | `app.html` linhas ~805, ~1146, ~1270, ~1691, ~1756 (`.cg-chip` + `categoryFor()`) | **5 cópias** do mesmo markup, com variações (uma já é só ícone com `aria-label`, outras não aceitam `icone_url`). Categoria já tem `cor`, `icone` (Bootstrap Icons) e `icone_url` no schema. O tooltip acessível que já existe é `cgHelp` (`tests/e2e/tooltip-ajuda.spec.js`). |
| Gemini | — | **Não existe integração.** Precisa nascer como Edge Function (a chave nunca vai pro cliente). |
| Leitura de PDF/OCR | `js/services/pdf.js`, `js/services/ocr.js` (pdf.js e Tesseract via esm.sh) | Já existe. Será reaproveitado para extrair o texto no próprio aparelho antes de qualquer chamada à IA. |
| CSP | `firebase.json` | `connect-src` já libera `qlcrsclgtpjeqkmykqrs.supabase.co`. O OAuth do Google é uma navegação de página inteira, que a CSP não bloqueia. Gemini sempre via Edge Function, então não entra domínio novo. |

---

## Requirements (critérios de aceite)

### R1 — E-mail de verificação
1. Cadastro com e-mail **novo** → mensagem "enviamos" + botão "Reenviar" + campo **"Digitar código de 6 dígitos"** (alternativa ao link).
2. Cadastro com e-mail **já existente** (o Supabase devolve `user.identities = []`, **sem erro**, e não envia nada) → a tela diz "já existe conta com este e-mail; entre ou recupere a senha". Hoje ela diz "Conta criada! Enviamos…", o que é falso.
3. O reenvio respeita a espera de 60 s **mesmo depois de recarregar a página** (o horário fica guardado em `localStorage`, numa chave com prefixo `bonotto_`) e mostra a contagem regressiva.
4. Erros mapeados em PT-BR: provedor falhou (`error sending confirmation email` / 500), limite de envio, código expirado (`otp_expired`/`token has expired`), código inválido, usuário já confirmado, link com `error_description` no hash quando volta para `/app`.
5. Usuário já verificado que pede reenvio → "Seu e-mail já está confirmado, é só entrar".
6. A verificação nunca é desligada e nenhum código é aceito sem o `verifyOtp` do servidor.
7. Testes unitários para a classificação da resposta do signUp, o mapa de erros e o cooldown. E2E da interface com o cliente Supabase simulado.

### R2 — Google
1. Botões "Entrar com Google" (login) e "Criar conta com Google" (cadastro), no padrão visual do Google (logo oficial, texto oficial em PT-BR).
2. Usam `signInWithOAuth({ provider: 'google', options: { redirectTo: origin + '/app' } })`.
3. No primeiro login, o tipo de conta escolhido na LP (`intencao.tipo`) é gravado com `updateUser({ data: { tipo_conta } })`, porque o OAuth não carrega `options.data`.
4. No modo demo, os botões aparecem desabilitados com a dica "Disponível na versão conectada".
5. Erro de volta do Google (cancelou, provedor desligado) → mensagem clara, sem tela quebrada.

### R3 — Offline
1. Com dados já carregados uma vez, o app abre sem internet e mostra transações, compras, recursos e caixinhas a partir do cache local.
2. Sem internet é possível: criar e editar lançamento, marcar ou adicionar item de compra, editar quantidade de recurso. **Não** é possível sem internet: excluir lançamento financeiro, importar documento, IRPF, convites, pagamento, trocar senha (botão desabilitado com explicação).
3. Indicador na topbar com 4 estados: **Offline** · **Sincronizando (n)** · **Sincronizado** · **Erro de sincronização** (com "ver detalhes" e "tentar de novo").
4. Cada operação na fila tem um `id` gerado no cliente (`crypto.randomUUID()`), que serve de chave de idempotência. Reenviar a mesma operação nunca duplica.
5. Antes de sincronizar, um **ping real** ao Supabase (não basta o evento `online`).
6. Conflito: se o registro mudou no servidor depois da versão que o aparelho editou, **não sobrescreve**. A operação vai para "conflito" e o usuário escolhe "manter a minha" ou "ficar com a do servidor".
7. Cache separado por usuário (o banco local tem o `user.id` no nome), criptografado com chave AES-GCM não extraível, com validade (TTL) e versão de esquema. É **apagado no logout** e quando muda o usuário.
8. Tokens de autenticação continuam onde o supabase-js já os guarda. Nada de documentos nem de PDFs no cache offline.

### R4 — Badges de categoria
1. **Um** componente só (partial/helper `cgCategoria`) substitui as 5 cópias.
2. Celular (< 576 px): só o ícone, num círculo com a cor da categoria. Tela maior: ícone + nome.
3. Tocar, focar (Tab) ou passar o mouse abre um balão com o nome completo. O elemento tem `role="img"` + `aria-label` (ou é um `button` quando abre o menu de troca).
4. Contraste: a cor do texto/ícone (branco ou escuro) é escolhida por cálculo de luminância, com contraste ≥ 4.5:1 (texto) e ≥ 3:1 (ícone). Função pura testada.
5. Não depende só da cor: o ícone é sempre diferente por categoria padrão. Revisar os presets padrão (Moradia `bi-house`, Mercado `bi-cart`, Transporte `bi-car-front`, Saúde `bi-heart-pulse`, Lazer `bi-controller`, Educação `bi-mortarboard`, Contas `bi-receipt`, Salário `bi-cash-coin` etc.) para não haver ícone repetido nem cor contraditória (ex.: nada de vermelho em "Salário").
6. E2E em viewport de 390 px.

### R5 — IRPF (BNTT Home)
Critérios da seção 4.11 do pedido, com dois ajustes de honestidade:
- **"Compatível com o programa da Receita"** só depois de testar no programa oficial (Fase 9). Até lá: resumo + guia de preenchimento.
- **OCR de PDF digitalizado:** o pipeline usa Tesseract no aparelho (já existe) e/ou o Gemini lendo a imagem. Os testes automatizados usam **documentos sintéticos** gerados por script (nunca dados reais).

---

## Affected Files

| Fase | Arquivos |
|---|---|
| 1 E-mail | `js/services/auth.js`, `js/components/auth.js`, `js/components/store.js` (tratar `error_description` no retorno), `app.html` (tela de cadastro), `tests/unit/auth-mensagens.test.js` (ampliar), `tests/unit/auth-signup.test.js` (novo), `tests/e2e/cadastro-verificacao.spec.js` (novo) |
| 2 Google | `js/services/auth.js` (`signInWithGoogle`), `js/components/auth.js`, `js/components/store.js` (gravar `tipo_conta` no 1º login), `app.html`, `assets/` (logo G), `tests/e2e/login-google.spec.js` |
| 3 Badges | `app.html` (5 pontos), `js/components/categoryManager.js` (presets), `js/utils/cor.js` (novo, contraste), `css/components.css` (`.cg-chip.cg-chip--cat`), `js/data/mockDb.js` (seed com ícones distintos), `tests/unit/cor.test.js`, `tests/e2e/badge-categoria-mobile.spec.js` |
| 4 Offline | `js/data/offlineStore.js` (novo: IndexedDB + criptografia), `js/data/filaSync.js` (novo: fila, retentativa, conflito), `js/utils/conectividade.js` (novo: ping), `js/services/transactions.js`, `shoppingList.js`, `resources.js`, `caixinhas.js` (ler do cache / enfileirar), `js/components/store.js` (estado de sync, limpar no logout), `app.html` (indicador), `sw.js` (versão do cache), `tests/unit/filaSync.test.js`, `tests/e2e/offline.spec.js` |
| 5 IRPF pesquisa | `docs/IRPF-INVESTIGACAO.md` (novo) |
| 6–7 IRPF cliente | `js/irpf/regras/2026.js` (+ `2027.js` quando houver IN), `js/irpf/mapeamento.js`, `js/irpf/normalizar.js`, `js/irpf/deduplicar.js`, `js/irpf/calculo.js`, `js/irpf/esquemaExtracao.js` (JSON Schema validado), `js/services/irpf.js`, `js/components/irpfView.js`, `app.html` (tela + modais), `js/data/mockDb.js` (tabelas `irpf_*` do demo), `scripts/gerar-docs-sinteticos.mjs`, `tests/fixtures/irpf/` (sintéticos), `tests/unit/irpf-*.test.js`, `tests/e2e/irpf-*.spec.js` |
| 8 Banco (última) | `supabase/irpf-2026-10.sql`, `supabase/offline-2026-10.sql`, `supabase/schema.sql`, `supabase/templates/confirmar-cadastro.html`, `supabase/functions/irpf-extrair/`, `supabase/config.toml`, `docs/CONFIGURAR-EMAIL.md`, `docs/CONFIGURAR-GOOGLE.md` (novo) |

## Architecture Impact

- **`services/` continua sendo a única fronteira.** A fila offline entra **dentro** dos services (wrapper `executarOuEnfileirar`) e as telas não sabem se o dado foi gravado agora ou se ficou na fila, igual ao que já acontece com `isDemoMode()`.
- **IRPF** ganha uma pasta `js/irpf/` só com funções puras (regras, mapeamento, cálculo, deduplicação), fáceis de testar com `node --test`, e um `js/services/irpf.js` como fronteira. Mais uma tela (`irpfView`), sempre montada como as outras 7 (com `x-show`), visível só quando `conta.tipo === 'home'`.
- **O Gemini nunca é chamado do navegador.** O fluxo é: aparelho extrai o texto (pdf.js/Tesseract) → Edge Function `irpf-extrair` (autenticada por JWT, com limite por usuário) → Gemini com saída estruturada (`responseSchema`) → **a aplicação valida o JSON** com o esquema → nada entra sem a revisão do usuário. **Os cálculos são das regras versionadas em `js/irpf/regras/`, nunca da IA.**
- **No modo demo**, o `services/irpf.js` usa um extrator determinístico (regex sobre os documentos sintéticos), e assim toda a interface e os testes rodam sem Gemini.
- **Nenhuma biblioteca nova** para o offline (IndexedDB e WebCrypto nativos, mesmo padrão do `cofre.js`). Para validar o esquema, uma função pequena própria em vez de instalar Ajv.

## Database Impact (tudo na Fase 8)

| Mudança | Para quê | Reflete no `mockDb.js`? |
|---|---|---|
| `updated_at timestamptz` + trigger em `transactions`, `shopping_items`, `resources`, `caixinhas` (onde faltar) | Detectar conflito offline (`update … where id = ? and updated_at = ?`) | Sim (campo atualizado no demo) |
| Inserir com o `id` gerado no cliente (já é `uuid`; conferir se há `default` sem bloquear o `id` explícito) + `upsert … on conflict (id) do nothing` | Idempotência | Já é compatível |
| Gatilho `handle_new_user`: `coalesce(nome, full_name, name, split_part(email))` | Nome de quem entra pelo Google | — |
| Tabelas `irpf_declaracoes` (owner, exercício, ano-calendário, status), `irpf_documentos` (arquivo, hash SHA-256, instituição, período, tipo, status), `irpf_itens` (campo oficial, valor original/normalizado, origem: documento+página+trecho, confiança, estado da revisão: importado/sugerido/confirmado/pendente/inconsistente), `irpf_dependentes`, `irpf_bens`, `irpf_dividas` | Declaração persistida e retomável | Sim, espelho completo |
| RLS **só `owner_id = auth.uid()`** em todas as `irpf_*` (sem acesso pelo grupo) + `check` de que o perfil é da linha Home | Privacidade e separação PF/PJ | — |
| Bucket **privado** `irpf-documentos`, com caminho `{uid}/{declaracao}/{hash}`, policy por dono, URL assinada de curta duração | Arquivos | Demo: dataURL só em memória |
| `unique (declaracao_id, hash)` em `irpf_documentos` | Deduplicação no servidor | Sim |
| Tabela `irpf_uso_ia` (user, dia, chamadas, páginas) | Limite de custo por usuário | — |
| Exclusão: `excluir-conta` passa a apagar o bucket `irpf-documentos`; botão "apagar documentos e manter só os valores confirmados" | Retenção mínima | — |

## UX Impact

- Segue `docs/DESIGN-SYSTEM-2027.md`: regra do botão voltar, escala tipográfica, card só quando agrupa. O tooltip reaproveita `cgHelp`, sem componente novo.
- IRPF: **rótulo oficial sempre visível** + ícone `?` com balão (significado simples, exemplo, onde achar no informe, com o que não confundir). Fluxo em 10 passos com barra de progresso. Listas de pendências e chips de estado (Importado / Sugerido pela IA / Confirmado / Pendente / Inconsistente), cada um com ícone + texto (não só cor).
- Aviso permanente no resumo: "**Estimativa preliminar, não é o cálculo oficial da Receita.**" e "Faltam X itens para esta estimativa ficar confiável".
- Antes do primeiro upload, uma tela curta de consentimento: o que é enviado, para quem (Google Gemini, via servidor do BNTT), que não é usado para treinar o modelo (só se a conta Gemini contratada garantir isso, ver a decisão D2) e como apagar.

## QA Impact

- Unit (`node --test`): signup/erros/cooldown · contraste de cor · fila (idempotência, retentativa com backoff, conflito, isolamento por usuário, limpeza) · IRPF (normalizar R$/datas/CPF/CNPJ, dedup por hash e por conteúdo, não contar duas vezes informe + extrato, cálculo com casos conhecidos da tabela do exercício, validação do esquema da IA, rejeição de JSON fora do esquema, texto de "prompt injection" no documento não muda a classificação).
- E2E (Playwright, `?demo=1`): cadastro (Supabase simulado via `page.route`), botões Google, badge mobile 390 px + teclado, offline (`context.setOffline(true)` → cria lançamento → volta → "Sincronizado"), IRPF (importar lote sintético → revisar → corrigir → resumo → recarregar e retomar; a conta Business não vê a área IRPF).
- `npm run test:dist` no final (o código obfuscado não pode quebrar o IndexedDB nem o import dinâmico).

## Security Impact

- Auth (signup, OTP, OAuth): revisão do agente `security` obrigatória. `redirectTo` fixo em `origin + '/app'`, sem parâmetro vindo da URL (evita open redirect).
- Chave do Gemini **só** como segredo da Edge Function (`GEMINI_API_KEY`, nunca impresso) e registrada em `scripts/env.mjs` na lista do que **nunca** vai para o frontend. A varredura de segredos do `build.mjs` passa a procurar o padrão `AIza`.
- Edge Function: exige JWT, confere se a conta é Home, limita tamanho (ex.: 10 MB por arquivo, 20 arquivos por lote, N páginas por dia), deduplica pelo hash antes de chamar a IA (a mesma requisição repetida não gera custo), **não registra conteúdo nos logs** (só id, hash e status).
- Prompt injection: o texto do documento vai como **dado** (delimitado e marcado como não confiável), o modelo roda **sem ferramentas** e a saída é aceita só se passar pelo esquema. Campos fora do esquema são descartados.
- Offline: cache criptografado e separado por usuário, apagado no logout. Nenhum documento, token ou chave no cache.

---

## Implementation Plan (ordem)

> Branch: `feat/complemento-2026-10` (nunca em `main`). Um commit por fase. Deploy só quando você pedir.

### Fase 1 — E-mail de verificação (código) `[x]`
1. `signUp` passa a devolver `{ session, user, situacao }`, com `situacao` = `'confirmar_email' | 'ja_existe' | 'logado'` (`identities.length === 0` → `'ja_existe'`).
2. `verificarCodigo(email, codigo)` → `supabase.auth.verifyOtp({ email, token, type: 'signup' })`.
3. `reenviarConfirmacao` com cooldown persistido (`bonotto_reenvio_<hash do e-mail>`) e contagem regressiva na tela. Tratar "já confirmado".
4. Ampliar `mensagemErroAuth`: `error sending confirmation email`, `otp_expired`, `token has expired or is invalid`, `email address … is invalid`, `signups not allowed`, `over_email_send_rate_limit`.
5. `store`: ler `error`/`error_description` do hash ao voltar para `/app` (link expirado) → abrir o cadastro com "Link expirado, peça outro código".
6. Testes unitários + e2e com `page.route` simulando as respostas do Supabase.

### Fase 2 — Google (código) `[x]`
1. `signInWithGoogle()` no service. Botões no login e no cadastro, com o logo oficial em SVG local.
2. Primeiro login via OAuth sem `tipo_conta` → `updateUser({ data: { tipo_conta: intencao.tipo } })` (best-effort).
3. Tratar o retorno com erro (`error_description`). No demo, botão desabilitado.
4. E2E: o clique chama a URL `…/auth/v1/authorize?provider=google` (interceptada, sem sair do teste).

### Fase 3 — Badges de categoria `[x]`
1. `js/utils/cor.js`: `corDoTexto(hex)` e `contraste(a, b)`, com testes.
2. Um template único `cgCategoria(catId, { trocavel })` substitui as 5 cópias (as duas variantes: só exibir / botão que abre o menu de troca).
3. CSS `.cg-chip.cg-chip--cat`: ícone sempre visível, nome oculto abaixo de 576 px (`visually-hidden` só no mobile, para continuar acessível ao leitor de tela), balão `cgHelp` ao tocar ou focar.
4. Revisar `CATEGORY_ICON_PRESETS` e o seed do demo (ícones únicos, cores coerentes).
5. E2E 390 px + navegação por teclado + `aria-label`.

### Fase 4 — Offline (cliente) `[x]`
1. `offlineStore.js`: IndexedDB `bntt-offline-<uid>`, stores `cache` (com `{ tabela, chave, dado cifrado, salvoEm, versao }`) e `fila`. Chave AES-GCM não extraível (padrão do `cofre.js`). TTL de 30 dias para leitura e invalidação ao trocar de versão do esquema.
2. `conectividade.js`: `servidorDisponivel()` = `fetch` ao endpoint de health do Supabase com timeout de 5 s.
3. `filaSync.js`: `enfileirar(op)`, `processar()` em ordem, backoff exponencial (1 s → 5 min, até 8 tentativas e depois "erro"), estados `pendente | enviando | feito | conflito | erro`, executor injetável (para testar sem rede).
4. Services: leitura = rede → atualiza o cache; se falhar, usa o cache (marcado como "dados de dd/mm hh:mm"). Escrita das operações permitidas = gravação otimista local + fila. **Enquanto a Fase 8 não acontecer**, o conflito é detectado comparando `updated_at` lido antes de enviar (melhor esforço). A garantia atômica (`where updated_at = ?`) entra na Fase 8.
5. Gatilhos de sincronização: evento `online`, `visibilitychange`, a cada 60 s se houver pendência, e o botão "tentar de novo".
6. Indicador na topbar + painel de pendências/conflitos. `logout` → `limparDadosOffline(uid)`.
7. `sw.js`: bump `CACHE_NAME` e cache dos módulos do esm.sh essenciais (supabase-js) para o app abrir offline.
8. Testes unitários da fila + e2e com `setOffline`.

### Fase 5 — IRPF: investigação tributária e técnica (só documento) `[x]`
Gera `docs/IRPF-INVESTIGACAO.md`, com fonte oficial (gov.br/receitafederal) para cada afirmação:
1. **Exercício x ano-calendário.** Hoje (out/2026) o próximo é o **exercício 2027 / ano-calendário 2026**, cuja Instrução Normativa e programa **ainda não foram publicados** (costumam sair em fev–mar). O ano-calendário 2026 tem mudanças grandes (Lei 15.270/2025: redução do imposto para quem ganha até R$ 5 mil/mês, tributação mínima de altas rendas, retenção sobre dividendos). **Isso precisa ser confirmado na fonte oficial, não presumido.** Proposta: implementar e testar com o **exercício 2026** (regras publicadas) e deixar o 2027 como módulo de regras separado, ativado quando a IN sair.
2. Fichas oficiais do programa IRPF do exercício (nomes, códigos de rendimento, códigos de bens e direitos, códigos de pagamentos).
3. Meios oficiais de importação/exportação: declaração pré-preenchida (exige gov.br prata/ouro, é a Receita que preenche), importação da declaração do ano anterior, Carnê-Leão. **Hipótese a confirmar:** a Receita não publica um layout aberto para um terceiro gerar um arquivo `.DEC` importável. Se for confirmado, **não haverá exportador** e a saída será o guia de preenchimento.
4. Gemini: modelo atual com entrada de PDF/imagem + `responseSchema`, preço, limites e **termos de uso de dados** (a camada gratuita da API pode usar o conteúdo para melhorar o produto, por isso documentos fiscais exigem a camada paga ou o Vertex AI).
5. Revisão de privacidade (LGPD: dado sensível, consentimento, retenção) e atualização de `privacidade.html`.

### Fase 6 — IRPF: núcleo puro + tela (modo demo) `[x]`
1. `regras/2026.js` (tabela progressiva anual, limite de dedução por dependente, teto de educação, desconto simplificado e seu teto, obrigatoriedade) com a fonte de cada número em comentário.
2. `mapeamento.js`: campo interno → ficha/código oficial, versionado por exercício.
3. `esquemaExtracao.js` + validador. `normalizar.js` (R$ "1.234,56", datas, CPF/CNPJ com dígito verificador). `deduplicar.js` (hash SHA-256 do arquivo + chave de conteúdo: CNPJ da fonte + ano + tipo).
4. `calculo.js`: rendimento tributável por fonte, IR retido, deduções com teto, simplificado x completo, saldo estimado. **Recusa somar categorias incompatíveis** (exclusiva/definitiva nunca entra na base de cálculo) e marca o resultado como parcial quando falta algo essencial.
5. Tela `irpfView` (só na linha Home): escolher exercício → importar lote → processamento por arquivo (recebido / processado / parcial / rejeitado / duplicado, com o motivo) → revisão por ficha com origem clicável (arquivo, página, trecho) → perguntas complementares → pendências → resumo → guia de preenchimento.
6. `scripts/gerar-docs-sinteticos.mjs`: informes de rendimentos, extrato, informe de corretora e um PDF "escaneado" (imagem), todos fictícios, para os testes.

### Fase 7 — IRPF: testes de aceite + revisão `[x]`
1. Todos os testes da seção 4.11, exceto a exportação oficial.
2. Revisão dos agentes `security`, `ux-ui` e `code-reviewer`. `npm run test:unit`, `npm test` e `npm run test:dist` verdes.
3. **→ Aqui eu aviso: "fases de código concluídas, pode conectar o Supabase correto para a Fase 8."**

### Fase 8 — BANCO DE DADOS E CONFIGURAÇÃO DO SUPABASE (ÚLTIMA) `[ ]`

> **2026-10-12, aplicado em produção (`appbntt`):** `supabase/irpf-2026-10.sql` (4 tabelas, RLS só do dono), `supabase/ia-2026-10.sql` (`ia_uso` + `ia_consumir`, executável só pelo `service_role`), `supabase/google-2026-10.sql` (`handle_new_user` lê `full_name`/`name`). Segredo `GEMINI_API_KEY` gravado (lido do `.env`, sem exibir); função `ia` publicada (sem login → 401; chave validada no `gemini-3.5-flash` → 200).
> **Ainda `[ ]`, dependem do painel/conta:** `GEMINI_TIER_PAGO` (o projeto Google `bntt` está sem faturamento → IA não lê documento fiscal até ativar), SMTP próprio, Redirect URLs, cliente OAuth do Google + provedor no Supabase, `updated_at` condicional do offline.
Só depois que você confirmar o projeto (`npx supabase projects list` → o que estiver com `linked: true`). Cada passo em produção é confirmado com você antes.

**Feito por você no painel** (passo a passo em `docs/CONFIGURAR-EMAIL.md` e em `docs/CONFIGURAR-GOOGLE.md`):
1. **SMTP próprio** (Authentication → Emails → SMTP Settings). **Esta é a causa provável nº 1 do bug** (ver abaixo). Rate limit de e-mail: 30/h.
2. URL Configuration: Site URL `https://bnttapp.web.app` + Redirect URLs `…/app` e `…/**` (e `http://localhost:5510/**` para o dev).
3. Template "Confirm signup" com o link **e** o código `{{ .Token }}` (eu atualizo o arquivo e o gerador `scripts/gerar-emails.py`; você cola no painel).
4. Google: criar o OAuth Client no Google Cloud Console (tela de consentimento com nome BNTT e links de privacidade/termos, redirect `https://<ref>.supabase.co/auth/v1/callback`) → colar o Client ID/Secret em Authentication → Providers → Google.
5. Conta/chave Gemini na camada paga → `npx supabase secrets set GEMINI_API_KEY=…` (você digita, eu não vejo o valor).

**Feito por mim (com a sua confirmação):**
6. Aplicar `supabase/offline-2026-10.sql` (`updated_at` + triggers) e trocar a detecção de conflito para a versão atômica.
7. Aplicar `supabase/irpf-2026-10.sql` (tabelas, RLS só do dono, bucket privado, uso de IA) e incorporar ao `schema.sql`.
8. Ajustar o gatilho `handle_new_user` (`full_name`/`name` do Google).
9. Deploy da Edge Function `irpf-extrair` e atualização da `excluir-conta` (apagar o bucket do IRPF).
10. Teste real ponta a ponta: cadastro em e-mail externo (recebe, link e código funcionam, expira, reenvio), Google (conta nova e conta já existente com o mesmo e-mail), offline com conflito real, IRPF com Gemini usando **documentos sintéticos**.
11. Marcar `docs/CHECKLIST-REBRAND.md:168` como `[x]` só depois do teste 10.

### Fase 9 — Exportação oficial (condicional) `[ ]`
Só se a Fase 5 encontrar especificação oficial e um meio autorizado de validar. Caso contrário, fica registrado como **não implementado, por falta de formato oficial**, e o produto entrega o guia de preenchimento.

---

## Causa raiz do bug de e-mail (evidência até agora)

1. **Principal, falta confirmar no painel (Fase 8):** o SMTP próprio não está configurado. `docs/CHECKLIST-REBRAND.md:168` está `[ ]`, e o SMTP padrão do Supabase **só entrega para membros da equipe do projeto** (2–4 por hora). Qualquer usuário de fora nunca recebe. Verificação: painel → Authentication → Emails → SMTP Settings ("Enable custom SMTP" ligado) e Logs → Auth, procurando `error sending confirmation email` ou `rate limit`. Isso não é variável de ambiente do repo, é configuração do projeto Supabase.
2. **Bug no código, confirmado:** cadastro com e-mail já existente → o Supabase responde sucesso com `identities: []` e **não envia nada**, e a tela mostra "Conta criada! Enviamos um link…". O usuário fica esperando um e-mail que nunca vai chegar. Corrigido na Fase 1.
3. **Agravantes, confirmados no código:** a espera do reenvio se perde ao recarregar a página. Não existe alternativa ao link (código de 6 dígitos), e o link de uso único pode ser "consumido" pelo antivírus/pré-visualização do provedor de e-mail. O link expirado volta para `/app` sem nenhuma mensagem.
4. **A conferir na Fase 8:** se `https://bnttapp.web.app/app` está na lista de Redirect URLs (se não estiver, o Supabase manda para a Site URL).

## Risks

| Risco | Mitigação |
|---|---|
| A fila offline reenviar uma operação financeira duas vezes | `id` do cliente + `upsert … do nothing`. Teste unitário "enviar 2x = 1 registro". |
| Uma sincronização atrasada sobrescrever um dado mais novo | `updated_at` condicional (Fase 8) e estado "conflito" com escolha do usuário. Exclusão financeira é só online. |
| Dado de um usuário aparecer para outro no mesmo aparelho | Banco local por `uid`, cifrado, apagado no logout. Teste e2e de troca de perfil. |
| Obfuscação quebrar o IndexedDB ou o import dinâmico | `npm run test:dist`. |
| O padrão `x-show` + utilitário do Bootstrap esconder o badge errado | `x-show.important`, seletor composto `.cg-chip.cg-chip--cat`. |
| IA inventar valor ou ser manipulada pelo conteúdo do PDF | Esquema estrito, sem ferramentas, documento tratado como dado, revisão humana obrigatória, cálculo só por regra versionada. |
| Regras do exercício 2027 ainda não publicadas | Módulo de regras por exercício. O 2027 só é ativado com a fonte oficial citada. |
| Prometer compatibilidade com a Receita sem testar | A exportação fica na Fase 9 condicional. A interface diz "guia de preenchimento", nunca "arquivo oficial". |
| Custo do Gemini | Dedup por hash antes da chamada, limite diário por usuário, extração de texto local primeiro (manda texto, não PDF, quando o texto é selecionável). |
| Google + e-mail já cadastrado com senha | O Supabase vincula automaticamente quando o e-mail é verificado. Testar o caso na Fase 8. |

## Decisões que preciso de você (não bloqueiam as Fases 1–4)

- **D1 — Exercício-alvo do IRPF:** começar validando com o **2026** (regras publicadas) e preparar o 2027? *(minha recomendação)*
- **D2 — Gemini:** você tem, ou vai criar, uma conta Google AI/Vertex **paga** (exigência de privacidade para documentos fiscais)?
- **D3 — Privacidade entre o casal:** a declaração de cada um fica visível só para o dono *(recomendado e assumido no plano)* ou o parceiro do grupo também vê?
- **D4 — Google também na linha Business?** O login é comum ao app, então assumi que **sim**.
