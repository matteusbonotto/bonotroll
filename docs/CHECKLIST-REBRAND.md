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
- [~] **Tabela de Transações não usa a largura disponível no desktop** — INVESTIGADO, não resolvido: tentei forçar `width`/`max-width` menor em `input[type="date"]` e `.cg-pill-trigger` (Resp.) — sem efeito nenhum, confirmado via computed style (o Chromium impõe ~150px de largura mínima própria pro controle nativo de data, CSS de largura não controla isso). Correção de verdade precisa trocar o input sempre-editável por um texto formatado que só vira `<input type="date">` ao clicar (mudança estrutural, não CSS solto) — fica pra próxima rodada.
- [x] **Cor da barra de instalação/atualização muito clara/feia** — era efeito colateral do fix de tema escuro (`--color-primary-dark` virou claro, usado como fundo sólido aqui). Trocado pra `--color-primary`. Commit `fd74324`.
- [x] **Logo de empresa/serviço nunca aparecia em "Lançamentos recentes" (Início)** — não era "só aparece se dividida", era um widget que nunca tinha lógica de logo nenhuma, só avatar-stack de pagadores. Adicionada. Commit `fd74324`.

## Pedidos de redesign (prioridade 2 — visual agressivo, item por item)

- [ ] Aparência geral ainda parecida demais com a versão anterior — quer algo visualmente mais distinto/moderno em TODO o projeto, não só nos pontos já tocados.
- [x] Modal de "Nova despesa" muito poluído — seções com rótulo (Detalhes/Quem paga/Quando/Comprovante). Commit `16eecbe`.
- [ ] Filtros de Transações mal posicionados/feios (o grupo Agrupar + Período/Responsável/Movimentação/Categoria) — reposicionar e redesenhar.
- [x] Modos de visualização de Transações — reestruturado em 2 eixos independentes: `layout` (lista|grade) × `densidade` (normal|compacta), livremente combináveis (lista compacta agora existe). Agrupar continua terceiro filtro independente. Commit `35e40c9`.
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
