# REVISÃO DE ACESSIBILIDADE (baseline)

| Critério (WCAG 2.2) | Situação | Ação (fase) |
|---|---|---|
| 1.4.3 Contraste | Saldo negativo em branco sobre azul sem cor/ícone de alerta; chips coloridos com texto branco pequeno | Tokens de contraste AA e estados com ícone + texto (3, 4) |
| 1.4.4 / 1.4.10 Redimensionar / Reflow | "Tamanho do texto" escala o app; sem rolagem horizontal em 13 resoluções | Manter; testar a 200% (10) |
| 2.5.8 Tamanho do alvo | 293 alvos < 44 px em Transações; 7–10 nas outras | Lista sem campos editáveis por linha; componentes com 44 px (4, 7) |
| 1.3.1 Informação e relações | Listas e tabelas montadas com `div`; headings fora de ordem; um único `role=main` | HTML semântico: `ul/li`, `table` real, h1 por tela (4, 10) |
| 2.4.1 Bypass blocks | "Pular para o conteúdo" existe | Manter |
| 2.4.3 Ordem do foco / 2.4.11 | Modais sem foco preso; Esc inconsistente | Componente Modal/BottomSheet único com foco preso e Esc (4) |
| 3.3.1 / 3.3.3 Erros | Validação nativa do navegador ("Preencha este campo") | Mensagens próprias perto do campo (4) |
| 4.1.3 Mensagens de status | Toast com `role=status` | Manter; padronizar sucesso/erro (4) |
| 2.3.3 Movimento | Sem `prefers-reduced-motion` global | Tokens de movimento respeitando reduced motion (3) |
| Ícone sem texto | Ajuda unificada; ainda há ícones-ação sem rótulo nas linhas | Ícone + texto nas ações principais (4) |
