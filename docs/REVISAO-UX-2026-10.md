# Revisão de usabilidade e acessibilidade com personas — 2026-10-04

Personas: (1) idosa de 70 anos, (2) criança de 10, (3) iniciante, (4) quem vem de planilha, (5) usuário avançado. Telas testadas em 375 e 1280 px, com dark mode, tour e Central de tutoriais.

| ID | Prioridade | Achado | Correção | Status |
|---|---|---|---|---|
| C1 | Crítico | Importar CSV: "1.234,56" ou "R$ 10,00" vira R$ 0,00 sem aviso | `parseValorBR` com erro por linha | Corrigido nesta rodada |
| C2 | Crítico | Tour: passo "Salvar" trava (não dá para pular, balão no lugar errado, obriga a criar lançamento real) | Novo tour | Fase de acessibilidade |
| A1 | Alto | Tour de 19 passos, 17 sobre um único formulário | Tour de 6 passos puláveis; dicas nos campos | Fase de acessibilidade |
| A2 | Alto | Exportar não casa com importar (colunas, separador `,`, valor "34.9" quebra no Excel pt-BR) | Mesmas chaves do importador, `;`, "1234,56", dd/mm/aaaa, .xlsx | Fase de acessibilidade |
| A3 | Alto | Importação não ajuda quem vem da planilha (só .csv, "Choose File", modelo sem exemplo, sem validação por linha, não lembra o mapeamento) | Assistente: .xlsx/colar, amostra, validação, sinônimos, memória | Fase de acessibilidade |
| A4 | Alto | Tabela pouco densa, cortada no desktop, sem atalhos | Compacta, cabeçalho fixo, totais, atalhos N, / e E | Fase de acessibilidade |
| A5 | Alto | Fontes < 12 px e contraste fraco no card azul | Mínimo de 12 px, valores de 14–16 px, controle "Tamanho do texto" | Fase de acessibilidade |
| A6 | Alto | Alvos de toque < 44 px (ajuda 20 px, editar 22 px, fechar 21 px…) | 44 px mínimo | Fase de acessibilidade |
| A7 | Alto | 4 ícones sem texto no topo; ajuda espalhada; avatar cortado em 375 px | Botão único "Ajuda", tema no Perfil | Fase de acessibilidade |
| M1–M6 | Médio | Toast sobre o topo, banner de demo grande, campos sem rótulo, foco inconsistente, jargão, card azul destoa da marca, cards de transação grandes | ver relatório | Fase de acessibilidade |
| B1–B5 | Baixo | Estado vazio, botão de tema, seletor de visualização, importação em 3 lugares, textos longos | ver relatório | Backlog |

## Novo tour proposto (6 passos, todos puláveis, nenhum cria dado real)

1. Boas-vindas, com a pergunta "Você já usa planilha?".
2. Saldo e o botão "Nova despesa".
3. Onde fica cada tela.
4. Formulário pré-preenchido: só Título, Valor e Salvar (sem salvar de verdade).
5. Botão único de Ajuda.
6. "Vindo de planilha?" → Importar.

## Plano de migração de planilha

1. Base: valores e colunas simétricos entre exportar e importar.
2. Entrada única "Importar da planilha" com modelo de exemplo.
3. Assistente com validação linha a linha.
4. Criar categorias, cômodos e empresas que faltarem.
5. Memória do mapeamento e "Desfazer importação".
6. Guia "o que você fazia na planilha, no BNTT".
