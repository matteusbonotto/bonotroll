# Checklist — Rebrand visual (rodada Codex + continuação)

> Criado em 2026-08-20 porque a sessão atingiu ~90% de uso. Serve pra não
> perder o fio se a sessão cortar no meio — qualquer continuação (outra
> sessão, outro agente) deve ler isto primeiro pra saber exatamente o que já
> foi feito e o que falta, sem precisar redescobrir. Cada item marcado [x]
> foi verificado rodando o app de verdade (screenshot ou teste), não só
> "deveria funcionar".

## Bugs objetivos (prioridade 1 — não é gosto, é quebrado)

- [x] Tabela cortando as laterais + scroll horizontal da PÁGINA inteira (bug do `.cg-topbar` com margem negativa vazando) — corrigido, commit `34424fb`.
- [x] Tema escuro incompleto (`--color-primary-dark`, sombras, gatilho de sistema faltando) — corrigido, commit `34424fb`.
- [x] `<input type="color">` virando blob oval — corrigido, commit `34424fb`.
- [x] Botão "Nova despesa" ilegível no escuro — corrigido, commit `34424fb`.
- [x] **Sidebar não fica fixa/sticky no desktop** — causa raiz: era regressão MINHA (o `overflow-x:hidden` que eu tinha posto em `.cg-app-shell` pra outro bug fazia o navegador computar `overflow-y:auto` nele também, virando a âncora errada do `position:sticky`). Movido pra `.cg-main` (irmã da sidebar). Verificado rolando 1500px via Playwright.
- [ ] **Tabela de Transações não usa a largura disponível no desktop** — mesmo com espaço de sobra, as colunas ficam com largura fixa somada maior que o container, forçando scroll horizontal que não deveria ser necessário nessa largura de tela.
- [ ] **Cor da barra de instalação/atualização muito clara/feia** (`.cg-update-banner` ou similar) — trocar por algo mais sóbrio, alinhado à paleta nova.
- [ ] **Logo de empresa/serviço só aparece quando a despesa é dividida** — deveria aparecer sempre que a transação tiver uma empresa com logo cadastrado, dividida ou não.

## Pedidos de redesign (prioridade 2 — visual agressivo, item por item)

- [ ] Aparência geral ainda parecida demais com a versão anterior — quer algo visualmente mais distinto/moderno em TODO o projeto, não só nos pontos já tocados.
- [ ] Modal de "Nova despesa" muito poluído — precisa de hierarquia/organização, não só empilhar tudo.
- [ ] Filtros de Transações mal posicionados/feios (o grupo Agrupar + Período/Responsável/Movimentação/Categoria) — reposicionar e redesenhar.
- [ ] Modos de visualização de Transações — problema estrutural:
  - "Lista" não funciona em desktop.
  - "Tabela" é o que está sendo aplicado de fato.
  - "Grade" funciona mas pode melhorar.
  - "Grade compacta" existe, mas não existe "lista compacta".
  - Pedido: separar em dois eixos independentes — **lista vs. grade** × **normal vs. compacto** — mais o agrupamento como um terceiro filtro independente (isso já existe como conceito, só precisa the UI refletir bem).
- [ ] Lista de Compras — refazer a visualização inteira.
- [ ] Lista de Compras — "adicionar item" deve ser um modal padrão (hoje é um formulário inline expansível).
- [ ] Recursos — refazer cômodos/subitens e a visualização deles.
- [ ] Caixinhas — refazer aparência (mais visual, alinhado, padronizado — a estrutura já é boa, é questão de polish visual agressivo).
- [ ] Perfil/Configurações — refazer a tela inteira, "está horrível" (palavras do usuário).
- [ ] Perfil — a linha "Caixinhas" deveria gerenciar bancos/imagens ali mesmo (como Empresas/Categorias), não só ser um atalho pra tela de Caixinhas.

## Ordem de execução planejada

1. Bugs objetivos (lista acima) — em andamento agora.
2. Modos de visualização de Transações (é a base estrutural que os outros redesigns de tela vão seguir).
3. Modal de despesa (reorganizar em seções/etapas).
4. Filtros de Transações.
5. Compras (visualização + modal de item).
6. Recursos.
7. Caixinhas.
8. Perfil/Configurações.

## Como continuar se a sessão cortar aqui

- Tudo commitado até aqui está em `git log` na branch `bonotto-2027-blueprint`.
- Rodar `npm run test:unit && npm test` pra confirmar que nada quebrou antes de continuar.
- Servidor local: `python -m http.server 5500`, acessar `http://localhost:5500/?demo=1`.
