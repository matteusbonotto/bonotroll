# CHANGELOG — BNTT (reconstrução "Palm")

> 2026-10-05: o nome voltou a ser **BNTT** (decisão do usuário), com duas linhas: **BNTT Home** (verde) e **BNTT Business** (azul). As entradas abaixo citam "Palm" porque eram o nome na época.

## Alinhamento de ícones e botões — checkpoint/alinhamento
- Causa raiz: o Bootstrap Icons desce o desenho do ícone 0,125em; dentro de botões/chips/menus o ícone ficava mais baixo que o texto. Agora todo ícone é uma caixa centralizada e todo botão centraliza o conteúdo nas duas direções.
- 43 botões só com ícone viraram círculos perfeitos de 44×44 (antes ficavam ovais pelo espaçamento lateral).
- "Ajuda" no topo virou só o ícone, igual ao sininho.

## Business simples: tutoriais, demonstração realista e casas — checkpoint/demo-negocio
- **Tutoriais do Business** (Central mostra só os da linha em uso): "Crie sua empresa", "Cadastre suas filiais", "Chame sua equipe", "Escolha o papel de cada pessoa". No Home: "Cadastre suas casas".
- **"Comece aqui"** na Equipe do Business: 3 passos (empresa → filiais → equipe e papéis), com "Me mostre"; some quando tudo está feito.
- **Demonstração realista:** Lucas é dono de **4 padarias** (Business: Marina gerente, Diego funcionário, Sônia contadora; vendas, insumos, aluguel e energia por padaria, folha e impostos gerais) e de **2 casas** (Home: Casa e Casa da praia, com a Carla). A tela de entrada da demonstração mostra só as pessoas da linha, com o papel. Na demonstração vale o plano mais completo da linha.
- **Casas no Home:** a mesma ideia das filiais ("Todas as casas", campo "Casa" no lançamento). Plano Família: até 2 casas (app, banco e Stripe atualizados).
- Escopo da demonstração corrigido: "do grupo aberto ou pessoal sem grupo" (antes, as contas da casa apareciam nas padarias).
- Topo do celular: "Ajuda" só com o ícone; excluir filial discreto.

## Tutoriais por tela, push consertado, e-mail, Primeiros socorros e acabamento — checkpoint/acabamento
- **Push — causa raiz do servidor:** o projeto novo do Supabase nunca recebeu as chaves do push (VAPID) nem o segredo do agendador; as funções de aviso recusavam toda chamada (401 a cada 5 min). Chaves novas geradas e configuradas (cofre do banco + funções); chamada do banco → função agora 200.
- **Push — celular:** pedido de permissão com prazo (o Chrome às vezes não mostra o pedido e nada acontecia); estado "o celular não mostrou o pedido" com o caminho para liberar; **Diagnóstico deste aparelho**; botão **Enviar notificação de teste** (função `push-teste`).
- **Tutorial na 1ª visita a cada tela** (Movimentações, Reservas, Compras, Inventário, Pessoas, Saúde, Configurações) — curto, pulável, uma vez por tela.
- **Primeiros socorros:** menu de 3 caminhos (Emergência, Sintomas, Informações dos membros), cada situação em página própria com passos grandes, "Não faça" e o 192 sempre à mão.
- **Lista de compras:** grade e compacta viraram fichinhas de papel (pauta, margem, letra de mão), 2 por linha no celular.
- **E-mail:** link de confirmação/recuperação funciona aberto em outro aparelho (fluxo implicit), botão "Reenviar e-mail de confirmação", modelos em português e guia `docs/CONFIGURAR-EMAIL.md` (o Supabase só envia para a equipe sem SMTP próprio).
- **Distribuição e escala (auditoria de UX por agente):** faixa de demonstração em 1 linha, abas como controle segmentado, saldo sempre na cor da marca (negativo em destaque), números do saldo lado a lado no celular, ações rápidas legíveis, "Precisa de você" com até 3 itens + "Ver mais", sem rolagem dentro de rolagem, títulos em escala, "Marcar como pago" e "Remover" discretos, "+" e barra inferior alinhados, Configurações em coluna única, largura de leitura em telas grandes.
- Tutorial só é marcado como visto quando aparece de fato (antes, sair da tela no meio segundo de espera fazia ele nunca aparecer).

## Segurança no servidor, exclusão de conta e cartões quadrados — checkpoint/seguranca
- **Limites dos planos no banco** (`supabase/seguranca-planos-2026-10.sql`): lançamentos/mês, listas abertas, fichas de saúde, unidades e pessoas são recusados pelo servidor ("BNTT_LIMITE"), não só na tela — chamar a API direto não passa mais por cima. Plano que vale = o melhor entre o da pessoa e o de quem criou a casa/empresa. O app lê o plano do servidor (`bntt_meu_plano`) e transforma a recusa no aviso "Disponível em outro plano". Teste unitário garante app e banco com os mesmos limites.
- **Permissões mínimas:** sem login não se toca em tabela nem função nenhuma; logado não tem TRUNCATE/TRIGGER/REFERENCES; funções do banco liberadas só as que o app usa. Anexos: até 10 MB, só imagem e PDF.
- **Testes de invasão** guardados: `node scripts/teste-seguranca.mjs` (por fora: 24/24 bloqueados) e `supabase/testes/invasao-logado.sql` (logado: 16/16 bloqueados, tudo desfeito no fim).
- **Excluir minha conta** (LGPD): Configurações → pede a senha de novo → cancela a assinatura no Stripe, apaga arquivos e a conta (dados em cascata). Função `excluir-conta`.
- **Cartões quadrados de novo:** o lápis de editar (Inventário, subcategorias, Reservas) voltou a ser pequeno no canto superior direito. Causa: uma regra genérica de acessibilidade com `position: relative` anulava o `absolute` do lápis. A auditoria agora mede a área de toque invisível (::after).

