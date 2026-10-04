# CHANGELOG — Palm Business

## Fase 5 (navegação) — checkpoint/navigation
- Navegação por intenção: **barra inferior no celular** (Início · Dinheiro · **Adicionar** · Casa · Pessoas, com ícone + texto, safe-area) e **barra lateral agrupada** no computador; sub-abas por área (Movimentações/Reservas, Lista de compras/Inventário, Membros/Saúde). As rotas antigas continuam funcionando.
- **Adicionar universal:** folha agrupada (Dinheiro: Despesa, Receita; Casa: Item para comprar, Item no inventário; Pessoas: Pessoa).
- O ☰ e o menu lateral do celular saíram (substituídos pela barra inferior).
- **Causas raiz removidas do CSS:**
  - texto da marca e título "Painel financeiro" gerados por `::before` sobre a marcação escondida com `!important`;
  - rótulos do menu por `nth-of-type`;
  - margem negativa que fazia o topo ultrapassar a largura no desktop;
  - rótulos de 10–11 px do card de saldo.
- O título do topo é o h1 real da área. Marca visível: **Palm Business** (app, aba e manifest).
- O aviso automático de "lançamentos recorrentes gerados" deixou de cobrir o topo a cada login.

## Fase 8 (Pronto Socorro / Saúde) — checkpoint/health
- **Fichas de emergência** das pessoas da casa (inclusive quem não tem conta: crianças, avós): nome, nascimento/idade, **tipo sanguíneo** (destaque vermelho), **alergias** (faixa de alerta com ícone + texto), remédios de uso contínuo, condições, contato de emergência com botão **Ligar** e observações.
- **Criptografia ponta a ponta:** chave de dados AES-256-GCM criada no aparelho; vai ao servidor só embrulhada pela **senha da família** e por um **código de recuperação** mostrado uma vez (PBKDF2-SHA256, 310 mil iterações). O aparelho guarda a chave como não extraível (IndexedDB), então numa emergência a ficha abre sem senha. "Trancar neste aparelho" esquece a chave.
- Ordem da tela Saúde: ligar (números) → fichas → "o que fazer" (guias).
- Banco: `supabase/saude-2026-10.sql` (tabelas `cofres` e `fichas_saude` com RLS) — junto com o endurecimento em `supabase/APLICAR-NO-SQL-EDITOR-2026-10.sql`.
- Testes: unitário de criptografia (ida e volta, senha e código errados, troca de senha) e e2e (o dado salvo não contém o nome nem a alergia em texto).

## Fase 9 (notificações) — checkpoint/notifications
- **Diagnóstico:** o servidor aceita as inscrições (testado com a chave de serviço), mas a produção tinha **0 inscrições**. O app tratava "bloqueado pelo navegador", "fechou o pedido", "iPhone sem o app instalado" e "inscrição que não chegou ao servidor" tudo como "Permissão negada". Agravante: a troca de endereço (github.io → web.app) zera a permissão concedida antes.
- **Correção:** `estadoPush()` lê o estado real (não suportado · precisa instalar no iPhone · bloqueado · não pedido · ativo · só no aparelho), conferindo no servidor se a inscrição existe. O switch foi trocado por um **estado escrito + a ação certa**: bloqueado mostra o passo a passo para liberar e um botão "Já liberei — verificar de novo"; o iPhone explica como instalar; "só no aparelho" oferece concluir.
- e2e com permissão simulada (bloqueada e não pedida).
