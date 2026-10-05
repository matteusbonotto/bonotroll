# CHANGELOG — Palm Business

## Fase 4 + 10 (componentes e acessibilidade) — checkpoint/componentes
- **Auditoria automática** `npm run auditar` (scripts/auditar-telas.mjs; precisa do app servido em :5511): 8 telas × 320/375/768/1280/1920 px medindo alvo de toque, rolagem lateral, nome acessível, imagens sem alt, texto < 12 px e inglês na interface. **90 problemas → 0.**
- Regra única do design system: todo botão/campo ≥ 44 px (tabela densa do computador ≥ 24 px, WCAG 2.5.8). Ícones-botão (ajuda, editar cômodo/caixinha) mantêm o desenho pequeno com área de toque de 44 px.
- Nenhum texto abaixo de 12 px (badges, chips, cabeçalhos de tabela, iniciais, contador de notificações).
- Tablet (768–991 px) usa as linhas legíveis do celular em Movimentações, não a tabela densa feita para mouse.
- 26 imagens sem `alt` (decorativas) e campos sem nome (cor da foto, nome no perfil, renomear grupo) corrigidos.
- Títulos das telas iguais aos da navegação: Movimentações, Reservas, Membros da casa.
- **Tour:** a altura do balão e do painel era medida sem padding/borda — o balão podia passar da borda de baixo do celular. Corrigido na medição (borderBoxSize).

## Configurações, leitura, push e tour — checkpoint/configuracoes
- **Configurações** (antes "Perfil"): grupos curtos com título — Você · Leitura e aparência · Avisos · Ajuda · Cadastros · Seus dados — e descrições de uma linha.
- **Tamanho do texto A− / A+:** cada toque muda um passo (87,5% → 150%), com o valor mostrado, botões desativados nos limites e "Voltar ao normal". Fica salvo no aparelho (escolhas antigas Grande/Muito grande são convertidas).
- **Narração:** liga/desliga; o celular lê em voz alta o botão, campo ou texto tocado (voz do próprio aparelho, nada sai dele).
- **Push — causas raiz corrigidas:** (1) no mesmo celular, se outra pessoa da casa já tivesse ativado, o banco recusava trocar o dono da inscrição e a ativação falhava — agora gera um endereço novo para a conta atual; (2) o pedido podia nunca responder e a tela ficava presa em "Ativando…" — agora há prazo e mensagem; (3) inscrição antiga presa com outra chave é limpa e refeita; (4) erros técnicos em inglês viraram frases em português, com o texto original só em "Detalhes técnicos"; (5) permitido no aparelho mas sem registro no servidor conclui sozinho ao abrir o app.
- **Tour (7 passos)** atualizado para a navegação nova: O que precisa de você → saldo → Adicionar → as quatro áreas → Ajuda/Configurações → conclusão.

## Fase 5 (mobile-first, parte 2) — checkpoint/mobile
- **Movimentações no celular:** cada lançamento virou **uma linha legível** (quem, nome, categoria · empresa, situação com data em palavras, valor) em vez de um mini-formulário com 2 campos de data, 2 seletores e 3 botões. Tocar abre o formulário completo (onde tudo continua editável); a única ação direta é **"Marcar como pago/recebido"** / "Desfazer", com 44 px.
- Alvos de toque menores que 44 px na tela (375 px): **~293 → 0**. Barras de ferramenta (visualização, densidade, atalhos) com 44 px no celular/tablet.
- Sem rolagem lateral em 320 px.

## Fase 6 (Início) — checkpoint/dashboard
- O Início responde primeiro **"o que precisa de mim?"**: saudação por período do dia e o bloco **"Precisa de você"** (contas vencidas com o total, contas que vencem em 7 dias, itens acabando/vencendo em casa, orçamento estourado), cada um com botão que leva à tela certa. Sem pendências: "Tudo em dia".
- Saldo negativo agora também é dito **em palavras** ("Saiu mais dinheiro do que entrou neste período"), não só pela cor/sinal.
- Os 3 gráficos ficam **fechados por padrão** atrás de "Ver análises e gráficos" (menos rolagem e menos carga para quem só quer saber o que fazer).
- Orçamento estourado aparece num lugar só (Precisa de você); o card de saldo mostra só o "Restam R$ X".
- Tour: "Bem-vindo(a) ao Palm!".

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