## LP com o visual original + banco e webhook em produção — checkpoint/lp-original
- **LP volta à identidade original** (escura, Anton, grão, brilho, pilares B·N·T·T, scroll-reveal, parallax) com o conteúdo novo: Casa/Negócio (Business com a mesma estética em azul), planos Mensal/Anual (−20%), chamada final para o app, demonstração, Termos e Privacidade.
- **Banco de produção atualizado** (backup antes em backups/bntt/2026-10-05-antes-sql-final, contagens conferidas depois): endurecimento de segurança (fim da inserção direta em group_members), fichas de saúde (cofres, fichas_saude) e Business (unidades, papéis, regras no servidor).
- **Webhook do Stripe publicado** (`stripe-webhook`), endpoint criado no Stripe e segredos configurados; testado: sem assinatura → 400, evento irrelevante → ignorado, conta inexistente → 404.

## BNTT Home / Business, LP, planos e Stripe — checkpoint/linhas
- **Nome e marca de volta para BNTT** (logo, ícones v=4, cor do tema).
- **Acessibilidade no menu do avatar:** texto A−/A+, Narração e Tema escuro como chaves liga/desliga.
- **Configurações enxutas:** linhas só com título; acessibilidade saiu de lá; grupo "Seu plano".
- **Push no app instalado:** instruções certas para PWA (Informações do app → Notificações; e o bloqueio herdado do Chrome).
- **LP na raiz** (`/`), app em **`/app`**: escolha Casa/Negócio, 4 planos por linha, **Mensal/Anual (−20%)**, FAQ, Termos e Privacidade (`termos.html`, `privacidade.html`, gerados de docs/legal). Quem já usa (app instalado, sessão salva, link de demo/e-mail) vai direto para `/app`.
- **Planos** (fonte única `js/data/planos.js`): Home — Grátis, Solteiro, Casal, Família; Business — Largada, Balcão, Expansão, Rede. 30 dias com o plano mais completo da linha; depois, grátis com limites. Contas existentes: **Home Família por cortesia** (backup em backups/bntt/2026-10-05-antes-planos).
- **Stripe (modo teste):** 6 produtos, 12 preços e 12 links de pagamento criados por `scripts/stripe-planos.mjs` (idempotente). O pagamento abre depois do cadastro já com a conta identificada. Ativação do plano: `supabase/functions/stripe-webhook` (pronto, precisa ser publicado) e `scripts/stripe-sincronizar.mjs` (funciona já).
- **Limites do plano no app:** lançamentos por mês, listas de compras, pessoas, unidades, fichas de saúde e importação — sempre com aviso "Disponível em outro plano", nunca erro seco.
- **BNTT Business:** vocabulário de empresa (Financeiro, Contas, Estoque, Equipe), **unidades (filiais)** com seletor no topo e campo no lançamento, **papéis** dono/gerente/funcionário/contador (regras também no banco: `supabase/business-2026-10.sql`).
- **Correções de causa raiz:** editar lançamento de outra pessoa trocava o "dono" do lançamento; criar duas unidades seguidas apagava o nome digitado; a varredura de segredos não conhecia o nome novo da chave do Stripe.

## Fase 13 (polimento) — checkpoint/polish
- **Símbolo novo do Palm:** folha de palmeira branca sobre o Verde Palm, no lugar do "B" do BNTT — logo da entrada e da barra lateral, favicon, ícone do app (Android adaptável e iPhone), selo das notificações. Mesmos caminhos de arquivo (dá para trocar por um logo profissional sem mexer em código). Versão dos ícones v=3 para os celulares atualizarem.
- Cor do tema do navegador/app instalado: Verde Palm `#126B5C`.
- Tela de entrada sem jargão técnico ("Supabase").
- `scripts/gerar-png.mjs`: regenera os PNG a partir de HTML/SVG.

## Fases 7, 11 e 12 (fluxos, QA, hardening) — checkpoint/qa
- **Fluxo A (adicionar despesa):** ao salvar, aviso "Despesa salva." com **Desfazer** (5 s) que apaga o lançamento de verdade — antes, salvar sem querer obrigava a procurar e excluir. Ícone de confirmação (não lixeira).
- **45 rótulos de formulário ligados aos campos** (`for`/`id`): leitor de tela e narração agora dizem "Valor (R$)" em vez de só "campo de edição"; tocar no rótulo foca o campo.
- Linguagem: "Fixa (todo mês)" / "Variável (muda)"; "Previsto" → "Esperado" (o nome que o cartão de saldo usa).
- **Segurança:** SRI (integridade) em Bootstrap, Bootstrap Icons e Alpine vindos do CDN; dependências sem vulnerabilidades (`npm audit`); cabeçalhos conferidos em produção (HSTS com preload, CSP, X-Frame-Options, nosniff, Permissions-Policy).
- **QA:** 129 unitários + 64 e2e no fonte + mesma suíte e2e no build de produção ofuscado (`npm run test:dist`); auditoria de telas sem problemas nas 5 larguras.

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
