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
