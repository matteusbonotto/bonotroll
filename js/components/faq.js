// FAQ (TASK-037/038 — pedido explícito junto da reconstrução do onboarding):
// "um botão FAQ com todos os detalhes e soluções rápidas para dúvidas
// frequentes", separado do passo-a-passo guiado — sempre acessível, sem
// precisar reabrir/refazer o tour inteiro só pra tirar uma dúvida pontual.
//
// Store global (Alpine.store('faq'), registrado em app.js) pelo mesmo
// motivo de onboarding/txModal/etc: o ponto de abertura fica em mais de um
// lugar (ícone "?" na topbar, item em Perfil → Preferências) — um store é
// visível dos dois sem subir estado por props.
//
// Conteúdo baseado no que o produto REALMENTE faz (.claude/docs/
// business-rules.md e CLAUDE.md) — linguagem sempre conceitual/de
// benefício, nunca jargão técnico (RLS, Supabase, PWA etc.), mesma diretriz
// do onboarding: quem lê aqui é o usuário final, não outro desenvolvedor.
export function faqStore() {
  return {
    aberto: false,
    abertaId: null, // id da pergunta expandida (accordion simples, sem lib — só um id de cada vez)

    perguntas: [
      {
        id: 'o-que-e',
        pergunta: 'O que é o Bõnotto e pra quem é?',
        resposta:
          'É o app doméstico de vocês dois pra três coisas que normalmente vivem espalhadas em apps separados: controle financeiro (o que entra, o que sai, quem deve o quê), lista de compras do mercado, e um inventário do que tem em casa (despensa, banheiro etc.). Foi feito sob medida pra duas pessoas — não é um produto pra qualquer família ou empresa usar.',
      },
      {
        id: 'meus-dados',
        pergunta: 'Meus dados são só meus? Meu par vê tudo?',
        resposta:
          'Cada lançamento, item ou caixinha pertence sempre a UMA pessoa (quem criou). Se vocês dois estiverem no mesmo Grupo (tela "Grupo"), o que é do grupo aparece pros dois — é assim que a divisão de despesa e o "Entre vocês" funcionam. Fora de um grupo, o que você cadastra fica só com você; ninguém mais consegue ver ou editar, nem sabendo seu e-mail.',
      },
      {
        id: 'modo-demo',
        pergunta: 'Como funciona o modo demonstração (?demo=1)? É apagado quando eu saio?',
        resposta:
          'O modo demonstração usa dados de exemplo guardados só neste navegador (não manda nada pra nenhum servidor) — é pra conhecer o app sem precisar criar conta. Fechar a aba ou sair do site não apaga nada sozinho: os dados de exemplo continuam aqui até você mesmo escolher "Restaurar dados de exemplo" (volta ao ponto inicial) ou "Sair do modo demonstração" (Perfil → Preferências) pra usar uma conta de verdade.',
      },
      {
        id: 'dividir-despesa',
        pergunta: 'Como divido uma despesa com meu par?',
        resposta:
          'Ao cadastrar (ou editar) um lançamento, abra "mostrar mais" e adicione quem mais participou daquela despesa — o valor se divide automaticamente em partes iguais entre quem você escolheu, e dá pra ajustar o valor ou o percentual de cada um na mão se não for igual. O app calcula sozinho, na tela "Grupo", o saldo líquido de quem deve quanto pra quem, somando todas as despesas divididas pagas.',
      },
      {
        id: 'cartao-credito',
        pergunta: 'Como funciona a fatura do cartão de crédito no app?',
        resposta:
          'Cada cartão é cadastrado uma vez (Perfil → Cartões de crédito) e fica ligado a um banco. Ao registrar uma compra no cartão, é só escolher qual cartão foi usado — o app junta automaticamente todas as compras daquele cartão no mesmo mês numa "fatura", pra você ver o total fechado em vez de cada compra solta. Isso nunca conta a mesma despesa duas vezes nem no saldo nem nos gráficos.',
      },
      {
        id: 'esqueci-marcar-pago',
        pergunta: 'O que acontece se eu esquecer de marcar uma despesa como paga?',
        resposta:
          'Nada se perde — ela simplesmente continua aparecendo como "a vencer" ou "vencida" (se a data já passou) em vez de "paga", tanto no Início quanto em Transações, até você marcar a data de pagamento. Só despesas PAGAS entram no saldo "quanto eu realmente tenho" e nas dívidas do "Entre vocês"; o que ainda não foi pago aparece à parte, em "Previsto", pra você não perder de vista o que falta.',
      },
      {
        id: 'lista-compras',
        pergunta: 'Como funciona a lista de compras (marcar item, encerrar compra)?',
        resposta:
          'A lista tem 3 fases: planejando (só montando o que precisa comprar), comprando (você já está no mercado, marcando cada item conforme coloca no carrinho e anotando o preço) e finalizada (quando você encerra a compra). Ao encerrar, o app pergunta se quer lançar o total como uma despesa no financeiro — se disser que sim, já cria o lançamento sozinho, sem precisar digitar de novo. Uma lista nova já começa automaticamente pra próxima ida ao mercado.',
      },
      {
        id: 'caixinhas',
        pergunta: 'Como funcionam as Caixinhas (moeda estrangeira, meta)?',
        resposta:
          'Uma caixinha é uma reserva separada — pode ser em reais ou em outra moeda (dólar, euro, algumas criptos). O saldo dela é sempre a soma do que você guardou menos o que retirou, nunca um número editável direto. Se você definir uma meta, uma barra de progresso mostra o quanto falta. Pra somar tudo num total só (Caixinhas → topo da tela), o app converte cada moeda pra real na cotação do momento — só pra mostrar esse total; o valor guardado na moeda original nunca muda.',
      },
      {
        id: 'notificacoes',
        pergunta: 'Onde vejo e gerencio minhas notificações?',
        resposta:
          'O sino no topo de qualquer tela mostra os avisos mais recentes (despesa a vencer/vencida, item de Recursos acabando ou vencendo, pagamento registrado por alguém do grupo) — clique nele pra abrir a lista e marcar como lida. Pra receber esses avisos mesmo com o app fechado (notificação push de verdade), ative em Perfil → Preferências → "Notificações push" (precisa de um navegador compatível).',
      },
    ],

    abrir() {
      this.abertaId = null;
      this.aberto = true;
    },
    fechar() {
      this.aberto = false;
    },
    alternar(id) {
      this.abertaId = this.abertaId === id ? null : id;
    },
  };
}
