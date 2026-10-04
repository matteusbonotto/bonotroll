# Problemas consolidados (baseline) — P0 a P3

Fontes: feedback do usuário (2026-10-04), medição em 13 resoluções, `docs/REVISAO-UX-2026-10.md` (5 personas), `docs/AUDITORIA-SEGURANCA-2026-10.md`.

| # | Prioridade | Sintoma | Causa raiz | Fase que resolve |
|---|---|---|---|---|
| 1 | **P0** | Falha crítica de RLS: qualquer pessoa logada entra num grupo como admin | Policy de INSERT em `group_members` | 12 (migração pronta; precisa de acesso ao banco) |
| 2 | **P0** | Push "negado" mesmo ligando o switch | Fluxo só distingue concedido/não concedido; permissão bloqueada no navegador e troca de endereço (github.io → web.app) não são explicadas | 9 |
| 3 | **P0** | Pronto Socorro não guarda tipo sanguíneo, alergias, remédios nem contato de emergência | Não existe entidade de ficha médica (modelo de 2 pessoas) | 8 (precisa de migração) |
| 4 | **P1** | Usuário fica perdido / "não sei o que fazer aqui" | Navegação por estrutura técnica (Transações, Caixinhas, Recursos); Início com muitos cartões e números sem hierarquia de atenção | 2 e 6 |
| 5 | **P1** | Mobile com "acabamento de protótipo" | Monólito de markup + breakpoints ad hoc + 146 estilos inline; alvos de toque pequenos (Transações: 293 < 44 px); texto < 12 px fora dos tokens | 4 e 5 |
| 6 | **P1** | Acessibilidade superficial | Correções pontuais (CSS) sem semântica base: listas/tabelas, headings, landmarks, foco por modal; ícones sem texto | 10 |
| 7 | **P1** | Formulário de lançamento longo e assustador | Todos os campos de uma vez (o tour antigo tinha 17 passos só nele) | 7 |
| 8 | **P1** | Membros sem informações importantes (contato, nascimento, papel) | `profiles` só tem nome/cor/avatar; grupo sem papéis além de admin/membro | 7–8 (migração) |
| 9 | **P2** | Inconsistências visuais (azul do card de saldo × verde da marca, ícones soltos, cards dentro de cards) | Sem design system de componentes, só tokens de cor | 3 e 4 |
| 10 | **P2** | Estados de carregando/vazio/erro diferentes em cada tela | Componentes não padronizados | 4 |
| 11 | **P2** | Barra do topo ultrapassa a largura no desktop | Largura do topo calculada sem descontar a barra lateral | 5 |
| 12 | **P2** | Visão empresa (unidades, funcionários, permissões, fornecedores) inexistente | Produto nasceu para 2 pessoas | 2 (desenho) e 7 (dados, com migração) |
| 13 | **P3** | Tabela de Transações pouco densa no desktop, sem totais | — | 7 |

## Bloqueio transversal
As fases 7, 8 e 12 precisam de **acesso de escrita ao schema do banco**: a CLI do Supabase desta máquina está logada noutra conta (403 no `appbntt`). Opções:
1. `npx supabase login` com a conta do BNTT — **recomendado**;
2. colocar no `.env` um `SUPABASE_ACCESS_TOKEN` da conta do BNTT.

Até lá, as fases de interface avançam e os dados novos ficam prontos em migração.
