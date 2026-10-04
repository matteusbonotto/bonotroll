# ARQUITETURA atual (baseline)

| Camada | Hoje | Observação |
|---|---|---|
| Markup | **1 único `index.html` com 4.139 linhas**: 8 telas + 38 modais sempre montados (x-show) | Raiz de acoplamento: qualquer seletor sem escopo pega elemento de outra tela; difícil evoluir |
| Estado | Alpine.js 3 — 12 stores globais (`app`, `txModal`, `csvModal`, `categoryModal`, `companyModal`, `budgetModal`, `caixinhaModal`, `bankModal`, `cartaoModal`, `onboarding`, `faq`, `camera`) + 46 `x-data` | Um store por modal |
| Dados | 20 services (`js/services/*`) — fronteira única UI↔dado; modo demo (localStorage) espelha o Supabase | **Bom e deve ser preservado** |
| Backend | Supabase: 23 tabelas com RLS, 3 Edge Functions (push), Storage | Endurecimento pronto e não aplicado (`supabase/endurecimento-2026-10.sql`) |
| CSS | `tokens.css` + `components.css` (1.841 linhas) + `app.css` (1.305) + Bootstrap 5 via CDN | 33 media queries em 8 breakpoints diferentes (420, 419.98, 480, 576, 767, 768, 991.98, 992); 146 `style=` inline; 16 `!important` |
| Hospedagem | Firebase Hosting (`dist/` minificado + obfuscado), CSP estrita, SW network-first | GitHub Pages antigo redireciona |
| Testes | node --test (funções puras) + Playwright e2e (demo) | Faltam: e2e por resolução e acessibilidade automatizada |

## Causas raiz arquiteturais
1. **Monólito de markup.** O `index.html` único e as telas sempre montadas fazem cada mudança virar exceção local, e explicam o histórico de "correção sobre correção" (`docs/CHECKLIST-REBRAND.md`).
2. **Responsividade sem contrato.** Os breakpoints são ad hoc por componente, não há escala de layout, e os estilos inline driblam os tokens.
3. **Componentes sem estados padronizados.** Cada tela trata de um jeito o carregando, o vazio, o erro e o sucesso.
4. **Navegação por estrutura técnica.** Transações, Caixinhas, Recursos: nomes que mostram o sistema, não a intenção.
5. **Modelo de dados doméstico de 2 pessoas.** Não há entidades para unidades/filiais, funcionários com papéis, contatos nem ficha médica — a visão Palm Business exige migração de banco (bloqueada: a CLI não acessa o projeto `appbntt`).

## O que precisa sobreviver (inventário funcional)
Lançamentos (fixa/variável, recorrência, parcelas, divisão entre pagadores, cartão/fatura, comprovante, OCR/PDF/código de barras/Pix/NFC-e), orçamentos por categoria, várias listas de compras (planejar → comprar → encerrar, histórico, histórico de preços), inventário por cômodo/subcategoria com validade e sugestão de compra, caixinhas multimoeda, grupo com convite, notificações (central + push), importação/exportação de planilha, exportar dados, modo demonstração, tour/Central de tutoriais/FAQ, Primeiros socorros, câmera do app, tamanho do texto, modo escuro.
