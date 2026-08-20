# Bõnotto — Controle Financeiro + Compras + Inventário Doméstico

PWA mobile-first (com visão mais ampla no desktop) que unifica controle financeiro pessoal e de grupo (com divisão de despesa entre pagadores), lista de compras, inventário doméstico ("Recursos") e reserva financeira ("Caixinhas", com moeda própria e conversão ao vivo). HTML/CSS/JS puro, sem build step — tudo via CDN (Bootstrap, Bootstrap Icons, Alpine.js, Chart.js, PapaParse, html5-qrcode, pdf.js, Tesseract.js) + Supabase como backend opcional.

Documentação técnica completa em [`docs/RAIO-X-2.0.md`](./docs/RAIO-X-2.0.md) e no diagnóstico original [`docs/RAIO-X-DO-PROJETO.md`](./docs/RAIO-X-DO-PROJETO.md).

Construído a partir do prompt em [`prompt-app-controle-financeiro.md`](./prompt-app-controle-financeiro.md).

## Rodando agora (modo demonstração)

O app **já funciona sem nenhuma configuração**. Enquanto o Supabase não estiver plugado, ele roda 100% em modo demonstração: os dados ficam salvos em `localStorage` do navegador, com dois perfis de exemplo (Matheus e Beatriz) e os lançamentos da planilha que você mandou já cadastrados.

Para abrir localmente, sirva a pasta com qualquer servidor estático (não pode ser aberto direto como `file://` porque os módulos ES e o service worker exigem `http://`):

```bash
# opção 1 — Python
python -m http.server 5500

# opção 2 — Node
npx serve .
```

Depois acesse `http://localhost:5500`. Na tela de entrada, clique em "Entrar como Matheus" ou "Entrar como Beatriz" para ver o app com dados diferentes (e ver a agregação do grupo funcionando).

Para restaurar os dados de demonstração ao estado original, use o botão em **Perfil → Restaurar dados de exemplo**.

Mesmo depois de conectar o Supabase real (próxima seção), dá pra ver o modo demonstração a qualquer momento acessando com `?demo=1` na URL (ex.: `http://localhost:5500/?demo=1`) — nunca precisa editar `js/data/config.js` pra isso. É o mesmo mecanismo do link "Ver demonstração" que aparece na tela de entrada quando o Supabase já está configurado.

## Conectando o Supabase de verdade

Isso é 100% opcional e só deve ser feito quando você estiver pronto (e logado na conta certa do Supabase). Nada neste repositório se conecta a nenhuma conta sozinho.

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra o **SQL Editor** do projeto e rode o conteúdo de [`supabase/schema.sql`](./supabase/schema.sql) — ele cria as tabelas, o trigger que gera o perfil no cadastro e todas as políticas de RLS (cada usuário só vê os próprios dados ou os do grupo do qual participa).
3. (Opcional, para fotos/comprovantes) Em **Storage**, crie um bucket privado chamado `anexos`. Depois descomente e rode as duas policies no final do `schema.sql`.
4. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.
5. Edite [`js/data/config.js`](./js/data/config.js) e cole os dois valores:
   ```js
   export const SUPABASE_URL = 'https://xxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'ey...';
   ```
6. Salve. O app detecta automaticamente que não são mais os valores placeholder e passa a usar o Supabase real — a tela de entrada troca os botões de demonstração por um formulário de e-mail/senha (cadastro cria a conta e o perfil na hora).

Categorias e cômodos de Recursos padrão são criados automaticamente no primeiro login/primeiro acesso de cada conta real (`ensureDefaultCategories` / `ensureDefaultRooms`), então você não precisa de um script de seed separado.

### Notificações push + keepalive (opcional, requer passos manuais)

A central de notificações (sino no topo) já funciona sozinha, em qualquer modo. Push de verdade (chegar com o app fechado) e o keepalive do projeto (não pausar por inatividade) exigem alguns comandos de terminal e rodar um SQL a mais — passo a passo completo em [`supabase/NOTIFICACOES.md`](./supabase/NOTIFICACOES.md).

## Estrutura

