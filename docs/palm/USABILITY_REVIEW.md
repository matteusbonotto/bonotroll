# REVISÃO DE USABILIDADE — personas × fluxos (375 px, evidência: telas reais do baseline)

## Percursos (na voz da persona)

- **Dona Lúcia — Fluxo E (tipo sanguíneo).** "Abri e tem um quadro azul com número vermelho. Não sei o que é saldo atual negativo. Onde fica a saúde? Não tem nada embaixo; os três tracinhos eu não sabia que era menu." → **Falhou**: não acha (menu escondido; e a informação não existe — P0).
- **Dona Lúcia — Fluxo A (despesa).** "Tem 'Nova despesa' grandão, ótimo. Abriu: escrevi 'Farmácia', o valor e salvei. Apareceu algo lá em cima e sumiu." → **Passou com dúvida** sobre o feedback.
- **Rafael — Fluxo B (consultar despesas).** "Transações? Cada gasto ocupa meia tela com campos de data. Rolei muito e cansei." → **Falhou por fadiga**: a lista é formulário, não lista.
- **Paula — Fluxo I (alerta).** "Contas a vencer mostra coisas que venceram há 40 dias com a mesma cara das outras. Não sei por onde começar; não existe 'o que precisa de mim'. E não consigo separar por loja." → **Falhou** (sem hierarquia de atenção; sem unidades — P1/P2).
- **Jéssica — Fluxo K/L (funcionária e permissão).** Não existe papel de funcionário: entrar no grupo dá acesso a tudo. → **Falhou** (modelo de dados — P1, fase 7 com migração).
- **Seu Antônio — leitura e toque.** Os chips "Assinaturas/Pendente" e as datas são pequenos; 293 alvos < 44 px em Transações. → **Falhou**.
- **Marcos — 20 segundos.** Início com 8 telas de altura, 3 gráficos antes da lista do que fazer. → **Falhou**.
- **Cláudia — Fluxo G (planilha).** Colar do Excel e validar funciona (entregue hoje). Falta uma visão tabela densa no desktop. → **Passou parcialmente**.
- **Fluxo F (notificações).** Switch diz "negado" sem dizer por quê nem como resolver. → **Falhou** (P0).

## Equipe de especialistas — consolidado

| Especialista | Pergunta | Veredito |
|---|---|---|
| Product Manager | Qual problema resolvemos? | "Ver o que está acontecendo e agir" — o Início mostra dados, não decisões |
| UX | O usuário sabe o que fazer? | Não na Início nem em Transações; sim no Novo lançamento |
| UI | Clara e consistente? | Azul do saldo × verde da marca; chips coloridos demais; cartões em excesso |
| Acessibilidade | Funciona com limitações? | Parcial; ver ACCESSIBILITY_REVIEW.md |
| Mobile UX | Uma mão, tela pequena? | Navegação no ☰ (topo), sem barra inferior; ações no topo |
| Arquitetura de informação | Lógico? | Nomes técnicos; Compras e Inventário separados mas são "Casa"; saúde perdida |
| Frontend | Suporta evolução? | Não sem quebrar o `index.html` monolítico em partes por área |
| QA / Automação | Fluxos protegidos? | Sim no demo; falta e2e por resolução e de acessibilidade |
| Segurança | Riscos? | P0 de grupo (migração pronta) e dados médicos precisam de proteção forte |
| Performance | Rápido? | Aceitável; Início renderiza 3 gráficos sempre |
| Copywriter | Linguagem clara? | "Saldo atual", "Esperado", "Caixinhas", "Entrada rápida" pedem explicação |
| Defensor do idoso | Sem treinamento? | Não |
| Dono de negócio | Ajuda quem administra? | Ajuda a casa; não atende empresa (sem unidades, papéis, fornecedores) |

## Problemas → causas → prioridades
Ver `UX_PROBLEMS.md`. Acréscimos desta fase: **Início sem hierarquia de atenção (P1)**, **lista de Transações como formulário (P1)**, **navegação escondida no topo (P1)**.
