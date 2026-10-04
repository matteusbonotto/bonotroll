// Aba Primeiros Socorros (pedido do usuário, 2026-10-04). Conteúdo estático,
// orientações gerais amplamente aceitas (Ministério da Saúde/SAMU/Cruz
// Vermelha) — NÃO substitui atendimento: todo tópico diz quando ligar 192.
// Texto curto, verbo no imperativo e passos numerados para ler com pressa.
// Os dados médicos da casa (alergias, remédios) entram numa etapa própria,
// já cifrados ponta a ponta — ver docs/CHECKLIST-REBRAND.md.

export const NUMEROS_EMERGENCIA = [
  { numero: '192', nome: 'SAMU', descricao: 'Emergência médica', icone: 'bi-heart-pulse-fill', destaque: true },
  { numero: '193', nome: 'Bombeiros', descricao: 'Fogo, resgate, afogamento', icone: 'bi-fire' },
  { numero: '190', nome: 'Polícia', descricao: 'Violência, perigo', icone: 'bi-shield-fill' },
  { numero: '08007226001', rotulo: '0800 722 6001', nome: 'Disque-Intoxicação', descricao: 'Envenenamento (Anvisa)', icone: 'bi-capsule' },
  { numero: '188', nome: 'CVV', descricao: 'Apoio emocional, 24h', icone: 'bi-chat-heart-fill' },
];

