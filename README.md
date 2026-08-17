# CasaGrana — Controle Financeiro + Lista de Compras

PWA mobile-first (com visão mais ampla no desktop) para controle financeiro pessoal e de grupo, com lista de compras integrada. HTML/CSS/JS puro, sem build step — tudo via CDN (Bootstrap, Bootstrap Icons, Alpine.js, Chart.js, PapaParse, html5-qrcode) + Supabase como backend opcional.

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

Categorias padrão são criadas automaticamente no primeiro login de cada conta real (`ensureDefaultCategories`), então você não precisa de um script de seed separado.

## Estrutura

```
index.html                 shell único da aplicação (todas as telas)
manifest.webmanifest        PWA
sw.js                        service worker (cache do app shell + CDNs)
css/                         tokens.css (cores/spacing) · components.css · app.css
js/
  app.js                     registra os stores/componentes do Alpine
  data/
    config.js                credenciais do Supabase (placeholder = modo demo)
    mockDb.js                "banco" localStorage + seed dos dados de exemplo
    supabaseClient.js         cliente Supabase carregado sob demanda
  utils/
    format.js                moeda, datas
    status.js                regra de pago/pendente/a vencer/vencido
  services/                  cada função aqui decide sozinha se fala com o
                              mockDb (demo) ou com o Supabase (real) — as
                              telas nunca sabem qual dos dois está ativo
    auth.js · categories.js · groups.js · transactions.js
    shoppingList.js · csvImport.js · barcode.js
  components/                 um Alpine.data/Alpine.store por tela/modal
    store.js · auth.js · dashboard.js · transactionForm.js
    transactionTable.js · shoppingList.js · csvImportModal.js
    groupView.js · profileView.js · charts.js
supabase/
  schema.sql                  schema + RLS — só roda se VOCÊ rodar manualmente
assets/icons/                 ícones do PWA (SVG placeholder — ver abaixo)
```

## Sobre os ícones

`assets/icons/icon.svg` e `icon-maskable.svg` são placeholders funcionais (o manifest já aponta para eles). Antes de publicar de verdade, gere PNGs nos tamanhos 192×192 e 512×512 (e uma versão maskable) a partir de um logo definitivo — ferramentas como [realfavicongenerator.net](https://realfavicongenerator.net) fazem isso automaticamente a partir do SVG.

## O que ainda não está implementado (fora do escopo da v1)

- OCR de nota fiscal (leitura automática do valor a partir da foto).
- Geração automática de lançamentos futuros para despesas recorrentes (o campo "recorrente" hoje é só um marcador/filtro).
- Múltiplas moedas e internacionalização.
- Notificações push.

## Checklist antes de considerar "pronto para uso real"

- [ ] Testar em pelo menos um celular físico (toque, câmera do leitor de código de barras, instalação como PWA).
- [ ] Rodar `schema.sql` num projeto Supabase e testar RLS com duas contas reais.
- [ ] Substituir os ícones placeholder por PNGs definitivos.
- [ ] Revisar o texto do app com alguém fora do projeto (idealmente alguém não-técnico) para confirmar que está mesmo fácil de usar.
