# NAVEGAÇÃO

## Celular (até 991 px)
- **Barra inferior fixa** (zona do polegar): Início · Dinheiro · **[+ Adicionar]** · Casa · Pessoas. Ícone + **texto sempre visível**; alvo ≥ 48 px; respeita `safe-area-inset-bottom`; a área ativa tem cor + traço + `aria-current="page"`.
- Topo: título da área (h1), Ajuda (texto) e avatar (Perfil). O ☰ sai.
- Sub-abas (ex.: Movimentações · Reservas) logo abaixo do título, com rolagem horizontal se não couber.
- Voltar: o botão Voltar do celular funciona entre áreas e sub-abas (history).

## Computador (≥ 992 px)
Barra lateral com as mesmas 4 áreas + botão "Adicionar" em destaque; mesmo vocabulário.

## Regras
1. Nenhuma função importante fica a mais de 2 toques do Início.
2. Toda tela responde: onde estou (título), o que posso fazer (ação principal visível), como volto (barra inferior/voltar).
3. Rotas antigas (`#/transacoes`, `#/caixinhas`, `#/compras`, `#/recursos`, `#/grupo`, `#/socorros`) continuam funcionando e abrem a área/sub-aba nova.
