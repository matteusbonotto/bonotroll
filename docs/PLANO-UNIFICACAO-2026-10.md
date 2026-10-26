# Plano — BNTT único, mais simples (24/10/2026)

Pedido do dono: fundir o **BNTT Investimentos** no **BNTT**, simplificar muito a usabilidade ("eu mesmo sinto
preguiça de refazer"), resolver o que ficou confuso (compras no cartão × compras do mercado), recorrências que
sempre aparecem nos próximos meses, aviso de "deslize" quando algo está escondido pela rolagem, e uma análise de
mercado feita por agentes especialistas. Nada disto foi implementado ainda. Trabalhar em branch, deploy só com ok.

## 1. Fusão BNTT + BNTT Investimentos
Os dois já usam o mesmo Supabase (`appbntt`; Investimentos no schema `invest`) e as mesmas contas. As stacks
diferem (BNTT = JS puro + Alpine, sem bundler; Investimentos = React 19 + Vite + TS).

**Recomendação — fusão por domínio, sem reescrever (fase 1, ~1–2 dias):**
- Publicar o build do Investimentos dentro do hosting do BNTT em `bnttapp.web.app/investir/` (`base: '/investir/'`
  no Vite; o `scripts/build.mjs` do BNTT copia `../BNTT Investimentos/dist` para `dist/investir`).
- Mesmo domínio ⇒ mesma sessão do Supabase (a chave de sessão no `localStorage` é por origem): entra uma vez, vale nos dois.
- Item "Investimentos" no menu do BNTT; no Investimentos, botão "Voltar ao BNTT" e o mesmo tema/cores.
- Saldo das Caixinhas aparece como "patrimônio" no Investimentos (leitura via RPC; nada duplicado).
- Redirecionar `bntt-investimentos.web.app` → `bnttapp.web.app/investir/` (firebase.json `redirects`).
- Um só service worker no escopo raiz (o do Investimentos passa a ter escopo `/investir/` ou é removido).

**Fase 2 (opcional, depois):** migrar o BNTT para Vite também e unificar componentes. Só vale se virar produto comercial.

## 2. Compras no cartão × compras do mercado — um conceito só
Hoje são caminhos paralelos: lista de compras (`shoppingList.js`, encerra e cria transação), lançamento com
`cartao_credito` (agrupado em fatura por `groupCartaoCredito`) e o gerenciador de cartões (`cartaoManager.js`).
- **Regra única:** toda compra é uma **transação** com **forma de pagamento** (dinheiro/Pix/débito/cartão X).
  Cartão é só uma forma de pagamento; a **fatura** é uma visão (agrupamento por cartão + mês de fechamento), não um cadastro à parte.
- **Mercado** = a lista de compras. Ao "Encerrar compras", um passo só pergunta: total pago, forma de pagamento
  (cartão X ⇒ entra na fatura certa, com parcelas se houver). Sem segundo formulário.
- Navegação: "Lançamentos" (tudo), "Cartões" (faturas), "Mercado" (listas). Remover entradas duplicadas do menu.
- Migração: `cartao_credito = true` vira `forma_pagamento = 'cartao'` + `cartao_id`; manter a coluna antiga até validar.

## 3. Recorrências sempre nos próximos meses
Hoje `js/services/recurring.js` só gera até **hoje** (backfill com limite). Resultado: o mês seguinte aparece vazio.
- **Proposta:** gerar até o **fim do mês seguinte** (ou horizonte configurável: 1, 3, 6 meses) respeitando a
  cadência (semanal, mensal, anual, personalizado) e `parcela_total`. Ocorrências futuras ficam com selo "Prevista"
  e não entram no saldo realizado até a data/pagamento.
- Editar uma ocorrência pergunta: "Só esta / esta e as próximas". Desligar a recorrência apaga só as futuras não pagas.
- **Decisão do dono:** "compras recorrentes" = lançamentos recorrentes (acima) ou também itens da lista de mercado
  que voltam todo mês? Se for o segundo, a lista ganha "repetir a cada N dias/semanas/meses" e recria o item no prazo.

## 4. Aviso de "deslize" quando há conteúdo escondido
- Componente único `js/components/dicaRolagem.js` (diretiva Alpine `x-dica-rolagem`): observa contêineres com
  rolagem (tabelas, abas, carrosséis). Se há conteúdo fora da vista e a pessoa fica **9 s sem interagir**, mostra por
  **4 s** um overlay suave (mão/seta animada + "Deslize" ou "Arraste para o lado") na borda certa; some ao tocar/rolar.
- Respeita `prefers-reduced-motion` (sem animação, só o texto); para depois de 3 vezes na mesma tela por sessão.
- Aplicar primeiro na visualização em tabela (`transactionTable.js`) e nas abas com overflow.

## 5. Simplificação geral (meta: lançar um gasto em ≤ 3 toques)
- Botão "+" único → "Gasto / Entrada / Mercado"; campos avançados (recorrência, parcelas, divisão) dentro de "Mais opções".
- Início com 3 números (saldo do mês, próximas contas, faturas) e 1 lista "o que precisa de você".
- Cortar ou esconder telas pouco usadas (medir antes: contador local de uso por tela, 2 semanas).

## 6. Análise de mercado por agentes especialistas (executar depois, 1 por vez)
Seguindo a regra do dono (poucos agentes): **1 agente analista + 1 revisor**, em sequência, cada um com saída num
arquivo em `docs/mercado/`:
1. **Produto/UX** — concorrentes (Mobills, Organizze, Minhas Economias, Olivia, GuiaBolso legado, YNAB, Monarch;
   para investimentos: Kinvo, Gorila, Investidor10, Status Invest): matriz de recursos, onde o BNTT se destaca
   (casa + compras + inventário + casal num lugar só), onde perde (Open Finance, importação automática).
2. **Precificação/negócio** — preços públicos dos concorrentes, proposta de planos (grátis / casal / família), custo por usuário no Supabase.
3. **Usabilidade** — teste com 3 personas sobre as tarefas: lançar gasto, fechar mercado, ver fatura, ver investimentos.
4. **Revisor** — confere fontes, remove achismo e consolida em `docs/mercado/RESUMO.md` com as 10 ações priorizadas.

## 7. Ler a nota do mercado e lançar a compra feita (pedido de 25/10/2026)
Hoje o QR da NFC-e (`parseNfceQr`) só tira chave/valor/CNPJ e o OCR da foto (`parseReceiptText`) só total e vencimento.
- **QR da NFC-e (caminho principal, preciso):** o QR aponta para a consulta pública da SEFAZ, que lista os itens
  (descrição, quantidade, unidade, valor). O navegador não consegue ler essa página (CORS) → Edge Function
  `nfce-itens` busca a página da SEFAZ do estado e devolve os itens em JSON (começar por SP/MG/PR, que usam o
  layout padrão; cache por chave de acesso para não consultar duas vezes).
- **Foto do cupom (reserva):** OCR linha a linha → itens com quantidade e preço; a pessoa confere antes de salvar.
- **Tela de conferência:** lista dos itens com marcar/desmarcar, junta com produtos já conhecidos (mesmo nome/código),
  categoria sugerida. Ao confirmar: vira uma **compra encerrada** na lista de mercado (itens comprados, com preço) e
  **uma transação** (loja, data, total, forma de pagamento — cartão ⇒ entra na fatura), igual ao item 2.
- De quebra: histórico de preço por produto ("o leite subiu 12%") e reposição do inventário (Recursos).

## Ordem sugerida
1 (fusão por domínio) → 3 (recorrências) → 2 (cartão × mercado) → 7 (nota do mercado) → 4 (deslize) → 5 → 6.

## Estado em 25/10/2026 (branch feat/unificacao, nada publicado)
- [x] 1. Fusão fase 1: Investimentos em `/investir/` (build junto, mesma sessão, "Voltar ao BNTT", SW com escopo próprio).
  Falta: redirecionar `bntt-investimentos.web.app` → `bnttapp.web.app/investir/` (no projeto Firebase do Investimentos) e somar Caixinhas no patrimônio.
- [x] 3. Recorrências geradas até o fim do mês seguinte (e a ocorrência nova leva o `cartao_id`).
- [x] 7. Nota do mercado: QR da NFC-e (Edge Function `nfce-itens`) ou foto (OCR) → conferência → compra encerrada no Histórico + gasto (cartão ⇒ fatura).
  **Falta publicar a função:** `npx supabase functions deploy nfce-itens --no-verify-jwt`. Sem ela o QR avisa e oferece a foto.
- [x] Home do dono (Business): o painel é a Home — frase de situação, 4 números, até 3 ações (+ estoque), filiais e contas para pagar; o que era da Home doméstica não se repete embaixo.
- [x] Corrigido: "Histórico" em "Minhas listas" abria um modal escondido (só funcionava com uma lista aberta).
- [ ] 2. Cartão × mercado num conceito só · [ ] 4. Aviso de "deslize" · [ ] 5. resto da simplificação · [ ] 6. mercado.
- Testes e2e de offline (`offline-sincronizacao.spec.js`) já falhavam antes desta branch (dados demo dependentes da data).