export const TOPICOS_PRIMEIROS_SOCORROS = [
  {
    id: 'parada',
    titulo: 'Pessoa não responde e não respira',
    icone: 'bi-heartbreak-fill',
    urgente: true,
    passos: [
      'Toque nos ombros e chame alto. Se não responder e não respirar normalmente, ligue 192 (viva-voz).',
      'Deite a pessoa de costas, no chão firme.',
      'Mãos uma sobre a outra no centro do peito; braços retos.',
      'Empurre forte e rápido: 5 cm de profundidade, 100 a 120 vezes por minuto (no ritmo de "Stayin\' Alive").',
      'Não pare até a ajuda chegar ou a pessoa reagir. Se houver desfibrilador (DEA), ligue e siga a voz dele.',
    ],
    naoFaca: ['Não perca tempo procurando pulso.', 'Não pare as compressões para dar água ou sacudir.'],
  },
  {
    id: 'engasgo',
    titulo: 'Engasgo',
    icone: 'bi-lungs-fill',
    urgente: true,
    passos: [
      'Se a pessoa tosse forte, incentive a tossir.',
      'Se não consegue falar, tossir ou respirar: fique atrás dela, abrace a cintura, punho fechado acima do umbigo.',
      'Puxe para dentro e para cima, com força, até o objeto sair (manobra de Heimlich).',
      'Bebê (menos de 1 ano): de bruços no seu antebraço, cabeça mais baixa, 5 tapas entre as costas; vire e faça 5 compressões com 2 dedos no centro do peito. Repita.',
      'Se a pessoa desmaiar, ligue 192 e comece as compressões no peito.',
    ],
    naoFaca: ['Não dê tapas nas costas de quem ainda tosse.', 'Não tente tirar o objeto com o dedo se não estiver vendo.'],
  },
  {
    id: 'sangramento',
    titulo: 'Corte e sangramento',
    icone: 'bi-droplet-fill',
    passos: [
      'Lave as mãos ou use luvas/saco plástico.',
      'Aperte o ferimento com pano limpo, sem parar, por 10 minutos.',
      'Se o pano encharcar, coloque outro por cima — não tire o primeiro.',
      'Corte pequeno: lave com água e sabão e cubra.',
      'Ligue 192 se o sangue jorrar, não parar em 10 minutos ou o corte for fundo.',
    ],
    naoFaca: ['Não use pó de café, pasta de dente ou açúcar no ferimento.', 'Não retire objeto encravado.'],
  },
  {
    id: 'queimadura',
    titulo: 'Queimadura',
    icone: 'bi-thermometer-high',
    passos: [
      'Afaste a pessoa do que queimou.',
      'Deixe água corrente fria (não gelada) sobre a queimadura por 20 minutos.',
      'Tire anéis, relógio e roupas que não estejam grudados.',
      'Cubra com pano limpo ou plástico filme, sem apertar.',
      'Ligue 192 se for grande, no rosto, mãos, genitais, em criança/idoso ou se a pele ficou branca ou preta.',
    ],
    naoFaca: ['Não passe manteiga, pasta de dente, óleo ou gelo.', 'Não estoure bolhas.'],
  },
  {
    id: 'intoxicacao',
    titulo: 'Envenenamento ou intoxicação',
    icone: 'bi-capsule',
    passos: [
      'Ligue já para o Disque-Intoxicação (0800 722 6001) ou 192.',
      'Separe a embalagem do produto ou remédio para dizer o que foi.',
      'Se caiu na pele ou nos olhos, lave com muita água por 15 minutos.',
      'Se a pessoa desmaiar ou não respirar, siga "Pessoa não responde e não respira".',
    ],
    naoFaca: ['Não provoque vômito.', 'Não dê leite, óleo ou "remédio caseiro".'],
  },
  {
    id: 'desmaio',
    titulo: 'Desmaio',
    icone: 'bi-person-down',
    passos: [
      'Deite a pessoa de costas e levante as pernas uns 30 cm.',
      'Afrouxe roupas apertadas e deixe o ar circular.',
      'Se não acordar em 1 minuto, ligue 192.',
      'Quando acordar, deixe deitada um pouco antes de levantar.',
    ],
    naoFaca: ['Não jogue água no rosto nem dê nada para beber enquanto estiver desacordada.'],
  },
  {
    id: 'convulsao',
    titulo: 'Convulsão',
    icone: 'bi-activity',
    passos: [
      'Afaste móveis e objetos para a pessoa não se machucar.',
      'Proteja a cabeça com algo macio.',
      'Marque o tempo. Quando parar, vire a pessoa de lado.',
      'Ligue 192 se durar mais de 5 minutos, for a primeira vez, a pessoa se machucar ou não acordar.',
    ],
    naoFaca: ['Não coloque nada na boca nem puxe a língua.', 'Não segure os movimentos.'],
  },
  {
    id: 'avc',
    titulo: 'Sinais de AVC (derrame)',
    icone: 'bi-person-exclamation',
    urgente: true,
    passos: [
      'Peça para SORRIR: um lado da boca cai?',
      'Peça para ABRAÇAR (levantar os dois braços): um braço cai?',
      'Peça para MÚSICA (repetir uma frase simples): fala enrolada?',
      'Qualquer sinal: ligue 192 na hora (URGENTE). Anote o horário em que começou.',
    ],
    naoFaca: ['Não dê remédio, comida ou água.', 'Não espere "passar".'],
  },
  {
    id: 'infarto',
    titulo: 'Sinais de infarto',
    icone: 'bi-heart-pulse',
    urgente: true,
    passos: [
      'Dor ou aperto no peito que pode ir para braço, costas, pescoço ou queixo; suor frio, falta de ar, enjoo.',
      'Ligue 192 imediatamente.',
      'Deixe a pessoa sentada e em repouso, afrouxe a roupa.',
      'Se ela parar de responder e de respirar, comece as compressões no peito.',
    ],
    naoFaca: ['Não deixe a pessoa ir sozinha ao hospital dirigindo.'],
  },
  {
    id: 'alergia',
    titulo: 'Alergia grave (anafilaxia)',
    icone: 'bi-flower1',
    urgente: true,
    passos: [
      'Sinais: inchaço no rosto/lábios/língua, falta de ar, manchas pelo corpo, tontura.',
      'Ligue 192.',
      'Se a pessoa tem caneta de adrenalina receitada, use na coxa conforme a bula.',
      'Com falta de ar, deixe sentada; se tonta, deitada com as pernas para cima.',
    ],
    naoFaca: ['Não espere melhorar sozinho.', 'Não dê nada pela boca se estiver com dificuldade de engolir.'],
  },
  {
    id: 'fratura',
    titulo: 'Queda, fratura ou torção',
    icone: 'bi-bandaid-fill',
    passos: [
      'Não mexa no lugar machucado.',
      'Imobilize como está, com papelão ou revista e pano, sem apertar.',
      'Gelo envolto em pano por 20 minutos ajuda no inchaço.',
      'Ligue 192 se houver osso aparente, deformidade, batida na cabeça ou dor nas costas/pescoço.',
    ],
    naoFaca: ['Não tente colocar o osso no lugar.', 'Não mova quem bateu a cabeça ou as costas.'],
  },
  {
    id: 'choque',
    titulo: 'Choque elétrico',
    icone: 'bi-lightning-charge-fill',
    passos: [
      'Desligue a energia no disjuntor antes de tocar na pessoa.',
      'Se não der, afaste o fio com algo seco que não conduz (cabo de vassoura de madeira).',
      'Ligue 192. Se não respirar, comece as compressões.',
    ],
    naoFaca: ['Não toque na pessoa enquanto ela estiver encostada na eletricidade.'],
  },
  {
    id: 'afogamento',
    titulo: 'Afogamento',
    icone: 'bi-water',
    passos: [
      'Peça ajuda e ligue 193. Jogue algo que boie — não entre na água se não for seguro.',
      'Fora da água: se não respirar, dê 5 respirações boca a boca e comece as compressões.',
      'Se respirar, deixe de lado e aquecida até a ajuda chegar.',
    ],
    naoFaca: ['Não tente tirar a água do estômago apertando a barriga.'],
  },
  {
    id: 'animais',
    titulo: 'Picada de cobra, escorpião ou aranha',
    icone: 'bi-bug-fill',
    passos: [
      'Lave o local com água e sabão.',
      'Deixe a pessoa deitada e calma, com o membro picado parado.',
      'Vá ao hospital ou ligue 192 — criança e idoso com urgência.',
      'Se possível, foto do animal (sem se arriscar).',
    ],
    naoFaca: ['Não faça torniquete, corte ou chupe o veneno.', 'Não passe nada no local.'],
  },
  {
    id: 'hipoglicemia',
    titulo: 'Açúcar baixo (hipoglicemia)',
    icone: 'bi-cup-straw',
    passos: [
      'Sinais: tremor, suor frio, confusão, fraqueza — comum em quem usa insulina.',
      'Se a pessoa estiver acordada e conseguir engolir: dê 1 colher de sopa de açúcar ou um copo de suco comum.',
      'Espere 15 minutos; se não melhorar, repita e ligue 192.',
    ],
    naoFaca: ['Não dê nada pela boca a quem está desmaiado — ligue 192.'],
  },
  {
    id: 'nariz',
    titulo: 'Sangramento no nariz',
    icone: 'bi-droplet-half',
    passos: [
      'Sente a pessoa com a cabeça levemente para FRENTE.',
      'Aperte a parte mole do nariz por 10 minutos, sem soltar.',
      'Ligue 192 se não parar em 20 minutos ou foi depois de uma pancada forte.',
    ],
    naoFaca: ['Não incline a cabeça para trás.'],
  },
];

// Busca sem acento e sem diferenciar maiúsculas.
function normalizar(texto) {
  return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function filtrarTopicos(topicos, termo) {
  const t = normalizar(termo).trim();
  if (!t) return topicos;
  return topicos.filter((tp) => normalizar([tp.titulo, ...tp.passos, ...tp.naoFaca].join(' ')).includes(t));
}