```
index.html                 shell único da aplicação (todas as telas + modais)
manifest.webmanifest        PWA
sw.js                        service worker (cache do app shell + CDNs + push)
css/                         tokens.css (cores/spacing/tipografia) · components.css · app.css
js/
  app.js                     registra os stores/componentes do Alpine + fluxo de atualização do PWA
                              + comportamento global de overlay (scroll-lock, Esc, devolução de foco)
  data/
    config.js                credenciais do Supabase (placeholder OU ?demo=1 = modo demo)
    vapid.js                 chave pública VAPID (push) — a privada nunca fica no repo
    mockDb.js                "banco" localStorage + seed dos dados de exemplo
    supabaseClient.js         cliente Supabase carregado sob demanda
  utils/
    format.js                moeda (BRL + Caixinhas multi-moeda), datas
    status.js                regra de pago/pendente/a vencer/vencido + validade/estoque de Recursos
    money.js                 Money Engine — soma/divide dinheiro em centavos inteiros, nunca float
    image.js                 redimensiona imagem (Canvas) antes de upload de avatar/ícone/logo
    dbFallback.js             tolera coluna ainda não migrada no banco da pessoa
  services/                  cada função aqui decide sozinha se fala com o
                              mockDb (demo) ou com o Supabase (real) — as
                              telas nunca sabem qual dos dois está ativo
    auth.js · categories.js · companies.js · groups.js · transactions.js
    resources.js · notifications.js · push.js · budgets.js · recurring.js
    caixinhas.js · fx.js (cotação ao vivo) · shoppingList.js · csvImport.js
    barcode.js · ocr.js · pdf.js
  components/                 um Alpine.data/Alpine.store por tela/modal
    store.js · auth.js · dashboard.js · transactionForm.js
    transactionTable.js · shoppingList.js · resourcesView.js · caixinhasView.js
    csvImportModal.js · groupView.js · profileView.js · categoryManager.js
    budgetManager.js · charts.js
supabase/
  schema.sql                  schema + RLS — só roda se VOCÊ rodar manualmente
  seed.sql                    popula um projeto real com o mesmo dataset do modo demo
  notifications_push.sql      trigger + agendamentos (pg_cron) das notificações — opcional
  functions/                  Edge Functions: keepalive · notify-scan · notify-payment
  NOTIFICACOES.md              passo a passo do push real + keepalive
assets/icons/                 favicon, ícone do manifest, ícone maskable e apple-touch-icon (PNG)
assets/logos/                 logo Bõnotto original (colorida/branco/preto/verde), fonte dos ícones acima
```

## Testes

O app em si continua sem build step. `package.json`/`node_modules` existem só como *tooling de teste* (Playwright + o test runner nativo do Node), não afetam como o app roda no navegador.

```bash
npm install              # uma vez
npm run test:unit        # funções puras (dinheiro, data, status) — rápido, sem navegador
npm test                 # E2E (Playwright) contra o app real em modo demo (?demo=1, nunca toca em js/data/config.js)
```

Ver `docs/BONOTTO-2027-BLUEPRINT.md` (Fase 1) e `docs/RAIO-X-2.0.md` (§5) para o porquê: cobre primeiro os bugs que já se repetiram mais de uma vez em produção.

Roda automaticamente a cada push/PR contra `main` via GitHub Actions ([`.github/workflows/tests.yml`](./.github/workflows/tests.yml)) — só testa, não builda nem faz deploy (isso continua manual, como sempre foi).

## Sobre os ícones

`assets/logos/` tem a logo original em 4 variantes (colorida, branco, preto, verde), a partir das quais `assets/icons/icon.svg` (favicon + manifest), `icon-maskable.svg` (ícone adaptativo Android, fundo cheio) e `apple-touch-icon.png` (PNG raster — iOS não confia em SVG pra isso, nem pro splash screen que ele gera sozinho a partir dele) foram montados. Pra gerar variações novas a partir da logo (ex.: outros tamanhos de PNG), reaproveite o mesmo recorte/posicionamento já usado nesses dois SVGs como referência.

## O que ainda não está implementado

- Ponte automática entre Compras e Recursos (comprar "Arroz" não decrementa o estoque de Recursos sozinho — decisão deliberada, ver `docs/BONOTTO-2027-BLUEPRINT.md` §8: o risco de casar nome errado (falso-positivo) supera o ganho por enquanto).
- Múltiplas moedas fora de Caixinhas (Transações/Compras continuam só em BRL; Caixinhas já suporta BRL/USD/EUR/GBP/USDT/BTC/ETH com conversão ao vivo).
- Severidade/priorização de notificação (info/atenção/alerta/crítico) — hoje todo evento chega com o mesmo peso visual.
- Notificações push e keepalive **funcionam de ponta a ponta em produção**, mas exigem alguns passos manuais únicos (deploy de Edge Functions, chaves VAPID, agendamento) — ver [`supabase/NOTIFICACOES.md`](./supabase/NOTIFICACOES.md).

Já implementado (histórico: este README ficou desatualizado por um tempo dizendo o contrário) — OCR de nota fiscal, geração automática de lançamentos recorrentes, CRUD completo de cômodo/subcategoria em Recursos, divisão de despesa entre múltiplos pagadores, leitura offline de boleto/Pix, importação de CSV/PDF, e o módulo Caixinhas inteiro.

## Checklist antes de considerar "pronto para uso real"

- [ ] Testar em pelo menos um celular físico (toque, câmera do leitor de código de barras, instalação como PWA).
- [ ] Rodar `schema.sql` num projeto Supabase e testar RLS com duas contas reais.
- [ ] Substituir os ícones placeholder por PNGs definitivos.
- [ ] Revisar o texto do app com alguém fora do projeto (idealmente alguém não-técnico) para confirmar que está mesmo fácil de usar.
